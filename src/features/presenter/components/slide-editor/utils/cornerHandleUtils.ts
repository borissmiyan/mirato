import { ICanvasItem } from '@/core/types';

export interface ICornerRadiusHandle {
  id: string;
  index: number;
  x: number;
  y: number;
  bisectorX: number;
  bisectorY: number;
  radius: number;
  maxRadius: number;
  target: 'rect' | 'polygon' | 'star-outer' | 'star-inner';
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes the 4 Figma-style corner radius handles for rectangular items.
 */
export function getRectCornerHandles(
  item: ICanvasItem,
  widthPx: number,
  heightPx: number,
  counterScale: number = 1
): ICornerRadiusHandle[] {
  const maxRadius = Math.round(Math.min(widthPx, heightPx) / 2);
  const handleOffset = Math.max(12 * counterScale, 10);

  const getRadius = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (item.lockBorderRadius !== false) return item.borderRadius ?? 0;
    if (corner === 'tl') return item.borderRadiusTL ?? 0;
    if (corner === 'tr') return item.borderRadiusTR ?? 0;
    if (corner === 'bl') return item.borderRadiusBL ?? 0;
    return item.borderRadiusBR ?? 0;
  };

  const corners: Array<{
    id: 'tl' | 'tr' | 'br' | 'bl';
    index: number;
    baseX: number;
    baseY: number;
    dx: number;
    dy: number;
  }> = [
    { id: 'tl', index: 0, baseX: 0, baseY: 0, dx: 1, dy: 1 },
    { id: 'tr', index: 1, baseX: widthPx, baseY: 0, dx: -1, dy: 1 },
    { id: 'br', index: 2, baseX: widthPx, baseY: heightPx, dx: -1, dy: -1 },
    { id: 'bl', index: 3, baseX: 0, baseY: heightPx, dx: 1, dy: -1 },
  ];

  return corners.map((c) => {
    const r = getRadius(c.id);
    const offset = Math.min(maxRadius * 0.8, Math.max(handleOffset, r * 0.85));
    return {
      id: c.id,
      index: c.index,
      x: c.baseX + c.dx * offset,
      y: c.baseY + c.dy * offset,
      bisectorX: c.dx * 0.7071,
      bisectorY: c.dy * 0.7071,
      radius: r,
      maxRadius,
      target: 'rect',
    };
  });
}

/**
 * Computes on-canvas corner radius handles for N-sided regular polygons.
 * Places handles along each vertex's inward angle bisector.
 */
export function getPolygonCornerHandles(
  item: ICanvasItem,
  widthPx: number,
  heightPx: number,
  counterScale: number = 1
): ICornerRadiusHandle[] {
  const sides = clamp(item.shape?.polygonSides ?? 3, 3, 60);
  const globalRadius = item.shape?.polygonCornerRadius ?? 0;
  const cornerRadii = item.shape?.polygonCornerRadii;

  const angleStep = (2 * Math.PI) / sides;
  const rawVertices: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    rawVertices.push({
      x: 0.5 + 0.5 * Math.cos(angle),
      y: 0.5 + 0.5 * Math.sin(angle),
    });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const v of rawVertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);

  const vertices = rawVertices.map((v) => ({
    x: ((v.x - minX) / spanX) * widthPx,
    y: ((v.y - minY) / spanY) * heightPx,
  }));

  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.5;
  const handleOffset = Math.max(14 * counterScale, 10);
  const maxRadius = 100;

  return vertices.map((v, i) => {
    // Vector towards center
    const toCenterX = centerX - v.x;
    const toCenterY = centerY - v.y;
    const distToCenter = Math.hypot(toCenterX, toCenterY);
    const bisectorX = distToCenter > 0.001 ? toCenterX / distToCenter : 0;
    const bisectorY = distToCenter > 0.001 ? toCenterY / distToCenter : 1;

    const currentRadius = cornerRadii?.[i] ?? globalRadius;
    const offset = Math.min(distToCenter * 0.7, Math.max(handleOffset, (currentRadius / 100) * distToCenter * 0.5));

    return {
      id: `poly-v-${i}`,
      index: i,
      x: v.x + bisectorX * offset,
      y: v.y + bisectorY * offset,
      bisectorX,
      bisectorY,
      radius: currentRadius,
      maxRadius,
      target: 'polygon',
    };
  });
}

/**
 * Computes on-canvas corner radius handles for stars (outer tip handles and inner valley handle).
 */
export function getStarCornerHandles(
  item: ICanvasItem,
  widthPx: number,
  heightPx: number,
  counterScale: number = 1
): ICornerRadiusHandle[] {
  const points = clamp(item.shape?.starPoints ?? 5, 3, 60);
  const ratio = clamp(item.shape?.starRatio ?? 0.382, 0.05, 0.95);
  const globalOuterRadius = item.shape?.starOuterRadius ?? 0;
  const outerRadii = item.shape?.starOuterRadii;
  const innerRadius = item.shape?.starInnerRadius ?? 0;

  const totalVertices = points * 2;
  const angleStep = Math.PI / points;
  const rawVertices: Array<{ x: number; y: number; isTip: boolean; rayIndex: number }> = [];

  for (let i = 0; i < totalVertices; i++) {
    const isTip = i % 2 === 0;
    const r = isTip ? 0.5 : 0.5 * ratio;
    const angle = -Math.PI / 2 + i * angleStep;
    rawVertices.push({
      x: 0.5 + r * Math.cos(angle),
      y: 0.5 + r * Math.sin(angle),
      isTip,
      rayIndex: Math.floor(i / 2),
    });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const v of rawVertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);

  const vertices = rawVertices.map((v) => ({
    x: ((v.x - minX) / spanX) * widthPx,
    y: ((v.y - minY) / spanY) * heightPx,
    isTip: v.isTip,
    rayIndex: v.rayIndex,
  }));

  const centerX = widthPx * 0.5;
  const centerY = heightPx * 0.5;
  const handleOffset = Math.max(12 * counterScale, 10);
  const handles: ICornerRadiusHandle[] = [];

  // Outer ray tips
  vertices.forEach((v) => {
    if (!v.isTip) return;
    const toCenterX = centerX - v.x;
    const toCenterY = centerY - v.y;
    const dist = Math.hypot(toCenterX, toCenterY);
    const bisectorX = dist > 0.001 ? toCenterX / dist : 0;
    const bisectorY = dist > 0.001 ? toCenterY / dist : 1;

    const currentRadius = outerRadii?.[v.rayIndex] ?? globalOuterRadius;
    const offset = Math.min(dist * 0.6, Math.max(handleOffset, (currentRadius / 100) * dist * 0.5));

    handles.push({
      id: `star-outer-${v.rayIndex}`,
      index: v.rayIndex,
      x: v.x + bisectorX * offset,
      y: v.y + bisectorY * offset,
      bisectorX,
      bisectorY,
      radius: currentRadius,
      maxRadius: 100,
      target: 'star-outer',
    });
  });

  // Inner valley handle (use valley 0 for uniform inner rounding)
  const valley0 = vertices.find((v) => !v.isTip);
  if (valley0) {
    const fromCenterX = valley0.x - centerX;
    const fromCenterY = valley0.y - centerY;
    const dist = Math.hypot(fromCenterX, fromCenterY);
    const bisectorX = dist > 0.001 ? fromCenterX / dist : 0;
    const bisectorY = dist > 0.001 ? fromCenterY / dist : -1;
    const offset = Math.min(dist * 0.6, Math.max(handleOffset, (innerRadius / 100) * dist * 0.5));

    handles.push({
      id: 'star-inner',
      index: 0,
      x: valley0.x + bisectorX * offset,
      y: valley0.y + bisectorY * offset,
      bisectorX,
      bisectorY,
      radius: innerRadius,
      maxRadius: 100,
      target: 'star-inner',
    });
  }

  return handles;
}

