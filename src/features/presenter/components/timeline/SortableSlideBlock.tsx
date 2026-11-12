import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IPresentationFile, IBlock, ITemplate } from '@/core/types';
import { SlideTile } from './SlideTile';
import { TransitionSeparator } from './TransitionSeparator';
import NestedPresentationTile from './NestedPresentationTile';

export interface SortableSlideBlockProps {
    slide: ISlide;
    index: number;
    activePresentationId: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    liveSlideId: string | null;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    lang: string;
    onSelect: (id: string, e?: React.MouseEvent) => void;
    onLive: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onToggleExpansion: (id: string) => void;
    isSelected?: boolean;
    isMultiSelect?: boolean;
    isSubItemSelected?: boolean;
    isMultiDragHidden?: boolean;
    isNew?: boolean;
    dragActiveId?: string | null;
    setContextMenu: (menu: { x: number; y: number; slideId: string; presentationId: string } | null) => void;
    disabled?: boolean;
}

/**
 * SortableSlideBlock component for the presentation timeline.
 * Integrates with dnd-kit for drag-and-drop sorting and renders the SlideTile and its separators.
 */
export const SortableSlideBlock = React.memo<SortableSlideBlockProps>(({
    slide,
    index,
    activePresentationId,
    previewSlideId,
    selectedPresentationId,
    liveSlideId,
    blocksMap,
    templatesMap,
    presentationsMap,
    lang,
    onSelect,
    onLive,
    onContextMenu,
    onToggleExpansion,
    isSelected,
    isMultiSelect,
    isSubItemSelected,
    isMultiDragHidden,
    isNew,
    dragActiveId,
    navigationParentSlideId,
    setContextMenu,
    disabled
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
    } = useSortable({ id: slide.id, disabled });

    const isCurrentDragging = slide.id === dragActiveId;

    const isMaster = slide.blockId === 'master-presentation';
    const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
    const nestedPres = masterPresId ? presentationsMap.get(masterPresId) : null;

    return (
        <div
            ref={setNodeRef}
            data-slide-block-id={slide.id}
            style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                willChange: 'transform',
                // Collapse hidden multi-drag items to zero width — they must not
                // reserve layout space, otherwise the drop-target gap = N * slide width
                // instead of always being exactly one slide width.
                ...(isMultiDragHidden ? { width: 0, overflow: 'hidden', padding: 0, margin: 0, minWidth: 0, gap: 0 } : {}),
            }}
            className={cn(
                "relative flex items-center h-fit",
                isCurrentDragging && "z-50"
            )}
        >
            {/* Drop placeholder — dedicated gap matching the 128x72 slide card with Apple spring fade */}
            <div
                className={cn(
                    "absolute inset-0 rounded-xl border-2 border-dashed border-accent/40 bg-accent/10 pointer-events-none transition-all duration-200 shadow-[inset_0_0_15px_rgba(var(--accent-rgb,147,51,234),0.12)]",
                    isCurrentDragging ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                )}
            />

            {/* Slide contents — smoothly fades during drag lift and drop */}
            <div className={cn(
                "flex items-center gap-3 transition-opacity duration-150",
                isCurrentDragging ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                <TransitionSeparator slide={slide} activePresentationId={activePresentationId} />
                <SlideTile
                slide={slide}
                index={index}
                activePresentationId={activePresentationId}
                previewSlideId={previewSlideId}
                selectedPresentationId={selectedPresentationId}
                liveSlideId={liveSlideId}
                blocksMap={blocksMap}
                templatesMap={templatesMap}
                lang={lang}
                onSelect={onSelect}
                onLive={onLive}
                onContextMenu={onContextMenu}
                onToggleExpansion={onToggleExpansion}
                isSelected={isSelected}
                isMultiSelect={isMultiSelect}
                isSubItemSelected={isSubItemSelected}
                isMultiDragHidden={isMultiDragHidden}
                isNew={isNew}
                presentationsMap={presentationsMap}
                navigationParentSlideId={navigationParentSlideId}
                listeners={listeners}
                attributes={attributes}
            />

            {isMaster && slide.isExpanded && nestedPres && (
                <NestedPresentationTile
                    slide={slide}
                    nestedPresentation={nestedPres}
                    blocksMap={blocksMap}
                    templatesMap={templatesMap}
                    presentationsMap={presentationsMap}
                    lang={lang}
                    previewSlideId={previewSlideId}
                    selectedPresentationId={selectedPresentationId}
                    onContextMenu={(e, slideId, presentationId) => {
                        setContextMenu({ x: e.clientX, y: e.clientY, slideId, presentationId });
                    }}
                />
            )}
            </div>
        </div>
    );
});

SortableSlideBlock.displayName = 'SortableSlideBlock';
