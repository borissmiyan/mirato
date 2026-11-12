import React, { useRef, useState, useCallback } from 'react';
import { ICanvasItem, ShapeType } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { createCanvasItem } from '@/features/presenter/components/slide-properties/helpers';
import { normalizePathItemBounds } from '../utils/createPathItem';
import { calculateShapeDragBounds, calculateLineDrag, createInitialPenPathItem, configureShapeItemData } from '../utils/canvasDrawingMath';

interface UseCanvasDrawingProps {
  slideId: string;
  canvasTool: string;
  setCanvasTool: (tool: string) => void;
  getContainerRect: () => { left: number; top: number; width: number; height: number } | DOMRect;
  setSelectedIds: (ids: string[]) => void;
  vectorEditingId: string | null;
  setVectorEditingId: (id: string | null) => void;
  resolvedItems: ICanvasItem[];
}

export interface DrawingPreview {
  type: 'shape' | 'line';
  shapeType?: ShapeType;
  // For shapes: percentage bounds
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  // For lines: percentage coordinates
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export function useCanvasDrawing({
  slideId,
  canvasTool,
  setCanvasTool,
  getContainerRect,
  setSelectedIds,
  vectorEditingId,
  setVectorEditingId,
  resolvedItems,
}: UseCanvasDrawingProps) {
  const [drawingPreview, setDrawingPreview] = useState<DrawingPreview | null>(null);
  const drawingStartRef = useRef<{ clientX: number; clientY: number; pctX: number; pctY: number } | null>(null);
  const penDragRef = useRef<{ itemId: string; nodeId: string; startX: number; startY: number } | null>(null);

  const isDrawingTool = canvasTool === 'line' || canvasTool === 'stroke' || canvasTool.startsWith('shape:') || canvasTool === 'shape' || canvasTool === 'pen';

  const handleDrawingPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isDrawingTool) return false;

    const rect = getContainerRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    // Handle Pen tool click-to-place point
    if (canvasTool === 'pen') {
      const activePathItem = vectorEditingId
        ? resolvedItems.find((it) => it.id === vectorEditingId && it.type === 'path')
        : null;

      const newNodeId = crypto.randomUUID();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      if (!activePathItem) {
        // First point: create new full-slide path item with single node
        const newPathItem = createInitialPenPathItem(newNodeId, pctX, pctY);
        usePresentationStore.getState().addCanvasItem(slideId, newPathItem);
        setSelectedIds([newPathItem.id]);
        setVectorEditingId(newPathItem.id);
        penDragRef.current = { itemId: newPathItem.id, nodeId: newNodeId, startX: pctX, startY: pctY };
      } else {
        // Appending to existing active path item
        const existingNodes = activePathItem.path?.nodes || [];
        const firstNode = existingNodes[0];

        // If clicked near first node, close path, normalize bounds, and finish pen tool
        if (firstNode && Math.hypot(pctX - firstNode.x, pctY - firstNode.y) < 2.5) {
          const closedItem: ICanvasItem = {
            ...activePathItem,
            path: {
              nodes: existingNodes,
              isClosed: true,
            },
          };
          const normalizedUpdates = normalizePathItemBounds(closedItem);
          usePresentationStore.getState().updateCanvasItem(slideId, activePathItem.id, {
            path: {
              nodes: existingNodes,
              isClosed: true,
            },
            ...normalizedUpdates,
          });
          usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
          setCanvasTool('select');
          setVectorEditingId(null);
          return true;
        }

        // Add new node
        const nextNodes = [
          ...existingNodes,
          { id: newNodeId, x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10, isCorner: true },
        ];
        usePresentationStore.getState().updateCanvasItem(slideId, activePathItem.id, {
          path: {
            nodes: nextNodes,
            isClosed: false,
          },
        });
        penDragRef.current = { itemId: activePathItem.id, nodeId: newNodeId, startX: pctX, startY: pctY };
      }
      return true;
    }

    // Drag-to-draw for Shapes and Lines
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      pctX,
      pctY,
    };
    return true;
  }, [isDrawingTool, canvasTool, getContainerRect, vectorEditingId, resolvedItems, slideId, setSelectedIds, setVectorEditingId, setCanvasTool]);

  const handleDrawingPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = getContainerRect();
    const currPctX = ((e.clientX - rect.left) / rect.width) * 100;
    const currPctY = ((e.clientY - rect.top) / rect.height) * 100;

    if (penDragRef.current) {
      const { itemId, nodeId, startX, startY } = penDragRef.current;
      const dx = currPctX - startX;
      const dy = currPctY - startY;
      if (Math.hypot(dx, dy) > 0.4) {
        const item = resolvedItems.find((it) => it.id === itemId);
        if (item?.path?.nodes) {
          const updatedNodes = item.path.nodes.map((n) => {
            if (n.id !== nodeId) return n;
            return {
              ...n,
              isCorner: false,
              handleOut: { x: Math.round((startX + dx) * 10) / 10, y: Math.round((startY + dy) * 10) / 10 },
              handleIn: { x: Math.round((startX - dx) * 10) / 10, y: Math.round((startY - dy) * 10) / 10 },
            };
          });
          usePresentationStore.getState().updateCanvasItem(slideId, itemId, {
            path: { ...item.path, nodes: updatedNodes },
          });
        }
      }
      return;
    }

    if (!drawingStartRef.current) return;

    const start = drawingStartRef.current;
    const isLine = canvasTool === 'line' || canvasTool === 'stroke';

    if (isLine) {
      const lineRes = calculateLineDrag(start, currPctX, currPctY, rect, e.shiftKey);
      setDrawingPreview({
        type: 'line',
        x1: lineRes.x1,
        y1: lineRes.y1,
        x2: lineRes.x2,
        y2: lineRes.y2,
      });
    } else {
      const shapeType: ShapeType = canvasTool.startsWith('shape:')
        ? (canvasTool.replace('shape:', '') as ShapeType)
        : 'rect';
      const bounds = calculateShapeDragBounds(start, currPctX, currPctY, rect, e.altKey, e.shiftKey);
      setDrawingPreview({
        type: 'shape',
        shapeType,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
    }
  }, [canvasTool, getContainerRect, resolvedItems, slideId]);

  const handleDrawingPointerUp = useCallback((e: React.PointerEvent) => {
    if (penDragRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      penDragRef.current = null;
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
      return;
    }

    if (!drawingStartRef.current) return;

    const start = drawingStartRef.current;
    drawingStartRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDrawingPreview(null);

    const rect = getContainerRect();
    const currPctX = ((e.clientX - rect.left) / rect.width) * 100;
    const currPctY = ((e.clientY - rect.top) / rect.height) * 100;

    const distPx = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY);
    const isLine = canvasTool === 'line' || canvasTool === 'stroke';

    if (isLine) {
      const item = createCanvasItem('stroke');
      if (distPx < 5) {
        item.x = Math.max(10, Math.min(90, start.pctX));
        item.y = Math.max(5, Math.min(95, start.pctY));
        item.width = 20;
        item.rotation = 0;
      } else {
        const lineRes = calculateLineDrag(start, currPctX, currPctY, rect, e.shiftKey);
        item.x = lineRes.x;
        item.y = lineRes.y;
        item.width = lineRes.width;
        item.rotation = lineRes.rotation;
      }

      usePresentationStore.getState().addCanvasItem(slideId, item);
      setSelectedIds([item.id]);
      setCanvasTool('select');
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
      return;
    }

    // Shape creation
    const shapeType: ShapeType = canvasTool.startsWith('shape:')
      ? (canvasTool.replace('shape:', '') as ShapeType)
      : 'rect';

    const item = createCanvasItem('shape');
    configureShapeItemData(item, shapeType);

    if (distPx < 5) {
      item.width = 20;
      item.height = 20;
      item.x = Math.max(10, Math.min(90, start.pctX));
      item.y = Math.max(10, Math.min(90, start.pctY));
    } else {
      const bounds = calculateShapeDragBounds(start, currPctX, currPctY, rect, e.altKey, e.shiftKey);
      item.width = bounds.width;
      item.height = bounds.height;
      item.x = bounds.x;
      item.y = bounds.y;
    }

    usePresentationStore.getState().addCanvasItem(slideId, item);
    setSelectedIds([item.id]);
    setCanvasTool('select');
    usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
  }, [canvasTool, getContainerRect, slideId, setSelectedIds, setCanvasTool]);

  return {
    isDrawingTool,
    drawingPreview,
    handleDrawingPointerDown,
    handleDrawingPointerMove,
    handleDrawingPointerUp,
  };
}

