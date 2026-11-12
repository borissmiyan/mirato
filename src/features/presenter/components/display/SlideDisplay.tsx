import React, { useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

// Store imports
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import {
  sidebarOpenAtom,
  historyOpenAtom,
  slideDesignPanelOpenAtom,
  canvasZoomAtom,
  canvasOffsetAtom,
  clipSlideContentAtom,
  timelineModeAtom,
} from '@/core/store/uiAtoms';
import { useAtomValue } from 'jotai';

// Hooks and Services
import { LiveSyncService } from '@/core/services/liveSyncService';
import { IpcService } from '@/core/services/ipcService';
import { useSlideDisplayData } from '../../hooks/useSlideDisplayData';
import { useSlideTransitionManager } from '../../hooks/useSlideTransitionManager';

// Utils and Types
import { cn } from '@/core/utils/cn';
import { SlideDisplayProps, ICanvasSlide } from '@/core/types';

// Component imports
import { SlideBackground } from './SlideBackground';
import LogicalCanvas from '../slide-editor/LogicalCanvas';
import SlideCanvas from '../slide-editor/SlideCanvas';
import SlideEditorToolbar from '../slide-editor/SlideEditorToolbar';
import TimelineModeToggle from '../timeline/TimelineModeToggle';
import { SlideContentOrchestrator } from './SlideContentOrchestrator';

const SlideDisplay: React.FC<SlideDisplayProps> = (props) => {
  const { isProjector = false, isPreview = false } = props;
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';
  
  const clipContent = useAtomValue(clipSlideContentAtom);

  // 1. Data Orchestration
  const data = useSlideDisplayData(props);
  const {
    appMode,
    settings,
    activeVerse,
    isMultiVerseMode,
    multiVerses,
    parallelVerse,
    presentation,
    selectedSlide,
    showRef,
    previewFontSize,
    presentationStore,
    activeOverride,
    bibleVerses,
    bibleSecondVerse,
    blocksMap,
    templatesMap
  } = data;

  const currentKey = `${appMode}-${appMode === 'scripture' ? activeVerse?.id : selectedSlide?.id}-${presentationStore.lastTransitionTrigger}`;

  // 2. Transition Management
  const {
    prevSlideState,
    isTransitioning,
    prevContentRef
  } = useSlideTransitionManager(currentKey, selectedSlide, presentationStore.lastTransitionTrigger);

  // 3. Side Effects (Projector Sync & Mode Sync)
  React.useEffect(() => {
    if (isProjector || !IpcService.isElectron()) return;

    const unsub = IpcService.on('projector-ready', () => {
      const store = useBibleStore.getState();
      const { activeVerse, isMultiVerseMode: multiMode, selectedVerses, secondTranslationId: secId } = store;

      LiveSyncService.showAppMode(appMode);

      if (appMode === 'scripture') {
        if (multiMode && selectedVerses.length >= 2) {
          LiveSyncService.showMultiVerses(selectedVerses, secId);
        } else if (activeVerse) {
          LiveSyncService.showVerse(activeVerse, secId);
        }
      } else if (selectedSlide) {
        LiveSyncService.showSlide(
          selectedSlide,
          presentationStore.selectedPresentationId || presentationStore.activePresentationId || undefined,
          presentationStore.activePresentationId || undefined
        );
      }
    });

    return () => unsub?.();
  }, [isProjector, appMode, selectedSlide, presentationStore.selectedPresentationId, presentationStore.activePresentationId]);

  React.useEffect(() => {
    if (isProjector) return;
    LiveSyncService.showAppMode(appMode);
  }, [appMode, isProjector]);

  // 4. Render Content
  const content = React.useMemo(() => (
    <SlideContentOrchestrator
      appMode={appMode}
      isMultiVerseMode={isMultiVerseMode}
      multiVerses={multiVerses}
      activeVerse={activeVerse}
      parallelVerse={parallelVerse}
      selectedSlide={selectedSlide}
      hasActivePresentation={!!presentation}
      showRef={showRef}
      previewFontSize={previewFontSize}
      settings={settings}
      isProjector={isProjector}
      isPreloading={props.isPreloading}
      isMuted={props.isMuted}
      isPreview={isPreview}
      lang={lang}
      isTransitioning={isTransitioning}
      lastTransitionTrigger={presentationStore.lastTransitionTrigger}
      navigationDirection={presentationStore.navigationDirection}
      bibleVerses={bibleVerses}
      bibleSecondVerse={bibleSecondVerse}
      blocksMap={blocksMap}
      templatesMap={templatesMap}
    />
  ), [
    appMode,
    isMultiVerseMode,
    multiVerses,
    activeVerse,
    parallelVerse,
    selectedSlide,
    presentation,
    showRef,
    previewFontSize,
    settings,
    isProjector,
    props.isPreloading,
    props.isMuted,
    isPreview,
    lang,
    isTransitioning,
    presentationStore.lastTransitionTrigger,
    presentationStore.navigationDirection,
    bibleVerses,
    bibleSecondVerse,
    blocksMap,
    templatesMap
  ]);

  // Update ref for transition caching
  React.useEffect(() => {
    prevContentRef.current = content;
  }, [content, prevContentRef]);

  const sidebarOpen = useAtomValue(sidebarOpenAtom);
  const historyOpen = useAtomValue(historyOpenAtom);
  const designPanelOpen = useAtomValue(slideDesignPanelOpenAtom);

  const [zoom, setZoom] = useAtom(canvasZoomAtom);
  const [offset, setOffset] = useAtom(canvasOffsetAtom);

  // Reset zoom/offset when switching to Bible or Hymns mode
  React.useEffect(() => {
    if ((appMode === 'scripture' || appMode === 'hymns') && !isProjector) {
      setZoom(1.0);
      setOffset({ x: 0, y: 0 });
    }
  }, [appMode, isProjector, setZoom, setOffset]);

  const timelineMode = useAtomValue(timelineModeAtom);

  const viewportPadding = React.useMemo(() => {
    if (isProjector) return { top: 0, bottom: 0, left: 0, right: 0 };
    
    const baseGap = appMode === 'hymns' ? 8 : 16;
    let pr = baseGap;
    let pt = 80;
    const timelineHeight = timelineMode === 'hidden' ? 0 : (timelineMode === 'compact' ? 160 : 300);
    // Standard 16px clearance from timeline so slide preview aligns with the 16px grid
    const timelineGap = 16;
    let pb = (appMode === 'presentation' || appMode === 'hymns')
      ? (timelineHeight > 0 ? timelineHeight + timelineGap : baseGap)
      : 48;
    let pl = baseGap;

    if (appMode === 'presentation' || appMode === 'hymns') {
      pt = 80; // Top toolbar clearance + gap
      if (designPanelOpen) pr = 320 + baseGap;
      else if (historyOpen) pr = 300 + baseGap;
      else pr = baseGap;
    } else if (sidebarOpen || historyOpen) {
      pt = 80; pb = 192; pl = 48; pr = 48;
    } else {
      pt = 48; pb = 48; pl = 48; pr = 48;
    }

    return { top: pt, bottom: pb, left: pl, right: pr };
  }, [appMode, isProjector, sidebarOpen, historyOpen, designPanelOpen, timelineMode]);

  // Spacebar pan state
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const [isSpacePanning, setIsSpacePanning] = React.useState(false);
  const spacePanRef = React.useRef<{ startX: number; startY: number; initialOffsetX: number; initialOffsetY: number } | null>(null);
  const isHoveredRef = React.useRef(false);

  // Global shortcuts for Spacebar Pan and Zoom Presets (Cmd+0 / Cmd+1)
  React.useEffect(() => {
    if (isProjector) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
      if (isTyping) return;

      if (e.code === 'Space' && !e.repeat && !isSpacePressed) {
        if (!isHoveredRef.current) return;
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Zoom presets: Cmd+0 = Fit to Screen, Cmd+1 = 100%
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        setOffset({ x: 0, y: 0 });
      } else if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setZoom(1.0);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsSpacePanning(false);
        spacePanRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isProjector, isSpacePressed, setZoom, setOffset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSpacePressed) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsSpacePanning(true);
      spacePanRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialOffsetX: offset.x,
        initialOffsetY: offset.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isSpacePanning && spacePanRef.current) {
      const dx = e.clientX - spacePanRef.current.startX;
      const dy = e.clientY - spacePanRef.current.startY;
      setOffset({
        x: spacePanRef.current.initialOffsetX + dx,
        y: spacePanRef.current.initialOffsetY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isSpacePanning) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsSpacePanning(false);
      spacePanRef.current = null;
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isProjector || appMode === 'scripture' || appMode === 'hymns') return;
    
    const isPinchOrZoom = e.ctrlKey || e.metaKey;

    if (!isPinchOrZoom) {
      // Figma-style Fluid Pan: Normal two-finger scroll or wheel pans the canvas
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
      return;
    }

    // Ctrl/Cmd + Wheel or Trackpad Pinch = Zoom towards Mouse Position
    const delta = e.deltaY;
    const zoomIntensity = e.ctrlKey ? 0.01 : 0.05;
    const factor = Math.exp(-delta * zoomIntensity);
    const newZoom = Math.min(Math.max(zoom * factor, 0.1), 4);
    
    if (newZoom === zoom) return;

    // Zoom towards Mouse Position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;

    const sRatio = newZoom / zoom;
    const newOffset = {
      x: offset.x * sRatio - dx * (sRatio - 1),
      y: offset.y * sRatio - dy * (sRatio - 1)
    };

    setZoom(newZoom);
    setOffset(newOffset);
  }, [isProjector, appMode, zoom, offset, setZoom, setOffset]);

  // Determine if a transition animation is configured
  const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
  const hasTransition = transition.type !== 'none';

  return (
    <div
      className={cn(
        'h-full w-full relative group',
        isProjector ? 'bg-black overflow-hidden' : 'bg-transparent',
        isSpacePressed && (isSpacePanning ? 'cursor-grabbing' : 'cursor-grab')
      )}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        setIsSpacePressed(false);
        setIsSpacePanning(false);
        spacePanRef.current = null;
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <LogicalCanvas
        aspectRatioOverride={(appMode === 'presentation' || appMode === 'hymns') ? (16 / 9) : undefined}
        autoFill={isProjector}
        viewportPadding={viewportPadding}
        containerClassName={cn(
          'relative',
          !isProjector && 'ring-1 ring-white/10 border border-white/5 shadow-2xl'
        )}
        zoom={zoom}
        offset={offset}
        style={{
          borderRadius: settings?.display?.cornerRadius ? `${settings.display.cornerRadius}px` : undefined,
        }}
      >
        <SlideBackground background={settings?.background} />
        <div className="relative z-10 w-full h-full">
          {prevSlideState && hasTransition && (
            <div key={prevSlideState.key} className={cn("absolute inset-0 z-0 pointer-events-none", isProjector || clipContent ? "overflow-hidden" : "overflow-visible")}>
              {prevSlideState.content}
            </div>
          )}
          <div key={currentKey} className={cn("absolute inset-0 z-10 pointer-events-auto", isProjector ? "overflow-hidden" : "overflow-visible")}>
            {content}
          </div>
        </div>
      </LogicalCanvas>

      {/* 5. Editor Toolbar */}
      {appMode === 'presentation' && !isProjector && selectedSlide && (
        <SlideEditorToolbar />
      )}

      {/* 6. Floating Timeline Mode Toggle */}
      {(appMode === 'presentation' || appMode === 'hymns') && !isProjector && (
        <TimelineModeToggle />
      )}
    </div>
  );
};

export default SlideDisplay;

