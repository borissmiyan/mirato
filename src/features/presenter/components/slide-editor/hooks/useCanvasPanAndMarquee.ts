import { useRef, useState, useEffect } from 'react';
import { ICanvasItem } from '@/core/types';
import { IMarqueeRect } from '../CanvasMarqueeBox';
import { checkItemIntersectsBox } from '@/core/utils/canvasDistribution';

interface UseCanvasPanAndMarqueeProps {
  canvasTool: string;
  offset: { x: number; y: number };
  setOffset: (offset: { x: number; y: number }) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getContainerRect: () => { left: number; top: number; width: number; height: number; } | DOMRect;
  sortedItems: ICanvasItem[];
  setSelectedIds: (ids: string[]) => void;
  setLatestArea: (area: 'canvas') => void;
}

export function useCanvasPanAndMarquee({
  canvasTool,
  offset,
  setOffset,
  containerRef,
  getContainerRect,
  sortedItems,
  setSelectedIds,
  setLatestArea,
}: UseCanvasPanAndMarqueeProps) {
  const [marqueeBox, setMarqueeBox] = useState<IMarqueeRect | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const marqueeStartRef = useRef<{ clientX: number; clientY: number; pctX: number; pctY: number } | null>(null);
  const marqueeMovedRef = useRef(false);
  const panDownRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Figma Spacebar-to-Pan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (isInput) return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpaceHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setLatestArea('canvas');
    if (canvasTool === 'pan' || isSpaceHeld) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      panDownRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: offset.x,
        startY: offset.y,
      };
    } else if (e.target === containerRef.current && canvasTool === 'select') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      marqueeMovedRef.current = false;
      const rect = getContainerRect();
      const pctX = ((e.clientX - rect.left) / rect.width) * 100;
      const pctY = ((e.clientY - rect.top) / rect.height) * 100;
      marqueeStartRef.current = { clientX: e.clientX, clientY: e.clientY, pctX, pctY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (panDownRef.current) {
      const dx = e.clientX - panDownRef.current.x;
      const dy = e.clientY - panDownRef.current.y;
      setOffset({
        x: panDownRef.current.startX + dx,
        y: panDownRef.current.startY + dy,
      });
    } else if (marqueeStartRef.current) {
      const rect = getContainerRect();
      const dist = Math.hypot(e.clientX - marqueeStartRef.current.clientX, e.clientY - marqueeStartRef.current.clientY);
      if (dist > 3) {
        marqueeMovedRef.current = true;
        const currPctX = ((e.clientX - rect.left) / rect.width) * 100;
        const currPctY = ((e.clientY - rect.top) / rect.height) * 100;
        const left = Math.min(marqueeStartRef.current.pctX, currPctX);
        const top = Math.min(marqueeStartRef.current.pctY, currPctY);
        const width = Math.abs(currPctX - marqueeStartRef.current.pctX);
        const height = Math.abs(currPctY - marqueeStartRef.current.pctY);
        setMarqueeBox({ left, top, width, height });

        const boxBounds = { left, top, right: left + width, bottom: top + height };
        const intersected = sortedItems.filter(it => !it.locked && it.visible !== false && checkItemIntersectsBox(it, boxBounds));
        setSelectedIds(intersected.map(it => it.id));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (panDownRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      panDownRef.current = null;
    }
    if (marqueeStartRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      marqueeStartRef.current = null;
      setMarqueeBox(null);
    }
  };

  return {
    marqueeBox,
    marqueeMovedRef,
    panDownRef,
    isSpaceHeld,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

