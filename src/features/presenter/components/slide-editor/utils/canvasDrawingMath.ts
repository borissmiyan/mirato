import { getLineAngleAndLength, snapAngleToStep } from '../renderers/shapeGeometry';
import { ICanvasItem, ShapeType } from '@/core/types';

export interface PointPct {
  pctX: number;
  pctY: number;
}

export interface ContainerDimensions {
  width: number;
  height: number;
}

export interface ShapeBoundsResult {
  left: number;
  top: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface LineDrawingResult {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  rotation: number;
  x: number;
  y: number;
}

/**
 * Computes bounding geometry for dragging a shape on canvas,
 * with support for Alt-key center scaling and Shift-key 1:1 aspect ratio constraint.
 */
export function calculateShapeDragBounds(
  start: PointPct,
  currPctX: number,
  currPctY: number,
  container: ContainerDimensions,
  isAlt: boolean,
  isShift: boolean
): ShapeBoundsResult {
  let left: number;
  let top: number;
  let width: number;
  let height: number;

  if (isAlt) {
    const halfW = Math.abs(currPctX - start.pctX);
    const halfH = Math.abs(currPctY - start.pctY);
    let finalHalfW = Math.max(0.5, halfW);
    let finalHalfH = Math.max(0.5, halfH);
    if (isShift) {
      const maxPx = Math.max(halfW * (container.width / 100), halfH * (container.height / 100));
      finalHalfW = Math.max(0.5, (maxPx / container.width) * 100);
      finalHalfH = Math.max(0.5, (maxPx / container.height) * 100);
    }
    left = start.pctX - finalHalfW;
    top = start.pctY - finalHalfH;
    width = finalHalfW * 2;
    height = finalHalfH * 2;
  } else {
    const rawW = Math.abs(currPctX - start.pctX);
    const rawH = Math.abs(currPctY - start.pctY);
    let finalW = Math.max(1, rawW);
    let finalH = Math.max(1, rawH);
    if (isShift) {
      const maxPx = Math.max(rawW * (container.width / 100), rawH * (container.height / 100));
      finalW = Math.max(1, (maxPx / container.width) * 100);
      finalH = Math.max(1, (maxPx / container.height) * 100);
    }
    left = currPctX < start.pctX ? start.pctX - finalW : start.pctX;
    top = currPctY < start.pctY ? start.pctY - finalH : start.pctY;
    width = finalW;
    height = finalH;
  }

  const roundedW = Math.round(width * 10) / 10;
  const roundedH = Math.round(height * 10) / 10;
  const roundedX = Math.round((left + width / 2) * 10) / 10;
  const roundedY = Math.round((top + height / 2) * 10) / 10;

  return {
    left,
    top,
    width: roundedW,
    height: roundedH,
    x: roundedX,
    y: roundedY,
  };
}

/**
 * Computes line coordinates, rotation angle, and length for drag-to-draw line creation.
 */
export function calculateLineDrag(
  start: PointPct,
  currPctX: number,
  currPctY: number,
  container: ContainerDimensions,
  isShift: boolean
): LineDrawingResult {
  const dx = currPctX - start.pctX;
  const dy = (currPctY - start.pctY) * (container.height / container.width);
  const res = getLineAngleAndLength(0, 0, dx, dy);
  let angle = res.angleDeg;
  if (isShift) {
    angle = snapAngleToStep(angle, 45);
  }

  const width = Math.max(1, res.length);
  const rad = (angle * Math.PI) / 180;
  const endDx = width * Math.cos(rad);
  const endDy = width * (container.width / container.height) * Math.sin(rad);

  const x2 = start.pctX + endDx;
  const y2 = start.pctY + endDy;
  const x = start.pctX + endDx / 2;
  const y = start.pctY + endDy / 2;

  return {
    x1: start.pctX,
    y1: start.pctY,
    x2,
    y2,
    width: Math.round(width * 10) / 10,
    rotation: angle,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

export function createInitialPenPathItem(newNodeId: string, pctX: number, pctY: number): ICanvasItem {
  return {
    id: crypto.randomUUID(),
    type: 'path',
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 100,
    locked: false,
    visible: true,
    path: {
      nodes: [{ id: newNodeId, x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10, isCorner: true }],
      isClosed: false,
    },
    fills: [],
    strokes: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ffffff' }],
    borderWidth: 1,
  };
}

export function configureShapeItemData(item: ICanvasItem, shapeType: ShapeType): void {
  if (!item.shape) return;
  if (shapeType === 'triangle') {
    item.shape.shapeType = 'polygon';
    item.shape.polygonSides = 3;
  } else {
    item.shape.shapeType = shapeType;
    if (shapeType === 'polygon') item.shape.polygonSides = 5;
    if (shapeType === 'star') {
      item.shape.starPoints = 5;
      item.shape.starRatio = 0.382;
    }
  }
}

