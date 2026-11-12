import { useState, useEffect, useRef, useCallback } from 'react';
import { ITimerSettings, ITimerAction, ITimerTrigger } from '@/core/types/timer';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { audioService } from '@/features/presenter/services/AudioService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/ipcService';
import { playSynthesizedTone } from '../utils/timerAudioSynthesizer';

export const useTimerCore = (id: string, settings: ITimerSettings, isLive: boolean, isProjector: boolean = false, isPreloading: boolean = false) => {
    const [timeLeft, setTimeLeft] = useState(settings.duration);
    const [isPaused, setIsPaused] = useState(false);
    const [showFlash, setShowFlash] = useState(false);
    const keyResolvers = useRef<Map<string, (key: string) => void>>(new Map());
    const firedTriggers = useRef<Set<string>>(new Set());
    const settingsRef = useRef(settings);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        // Always reset timer state when the slide ID changes
        setTimeLeft(settings.duration);
        setIsPaused(false);
        firedTriggers.current.clear();
    }, [id, settings.duration]);

    useEffect(() => {
        // Keep preview in sync when duration changes
        if (!isLive) {
            setTimeLeft(settings.duration);
            setIsPaused(false);
            firedTriggers.current.clear();
        }
    }, [settings.duration, isLive]);

    // Listen for remote timer commands
    useEffect(() => {
        if (!isLive) return;

        const unsub = LiveSyncService.onTimerCommand(({ slideId, command }) => {
            if (slideId !== id) return;

            if (command === 'pause') setIsPaused(true);
            else if (command === 'resume') setIsPaused(false);
            else if (command === 'toggle') setIsPaused(prev => !prev);
        });

        return unsub;
    }, [id, isLive]);

    const runSequence = useCallback(async (actions: ITimerAction[]) => {
        // Only the master window (projector in electron, or main window in web) executes actions
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;

        for (const action of actions) {
            // Sequence Halt: Wait
            if (action.type === 'wait') {
                const duration = (action.payload.duration || 0) * 1000;
                if (duration > 0) {
                    await new Promise(resolve => setTimeout(resolve, duration));
                }
                continue;
            }

            // Sequence Halt: Key Halt
            if (action.type === 'key_halt') {
                const targetKey = action.payload.key || 'Enter';
                await new Promise<void>(resolve => {
                    const id = crypto.randomUUID();
                    keyResolvers.current.set(id, (pressedKey) => {
                        if (pressedKey.toLowerCase() === targetKey.toLowerCase()) {
                            keyResolvers.current.delete(id);
                            resolve();
                        }
                    });
                });
                continue;
            }

            if (action.type === 'next_slide') {
                LiveSyncService.sendTimerAction('next_slide');
                await new Promise(resolve => setTimeout(resolve, 100));
            } else if (action.type === 'prev_slide') {
                LiveSyncService.sendTimerAction('prev_slide');
                await new Promise(resolve => setTimeout(resolve, 100));
            } else if (action.type === 'navigate_to' && action.payload?.slideId) {
                LiveSyncService.sendTimerAction('navigate_to', { slideId: action.payload.slideId });
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Standard Actions
            switch (action.type) {
                case 'apply_override':
                    LiveSyncService.sendTimerAction('override', action.payload?.override || 'blackout');
                    break;
                case 'close_override':
                    LiveSyncService.sendTimerAction('override', null);
                    break;
                case 'blackout':
                    LiveSyncService.sendTimerAction('override', 'blackout');
                    break;
                case 'play_sound':
                    const soundId = action.payload.soundId || 'ring_default';
                    const mediaId = action.payload.mediaId;

                    if (mediaId) {
                        // Play User Media from Library
                        audioService.playScope({
                            id: `timer-audio-${id}-${action.id}`,
                            presentationId: '',
                            startSlideId: id,
                            endSlideId: id,
                            fileId: mediaId,
                            volume: action.payload?.volume ?? 1,
                            loop: false
                        });
                    } else {
                        playSynthesizedTone(soundId);
                    }
                    break;
                case 'flash':
                    setShowFlash(true);
                    setTimeout(() => setShowFlash(false), 500);
                    break;
                case 'change_bg':
                    if (action.payload?.background) {
                        usePresentationStore.getState().updateSlideBackground(id, action.payload.background);
                    }
                    break;
                case 'volume_fade':
                    audioService.stopAll(action.payload.duration ?? 0.5);
                    break;
            }
        }
    }, [id, isLive, isProjector, isPreloading]);

    const handleEndAction = useCallback(() => {
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;
        if (settingsRef.current.endAction === 'loop') {
            setTimeLeft(settingsRef.current.duration);
            firedTriggers.current.clear();
        } else if (settingsRef.current.endAction === 'next') {
            LiveSyncService.sendTimerAction('next_slide');
        }
    }, [isLive, isProjector, isPreloading]);

    useEffect(() => {
        if (!isLive || isPreloading) return;

        const interval = setInterval(() => {
            if (isPaused) return;

            const currentSettings = settingsRef.current;

            setTimeLeft(prev => {
                const remaining = Math.max(0, prev - 1);

                // Triggers logic moved inside here to stay in sync with actual ticks
                if (currentSettings.triggers) {
                    currentSettings.triggers.forEach(trigger => {
                        let shouldFire = false;
                        const elapsedFromStart = currentSettings.duration - remaining;

                        const triggerType = trigger.type;

                        switch (triggerType) {
                            case 'on_start':
                            case 'start' as string:
                                if (elapsedFromStart <= 1) shouldFire = true;
                                break;
                            case 'on_end':
                            case 'finish' as string:
                                if (remaining === 0) shouldFire = true;
                                break;
                            case 'remaining':
                                if ('value' in trigger && remaining === trigger.value) shouldFire = true;
                                break;
                            case 'elapsed':
                                if ('value' in trigger && elapsedFromStart === trigger.value) shouldFire = true;
                                break;
                            case 'percentage':
                                if ('value' in trigger) {
                                    shouldFire = ((elapsedFromStart / currentSettings.duration) * 100) >= trigger.value;
                                }
                                break;
                        }

                        if (shouldFire && !firedTriggers.current.has(trigger.id)) {
                            firedTriggers.current.add(trigger.id);
                            runSequence(trigger.actions);
                        }
                    });
                }

                if (remaining === 0) {
                    clearInterval(interval);
                    // Minimal delay to allow audio synthesis to start before unmounting
                    setTimeout(() => {
                        handleEndAction();
                    }, 50);
                }

                return remaining;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isLive, id, isPreloading, isPaused, runSequence, handleEndAction]);

    // Keyboard sequence handling
    useEffect(() => {
        const isMaster = isProjector || !IpcService.isElectron();
        if (!isLive || !isMaster || isPreloading) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Resolve all key-halt promises that match this key
            keyResolvers.current.forEach(resolve => resolve(e.key));

            // Also check for direct keyboard triggers
            if (settingsRef.current.triggers) {
                settingsRef.current.triggers
                    .filter(t => t.type === 'on_keypress' && t.triggerValue === e.key)
                    .forEach(trigger => {
                        // Key triggers can fire multiple times, so we don't check firedTriggers.current
                        runSequence(trigger.actions);
                    });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLive, isProjector, isPreloading, runSequence]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    return {
        timeLeft,
        isPaused,
        showFlash,
        formatTime,
    };
};
