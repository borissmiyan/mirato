import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ICanvasItem, ShapeType } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { CanvasHUD } from './CanvasHUD';
import {
  ICornerRadiusHandle,
  getRectCornerHandles,
  getPolygonCornerHandles,
  getStarCornerHandles,
} from './utils/cornerHandleUtils';
import { generatePolygonPath, generateStarPath } from './renderers/shapeGeometry';

interface CanvasCornerRadiusHandlesProps {
  item: ICanvasItem;
  slideId: string;
  itemScale?: number;
  canvasScale?: number;
}

/**
 * Figma-grade On-Canvas Corner Radius Handles.
 * Standardized circular handles positioned along corner angle bisectors.
 * Supports rect (4 corners), polygon (N vertices), and star (outer rays & inner valleys).
 * Holding Alt allows adjusting an individual corner's fillet.
 */
export const CanvasCornerRadiusHandles: React.FC<CanvasCornerRadiusHandlesProps> = React.memo(({
  item,
  slideId,
  itemScale = 1,
  canvasScale = 1,
}) => {
  const [activeRadius, setActiveRadius] = useState<number | null>(null);
  const [activeHandleId, setActiveHandleId] = useState<string | null>(null);
  const [isAltActive, setIsAltActive] = useState<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const latestRadiusRef = useRef<number>(0);
  const dragStartRef = useRef<{
    handle: ICornerRadiusHandle;
    startX: number;
    startY: number;
    startRadius: number;
    isAlt: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const shapeType: ShapeType = item.shape?.shapeType ?? 'rect';
  const isSupported =
    item.type !== 'path' &&
    item.type !== 'stroke' &&
    (item.type === 'shape' ||
      item.type === 'image' ||
      item.type === 'video' ||
      typeof item.borderRadius === 'number');

  const widthPx = Math.round(item.width * 19.2);
  const heightPx = Math.round(item.height * 10.8);
  const effectiveTotalScale = (itemScale || 1) * (canvasScale || 1);
  const safeScale = effectiveTotalScale > 0 ? effectiveTotalScale : 1;
  const counterScale = 1 / safeScale;

  // Compute handles based on shape type
  const handles = useMemo<ICornerRadiusHandle[]>(() => {
    if (!isSupported) return [];
    if (Math.min(widthPx, heightPx) < 16) return [];

    if (item.type === 'shape') {
      if (shapeType === 'polygon' || shapeType === 'triangle') {
        return getPolygonCornerHandles(item, widthPx, heightPx, counterScale);
      }
      if (shapeType === 'star') {
        return getStarCornerHandles(item, widthPx, heightPx, counterScale);
      }
      if (shapeType === 'rect') {
        return getRectCornerHandles(item, widthPx, heightPx, counterScale);
      }
      return [];
    }
    // Default rect for media items
    return getRectCornerHandles(item, widthPx, heightPx, counterScale);
  }, [isSupported, item, shapeType, widthPx, heightPx, counterScale]);

  const updateDomPreview = useCallback((r: number, handle: ICornerRadiusHandle, isAlt: boolean) => {
    const visualEl = document.getElementById(`visual-${item.id}`);
    const clipPathEl = document.querySelector(
      `#clip-slide-${item.id} path, [id^="clip-"][id$="-${item.id}"] path`
    ) as SVGPathElement | null;

    if (handle.target === 'rect' && visualEl) {
      if (isAlt) {
        const tl = handle.id === 'tl' ? r : (item.borderRadiusTL ?? item.borderRadius ?? 0);
        const tr = handle.id === 'tr' ? r : (item.borderRadiusTR ?? item.borderRadius ?? 0);
        const br = handle.id === 'br' ? r : (item.borderRadiusBR ?? item.borderRadius ?? 0);
        const bl = handle.id === 'bl' ? r : (item.borderRadiusBL ?? item.borderRadius ?? 0);
        visualEl.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
      } else {
        visualEl.style.setProperty('--item-border-radius', `${r}px`);
        visualEl.style.borderRadius = `${r}px`;
      }
    } else if (handle.target === 'polygon' && clipPathEl) {
      const sides = item.shape?.polygonSides ?? 3;
      const cornerRadii = isAlt
        ? (item.shape?.polygonCornerRadii ? [...item.shape.polygonCornerRadii] : Array(sides).fill(item.shape?.polygonCornerRadius ?? 0))
        : undefined;
      if (cornerRadii) cornerRadii[handle.index] = r;
      const newD = generatePolygonPath({
        ...item.shape,
        polygonSides: sides,
        polygonCornerRadius: isAlt ? (item.shape?.polygonCornerRadius ?? 0) : r,
        polygonCornerRadii: cornerRadii,
      });
      clipPathEl.setAttribute('d', newD);
    } else if ((handle.target === 'star-outer' || handle.target === 'star-inner') && clipPathEl) {
      const points = item.shape?.starPoints ?? 5;
      const outerRadii = (handle.target === 'star-outer' && isAlt)
        ? (item.shape?.starOuterRadii ? [...item.shape.starOuterRadii] : Array(points).fill(item.shape?.starOuterRadius ?? 0))
        : undefined;
      if (outerRadii) outerRadii[handle.index] = r;
      const newD = generateStarPath({
        ...item.shape,
        starPoints: points,
        starOuterRadius: handle.target === 'star-outer' ? (isAlt ? (item.shape?.starOuterRadius ?? 0) : r) : item.shape?.starOuterRadius,
        starOuterRadii: outerRadii,
        starInnerRadius: handle.target === 'star-inner' ? r : item.shape?.starInnerRadius,
      });
      clipPathEl.setAttribute('d', newD);
    }
  }, [item]);

  const handlePointerDown = (e: React.PointerEvent, handle: ICornerRadiusHandle) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const isAlt = e.altKey;
    setIsAltActive(isAlt);
    setActiveHandleId(handle.id);
    latestRadiusRef.current = handle.radius;
    dragStartRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRadius: handle.radius,
      isAlt,
    };
    setActiveRadius(handle.radius);

    const handlePointerMove = (me: PointerEvent) => {
      if (!dragStartRef.current) return;
      const curAlt = me.altKey || dragStartRef.current.isAlt;
      setIsAltActive(curAlt);

      const angleRad = ((item.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(-angleRad);
      const sin = Math.sin(-angleRad);

      const dx = me.clientX - dragStartRef.current.startX;
      const dy = me.clientY - dragStartRef.current.startY;
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;

      const deltaScreen = localDx * handle.bisectorX + localDy * handle.bisectorY;
      const deltaLogical = deltaScreen / safeScale;

      const rawRadius = Math.round(dragStartRef.current.startRadius + deltaLogical);
      const newRadius = rawRadius <= 1 ? 0 : Math.min(handle.maxRadius, rawRadius);
      latestRadiusRef.current = newRadius;
      setActiveRadius(newRadius);

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          updateDomPreview(latestRadiusRef.current, dragStartRef.current!.handle, curAlt);
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      const finalR = latestRadiusRef.current;
      const h = dragStartRef.current?.handle;
      const wasAlt = dragStartRef.current?.isAlt ?? false;

      if (h) {
        if (h.target === 'rect') {
          if (wasAlt) {
            const key = h.id === 'tl' ? 'borderRadiusTL' : h.id === 'tr' ? 'borderRadiusTR' : h.id === 'br' ? 'borderRadiusBR' : 'borderRadiusBL';
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              lockBorderRadius: false,
              [key]: finalR,
            });
          } else {
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              borderRadius: finalR,
              borderRadiusTL: finalR,
              borderRadiusTR: finalR,
              borderRadiusBL: finalR,
              borderRadiusBR: finalR,
            });
          }
        } else if (h.target === 'polygon') {
          const sides = item.shape?.polygonSides ?? 3;
          if (wasAlt) {
            const radii = item.shape?.polygonCornerRadii ? [...item.shape.polygonCornerRadii] : Array(sides).fill(item.shape?.polygonCornerRadius ?? 0);
            radii[h.index] = finalR;
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              shape: { ...item.shape, polygonSides: sides, polygonCornerRadii: radii },
            });
          } else {
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              shape: { ...item.shape, polygonSides: sides, polygonCornerRadius: finalR, polygonCornerRadii: undefined },
            });
          }
        } else if (h.target === 'star-outer') {
          const points = item.shape?.starPoints ?? 5;
          if (wasAlt) {
            const radii = item.shape?.starOuterRadii ? [...item.shape.starOuterRadii] : Array(points).fill(item.shape?.starOuterRadius ?? 0);
            radii[h.index] = finalR;
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              shape: { ...item.shape, starOuterRadii: radii },
            });
          } else {
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
              shape: { ...item.shape, starOuterRadius: finalR, starOuterRadii: undefined },
            });
          }
        } else if (h.target === 'star-inner') {
          usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
            shape: { ...item.shape, starInnerRadius: finalR },
          });
        }
        usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
      }

      dragStartRef.current = null;
      setActiveRadius(null);
      setActiveHandleId(null);
      setIsAltActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleDoubleClick = (e: React.MouseEvent, handle: ICornerRadiusHandle) => {
    e.preventDefault();
    e.stopPropagation();
    const nextR = handle.radius > 0 ? 0 : 20;

    if (handle.target === 'rect') {
      usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
        borderRadius: nextR,
        borderRadiusTL: nextR,
        borderRadiusTR: nextR,
        borderRadiusBL: nextR,
        borderRadiusBR: nextR,
      });
    } else if (handle.target === 'polygon') {
      usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
        shape: { ...item.shape, polygonCornerRadius: nextR, polygonCornerRadii: undefined },
      });
    } else if (handle.target === 'star-outer') {
      usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
        shape: { ...item.shape, starOuterRadius: nextR, starOuterRadii: undefined },
      });
    } else if (handle.target === 'star-inner') {
      usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
        shape: { ...item.shape, starInnerRadius: nextR },
      });
    }
    usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
  };

  if (handles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {handles.map((h) => (
        <div
          key={h.id}
          className="absolute w-2.5 h-2.5 rounded-full bg-white border border-accent ring-1 ring-black/40 shadow-xs pointer-events-auto cursor-crosshair hover:scale-125 transition-transform"
          style={{
            left: `${h.x}px`,
            top: `${h.y}px`,
            transform: `translate(-50%, -50%) scale(${counterScale})`,
          }}
          onPointerDown={(e) => handlePointerDown(e, h)}
          onDoubleClick={(e) => handleDoubleClick(e, h)}
          title={
            h.target === 'star-inner'
              ? 'Inner star fillet'
              : 'Drag inward to adjust fillet (Hold Alt for individual corner)'
          }
        />
      ))}

      {activeRadius !== null && (
        <CanvasHUD
          activeMode="radius"
          radius={activeRadius}
          label={isAltActive && activeHandleId ? 'ALT' : undefined}
        />
      )}
    </div>
  );
});

CanvasCornerRadiusHandles.displayName = 'CanvasCornerRadiusHandles';
