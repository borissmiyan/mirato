import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { 
  sidebarOpenAtom, 
  themeAccentAtom, 
  historyOpenAtom, 
  searchOpenAtom, 
  appModeAtom, 
  activeOverrideAtom, 
  liveLogoAtom, 
  slideDesignPanelOpenAtom, 
  isTimelineHoveredAtom, 
  selectedCanvasItemIdsAtom, 
  OverrideType 
} from '@/core/store/uiAtoms';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
// eslint-disable-next-line no-restricted-imports
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { ModalType } from '@/core/store/modalStore';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { BibleNavigationService } from '@/features/bible-browser/services/BibleNavigationService';
import { PresentationService } from '@/core/services/presentationService';
import { useAppInitialization } from './useAppInitialization';
import { useAudioSync } from './useAudioSync';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useControllerRemoteSync } from './useControllerRemoteSync';
import { useProjectorLifecycleSync } from './useProjectorLifecycleSync';
import { useProjectorToggle } from './useProjectorToggle';

/**
 * Custom hook to encapsulate the main controller logic, state management, 
 * and orchestration for the application.
 */
export function useControllerLogic() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  // --- UI Atoms ---
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [historyOpen, setHistoryOpen] = useAtom(historyOpenAtom);
  const [searchOpen, setSearchOpen] = useAtom(searchOpenAtom);
  const [appMode] = useAtom(appModeAtom);
  const [themeAccent] = useAtom(themeAccentAtom);
  const [designPanelOpen, setDesignPanelOpen] = useAtom(slideDesignPanelOpenAtom);
  const isTimelineHovered = useAtom(isTimelineHoveredAtom)[0];
  const selectedCanvasItemIds = useAtom(selectedCanvasItemIdsAtom)[0];
  const [activeOverride, setActiveOverride] = useAtom(activeOverrideAtom);
  const [activeLogo, setActiveLogo] = useAtom(liveLogoAtom);

  // --- Local State ---
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // --- Store Selectors ---
  const activeVerse = useBibleStore(s => s.activeVerse);
  const currentTranslationId = useBibleStore(s => s.currentTranslationId);
  const setActiveVerse = useBibleStore(s => s.setActiveVerse);
  const isMultiVerseMode = useBibleStore(s => s.isMultiVerseMode);
  const selectedVerses = useBibleStore(s => s.selectedVerses);
  const commitToProjector = useBibleStore(s => s.commitToProjector);
  const exitMultiVerseMode = useBibleStore(s => s.exitMultiVerseMode);
  const projectorIsLive = useBibleStore(s => s.projectorIsLive);

  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const activePresentation = usePresentationStore(s => s.activePresentation);
  const previewSlideId = usePresentationStore(s => s.previewSlideId);
  const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
  const undo = usePresentationStore(s => s.undo);
  const redo = usePresentationStore(s => s.redo);

  const presenterSettings = usePresenterStore(state => state.settings);
  const activeLogoUrl = useLogoUrl(activeLogo);

  // --- Global Initialization & Sync Hooks ---
  useAppInitialization(themeAccent);
  useAudioSync();

  // --- Bible Verse Previews ---
  const nextVersePreview = useLiveQuery(
    () => activeVerse ? BibleNavigationService.getNextVerse(activeVerse, currentTranslationId) : null,
    [activeVerse?.id, currentTranslationId]
  );

  const prevVersePreview = useLiveQuery(
    () => activeVerse ? BibleNavigationService.getPrevVerse(activeVerse, currentTranslationId) : null,
    [activeVerse?.id, currentTranslationId]
  );

  // --- Sync Effects ---
  useEffect(() => {
    const allLogos = [
      ...presenterSettings.logo.customLogos,
      ...presenterSettings.logo.customGroups.flatMap(g => g.logos),
      ...presenterSettings.logo.logoGroups.flatMap(g => g.logos),
      ...PRELOADED_LOGOS.flatMap(g => g.logos)
    ];
    const active = allLogos.find(l => l.id === presenterSettings.logo.activeLogoId);
    setActiveLogo(active || null);
  }, [presenterSettings.logo.activeLogoId, presenterSettings.logo.customLogos, presenterSettings.logo.customGroups, presenterSettings.logo.logoGroups, setActiveLogo]);

  useEffect(() => {
    LiveSyncService.setOverride(activeOverride as OverrideType | null, activeOverride === 'logo' ? activeLogo : null);
  }, [activeOverride, activeLogo]);

  useEffect(() => {
    LiveSyncService.syncSettings(presenterSettings);
  }, [presenterSettings]);

  // --- Actions ---
  const toggleOverride = useCallback((type: OverrideType) => {
    setActiveOverride((prev: OverrideType | null) => {
        const next = prev === type ? null : type;
        if (next) {
            LiveSyncService.syncSettings(usePresenterStore.getState().settings);
        }
        return next;
    });
  }, [setActiveOverride]);

  const openGlobalModal = useCallback((type: ModalType) => {
    PresentationService.openGlobalModal(type);
  }, []);

  const openProjector = useCallback(async () => {
    const success = await PresentationService.openProjector();
    if (success) setProjectorOpen(true);
  }, []);

  const closeProjector = useCallback(() => {
    PresentationService.closeProjector();
    setProjectorOpen(false);
  }, []);

  const toggleProjector = useProjectorToggle({
    appMode,
    projectorOpen,
    projectorIsLive,
    liveSlideId,
    previewSlideId,
    closeProjector,
    openProjector
  });

  const handleNext = useCallback(async (detached?: boolean, preferLiveAnchor?: boolean) => {
    await PresentationService.navigateNext(appMode, detached, preferLiveAnchor);
  }, [appMode]);

  const handlePrev = useCallback(async (detached?: boolean, preferLiveAnchor?: boolean) => {
    await PresentationService.navigatePrev(appMode, detached, preferLiveAnchor);
  }, [appMode]);

  // --- Remote Synchronization ---
  const updateRemoteState = useControllerRemoteSync({
    appMode,
    activeVerse,
    projectorIsLive,
    liveSlideId,
    previewSlideId,
    lang,
    themeAccent,
    isPlaying,
    activeOverride,
    activeLogo,
    activeLogoUrl,
    presenterSettings
  });

  // --- Shortcuts ---
  useGlobalShortcuts({
    appMode: appMode === 'hymns' ? 'presentation' : appMode,
    previewSlideId,
    activePresentation,
    activeVerse,
    selectedCanvasItemIds,
    isTimelineHovered,
    handleNext,
    handlePrev,
    openProjector,
    closeProjector,
    toggleOverride,
    onRequestRemoteUpdate: updateRemoteState
  });

  // --- Projector Handshake & Status Sync ---
  useProjectorLifecycleSync({
    themeAccent,
    activeOverride,
    activeLogo,
    appMode,
    setProjectorOpen,
    handleNext,
    handlePrev,
    setLiveSlide,
    toggleOverride,
    setIsPlaying,
    t
  });

  useEffect(() => {
    setIsPlaying(false);
  }, [liveSlideId, appMode, activeVerse?.id]);

  const isBibleSlide = useMemo(() => {
    if (!activePresentation || !previewSlideId) return false;
    const slide = activePresentation.slides.find(s => s.id === previewSlideId);
    return slide?.blockId === 'bible';
  }, [activePresentation, previewSlideId]);

  const isProjectorLive = projectorOpen && (appMode === 'scripture' ? projectorIsLive : !!liveSlideId);

  return {
    state: {
      sidebarOpen, historyOpen, searchOpen, appMode,
      themeAccent, designPanelOpen, isTimelineHovered, selectedCanvasItemIds,
      projectorOpen, isProjectorLive, settingsOpen, activeVerse,
      activePresentation, previewSlideId, activeLogo, activeLogoUrl,
      activeOverride, isMultiVerseMode, selectedVerses, lang,
      prevVersePreview, nextVersePreview, isBibleSlide
    },
    actions: {
      setSidebarOpen, setHistoryOpen, setSearchOpen, setDesignPanelOpen,
      setSettingsOpen, setActiveVerse, toggleOverride, undo, redo,
      openProjector, closeProjector, toggleProjector, handleNext, handlePrev,
      exitMultiVerseMode, commitToProjector, openGlobalModal
    }
  };
}
