import { ICanvasItem } from '@/core/types';
import { recalculatePathBounds } from '../renderers/vectorGeometry';

/**
 * Creates a new vector path item placed at the specified canvas click percentage coordinates.
 */
export function createDefaultPathItem(clickX: number, clickY: number): ICanvasItem {
  return {
    id: crypto.randomUUID(),
    type: 'path',
    x: Math.round(Math.max(5, Math.min(75, clickX - 10))),
    y: Math.round(Math.max(5, Math.min(75, clickY - 10))),
    width: 20,
    height: 20,
    rotation: 0,
    zIndex: 10,
    locked: false,
    visible: true,
    path: {
      nodes: [
        { id: crypto.randomUUID(), x: 0, y: 0, isCorner: false },
        { id: crypto.randomUUID(), x: 100, y: 100, isCorner: false },
      ],
      isClosed: false,
    },
    fills: [],
    strokes: [
      {
        id: crypto.randomUUID(),
        type: 'color',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        color: '#ffffff',
      },
    ],
    borderWidth: 1,
  };
}

/**
 * Normalizes path items to a tight bounding box around its nodes (Figma Done behavior).
 * Supports full-canvas pen containers as well as arbitrary deformed path items.
 */
export function normalizePathItemBounds(item: ICanvasItem): Partial<ICanvasItem> {
  if (item.type !== 'path' || !item.path?.nodes || item.path.nodes.length < 2) return {};
  const nodes = item.path.nodes;
  const isClosed = Boolean(item.path.isClosed);
  const { minX, minY, maxX, maxY } = recalculatePathBounds(nodes, isClosed);

  const isFullSlide = item.width === 100 && item.height === 100 && item.x === 50 && item.y === 50;
  const isOutOfBounds = minX < -0.5 || maxX > 100.5 || minY < -0.5 || maxY > 100.5;
  const isLooseBounds = minX > 3 || maxX < 97 || minY > 3 || maxY < 97;

  // If already tightly bounded and not full-slide or if rotated, skip normalization
  if (!isFullSlide && (item.rotation || (!isOutOfBounds && !isLooseBounds))) {
    return {};
  }

  const left = item.x - item.width / 2;
  const top = item.y - item.height / 2;
  const toSlideX = (lx: number) => left + (lx / 100) * item.width;
  const toSlideY = (ly: number) => top + (ly / 100) * item.height;

  const slideMinX = toSlideX(minX);
  const slideMaxX = toSlideX(maxX);
  const slideMinY = toSlideY(minY);
  const slideMaxY = toSlideY(maxY);

  const newW = Math.max(1, slideMaxX - slideMinX);
  const newH = Math.max(1, slideMaxY - slideMinY);
  const newX = slideMinX + newW / 2;
  const newY = slideMinY + newH / 2;

  const normalizedNodes = nodes.map(n => ({
    ...n,
    x: Math.round((((toSlideX(n.x) - slideMinX) / newW) * 100) * 10) / 10,
    y: Math.round((((toSlideY(n.y) - slideMinY) / newH) * 100) * 10) / 10,
    handleIn: n.handleIn ? {
      x: Math.round((((toSlideX(n.handleIn.x) - slideMinX) / newW) * 100) * 10) / 10,
      y: Math.round((((toSlideY(n.handleIn.y) - slideMinY) / newH) * 100) * 10) / 10,
    } : undefined,
    handleOut: n.handleOut ? {
      x: Math.round((((toSlideX(n.handleOut.x) - slideMinX) / newW) * 100) * 10) / 10,
      y: Math.round((((toSlideY(n.handleOut.y) - slideMinY) / newH) * 100) * 10) / 10,
    } : undefined,
  }));

  return {
    x: Math.round(newX * 10) / 10,
    y: Math.round(newY * 10) / 10,
    width: Math.round(newW * 10) / 10,
    height: Math.round(newH * 10) / 10,
    path: {
      ...item.path,
      nodes: normalizedNodes,
    },
  };
}


