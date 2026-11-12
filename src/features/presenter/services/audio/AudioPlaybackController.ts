import { IAudioScope } from '@/core/types';
import { IActiveTrack } from './types';

/**
 * Calculates current playback progress for an active track.
 */
export function getTrackProgress(
    track: IActiveTrack | undefined,
    audioContext: AudioContext | null
): { currentTime: number; duration: number; isPlaying: boolean } | null {
    if (!track || !audioContext) return null;

    let currentTime = 0;
    let duration = 0;
    let isPlaying = false;

    if (track.mediaElement) {
        currentTime = track.mediaElement.currentTime;
        duration = track.scope.trimEnd || track.mediaElement.duration || 0;
        isPlaying = !track.mediaElement.paused;
    } else if (track.source instanceof AudioBufferSourceNode && track.source.buffer) {
        duration = track.scope.trimEnd || track.source.buffer.duration || 0;
        isPlaying = !track.isPaused;
        if (!track.isPaused) {
            const speed = (track.scope as IAudioScope & { speed?: number }).speed ?? 1.0;
            const elapsed = (audioContext.currentTime - track.startTime) * speed;
            currentTime = track.startOffset + elapsed;
        } else {
            currentTime = track.startOffset;
        }
    }

    return { currentTime, duration, isPlaying };
}

/**
 * Pauses an active track, recording its offset for subsequent resume.
 */
export function pauseTrack(track: IActiveTrack, audioContext: AudioContext | null): void {
    if (track.mediaElement) {
        track.mediaElement.pause();
        track.isPaused = true;
    } else {
        const progress = getTrackProgress(track, audioContext);
        if (progress) {
            track.startOffset = progress.currentTime;
            track.isPaused = true;
            track.suppressEndedCleanup = true;
            if (track.source instanceof AudioBufferSourceNode) {
                try { track.source.stop(); } catch (_) {}
                try { track.source.disconnect(); } catch (_) {}
            }
        }
    }
}

/**
 * Sets volume on an active track and updates gain ramp.
 */
export function setTrackVolume(track: IActiveTrack, volume: number, audioContext: AudioContext | null): void {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const clamped = Math.max(0.0001, Math.min(1, volume));
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(clamped, now);
    if (track.mediaElement) {
        track.mediaElement.volume = clamped;
    }
}

/**
 * Reconfigures a BufferSource track for a new seek position in-place.
 */
export function seekBufferSourceTrack(
    track: IActiveTrack,
    time: number,
    audioContext: AudioContext,
    onEndedCallback: () => void
): void {
    if (!(track.source instanceof AudioBufferSourceNode) || !track.source.buffer) {
        return;
    }
    const now = audioContext.currentTime;
    const buffer = track.source.buffer;

    // Suppress cleanup and detach old buffer source node
    track.suppressEndedCleanup = true;
    try { track.source.stop(); } catch (_) {}
    try { track.source.disconnect(); } catch (_) {}

    // Re-create buffer source node in-place on existing track without deleting activeTracks entry
    const newSource = audioContext.createBufferSource();
    newSource.buffer = buffer;
    newSource.loop = track.source.loop;
    if (newSource.loop) {
        newSource.loopStart = track.source.loopStart;
        newSource.loopEnd = track.source.loopEnd;
    }
    newSource.connect(track.gain);

    const offset = Math.max(0, Math.min(time, buffer.duration));
    const trimEnd = track.scope.trimEnd || buffer.duration;
    const playDuration = Math.max(0, trimEnd - offset);

    newSource.onended = onEndedCallback;

    track.suppressEndedCleanup = false;
    track.source = newSource;
    track.startTime = now;
    track.startOffset = offset;

    if (!track.isPaused) {
        newSource.start(now, offset, newSource.loop ? undefined : playDuration);
    }
}

