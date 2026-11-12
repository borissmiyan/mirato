import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Layers, Presentation } from 'lucide-react';
import { ICanvasSlide, INestedSlide, ISlide, IPresentationFile } from '@/core/types';
import { useModalStore } from '@/core/store/modalStore';
import { useAtom, useSetAtom } from 'jotai';
import { appModeAtom, isTimelineHoveredAtom, latestInteractionAreaAtom, selectedTransitionSlideIdAtom, slideDesignPanelOpenAtom } from '@/core/store/uiAtoms';
import { 
    DndContext, 
    DragOverlay, 
    MeasuringStrategy,
    DropAnimation
} from '@dnd-kit/core';
import { TrackContainerHandle } from './TrackContainer';

// Modularized Components & Hooks
import { useTimelineLayout } from './hooks/useTimelineLayout';
import { useTimelineOperations } from './hooks/useTimelineOperations';
import { useMetadata } from '@/features/presenter/hooks/useMetadata';
import { useTimelineDragAndDrop } from './hooks/useTimelineDragAndDrop';
import { useTimelineShortcuts } from './hooks/useTimelineShortcuts';
import { useTimelineLiveSync } from './hooks/useTimelineLiveSync';
import { TimelineContextMenu } from './TimelineContextMenu';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineTrackHeaders } from './TimelineTrackHeaders';
import { TimelineSlideTrack } from './TimelineSlideTrack';
import { TimelineDragOverlayContent } from './TimelineDragOverlayContent';
import AudioTrack from './AudioTrack';
import { LiveMediaToolbar } from '../display/LiveMediaToolbar';

import { horizontalCollisionDetection } from './utils/horizontalCollisionDetection';
import { cn } from '@/core/utils/cn';

interface SlideTimelineProps {
    openProjector?: () => Promise<void>;
    isOpen?: boolean;
    timelineMode?: 'hidden' | 'compact' | 'expanded';
}

const SlideTimeline: React.FC<SlideTimelineProps> = ({ openProjector, isOpen = true, timelineMode = 'expanded' }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    
    // Store State & Actions
    // Actions (Stable selectors - no re-render)
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
    const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
    const updateSlideBackground = usePresentationStore(s => s.updateSlideBackground);
    const toggleSlideExpansion = usePresentationStore(s => s.toggleSlideExpansion);
    const duplicateSlide = usePresentationStore(s => s.duplicateSlide);
    const duplicateSlides = usePresentationStore(s => s.duplicateSlides);
    const removeSlide = usePresentationStore(s => s.removeSlide);
    const removeSlides = usePresentationStore(s => s.removeSlides);
    const addPresentationToTimeline = usePresentationStore(s => s.addPresentationToTimeline);
    const setSelectedSlideIds = usePresentationStore(s => s.setSelectedSlideIds);
    const toggleSlideSelection = usePresentationStore(s => s.toggleSlideSelection);
    const clearSelection = usePresentationStore(s => s.clearSelection);
    const copySlides = usePresentationStore(s => s.copySlides);
    const pasteSlides = usePresentationStore(s => s.pasteSlides);
    const selectAudioScope = usePresentationStore(s => s.selectAudioScope);
    const takeSnapshot = usePresentationStore(s => s.takeSnapshot);

    // Dynamic State (Granular selectors)
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const selectedSlideIds = usePresentationStore(s => s.selectedSlideIds);
    const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);
    const navigationParentSlideId = usePresentationStore(s => s.navigationParentSlideId);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const pasteAudioScope = usePresentationStore(s => s.pasteAudioScope);

    const openModal = useModalStore(s => s.openModal);
    const trackRef = useRef<TrackContainerHandle>(null);
    
    // UI State Atoms
    const [appMode] = useAtom(appModeAtom);
    const [isTimelineHovered, setIsHovered] = useAtom(isTimelineHoveredAtom);
    const isTimelineHoveredRef = useRef(false);
    const [selectedTransId, setTransEditId] = useAtom(selectedTransitionSlideIdAtom);
    const selectedAudioId = usePresentationStore(s => s.selectedAudioScopeId);
    const [designPanelOpen] = useAtom(slideDesignPanelOpenAtom);
    const setLatestArea = useSetAtom(latestInteractionAreaAtom);

    // Local State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideId: string; presentationId: string } | null>(null);
    const [nativeDropIndex, setNativeDropIndex] = useState<number | null>(null);
    const [localSlides, setLocalSlides] = useState<ISlide[]>(() => activePresentation?.slides || []);
    const localSlidesRef = useRef(localSlides);
    useEffect(() => {
        localSlidesRef.current = localSlides;
    }, [localSlides]);
    const [autoFollow, setAutoFollow] = useState(true);
    
    // Refs for optimization
    const dragActiveRef = useRef(false);

    useEffect(() => {
        isTimelineHoveredRef.current = isTimelineHovered;
    }, [isTimelineHovered]);

    const isSubItemSelected = !!selectedTransId || !!selectedAudioId;
    const isDetached = previewSlideId !== null && liveSlideId !== null && previewSlideId !== liveSlideId;

    // Database Queries
    const dbPresentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );

    const presentation = useMemo(() => {
        if (activePresentation?.id === activePresentationId) return activePresentation;
        return dbPresentation;
    }, [activePresentation, dbPresentation, activePresentationId]);

    useEffect(() => {
        if (!presentation?.slides) return;
        if (!dragActiveRef.current) {
            setLocalSlides(presentation.slides);
        }
    }, [presentation?.slides]);

    const expandedPresentationIds = useMemo(() => {
        return (presentation?.slides || [])
            .filter(s => s.isExpanded || s.id === navigationParentSlideId)
            .map(s => {
                const canvasSlide = s.type === 'normal' ? s as ICanvasSlide : null;
                const nestedSlide = s.type === 'nested' ? s as INestedSlide : null;
                return canvasSlide?.masterPresentationId || nestedSlide?.presentationId;
            })
            .filter(Boolean) as string[];
    }, [presentation?.slides, navigationParentSlideId]);

    const liveExpandedPresentations = useLiveQuery(
        (): Promise<IPresentationFile[]> => expandedPresentationIds.length > 0 ? db.presentationFiles.where('id').anyOf(expandedPresentationIds).toArray() : Promise.resolve([]),
        [expandedPresentationIds]
    );
    const expandedPresentations = useMemo<IPresentationFile[]>(() => liveExpandedPresentations || [], [liveExpandedPresentations]);

    const presentationsMap = useMemo<Map<string, IPresentationFile>>(() => {
        return new Map(expandedPresentations.map(p => [p.id, p]));
    }, [expandedPresentations]);

    // Metadata
    const { blocksMap, templatesMap, templates } = useMetadata();

    // Custom Hooks Logic Extraction
    const { visualTimeline } = useTimelineLayout({
        slides: presentation?.slides || [],
        activePresentationId,
        presentationsMap
    });

    const {
        handleAddSlide,
        handleAddTimer,
        handleAddVideo,
        handleAddMediaSlides,
        handleRestoreTemplateBg,
        handleApplyBgToAll
    } = useTimelineOperations({
        activePresentationId,
        presentation,
        slides: presentation?.slides || [],
        previewSlideId,
        templatesMap,
        blocksMap,
        templates,
        t,
        updatePresentationSlides,
        setPreviewSlide,
        updateSlideBackground,
        openModal
    });

    const {
        activeId,
        droppingId,
        handleDropComplete,
        sensors,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    } = useTimelineDragAndDrop({
        activePresentationId,
        slides: presentation?.slides || [],
        localSlides,
        setLocalSlides,
        selectedSlideIds,
        trackRef,
        dragActiveRef,
        updatePresentationSlides,
        addPresentationToTimeline,
        takeSnapshot,
        disabled: !!presentation?.metadata?.isHymnLibraryItem
    });

    /** Apple ProMotion spring curve for drag overlay landing smoothly into the target slot */
    const timelineDropAnimation: DropAnimation = React.useMemo(() => ({
        duration: 220,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        sideEffects: () => {
            return () => {
                handleDropComplete();
            };
        },
    }), [handleDropComplete]);

    const copyAudioScope = usePresentationStore(s => s.copyAudioScope);
    const duplicateAudioScope = usePresentationStore(s => s.duplicateAudioScope);

    useTimelineShortcuts({
        activePresentationId,
        slides: presentation?.slides || [],
        selectedSlideIds,
        selectedAudioScopeId: selectedAudioId,
        previewSlideId,
        isTimelineHoveredRef,
        copySlides,
        pasteSlides,
        duplicateSlides,
        duplicateSlide,
        removeSlides,
        removeSlide,
        copyAudioScope,
        pasteAudioScope,
        duplicateAudioScope,
        setSelectedSlideIds,
        setLiveSlide,
        clearSelection
    });

    // Synchronization Effects
    useEffect(() => {
        if (appMode === 'presentation') {
            setAutoFollow(true);
        }
    }, [appMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            if (active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            )) return;

            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                setAutoFollow(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    // Encapsulated Live & Preview Synchronization to Secondary Display / Projector
    useTimelineLiveSync({
        appMode,
        liveSlideId,
        previewSlideId,
        activePresentationId,
        selectedPresentationId,
        activePresentation,
        selectedPresentation,
        visualTimeline,
        navigationParentSlideId,
    });

    useEffect(() => {
        // Critical: Never auto-scroll timeline while dragging or dropping slides to prevent infinite flip-flop
        if (activeId || droppingId) return;

        if (autoFollow && previewSlideId) {
            let targetId = previewSlideId;
            
            if (navigationParentSlideId) {
                const parentSlide = localSlidesRef.current.find(s => s.id === navigationParentSlideId);
                const masterId = parentSlide?.type === 'normal' 
                    ? (parentSlide as ICanvasSlide).masterPresentationId 
                    : (parentSlide?.type === 'nested' ? (parentSlide as INestedSlide).presentationId : undefined);
                
                if (masterId) {
                    const nestedPres = presentationsMap.get(masterId);
                    if (nestedPres && nestedPres.slides.length > 0 && nestedPres.slides[0].id === previewSlideId) {
                        targetId = navigationParentSlideId;
                    }
                }
            }
            
            trackRef.current?.scrollToSlide(targetId, navigationParentSlideId || undefined);
        }
    }, [autoFollow, previewSlideId, activeId, droppingId, designPanelOpen, navigationParentSlideId, presentationsMap]);

    const handleSelect = useCallback((id: string, multi?: boolean, range?: boolean, deselect?: boolean, slides?: ISlide[]) => {
        if (deselect) {
            toggleSlideSelection(id, false, false, true);
        } else if (multi || range) {
            toggleSlideSelection(id, multi, range, false, slides || localSlidesRef.current);
        } else {
            setPreviewSlide(id, activePresentationId || undefined, undefined, undefined, undefined, true);
        }
        setTransEditId(null);
        selectAudioScope(null);
        setAutoFollow(true);
    }, [toggleSlideSelection, setPreviewSlide, activePresentationId, setTransEditId, selectAudioScope]);

    const handleLive = useCallback(async (id: string | null, pid?: string, rootId?: string, parentId?: string | null) => {
        if (!id) {
            setLiveSlide(null);
            return;
        }
        const item = visualTimeline.find(i => i.id === id);
        if (item) {
             setLiveSlide(id, item.presentationId, activePresentationId || undefined, item.parentSlideId || null, activePresentationId || undefined);
        } else {
             setLiveSlide(id, pid, rootId, parentId);
        }
        if (openProjector) await openProjector();
    }, [setLiveSlide, openProjector, visualTimeline, activePresentationId]);

    // Height calculation: compact mode is 160px (56px header + 16px top + 72px slide + 16px bottom), expanded is 300px
    const timelineHeight = timelineMode === 'compact' ? 160 : 300;

    const isVisible = isOpen && timelineMode !== 'hidden';
    // When hidden, completely unmount from DOM to eliminate all background CPU, timers, and listener load
    if (!activePresentationId || !isVisible) return null;

    return (
        <div
            data-timeline-root
            className="absolute bottom-0 left-0 right-0 bg-stone-900/60 backdrop-blur-xl border-t border-white/5 flex flex-col z-30 transition-[height,padding] duration-250 ease-out will-change-transform animate-in slide-in-from-bottom pointer-events-auto"
            style={{ height: timelineHeight, paddingRight: designPanelOpen ? 320 : 0 }}
            onPointerDown={() => setLatestArea('timeline')}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <TimelineToolbar
                t={t}
                slideCount={localSlides.length}
                isDetached={isDetached}
                appMode={appMode}
                handleAddSlide={handleAddSlide}
                handleAddTimer={handleAddTimer}
                handleAddVideo={handleAddVideo}
                openModal={openModal}
            />

            <div className="flex bg-stone-950/20 overflow-hidden flex-1 relative">
                <TimelineTrackHeaders t={t} hasSlides={localSlides.length > 0} type={timelineMode === 'compact' ? 'slides' : 'both'} />
                
                <DndContext
                    sensors={sensors}
                    collisionDetection={horizontalCollisionDetection}
                    autoScroll={false}
                    measuring={{
                        droppable: {
                            strategy: MeasuringStrategy.WhileDragging,
                        },
                    }}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <TimelineSlideTrack
                        disabled={!!presentation?.metadata?.isHymnLibraryItem}
                        localSlides={localSlides}
                        visualTimeline={visualTimeline}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDragEnd={handleDragEnd}
                        handleDragCancel={handleDragCancel}
                        handleAddSlide={handleAddSlide}
                        addPresentationToTimeline={addPresentationToTimeline}
                        onAddMediaSlides={handleAddMediaSlides}
                        setNativeDropIndex={setNativeDropIndex}
                        trackRef={trackRef}
                        onUserScroll={() => setAutoFollow(false)}
                        activePresentationId={activePresentationId}
                        previewSlideId={previewSlideId}
                        liveSlideId={liveSlideId}
                        selectedSlideIds={selectedSlideIds}
                        selectedPresentationId={selectedPresentationId}
                        isDetached={isDetached}
                        templatesMap={templatesMap}
                        blocksMap={blocksMap}
                        presentationsMap={presentationsMap}
                        navigationParentSlideId={navigationParentSlideId}
                        lang={lang}
                        setPreviewSlide={setPreviewSlide}
                        setLiveSlide={handleLive}
                        toggleSlideSelection={handleSelect}
                        clearSelection={clearSelection}
                        toggleSlideExpansion={toggleSlideExpansion}
                        setContextMenu={setContextMenu}
                        isSubItemSelected={isSubItemSelected}
                        dragActiveId={activeId || droppingId}
                        audioTrack={timelineMode === 'expanded' ? <AudioTrack visualTimeline={visualTimeline} /> : null}
                    >
                        {nativeDropIndex === localSlides.length && (
                            <div className="w-32 h-[72px] shrink-0 rounded-xl relative overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 opacity-80 outline-dashed outline-2 outline-accent outline-offset-1 flex items-center justify-center bg-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb, 147, 51, 234),0.2)]">
                                <Presentation className="w-8 h-8 text-accent animate-pulse" />
                            </div>
                        )}
                    </TimelineSlideTrack>

                    {createPortal(
                        <DragOverlay 
                            zIndex={9999}
                            dropAnimation={timelineDropAnimation}
                        >
                            <TimelineDragOverlayContent
                                activeId={activeId}
                                selectedSlideIds={selectedSlideIds}
                                localSlides={localSlides}
                                templatesMap={templatesMap}
                                blocksMap={blocksMap}
                                lang={lang}
                            />
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>
            </div>

            {/* Lane 3: Live Media Toolbar (Only in expanded mode when video is live) */}
            {timelineMode === 'expanded' && (() => {
                const liveItem = liveSlideId ? visualTimeline.find(item => item.id === liveSlideId) : null;
                return (
                    <LiveMediaToolbar 
                        liveSlide={liveItem?.slide} 
                        presentationId={liveItem?.presentationId} 
                    />
                );
            })()}

            {localSlides.length === 0 && (
                <div className="absolute inset-0 top-10 flex items-center justify-center gap-4 text-stone-700 italic pointer-events-none">
                    <Layers className="w-6 h-6 opacity-20" />
                    <span className="text-xs">{t('timeline_empty_hint', 'Add slides from the toolbar or drag blocks here.')}</span>
                </div>
            )}

            {/* Context Menu Overlay */}
            <TimelineContextMenu
                contextMenu={contextMenu}
                onClose={() => setContextMenu(null)}
                presentationsMap={presentationsMap}
                activePresentationId={activePresentationId}
            />
        </div>
    );
};

export default React.memo(SlideTimeline);
