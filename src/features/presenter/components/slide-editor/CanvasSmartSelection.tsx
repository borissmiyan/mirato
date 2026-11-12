import React, { memo, useRef, useCallback, useState, useEffect } from 'react';
import { ICanvasItem } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { analyzeSelectionSpacing, adjustUniformGap, swapItemPositions } from '@/core/utils/tidyUpUtils';

interface CanvasSmartSelectionProps {
  selectedItems: ICanvasItem[];
  slideId: string;
  canvasScale?: number;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

/**
 * Figma-Grade Smart Selection Overlay.
 * Displays interactive pink gap scrubbers and item swap handles directly on canvas.
 */
export const CanvasSmartSelection: React.FC<CanvasSmartSelectionProps> = memo(({
  selectedItems,
  slideId,
  canvasScale = 1,
}) => {
  const safeScale = canvasScale > 0 ? canvasScale : 1;
  const counterScale = 1 / safeScale;

  const dragRef = useRef<{
    type: 'gap' | 'swap';
    startX: number;
    startY: number;
    startGapPx: number;
    initialItems: ICanvasItem[];
    activeItemId?: string;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const [localItems, setLocalItems] = useState<ICanvasItem[]>(selectedItems);

  useEffect(() => {
    setLocalItems(selectedItems);
  }, [selectedItems]);

  const spacingInfo = analyzeSelectionSpacing(localItems);
  if (localItems.length < 3 || spacingInfo.direction === 'grid') {
    return null;
  }

  const { direction, sortedItems, gapsPx } = spacingInfo;

  const handlePointerDownGap = (e: React.PointerEvent, initialGap: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      type: 'gap',
      startX: e.clientX,
      startY: e.clientY,
      startGapPx: initialGap,
      initialItems: [...sortedItems],
    };

    const onPointerMove = (me: PointerEvent) => {
      if (!dragRef.current) return;
      const dxPx = (me.clientX - dragRef.current.startX) * counterScale;
      const dyPx = (me.clientY - dragRef.current.startY) * counterScale;
      const delta = direction === 'row' ? dxPx : dyPx;
      const targetGap = Math.max(0, dragRef.current.startGapPx + delta);

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!dragRef.current) return;
        const updated = adjustUniformGap(dragRef.current.initialItems, direction, targetGap);
        setLocalItems(updated);
        const updates = updated.map((it) => ({
          id: it.id,
          updates: { x: it.x, y: it.y },
        }));
        usePresentationStore.getState().updateCanvasItems(slideId, updates).catch(console.error);
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      dragRef.current = null;
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handlePointerDownSwap = (e: React.PointerEvent, item: ICanvasItem) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      type: 'swap',
      startX: e.clientX,
      startY: e.clientY,
      startGapPx: 0,
      initialItems: [...sortedItems],
      activeItemId: item.id,
    };

    const onPointerMove = (me: PointerEvent) => {
      if (!dragRef.current || !dragRef.current.activeItemId) return;

      // Find item under cursor to swap with
      const targetEl = document.elementFromPoint(me.clientX, me.clientY);
      const targetSwapItemEl = targetEl?.closest('[data-swap-item-id]');
      const targetItemId = targetSwapItemEl?.getAttribute('data-swap-item-id');

      if (targetItemId && targetItemId !== dragRef.current.activeItemId) {
        const itemA = sortedItems.find((i) => i.id === dragRef.current!.activeItemId);
        const itemB = sortedItems.find((i) => i.id === targetItemId);

        if (itemA && itemB) {
          const { updatedA, updatedB } = swapItemPositions(itemA, itemB);
          const updates = [
            { id: updatedA.id, updates: { x: updatedA.x, y: updatedA.y } },
            { id: updatedB.id, updates: { x: updatedB.x, y: updatedB.y } },
          ];
          usePresentationStore.getState().updateCanvasItems(slideId, updates).catch(console.error);
        }
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dragRef.current = null;
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-35 overflow-visible">
      {/* 1. Pink Gap Scrubbers between consecutive items */}
      {sortedItems.slice(0, -1).map((item, index) => {
        const next = sortedItems[index + 1];
        if (!next) return null;

        const currentGapPx = gapsPx[index] ?? 20;

        let handleLeftPct: number;
        let handleTopPct: number;

        if (direction === 'row') {
          const itemRightPct = item.x - ((item.pivotX ?? 50) / 100) * item.width + item.width;
          const nextLeftPct = next.x - ((next.pivotX ?? 50) / 100) * next.width;
          handleLeftPct = (itemRightPct + nextLeftPct) / 2;
          handleTopPct = item.y;
        } else {
          const itemBottomPct = item.y - ((item.pivotY ?? 50) / 100) * item.height + item.height;
          const nextTopPct = next.y - ((next.pivotY ?? 50) / 100) * next.height;
          handleLeftPct = item.x;
          handleTopPct = (itemBottomPct + nextTopPct) / 2;
        }

        return (
          <div
            key={`gap-handle-${item.id}-${next.id}`}
            className="absolute flex items-center justify-center pointer-events-auto cursor-ew-resize hover:scale-125 transition-transform"
            style={{
              left: `${handleLeftPct}%`,
              top: `${handleTopPct}%`,
              transform: `translate(-50%, -50%) scale(${counterScale})`,
            }}
            onPointerDown={(e) => handlePointerDownGap(e, currentGapPx)}
            title={`Adjust Spacing (${Math.round(currentGapPx)}px)`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-white shadow-xs" />
          </div>
        );
      })}

      {/* 2. Center Swap Dots on each item */}
      {sortedItems.map((item) => (
        <div
          key={`swap-dot-${item.id}`}
          data-swap-item-id={item.id}
          className="absolute flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            transform: `translate(-50%, -50%) scale(${counterScale})`,
          }}
          onPointerDown={(e) => handlePointerDownSwap(e, item)}
          title="Drag to swap position (Figma Grid Swap)"
        >
          <div className="w-2 h-2 rounded-full bg-pink-500 border border-white shadow-xs opacity-80 hover:opacity-100" />
        </div>
      ))}
    </div>
  );
});

CanvasSmartSelection.displayName = 'CanvasSmartSelection';

