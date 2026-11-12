import type { ISlide, ICanvasSlide } from '@/core/types/presentation';
import { ipcService } from '@/core/services/ipcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
// audit-ignore: orchestration service accessing feature store
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
// audit-ignore: orchestration service accessing feature store
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
// audit-ignore: orchestration service accessing feature store
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
// audit-ignore: orchestration service accessing feature audio service
import { audioService } from '@/features/presenter/services/AudioService';

/**
 * Service for high-level presentation orchestration, including navigation logic
 * across different app modes and projector window management.
 */
export const presentationService = {
  /**
   * Opens the projector window with current display settings.
   */
  async openProjector(): Promise<boolean> {
    if (!ipcService.isElectron()) return false;
    
    const settings = usePresenterStore.getState().settings;
    const displaySettings = settings.display;
    const stageSettings = settings.stage;

    await ipcService.invoke('open-projector', displaySettings);
    
    if (stageSettings?.enabled && displaySettings.stageDisplayId !== undefined) {
      await ipcService.invoke('open-stage', displaySettings);
    }
    
    return true;
  },

  /**
   * Closes the projector window and clears live states.
   */
  closeProjector() {
    LiveSyncService.clear();
    useBibleStore.setState({ projectorIsLive: false });
    usePresentationStore.getState().setLiveSlide(null);
    if (ipcService.isElectron()) {
      ipcService.invoke('close-projector').catch((err) => {
        console.error('[PresentationService] Failed to close projector:', err);
      });
      ipcService.invoke('close-stage').catch((err) => {
        console.error('[PresentationService] Failed to close stage:', err);
      });
    }
  },

  /**
 Unified navigation to the next item based on current app mode.
   */
  async navigateNext(appMode: 'scripture' | 'presentation' | 'hymns' | string, detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigateNext(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigateNext(detached, preferLiveAnchor);
    }
  },

  /**
 Unified navigation to the previous item based on current app mode.
   */
  async navigatePrev(appMode: 'scripture' | 'presentation' | 'hymns' | string, detached?: boolean, preferLiveAnchor?: boolean) {
    if (appMode === 'scripture') {
      useBibleStore.getState().navigatePrev(detached, preferLiveAnchor);
    } else {
      await usePresentationStore.getState().navigatePrev(detached, preferLiveAnchor);
    }
  },

  /**
   * Opens a global modal.
   */
  openGlobalModal(type: ModalType) {
    useModalStore.getState().openModal(type);
  },

  /**
   * Checks whether there is active live media (video, audio, or timer).
   */
  hasLiveMedia(): boolean {
    const { liveSlideId, activePresentation, selectedPresentation, nestedPresentationsCache } = usePresentationStore.getState();

    // Check AudioService
    if (audioService.targetScopeId || audioService.activeTracks.size > 0) {
      return true;
    }

    if (!liveSlideId) return false;

    // Check if live slide is a video or timer
    let liveSlide: ISlide | undefined = activePresentation?.slides.find((s) => s.id === liveSlideId);
    if (!liveSlide) {
      liveSlide = selectedPresentation?.slides.find((s) => s.id === liveSlideId);
    }
    if (!liveSlide && nestedPresentationsCache) {
      for (const p of Object.values(nestedPresentationsCache)) {
        const s = p.slides.find((sl) => sl.id === liveSlideId);
        if (s) { liveSlide = s; break; }
      }
    }

    if (liveSlide) {
      if (liveSlide.type === 'video' || liveSlide.type === 'timer' || ('timerSettings' in liveSlide && Boolean((liveSlide as ICanvasSlide).timerSettings))) {
        return true;
      }
    } else {
      // If liveSlideId is present, assume potential live media
      return true;
    }

    return false;
  },

  /**
   * Toggles playback (play/pause) of the active live media (video, audio, or timer).
   * Returns true if a live media command was dispatched, false otherwise.
   */
  toggleLiveMedia(): boolean {
    const { liveSlideId, activePresentation, selectedPresentation, nestedPresentationsCache } = usePresentationStore.getState();

    // 1. Audio track active in AudioService
    const activeAudioScopeId = audioService.targetScopeId;
    if (activeAudioScopeId) {
      const progress = audioService.getTrackProgress(activeAudioScopeId);
      if (progress?.isPlaying) {
        audioService.pauseTrack(activeAudioScopeId);
        LiveSyncService.sendAudioCommand(activeAudioScopeId, 'pause');
      } else {
        audioService.playTrack(activeAudioScopeId);
        LiveSyncService.sendAudioCommand(activeAudioScopeId, 'play');
      }
      return true;
    }

    // 2. Live slide exists
    if (liveSlideId) {
      let liveSlide: ISlide | undefined = activePresentation?.slides.find((s) => s.id === liveSlideId);
      if (!liveSlide) {
        liveSlide = selectedPresentation?.slides.find((s) => s.id === liveSlideId);
      }
      if (!liveSlide && nestedPresentationsCache) {
        for (const p of Object.values(nestedPresentationsCache)) {
          const s = p.slides.find((sl) => sl.id === liveSlideId);
          if (s) { liveSlide = s; break; }
        }
      }

      // A. Timer slide
      if (liveSlide?.type === 'timer' || (liveSlide && 'timerSettings' in liveSlide && Boolean((liveSlide as ICanvasSlide).timerSettings))) {
        LiveSyncService.sendTimerCommand(liveSlideId, 'toggle');
        return true;
      }

      // B. Video slide (or slide not yet resolved)
      if (liveSlide?.type === 'video' || (!liveSlide && liveSlideId)) {
        LiveSyncService.sendVideoCommand(liveSlideId, 'toggle');
        return true;
      }

      // C. Active tracks in AudioService
      const firstActiveScopeId = Array.from(audioService.activeTracks.keys())[0] as string | undefined;
      if (firstActiveScopeId) {
        const progress = audioService.getTrackProgress(firstActiveScopeId);
        if (progress?.isPlaying) {
          audioService.pauseTrack(firstActiveScopeId);
          LiveSyncService.sendAudioCommand(firstActiveScopeId, 'pause');
        } else {
          audioService.playTrack(firstActiveScopeId);
          LiveSyncService.sendAudioCommand(firstActiveScopeId, 'play');
        }
        return true;
      }
    }

    // 3. Fallback: Any track in AudioService
    const fallbackScopeId = Array.from(audioService.activeTracks.keys())[0] as string | undefined;
    if (fallbackScopeId) {
      const progress = audioService.getTrackProgress(fallbackScopeId);
      if (progress?.isPlaying) {
        audioService.pauseTrack(fallbackScopeId);
        LiveSyncService.sendAudioCommand(fallbackScopeId, 'pause');
      } else {
        audioService.playTrack(fallbackScopeId);
        LiveSyncService.sendAudioCommand(fallbackScopeId, 'play');
      }
      return true;
    }

    return false;
  }
};

/** @deprecated Use presentationService instead. */
export const PresentationService = presentationService;
