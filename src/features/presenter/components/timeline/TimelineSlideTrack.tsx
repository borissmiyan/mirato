import React from 'react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { 
    SortableContext, 
    horizontalListSortingStrategy 
} from '@dnd-kit/sortable';
import { ISlide, IBlock, ITemplate, IPresentationFile, IMediaItem } from '@/core/types';
import { TimelineDroppableZone } from './TimelineDroppableZone';
import { SortableSlideBlock } from './SortableSlideBlock';
import { TimelineItem } from './hooks/useTimelineLayout';
import TrackContainer, { TrackContainerHandle } from './TrackContainer';
import { getHorizontalTransform } from './utils/horizontalCollisionDetection';
import { cn } from '@/core/utils/cn';

interface TimelineSlideTrackProps {
    localSlides: ISlide[];
    visualTimeline: TimelineItem[];
    // Handlers (DndContext now in parent)
    handleDragStart: (event: DragStartEvent) => void;
    handleDragOver: (event: DragOverEvent) => void;
    handleDragEnd: (event: DragEndEvent) => Promise<void>;
    handleDragCancel: () => void;
    handleAddSlide: (blockId: string, e?: React.MouseEvent) => void;
    addPresentationToTimeline: (pid: string, idx?: number) => Promise<void>;
    onAddMediaSlides?: (items: IMediaItem[], index?: number) => void;
    setNativeDropIndex: (idx: number | null) => void;
    trackRef: React.RefObject<TrackContainerHandle | null>;
    activePresentationId: string;
    previewSlideId: string | null;
    liveSlideId: string | null;
    selectedSlideIds: string[];
    selectedPresentationId: string | null;
    isDetached: boolean;
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, IBlock>;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    lang: string;
    setPreviewSlide: (id: string | null, pid?: string, rootId?: string, parentId?: string | null) => void;
    setLiveSlide: (id: string | null, pid?: string, rootId?: string, parentId?: string | null) => void;
    toggleSlideSelection: (id: string, multi?: boolean, range?: boolean, deselect?: boolean, slides?: ISlide[]) => void;
    clearSelection?: () => void;
    toggleSlideExpansion: (id: string) => void;
    setContextMenu: (menu: { x: number; y: number; slideId: string; presentationId: string } | null) => void;
    isSubItemSelected: boolean;
    dragActiveId: string | null;
    audioTrack?: React.ReactNode;
    children?: React.ReactNode;
    onUserScroll?: () => void;
    disabled?: boolean;
}

/**
 * TimelineSlideTrack - Pure layout component for the slide track.
 * The DndContext and DragOverlay are managed by the parent SlideTimeline.
 */
export const TimelineSlideTrack: React.FC<TimelineSlideTrackProps> = React.memo(({
    localSlides,
    visualTimeline,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    handleAddSlide,
    addPresentationToTimeline,
    onAddMediaSlides,
    setNativeDropIndex,
    trackRef,
    activePresentationId,
    previewSlideId,
    liveSlideId,
    selectedSlideIds,
    selectedPresentationId,
    isDetached,
    templatesMap,
    blocksMap,
    presentationsMap,
    navigationParentSlideId,
    lang,
    setPreviewSlide,
    setLiveSlide,
    toggleSlideSelection,
    clearSelection,
    toggleSlideExpansion,
    setContextMenu,
    isSubItemSelected,
    dragActiveId,
    audioTrack,
    children,
    onUserScroll,
    disabled
}) => {
    const handleSelect = React.useCallback((id: string, e?: React.MouseEvent) => {
        const isMod = !!(e?.metaKey || e?.ctrlKey);
        const isAlt = !!e?.altKey;
        const isShift = !!e?.shiftKey;
        const isDeselect = isMod && isAlt;
        toggleSlideSelection(id, isMod && !isAlt, isShift, isDeselect, localSlides);
    }, [toggleSlideSelection, localSlides]);

    const handleTrackClick = React.useCallback((e: React.MouseEvent) => {
        const isNotOnSlide = !(e.target as HTMLElement).closest?.('[data-slide-id]');

        if (isNotOnSlide) {
            if (clearSelection) {
                clearSelection();
            } else {
                toggleSlideSelection('', false, false, true);
            }
        }
    }, [clearSelection, toggleSlideSelection]);

    const handleContextMenu = React.useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        if (selectedSlideIds && !selectedSlideIds.includes(id)) {
            toggleSlideSelection(id, false, false);
        }
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            slideId: id,
            presentationId: activePresentationId
        });
    }, [setContextMenu, activePresentationId, selectedSlideIds, toggleSlideSelection]);

    const handleAddPresentation = React.useCallback((pid: string, idx?: number) => {
        addPresentationToTimeline(pid, idx);
        setNativeDropIndex(null);
    }, [addPresentationToTimeline, setNativeDropIndex]);

    const sortableIds = React.useMemo(() => localSlides.map(s => s.id), [localSlides]);

    const slidesContainerRef = React.useRef<HTMLDivElement>(null);
    const prevPositionsRef = React.useRef<Map<string, number>>(new Map());
    const activeAnimationsRef = React.useRef<Map<string, Animation>>(new Map());
    const mountedSlideIdsRef = React.useRef<Set<string>>(new Set());
    const currentPresIdRef = React.useRef<string>(activePresentationId);

    // Initialize or reset tracking when presentation changes so initial render doesn't animate
    if (currentPresIdRef.current !== activePresentationId) {
        currentPresIdRef.current = activePresentationId;
        mountedSlideIdsRef.current = new Set(localSlides.map(s => s.id));
        prevPositionsRef.current.clear();
        activeAnimationsRef.current.forEach(anim => anim.cancel());
        activeAnimationsRef.current.clear();
    } else if (mountedSlideIdsRef.current.size === 0 && localSlides.length > 0) {
        mountedSlideIdsRef.current = new Set(localSlides.map(s => s.id));
    }

    // 120Hz ProMotion FLIP animation for slides shifting during drag reordering or add/remove
    // Reads precalculated mathematical positions from visualTimeline to prevent synchronous layout thrashing (forced reflow)
    React.useLayoutEffect(() => {
        const container = slidesContainerRef.current;
        if (!container) return;

        const currentPositions = new Map<string, number>();
        for (const item of visualTimeline) {
            if (item.id) {
                currentPositions.set(item.id, item.x);
            }
        }

        const prefersReducedMotion = typeof window !== 'undefined' && 
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        // If initial load or reduced motion, record positions without animation
        if (prevPositionsRef.current.size === 0 || prefersReducedMotion) {
            prevPositionsRef.current = currentPositions;
            return;
        }

        const isDragging = Boolean(dragActiveId);

        // FLIP: Animate slides that shifted position smoothly to the right/left
        for (const [id, currX] of currentPositions.entries()) {
            // Newly added slide animates with its own keyframe (grows up from the bottom)
            const isNew = !mountedSlideIdsRef.current.has(id);
            if (isNew) continue;

            const prevX = prevPositionsRef.current.get(id);
            if (prevX !== undefined && prevX !== currX) {
                const el = container.querySelector<HTMLElement>(`[data-slide-block-id="${id}"]`);
                if (!el) continue;

                const existingAnim = activeAnimationsRef.current.get(id);
                let startVisualX = prevX;

                // Continuous Retargeting: If an animation is already running mid-flight,
                // extract its live in-flight horizontal translation offset before cancelling
                // so the slide smoothly glides from its current visual coordinate without any jump.
                if (existingAnim && existingAnim.playState === 'running') {
                    const currentTx = getHorizontalTransform(el);
                    existingAnim.cancel();
                    activeAnimationsRef.current.delete(id);
                    startVisualX = prevX + currentTx;
                }

                const deltaX = startVisualX - currX;

                // Only animate meaningful shifts (ignore subpixel rounding)
                if (Math.abs(deltaX) > 2) {
                    // Dynamic ProMotion duration scaled to travel distance:
                    // 160ms for small neighbor adjustments, up to 260ms for full-slot moves
                    const duration = isDragging
                        ? Math.max(160, Math.min(260, Math.round(Math.abs(deltaX) * 1.5)))
                        : 380;

                    const anim = el.animate([
                        { transform: `translateX(${deltaX}px)` },
                        { transform: 'translateX(0px)' }
                    ], {
                        duration,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'none'
                    });

                    activeAnimationsRef.current.set(id, anim);
                    anim.onfinish = () => {
                        if (activeAnimationsRef.current.get(id) === anim) {
                            activeAnimationsRef.current.delete(id);
                        }
                    };
                }
            }
        }

        prevPositionsRef.current = currentPositions;
    }, [localSlides, visualTimeline, dragActiveId]);

    React.useEffect(() => {
        mountedSlideIdsRef.current = new Set(localSlides.map(s => s.id));
    }, [localSlides]);

    return (
        <div className="flex-1 overflow-hidden relative">
            <TrackContainer ref={trackRef} onUserScroll={onUserScroll}>
                <div className="flex flex-col min-h-full min-w-full">
                    {/* Lane 1: Slides */}
                    <div 
                        className={cn(
                            "flex items-center px-4 min-w-full relative",
                            audioTrack ? "flex-1 py-4" : "h-[104px] pt-4 pb-4"
                        )}
                        onClick={handleTrackClick}
                    >
                        <TimelineDroppableZone 
                            disabled={!!dragActiveId && dragActiveId !== 'presentation-item-drag'}
                            onAddSlide={handleAddSlide} 
                            onAddPresentation={handleAddPresentation} 
                            onAddMediaSlides={onAddMediaSlides}
                            visualTimeline={visualTimeline}
                            onNativeDragOver={setNativeDropIndex}
                        />
                        
                        <div ref={slidesContainerRef} className="flex items-center gap-3 relative z-10">
                            <SortableContext
                                items={sortableIds}
                                strategy={horizontalListSortingStrategy}
                            >
                                {localSlides.map((slide, index) => {
                                    const isNew = !mountedSlideIdsRef.current.has(slide.id);
                                    return (
                                        <SortableSlideBlock
                                            key={slide.id}
                                            slide={slide}
                                            index={index}
                                            activePresentationId={activePresentationId}
                                            previewSlideId={previewSlideId}
                                            selectedPresentationId={selectedPresentationId}
                                            liveSlideId={liveSlideId}
                                            blocksMap={blocksMap}
                                            templatesMap={templatesMap}
                                            presentationsMap={presentationsMap}
                                            navigationParentSlideId={navigationParentSlideId}
                                            lang={lang}
                                            onSelect={handleSelect}
                                            onLive={setLiveSlide}
                                            onContextMenu={handleContextMenu}
                                            onToggleExpansion={toggleSlideExpansion}
                                            isSelected={selectedSlideIds.includes(slide.id)}
                                            isMultiSelect={selectedSlideIds.length > 1}
                                            isSubItemSelected={isSubItemSelected}
                                            isMultiDragHidden={!!dragActiveId && selectedSlideIds.length > 1 && selectedSlideIds.includes(slide.id) && slide.id !== dragActiveId}
                                            isNew={isNew}
                                            dragActiveId={dragActiveId}
                                            setContextMenu={setContextMenu}
                                            disabled={disabled}
                                        />
                                    );
                                })}
                            </SortableContext>
                            
                            {/* DragOverlay is now in SlideTimeline */}
                            {children}
                        </div>
                    </div>

                    {/* Lane 2: Audio */}
                    {audioTrack && (
                        <div className="shrink-0 h-[88px] border-t border-white/5 bg-stone-950/20 relative min-w-full px-8 py-2">
                            {audioTrack}
                        </div>
                    )}
                </div>
            </TrackContainer>
        </div>
    );
});

TimelineSlideTrack.displayName = 'TimelineSlideTrack';
