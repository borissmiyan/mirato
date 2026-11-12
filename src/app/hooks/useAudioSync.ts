import { useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { audioService } from '@/features/presenter/services/AudioService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { useAudioSyncData } from './useAudioSyncData';

/**
 * Hook to synchronize audio state with the current live slide and presentation.
 * This hook runs in both Controller and Projector windows with different roles.
 */
export function useAudioSync(isProjector: boolean = false) {
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const rootPresentationId = usePresentationStore(s => s.liveRootPresentationId);
    const navigationParentSlideId = usePresentationStore(s => s.liveNavigationParentSlideId);
    const navigationParentPresentationId = usePresentationStore(s => s.liveNavigationParentPresentationId);

    // 1. DATA SOURCE (Both windows) — Watch DB for slides and audio scopes
    const audioData = useAudioSyncData(
        activePresentationId,
        rootPresentationId,
        navigationParentSlideId,
        navigationParentPresentationId,
        liveSlideId
    );

    // Safety: Stop all audio if presentation is closed (Both windows, but primarily projector)
    useEffect(() => {
        if (!activePresentationId) {
            const timer = setTimeout(() => {
                if (!activePresentationId) audioService.stopAll(1.0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [activePresentationId]);

    // Auto-duck background audio when live video is playing
    useEffect(() => {
        if (isProjector) return;

        const unsub = LiveSyncService.onVideoStatus(({ isPlaying }) => {
            audioService.setDucking(isPlaying);
        });

        return () => {
            unsub();
            audioService.setDucking(false);
        };
    }, [isProjector]);

    // 2. Controller: Perform the actual service sync using local DB data (Source of Truth)
    useEffect(() => {
        if (isProjector || !audioData) return;

        if (audioData.slides.length === 0) {
            if (!activePresentationId) {
                audioService.stopAll(1.0);
            }
            return;
        }
        
        audioService.resume();

        if (navigationParentSlideId && audioData.nestedSlides.length > 0) {
            audioService.sync(
                liveSlideId,
                audioData.nestedSlides,
                audioData.nestedScopes,
                navigationParentSlideId,
                audioData.parentSlides,
                audioData.parentScopes
            );
        } else {
            audioService.sync(
                liveSlideId, 
                audioData.slides, 
                audioData.scopes,
                navigationParentSlideId,
                audioData.rootSlides,
                audioData.rootScopes
            );
        }
    }, [isProjector, liveSlideId, audioData, activePresentationId, rootPresentationId, navigationParentSlideId]);

    // 3. Audio Heartbeat — broadcast status to toolbar/remote
    useEffect(() => {
        if (isProjector) return;

        const interval = setInterval(() => {
            const activeId = audioService.targetScopeId;
            if (activeId) {
                const progress = audioService.getTrackProgress(activeId);
                const track = audioService.activeTracks.get(activeId);
                if (progress && track) {
                    LiveSyncService.sendAudioStatus(
                        activeId,
                        progress.currentTime,
                        progress.isPlaying,
                        progress.duration,
                        track.scope.fileId,
                        track.scope.fileName
                    );
                }
            } else {
                const firstTrackId = Array.from(audioService.activeTracks.keys())[0];
                if (!firstTrackId) {
                    LiveSyncService.sendAudioStatus('', 0, false, 0, '');
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isProjector]);

    // 4. Audio Command Relay — handle commands from remote
    useEffect(() => {
        if (isProjector) return;

        const unsub = LiveSyncService.onAudioCommand(({ scopeId, command, value }) => {
            const targetId = scopeId || audioService.targetScopeId;
            
            if (command === 'request-status') {
                const actualId = targetId || Array.from(audioService.activeTracks.keys())[0];
                if (actualId) {
                    const progress = audioService.getTrackProgress(actualId);
                    const track = audioService.activeTracks.get(actualId);
                    if (progress && track) {
                        LiveSyncService.sendAudioStatus(actualId, progress.currentTime, progress.isPlaying, progress.duration, track.scope.fileId);
                    }
                }
                return;
            }

            if (!targetId) return;

            switch (command) {
                case 'play': audioService.playTrack(targetId); break;
                case 'pause': audioService.pauseTrack(targetId); break;
                case 'toggle': {
                    const progress = audioService.getTrackProgress(targetId);
                    if (progress?.isPlaying) audioService.pauseTrack(targetId);
                    else audioService.playTrack(targetId);
                    break;
                }
                case 'seek': 
                    if (typeof value === 'number') audioService.seekTrack(targetId, value);
                    break;
            }
        });
        return () => unsub();
    }, [isProjector]);
}
