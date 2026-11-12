import React, { memo, useRef } from 'react';
import { ICanvasItem } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { getLineAngleAndLength, snapAngleToStep } from './renderers/shapeGeometry';

interface CanvasLineHandlesProps {
  item: ICanvasItem;
  slideId: string;
  canvasScale: number;
}

/**
 * 2-Point Vector Line Controller for Deck.CE.
 * Provides Start and End circular handles for vector lines.
 * Supports angle rotation, length resizing, and Shift-key 45° snapping.
 */
export const CanvasLineHandles: React.FC<CanvasLineHandlesProps> = memo(({
  item,
  slideId,
  canvasScale,
}) => {
  const safeScale = canvasScale > 0 ? canvasScale : 1;
  const counterScale = 1 / safeScale;
  const rafIdRef = useRef<number | null>(null);

  // Cleanup pending RAF on unmount
  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent, handleType: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Find the slide container element to convert screen coords to slide percentage
    const slideContainer = document.getElementById('slide-canvas-container');
    const containerRect = slideContainer ? slideContainer.getBoundingClientRect() : null;
    const contW = containerRect?.width || (1920 * safeScale);
    const contH = containerRect?.height || (1080 * safeScale);

    // Initial item geometry (item.x and item.y represent the center of the line)
    const centerStartX = item.x;
    const centerStartY = item.y;
    const initialWidth = item.width;
    const initialRot = item.rotation || 0;
    const rad = (initialRot * Math.PI) / 180;

    // Calculate actual fixed endpoints P1 (start) and P2 (end) in slide %
    const halfDx = (initialWidth / 2) * Math.cos(rad);
    const halfDy = (initialWidth / 2) * (contW / contH) * Math.sin(rad);

    const p1x = centerStartX - halfDx;
    const p1y = centerStartY - halfDy;
    const p2x = centerStartX + halfDx;
    const p2y = centerStartY + halfDy;

    const onPointerMove = (me: PointerEvent) => {
      if (!containerRect) return;

      const mouseX = ((me.clientX - containerRect.left) / contW) * 100;
      const mouseY = ((me.clientY - containerRect.top) / contH) * 100;

      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        if (handleType === 'end') {
          // Dragging End Point: P1 (p1x, p1y) is strictly fixed
          const dx = mouseX - p1x;
          const dy = (mouseY - p1y) * (contH / contW);
          const res = getLineAngleAndLength(0, 0, dx, dy);
          let angle = res.angleDeg;
          if (me.shiftKey) {
            angle = snapAngleToStep(angle, 45);
          }
          const width = Math.max(0.5, res.length);
          const newRad = (angle * Math.PI) / 180;
          const endDx = width * Math.cos(newRad);
          const endDy = width * (contW / contH) * Math.sin(newRad);
          const newP2x = p1x + endDx;
          const newP2y = p1y + endDy;

          usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
            x: (p1x + newP2x) / 2,
            y: (p1y + newP2y) / 2,
            width,
            rotation: angle,
          });
        } else {
          // Dragging Start Point: P2 (p2x, p2y) is strictly fixed
          const dx = p2x - mouseX;
          const dy = (p2y - mouseY) * (contH / contW);
          const res = getLineAngleAndLength(0, 0, dx, dy);
          let angle = res.angleDeg;
          if (me.shiftKey) {
            angle = snapAngleToStep(angle, 45);
          }
          const width = Math.max(0.5, res.length);
          const newRad = (angle * Math.PI) / 180;
          const startDx = width * Math.cos(newRad);
          const startDy = width * (contW / contH) * Math.sin(newRad);
          const newP1x = p2x - startDx;
          const newP1y = p2y - startDy;

          usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
            x: (newP1x + p2x) / 2,
            y: (newP1y + p2y) / 2,
            width,
            rotation: angle,
          });
        }
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Start Point Handle */}
      <div
        className="absolute w-3 h-3 rounded-full bg-white border-2 border-accent ring-1 ring-black/30 shadow-md pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
        style={{
          left: '0px',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${counterScale})`,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'start')}
        title="Start Point (Hold Shift for 45° snap)"
      />

      {/* End Point Handle */}
      <div
        className="absolute w-3 h-3 rounded-full bg-white border-2 border-accent ring-1 ring-black/30 shadow-md pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
        style={{
          left: '100%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${counterScale})`,
        }}
        onPointerDown={(e) => handlePointerDown(e, 'end')}
        title="End Point (Hold Shift for 45° snap)"
      />
    </div>
  );
});

CanvasLineHandles.displayName = 'CanvasLineHandles';

