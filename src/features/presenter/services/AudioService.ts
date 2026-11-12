import { IAudioScope, ISlide } from '@/core/types';
import { AudioBufferLoader } from '../utils/audio/AudioBufferLoader';
import { IActiveTrack, WindowWithWebkit } from './audio/types';
import { rampGain, cleanupMediaElement, fadeOutTrack } from './audio/AudioFadeUtils';
import { findActiveScope } from './audio/AudioScopeResolver';
import {
    getTrackProgress,
    pauseTrack,
    setTrackVolume,
    seekBufferSourceTrack
} from './audio/AudioPlaybackController';

export { type IActiveTrack } from './audio/types';

class AudioService {
    private static instance: AudioService;
    private audioContext: AudioContext | null = null;
    public targetScopeId: string | null = null;

    // Playback state
    public activeTracks: Map<string, IActiveTrack> = new Map();

    // Timer management for delayed tracks
    private pendingDelays: Map<string, NodeJS.Timeout> = new Map();
    private syncingScopeId: string | null = null;

    private constructor() { }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService();
        }
        return AudioService.instance;
    }

    private get loader() {
        return AudioBufferLoader.getInstance();
    }

    private async ensureContext() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('AudioContext is not supported in this environment');
            }
            this.audioContext = new AudioContextClass();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(e => console.warn('🔊 [AudioService] Failed to resume context:', e));
        }
        return this.audioContext;
    }

    /**
     * Resumes the audio context manually (e.g. on user interaction).
     */
    public async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(e => console.warn('🔊 [AudioService] Failed manual resume:', e));
        }
    }

    public async getWaveform(fileId: string, samples: number = 100): Promise<number[] | null> {
        const ctx = await this.ensureContext();
        return this.loader.getWaveform(fileId, samples, ctx);
    }

    public async sync(
        liveSlideId: string | null,
        slides: ISlide[],
        presentationScopes: IAudioScope[],
        parentSlideId?: string | null,
        parentSlides?: ISlide[],
        parentScopes?: IAudioScope[]
    ) {
        if (!this.audioContext) {
            await this.ensureContext();
        }

        if (!liveSlideId) {
            this.targetScopeId = null;
            this.stopAll(0.5);
            return;
        }

        // 1. Try to find scope in current presentation (nested)
        let activeScope = await findActiveScope(liveSlideId, slides, presentationScopes, this.activeTracks);

        // 2. Fallback: If nested and no local scope, try to find scope in parent presentation
        if (!activeScope && parentSlideId && parentSlides && parentSlides.length > 0) {
            activeScope = await findActiveScope(parentSlideId, parentSlides, parentScopes, this.activeTracks);
        }

        if (!activeScope) {
            this.targetScopeId = null;
            this.clearPendingDelays();
            this.stopAll(1.0);
            return;
        }

        const currentTrack = this.activeTracks.get(activeScope.id);
        const hasPendingDelay = this.pendingDelays.has(activeScope.id);

        this.targetScopeId = activeScope.id;

        // If we switched to a NEW scope (or no scope), clear all other delays
        this.clearPendingDelays(activeScope.id);

        if (currentTrack) {
            if (this.audioContext) {
                const now = this.audioContext.currentTime;
                const volumeChanged = currentTrack.scope.volume !== activeScope.volume;
                const muteChanged = currentTrack.scope.isMuted !== activeScope.isMuted;

                if (volumeChanged || muteChanged) {
                    const targetVolume = activeScope.isMuted ? 0.001 : (activeScope.volume ?? 1);
                    const fadeDuration = activeScope.volumeFadeDuration ?? 0.1;

                    rampGain(currentTrack.gain, targetVolume, now, fadeDuration);

                    currentTrack.scope.volume = activeScope.volume;
                    currentTrack.scope.isMuted = activeScope.isMuted;
                }
            }
            return;
        }

        // Concurrency Guard: Don't start the same scope multiple times in parallel
        if (this.syncingScopeId === activeScope.id) {
            return;
        }

        // Handle Strategy for NEW scope
        const strategy = activeScope.strategy || 'auto';

        try {
            this.syncingScopeId = activeScope.id;

            if (strategy === 'manual') {
                await this.playScope(activeScope, { startPaused: true });
            } else if (strategy === 'delay') {
                if (hasPendingDelay) return; // Already waiting

                const delaySec = activeScope.delaySeconds || 1;

                const timer = setTimeout(() => {
                    this.pendingDelays.delete(activeScope.id);
                    this.playScope(activeScope);
                }, delaySec * 1000);

                this.pendingDelays.set(activeScope.id, timer);
            } else {
                // Default: Auto-play
                await this.playScope(activeScope);
            }
        } finally {
            if (this.syncingScopeId === activeScope.id) {
                this.syncingScopeId = null;
            }
        }
    }

    private clearPendingDelays(exceptScopeId?: string) {
        if (exceptScopeId) {
            for (const [id, timer] of this.pendingDelays.entries()) {
                if (id !== exceptScopeId) {
                    clearTimeout(timer);
                    this.pendingDelays.delete(id);
                }
            }
        } else {
            this.pendingDelays.forEach(clearTimeout);
            this.pendingDelays.clear();
        }
    }

    public async playScope(scope: IAudioScope, options?: { startPaused?: boolean }): Promise<{ duration: number; startTime: number } | null> {
        if (!scope?.fileId) return null;

        const ctx = await this.ensureContext();
        const resolvedUrl = await this.loader.resolveEffectiveUrl(scope.fileId);
        if (!resolvedUrl) return null;

        // Check duration FIRST with a metadata probe to avoid fetching whole file if streaming
        const cachedBuffer = this.loader.bufferCache.get(resolvedUrl);
        let duration = cachedBuffer ? cachedBuffer.duration : 0;
        let isLongFile = false;

        if (!cachedBuffer) {
            duration = await this.loader.getDuration(scope.fileId);
            if (duration > 300) {
                isLongFile = true;
            }
        }

        // If this scope is already present, do NOT reset its start time or override pause state
        const existingTrack = this.activeTracks.get(scope.id);
        if (existingTrack && existingTrack.scope.fileId === scope.fileId) {
            existingTrack.scope = { ...scope };
            const currentDuration = (existingTrack.source instanceof AudioBufferSourceNode && existingTrack.source.buffer)
                ? existingTrack.source.buffer.duration
                : (existingTrack.mediaElement?.duration || 0);
            return { duration: currentDuration, startTime: existingTrack.startTime };
        }

        // Determine if we need to load/decode or stream
        let buffer: AudioBuffer | null = null;
        let audio: HTMLAudioElement | undefined;

        if (isLongFile) {
            audio = new Audio(resolvedUrl);
            audio.crossOrigin = 'anonymous';
        } else {
            buffer = await this.loader.loadAudio(scope.fileId, ctx);
            if (!buffer) {
                audio = new Audio(resolvedUrl);
                audio.crossOrigin = 'anonymous';
                if (duration === 0) {
                    duration = await this.loader.getDuration(scope.fileId);
                }
            } else {
                duration = buffer.duration;
            }
        }

        const now = ctx.currentTime;
        const fadeInTime = Math.max(0.01, scope.crossfadeSettings?.fadeInDuration ?? 1.0);
        const fadeOutTime = Math.max(0.01, scope.crossfadeSettings?.fadeOutDuration ?? 1.0);

        // Fade and cleanup previous tracks to prevent overlapping
        const idsToFadeOut = Array.from(this.activeTracks.keys());
        const tracksToFadeOut = idsToFadeOut.map(id => ({ id, track: this.activeTracks.get(id)! }));
        idsToFadeOut.forEach(id => this.activeTracks.delete(id));

        tracksToFadeOut.forEach(({ track }) => {
            fadeOutTrack(track, now, fadeOutTime);
        });

        const offset = scope.trimStart || 0;
        let source: AudioBufferSourceNode | MediaElementAudioSourceNode;

        if (audio) {
            audio.loop = false;
            audio.currentTime = offset;
            source = ctx.createMediaElementSource(audio);

            const trimEnd = scope.trimEnd || 0;
            const onTimeUpdate = () => {
                if (trimEnd > 0 && audio.currentTime >= trimEnd - 0.05) {
                    if (scope.loop) {
                        audio.currentTime = offset;
                        audio.play().catch(() => {});
                    } else {
                        audio.pause();
                        audio.currentTime = trimEnd;
                    }
                }
            };
            audio.addEventListener('timeupdate', onTimeUpdate);

            if (!options?.startPaused) {
                audio.play().catch(e => console.error('AudioService: Playback failed', e));
            }
        } else {
            const bufSource = ctx.createBufferSource();
            if (buffer) {
                bufSource.buffer = buffer;

                if (scope.loop) {
                    bufSource.loop = true;
                    bufSource.loopStart = offset;
                    bufSource.loopEnd = scope.trimEnd || buffer.duration;
                } else {
                    bufSource.loop = false;
                }

                source = bufSource;
                const playDuration = (scope.trimEnd && scope.trimEnd > offset) ? (scope.trimEnd - offset) : buffer.duration - offset;

                if (!options?.startPaused) {
                    bufSource.start(now, offset, scope.loop ? undefined : Math.max(0, playDuration));
                }
            } else {
                source = bufSource;
            }
        }

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.001, now);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const targetVolume = scope.isMuted ? 0.001 : (scope.volume ?? 1);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVolume), now + fadeInTime);

        const onEnded = () => {
            const currentTrack = this.activeTracks.get(scope.id);
            if (currentTrack?.suppressEndedCleanup) return;
            if (scope.onEnded) scope.onEnded();
            if (currentTrack?.source === source) {
                this.activeTracks.delete(scope.id);
            }
            if (audio) {
                cleanupMediaElement(audio);
            }
        };

        if (source instanceof AudioBufferSourceNode) {
            source.onended = onEnded;
        } else if (audio) {
            audio.onended = onEnded;
        }

        const finalDuration = (scope.trimEnd && scope.trimEnd > offset) ? (scope.trimEnd - offset) : duration - offset;
        this.activeTracks.set(scope.id, {
            source,
            gain: gainNode,
            scope: { ...scope },
            mediaElement: audio,
            startTime: now,
            startOffset: offset,
            isPaused: options?.startPaused || false
        });

        return { duration: finalDuration, startTime: now };
    }

    public stopScope(scopeId: string, fadeDuration: number) {
        const track = this.activeTracks.get(scopeId);
        if (!track || !this.audioContext) return;

        this.activeTracks.delete(scopeId);
        fadeOutTrack(track, this.audioContext.currentTime, fadeDuration);
    }

    public stopAll(fadeDuration: number) {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;
        const tracksToStop = Array.from(this.activeTracks.values());
        this.activeTracks.clear();
        this.clearPendingDelays();

        tracksToStop.forEach(track => {
            fadeOutTrack(track, now, fadeDuration);
        });
    }

    public getTrackProgress(scopeId: string): { currentTime: number; duration: number; isPlaying: boolean } | null {
        return getTrackProgress(this.activeTracks.get(scopeId), this.audioContext);
    }

    public isPlaying(scopeId: string): boolean {
        return this.getTrackProgress(scopeId)?.isPlaying ?? false;
    }

    public getPosition(scopeId: string): { currentTime: number; duration: number } {
        const progress = this.getTrackProgress(scopeId);
        return {
            currentTime: progress?.currentTime ?? 0,
            duration: progress?.duration ?? 0
        };
    }

    public getFileId(scopeId: string): string | undefined {
        return this.activeTracks.get(scopeId)?.scope?.fileId;
    }

    public playTrack(scopeId: string) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;

        if (track.mediaElement) {
            track.mediaElement.play().catch(() => {});
            track.isPaused = false;
        } else if (track.isPaused) {
            track.suppressEndedCleanup = true;
            try { track.source.disconnect(); } catch (_) {}
            this.activeTracks.delete(scopeId);
            this.playScope({ ...track.scope, trimStart: track.startOffset });
        }
    }

    public pauseTrack(scopeId: string) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;
        pauseTrack(track, this.audioContext);
    }

    public seekTrack(scopeId: string, time: number) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;

        if (track.mediaElement) {
            track.mediaElement.currentTime = time;
            track.startOffset = time;
        } else if (this.audioContext) {
            seekBufferSourceTrack(track, time, this.audioContext, () => {
                const current = this.activeTracks.get(scopeId);
                if (current?.suppressEndedCleanup) return;
                if (track.scope.onEnded) track.scope.onEnded();
                if (current?.source === track.source) {
                    this.activeTracks.delete(scopeId);
                }
            });
        }
    }

    public setTrackVolume(scopeId: string, volume: number) {
        const track = this.activeTracks.get(scopeId);
        if (!track) return;
        setTrackVolume(track, volume, this.audioContext);
    }

    /**
     * Ducker: smoothly lowers volume of all active background tracks when a video with audio is playing,
     * and restores original volume when video stops or pauses.
     */
    public setDucking(isDucked: boolean) {
        this.activeTracks.forEach(track => {
            if (track.gain && this.audioContext) {
                const baseVolume = track.scope.volume ?? 1;
                const targetVolume = isDucked ? baseVolume * 0.15 : baseVolume;
                rampGain(track.gain, targetVolume, this.audioContext.currentTime, 0.4);
            }
        });
    }

    public dispose() {
        this.stopAll(0);

        this.loader.blobUrlCache.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (_) {}
        });

        this.loader.blobUrlCache.clear();
        this.loader.bufferCache.clear();
        this.loader.waveformCache.clear();
        this.loader.durationCache.clear();
    }
}

export const audioService = AudioService.getInstance();
