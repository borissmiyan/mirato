import React, { useCallback, useRef, useState, useMemo } from 'react';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { calculateGradientEndpoints, calculateGradientAngleFromDrag } from './renderers/shapes/gradientGeometry';

interface CanvasGradientHandlesProps {
  item: ICanvasItem;
  slideId: string;
  canvasScale?: number;
}

export const CanvasGradientHandles: React.FC<CanvasGradientHandlesProps> = React.memo(({
  item,
  slideId,
  canvasScale = 1,
}) => {
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);
  const [optimisticAngle, setOptimisticAngle] = useState<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Find the first visible gradient layer in item fills
  const gradientLayerIndex = useMemo(() => {
    return item.fills?.findIndex((f) => f.type === 'gradient' && f.visible !== false && !!f.gradient) ?? -1;
  }, [item.fills]);

  const gradientLayer: IStyleLayer | null = gradientLayerIndex >= 0 ? item.fills[gradientLayerIndex] : null;

  const currentAngle = optimisticAngle ?? gradientLayer?.gradient?.angle ?? 90;

  const endpoints = useMemo(() => {
    return calculateGradientEndpoints(
      { x: item.x, y: item.y, width: item.width, height: item.height },
      currentAngle
    );
  }, [item.x, item.y, item.width, item.height, currentAngle]);

  const handlePointerDown = useCallback((e: React.PointerEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDrag(handle);

    const container = document.getElementById('slide-canvas-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onPointerMove = (moveEv: PointerEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        const ptrPercentX = ((moveEv.clientX - rect.left) / rect.width) * 100;
        const ptrPercentY = ((moveEv.clientY - rect.top) / rect.height) * 100;

        const effectivePtr = handle === 'start'
          ? { x: item.x - (ptrPercentX - item.x), y: item.y - (ptrPercentY - item.y) }
          : { x: ptrPercentX, y: ptrPercentY };

        const newAngle = calculateGradientAngleFromDrag(
          { x: item.x, y: item.y, width: item.width, height: item.height },
          effectivePtr,
          moveEv.shiftKey
        );

        setOptimisticAngle(newAngle);
      });
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      setActiveDrag(null);

      setOptimisticAngle((finalAngle) => {
        if (finalAngle !== null && gradientLayer && gradientLayerIndex >= 0) {
          const updatedFills = [...item.fills];
          updatedFills[gradientLayerIndex] = {
            ...gradientLayer,
            gradient: {
              ...gradientLayer.gradient!,
              angle: finalAngle,
            },
          };

          usePresentationStore.getState().updateCanvasItem(slideId, item.id, { fills: updatedFills }).catch(console.error);
          usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [gradientLayer, gradientLayerIndex, item.fills, item.height, item.id, item.width, item.x, item.y, slideId]);

  if (!gradientLayer || !gradientLayer.gradient) return null;

  const stops = gradientLayer.gradient.stops || [
    { offset: 0, color: gradientLayer.gradient.from || '#ff007a' },
    { offset: 100, color: gradientLayer.gradient.to || '#7928ca' },
  ];

  const scaleSafe = canvasScale > 0 ? canvasScale : 1;
  const handleRadius = 6 / scaleSafe;
  const strokeWidth = 1.5 / scaleSafe;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <svg className="w-full h-full overflow-visible">
        {/* Gradient Vector Line */}
        <line
          x1={`${endpoints.start.x}%`}
          y1={`${endpoints.start.y}%`}
          x2={`${endpoints.end.x}%`}
          y2={`${endpoints.end.y}%`}
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth={strokeWidth}
          strokeDasharray="4 2"
          className="drop-shadow-md"
        />

        {/* Intermediate Color Stops */}
        {stops.map((stop, idx) => {
          const t = stop.offset / 100;
          const stopX = endpoints.start.x + (endpoints.end.x - endpoints.start.x) * t;
          const stopY = endpoints.start.y + (endpoints.end.y - endpoints.start.y) * t;

          return (
            <circle
              key={`grad-stop-${idx}`}
              cx={`${stopX}%`}
              cy={`${stopY}%`}
              r={handleRadius * 0.8}
              fill={stop.color}
              stroke="#ffffff"
              strokeWidth={strokeWidth}
              className="drop-shadow-md pointer-events-auto cursor-pointer"
            />
          );
        })}

        {/* Start Handle Circle */}
        <circle
          cx={`${endpoints.start.x}%`}
          cy={`${endpoints.start.y}%`}
          r={handleRadius}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={strokeWidth}
          className="drop-shadow-lg pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
          onPointerDown={(e) => handlePointerDown(e, 'start')}
        />

        {/* End Handle Circle (Direction Arrow / Diamond) */}
        <circle
          cx={`${endpoints.end.x}%`}
          cy={`${endpoints.end.y}%`}
          r={handleRadius}
          fill="#9333ea"
          stroke="#ffffff"
          strokeWidth={strokeWidth}
          className="drop-shadow-lg pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
          onPointerDown={(e) => handlePointerDown(e, 'end')}
        />
      </svg>
    </div>
  );
});

CanvasGradientHandles.displayName = 'CanvasGradientHandles';

