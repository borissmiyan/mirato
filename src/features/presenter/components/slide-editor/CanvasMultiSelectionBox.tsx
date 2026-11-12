import React, { useCallback, useRef } from 'react';
import { Group, Blend } from 'lucide-react';
import { ICanvasItem } from '@/core/types';
import { getItemDOMBounds } from '@/core/utils/canvasDistance';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { cn } from '@/core/utils/cn';

interface CanvasMultiSelectionBoxProps {
    selectedItems: ICanvasItem[];
    slideId: string;
    getContainerRect: () => DOMRect | { left: number; top: number; width: number; height: number };
    canvasScale?: number;
    dragActive?: boolean;
    dragActiveMode?: 'move' | 'resize' | 'rotate' | null;
    isAltHeld?: boolean;
}

type HandleCorner =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

/**
 * Figma-grade Unified Bounding Box for multi-item selection.
 * Renders a single clean outer frame with 8 resize handles that scale the entire group proportionally.
 */
export const CanvasMultiSelectionBox: React.FC<CanvasMultiSelectionBoxProps> = React.memo(({
    selectedItems,
    slideId,
    getContainerRect,
    canvasScale = 1,
    dragActive = false,
    dragActiveMode = null,
    isAltHeld = false,
}) => {
    const dragStartRef = useRef<{
        corner: HandleCorner;
        startX: number;
        startY: number;
        startBounds: { left: number; top: number; width: number; height: number };
        initialItems: Array<{ id: string; x: number; y: number; width: number; height: number }>;
    } | null>(null);

    const bounds = selectedItems.length > 1 ? selectedItems.map(it => getItemDOMBounds(it)) : [];
    const minLeft = bounds.length > 0 ? Math.min(...bounds.map(b => b.left)) : 0;
    const maxRight = bounds.length > 0 ? Math.max(...bounds.map(b => b.right)) : 0;
    const minTop = bounds.length > 0 ? Math.min(...bounds.map(b => b.top)) : 0;
    const maxBottom = bounds.length > 0 ? Math.max(...bounds.map(b => b.bottom)) : 0;

    const width = maxRight - minLeft;
    const height = maxBottom - minTop;

    const handleHandleDown = useCallback((e: React.PointerEvent, corner: HandleCorner) => {
        if (selectedItems.length <= 1) return;
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const rect = getContainerRect();
        dragStartRef.current = {
            corner,
            startX: e.clientX,
            startY: e.clientY,
            startBounds: { left: minLeft, top: minTop, width, height },
            initialItems: selectedItems.map(it => ({
                id: it.id,
                x: it.x,
                y: it.y,
                width: it.width,
                height: it.height,
            })),
        };

        const handlePointerMove = (me: PointerEvent) => {
            if (!dragStartRef.current) return;
            const dxPct = ((me.clientX - dragStartRef.current.startX) / rect.width) * 100;
            const dyPct = ((me.clientY - dragStartRef.current.startY) / rect.height) * 100;

            const sb = dragStartRef.current.startBounds;
            let newW = sb.width;
            let newH = sb.height;

            if (corner.includes('right')) newW = Math.max(2, sb.width + dxPct);
            if (corner.includes('left')) newW = Math.max(2, sb.width - dxPct);
            if (corner.includes('bottom')) newH = Math.max(2, sb.height + dyPct);
            if (corner.includes('top')) newH = Math.max(2, sb.height - dyPct);

            const scaleX = newW / sb.width;
            const scaleY = newH / sb.height;

            const store = usePresentationStore.getState();
            dragStartRef.current.initialItems.forEach(orig => {
                const relX = (orig.x - sb.left) / sb.width;
                const relY = (orig.y - sb.top) / sb.height;

                const curLeft = corner.includes('left') ? (sb.left + sb.width - newW) : sb.left;
                const curTop = corner.includes('top') ? (sb.top + sb.height - newH) : sb.top;

                store.updateCanvasItem(slideId, orig.id, {
                    x: Math.round((curLeft + relX * newW) * 10) / 10,
                    y: Math.round((curTop + relY * newH) * 10) / 10,
                    width: Math.round((orig.width * scaleX) * 10) / 10,
                    height: Math.round((orig.height * scaleY) * 10) / 10,
                });
            });
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
            dragStartRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }, [getContainerRect, minLeft, minTop, width, height, selectedItems, slideId]);

    if (selectedItems.length <= 1) return null;

    const effectiveTotalScale = canvasScale || 1;
    const safeScale = effectiveTotalScale > 0 ? effectiveTotalScale : 1;
    const counterScale = 1 / safeScale;

    const handles: Array<{ corner: HandleCorner; style: React.CSSProperties; cursor: string }> = [
        { corner: 'top-left', style: { top: '0%', left: '0%' }, cursor: 'nwse-resize' },
        { corner: 'top-center', style: { top: '0%', left: '50%' }, cursor: 'ns-resize' },
        { corner: 'top-right', style: { top: '0%', left: '100%' }, cursor: 'nesw-resize' },
        { corner: 'middle-left', style: { top: '50%', left: '0%' }, cursor: 'ew-resize' },
        { corner: 'middle-right', style: { top: '50%', left: '100%' }, cursor: 'ew-resize' },
        { corner: 'bottom-left', style: { top: '100%', left: '0%' }, cursor: 'nesw-resize' },
        { corner: 'bottom-center', style: { top: '100%', left: '50%' }, cursor: 'ns-resize' },
        { corner: 'bottom-right', style: { top: '100%', left: '100%' }, cursor: 'nwse-resize' },
    ];

    const borderWidth = Math.max(1.5, 1.5 / safeScale);
    const shadowWidth = Math.max(1, 1 / safeScale);

    const commonGroupId = selectedItems.length > 1 && selectedItems.every(i => i.groupId && i.groupId === selectedItems[0]?.groupId);
    const isMaskGroup = commonGroupId && selectedItems.some(i => i.isMask);

    return (
        <div
            className="absolute pointer-events-none z-35 border-accent"
            style={{
                left: `${minLeft}%`,
                top: `${minTop}%`,
                width: `${width}%`,
                height: `${height}%`,
                borderStyle: 'solid',
                borderWidth: `${borderWidth}px`,
                borderColor: 'rgb(var(--accent, 245 158 11))',
                boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85), inset 0 0 0 ${shadowWidth}px rgba(0,0,0,0.45)`,
            }}
        >
            {/* Group Label Pill */}
            {commonGroupId && (
                <div
                    className="absolute left-0 bottom-full mb-1 px-1.5 py-0.5 rounded bg-accent text-black flex items-center gap-1 font-semibold text-[9px] pointer-events-none select-none shadow-sm"
                    style={{ transform: `scale(${counterScale})`, transformOrigin: 'bottom left' }}
                >
                    {isMaskGroup ? <Blend className="w-2.5 h-2.5" /> : <Group className="w-2.5 h-2.5" />}
                    <span>{isMaskGroup ? 'Mask Group' : 'Group'}</span>
                </div>
            )}

            {/* Unified 8 Handles (suppressed when Alt is held for distance measurement) */}
            {!isAltHeld && handles.map(h => (
                <div
                    key={h.corner}
                    className="absolute w-2 h-2 bg-accent border border-black/50 shadow-xs pointer-events-auto"
                    style={{
                        ...h.style,
                        transform: `translate(-50%, -50%) scale(${counterScale})`,
                        cursor: h.cursor,
                    }}
                    onPointerDown={(e) => handleHandleDown(e, h.corner)}
                />
            ))}
        </div>
    );
});

CanvasMultiSelectionBox.displayName = 'CanvasMultiSelectionBox';

