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
   * In 'auto' mode, prioritizes an active live video/timer slide over background audio.
   * Supports explicit targeting ('video' | 'audio' | 'all') and optional forceAction ('play' | 'pause').
   */
  toggleLiveMedia(
    target: 'auto' | 'video' | 'audio' | 'all' = 'auto',
    forceAction?: 'play' | 'pause'
  ): boolean {
    const { liveSlideId, activePresentation, selectedPresentation, nestedPresentationsCache } = usePresentationStore.getState();

    const resolveLiveSlide = (): ISlide | undefined => {
      if (!liveSlideId) return undefined;
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
      return liveSlide;
    };

    const toggleAudioTrack = (): boolean => {
      const scopeId = audioService.targetScopeId || (Array.from(audioService.activeTracks.keys())[0] as string | undefined);
      if (!scopeId) return false;
      const progress = audioService.getTrackProgress(scopeId);
      const shouldPause = forceAction ? forceAction === 'pause' : Boolean(progress?.isPlaying);
      if (shouldPause) {
        audioService.pauseTrack(scopeId);
        LiveSyncService.sendAudioCommand(scopeId, 'pause');
      } else {
        audioService.playTrack(scopeId);
        LiveSyncService.sendAudioCommand(scopeId, 'play');
      }
      return true;
    };

    const toggleVideoOrTimer = (): boolean => {
      if (!liveSlideId) return false;
      const liveSlide = resolveLiveSlide();

      if (liveSlide?.type === 'timer' || (liveSlide && 'timerSettings' in liveSlide && Boolean((liveSlide as ICanvasSlide).timerSettings))) {
        const timerAction = forceAction === 'play' ? 'resume' : (forceAction || 'toggle');
        LiveSyncService.sendTimerCommand(liveSlideId, timerAction);
        return true;
      }

      if (liveSlide?.type === 'video' || (!liveSlide && liveSlideId)) {
        LiveSyncService.sendVideoCommand(liveSlideId, forceAction || 'toggle');
        return true;
      }

      return false;
    };

    if (target === 'video') {
      return toggleVideoOrTimer();
    }

    if (target === 'audio') {
      return toggleAudioTrack();
    }

    if (target === 'all') {
      const videoHandled = toggleVideoOrTimer();
      const audioHandled = toggleAudioTrack();
      return videoHandled || audioHandled;
    }

    // 'auto' mode: prioritize live video/timer slide on screen over background audio
    if (toggleVideoOrTimer()) {
      return true;
    }

    return toggleAudioTrack();
  }
};

/** @deprecated Use presentationService instead. */
export const PresentationService = presentationService;
