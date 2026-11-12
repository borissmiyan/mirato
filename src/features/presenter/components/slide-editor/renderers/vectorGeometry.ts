import { ICanvasItem, IVectorNode, IVectorPoint } from '@/core/types';

/**
 * Converts an array of vector nodes with optional Bezier handles into an SVG path `d` string.
 */
export function nodesToSVGPath(nodes: IVectorNode[], isClosed: boolean): string {
  if (!nodes || nodes.length === 0) return '';
  const first = nodes[0];
  if (!first) return '';

  if (nodes.length === 1) {
    return `M ${first.x},${first.y}`;
  }

  const parts: string[] = [`M ${first.x},${first.y}`];

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    if (!prev || !curr) continue;

    const hasHandleOut = Boolean(prev.handleOut);
    const hasHandleIn = Boolean(curr.handleIn);

    if (hasHandleOut || hasHandleIn) {
      const cp1x = prev.handleOut ? prev.handleOut.x : prev.x;
      const cp1y = prev.handleOut ? prev.handleOut.y : prev.y;
      const cp2x = curr.handleIn ? curr.handleIn.x : curr.x;
      const cp2y = curr.handleIn ? curr.handleIn.y : curr.y;
      parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`);
    } else {
      parts.push(`L ${curr.x},${curr.y}`);
    }
  }

  if (isClosed && nodes.length > 2) {
    const last = nodes[nodes.length - 1];
    if (last && (last.handleOut || first.handleIn)) {
      const cp1x = last.handleOut ? last.handleOut.x : last.x;
      const cp1y = last.handleOut ? last.handleOut.y : last.y;
      const cp2x = first.handleIn ? first.handleIn.x : first.x;
      const cp2y = first.handleIn ? first.handleIn.y : first.y;
      parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${first.x},${first.y}`);
    }
    parts.push('Z');
  }

  return parts.join(' ');
}

/**
 * Normalizes vector nodes from 0-100 percentage space to 0-1 unit space for objectBoundingBox clipping.
 */
export function nodesToNormalizedSVGPath(nodes: IVectorNode[], isClosed: boolean): string {
  if (!nodes || nodes.length === 0) return '';
  const normalizedNodes: IVectorNode[] = nodes.map(n => ({
    ...n,
    x: n.x / 100,
    y: n.y / 100,
    handleIn: n.handleIn ? { x: n.handleIn.x / 100, y: n.handleIn.y / 100 } : undefined,
    handleOut: n.handleOut ? { x: n.handleOut.x / 100, y: n.handleOut.y / 100 } : undefined,
  }));
  return nodesToSVGPath(normalizedNodes, isClosed);
}

export { shapeItemToVectorNodes } from './vectorShapeConverters';

/**
 * Calculates the exact 1D bounding range [min, max] of a cubic Bezier curve segment.
 * Evaluates endpoints and analytical extrema where derivative B'(t) = 0 for t in (0, 1).
 * Control handles define tangents but do NOT inflate the visible bounding box into empty air.
 */
export function getCubicBezierExtrema(p0: number, p1: number, p2: number, p3: number): [number, number] {
  let min = Math.min(p0, p3);
  let max = Math.max(p0, p3);

  // If control points are within [min, max], the curve is monotonic and strictly bounded by [min, max]
  if (p1 >= min && p1 <= max && p2 >= min && p2 <= max) {
    return [min, max];
  }

  // Derivative B'(t) = a*t^2 + b*t + c = 0
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);

  const checkT = (t: number) => {
    if (t > 0 && t < 1) {
      const mt = 1 - t;
      const val = mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  };

  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) {
      checkT(-c / b);
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      checkT((-b + sqrtDisc) / (2 * a));
      checkT((-b - sqrtDisc) / (2 * a));
    }
  }

  return [min, max];
}

/**
 * Calculates the tight visual bounding box of a vector path.
 * Evaluates the actual curve extrema of all segments, excluding invisible guide handles.
 */
export function recalculatePathBounds(nodes: IVectorNode[], isClosed: boolean = true): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (!nodes || nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  if (nodes.length === 1) {
    const n = nodes[0];
    return { minX: n.x, minY: n.y, maxX: n.x, maxY: n.y };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const segmentCount = isClosed ? nodes.length : nodes.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const curr = nodes[i];
    const next = nodes[(i + 1) % nodes.length];

    const cp1x = curr.handleOut ? curr.handleOut.x : curr.x;
    const cp1y = curr.handleOut ? curr.handleOut.y : curr.y;
    const cp2x = next.handleIn ? next.handleIn.x : next.x;
    const cp2y = next.handleIn ? next.handleIn.y : next.y;

    const [segMinX, segMaxX] = getCubicBezierExtrema(curr.x, cp1x, cp2x, next.x);
    const [segMinY, segMaxY] = getCubicBezierExtrema(curr.y, cp1y, cp2y, next.y);

    if (segMinX < minX) minX = segMinX;
    if (segMaxX > maxX) maxX = segMaxX;
    if (segMinY < minY) minY = segMinY;
    if (segMaxY > maxY) maxY = segMaxY;
  }

  return {
    minX: minX === Infinity ? 0 : Math.round(minX * 10) / 10,
    minY: minY === Infinity ? 0 : Math.round(minY * 10) / 10,
    maxX: maxX === -Infinity ? 100 : Math.round(maxX * 10) / 10,
    maxY: maxY === -Infinity ? 100 : Math.round(maxY * 10) / 10,
  };
}

/**
 * Creates mirrored handle position around node center (Figma smooth handle behavior).
 */
export function getMirroredHandle(nodeX: number, nodeY: number, handleX: number, handleY: number): IVectorPoint {
  const dx = handleX - nodeX;
  const dy = handleY - nodeY;
  return {
    x: Math.round((nodeX - dx) * 100) / 100,
    y: Math.round((nodeY - dy) * 100) / 100,
  };
}

/**
 * Linearly interpolates between two vector points.
 */
function lerpPoint(p1: IVectorPoint, p2: IVectorPoint, t: number): IVectorPoint {
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

/**
 * Evaluates a cubic Bezier curve at parameter t in [0, 1].
 */
export function evaluateCubicBezier(
  p0: IVectorPoint,
  p1: IVectorPoint,
  p2: IVectorPoint,
  p3: IVectorPoint,
  t: number
): IVectorPoint {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Finds the closest point and parameter t on a linear or cubic Bezier segment.
 */
export function findClosestPointOnSegment(
  cursor: IVectorPoint,
  n1: IVectorNode,
  n2: IVectorNode
): { t: number; point: IVectorPoint; distance: number } {
  const isLinear = !n1.handleOut && !n2.handleIn;

  if (isLinear) {
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const dist = Math.hypot(cursor.x - n1.x, cursor.y - n1.y);
      return { t: 0, point: { x: n1.x, y: n1.y }, distance: dist };
    }
    const t = Math.max(0, Math.min(1, ((cursor.x - n1.x) * dx + (cursor.y - n1.y) * dy) / lenSq));
    const point = {
      x: Math.round((n1.x + t * dx) * 10) / 10,
      y: Math.round((n1.y + t * dy) * 10) / 10,
    };
    const distance = Math.hypot(cursor.x - point.x, cursor.y - point.y);
    return { t, point, distance };
  }

  const p0: IVectorPoint = { x: n1.x, y: n1.y };
  const p1: IVectorPoint = n1.handleOut || p0;
  const p3: IVectorPoint = { x: n2.x, y: n2.y };
  const p2: IVectorPoint = n2.handleIn || p3;

  let bestT = 0;
  let bestDist = Infinity;
  let bestPt = p0;

  // 20-step initial coarse search
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
    const d = Math.hypot(cursor.x - pt.x, cursor.y - pt.y);
    if (d < bestDist) { bestDist = d; bestT = t; bestPt = pt; }
  }

  // Refine around bestT with fine steps
  let left = Math.max(0, bestT - 0.05);
  let right = Math.min(1, bestT + 0.05);
  for (let i = 0; i < 8; i++) {
    const mid1 = left + (right - left) / 3;
    const mid2 = right - (right - left) / 3;
    const pt1 = evaluateCubicBezier(p0, p1, p2, p3, mid1);
    const pt2 = evaluateCubicBezier(p0, p1, p2, p3, mid2);
    const d1 = Math.hypot(cursor.x - pt1.x, cursor.y - pt1.y);
    const d2 = Math.hypot(cursor.x - pt2.x, cursor.y - pt2.y);
    if (d1 < d2) { right = mid2; bestDist = d1; bestT = mid1; bestPt = pt1; }
    else { left = mid1; bestDist = d2; bestT = mid2; bestPt = pt2; }
  }

  return {
    t: Math.round(bestT * 1000) / 1000,
    point: { x: Math.round(bestPt.x * 10) / 10, y: Math.round(bestPt.y * 10) / 10 },
    distance: Math.round(bestDist * 100) / 100,
  };
}

/**
 * Splits a segment at parameter t using de Casteljau's algorithm.
 */
export function splitBezierSegment(
  n1: IVectorNode,
  n2: IVectorNode,
  t: number
): { updatedN1: IVectorNode; newNode: IVectorNode; updatedN2: IVectorNode } {
  const isLinear = !n1.handleOut && !n2.handleIn;

  if (isLinear) {
    const splitPt = {
      x: Math.round((n1.x + t * (n2.x - n1.x)) * 10) / 10,
      y: Math.round((n1.y + t * (n2.y - n1.y)) * 10) / 10,
    };
    return {
      updatedN1: { ...n1 },
      newNode: { id: crypto.randomUUID(), x: splitPt.x, y: splitPt.y, isCorner: true },
      updatedN2: { ...n2 },
    };
  }

  const p0: IVectorPoint = { x: n1.x, y: n1.y };
  const p1: IVectorPoint = n1.handleOut || p0;
  const p3: IVectorPoint = { x: n2.x, y: n2.y };
  const p2: IVectorPoint = n2.handleIn || p3;

  const p01 = lerpPoint(p0, p1, t);
  const p12 = lerpPoint(p1, p2, t);
  const p23 = lerpPoint(p2, p3, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const p0123 = lerpPoint(p012, p123, t);

  return {
    updatedN1: { ...n1, handleOut: { x: Math.round(p01.x * 10) / 10, y: Math.round(p01.y * 10) / 10 } },
    newNode: {
      id: crypto.randomUUID(),
      x: Math.round(p0123.x * 10) / 10,
      y: Math.round(p0123.y * 10) / 10,
      handleIn: { x: Math.round(p012.x * 10) / 10, y: Math.round(p012.y * 10) / 10 },
      handleOut: { x: Math.round(p123.x * 10) / 10, y: Math.round(p123.y * 10) / 10 },
      isCorner: false,
    },
    updatedN2: { ...n2, handleIn: { x: Math.round(p23.x * 10) / 10, y: Math.round(p23.y * 10) / 10 } },
  };
}

/**
 * Searches all segments in a vector path to find the one closest to cursor point.
 */
export function findClosestSegmentInPath(
  cursor: IVectorPoint,
  nodes: IVectorNode[],
  isClosed: boolean,
  thresholdPct: number = 3.5
): { segmentIndex: number; t: number; point: IVectorPoint } | null {
  if (!nodes || nodes.length < 2) return null;

  const segmentCount = isClosed ? nodes.length : nodes.length - 1;
  let bestSegment: { segmentIndex: number; t: number; point: IVectorPoint } | null = null;
  let minDistance = thresholdPct;

  for (let i = 0; i < segmentCount; i++) {
    const n1 = nodes[i];
    const n2 = nodes[(i + 1) % nodes.length];
    if (!n1 || !n2) continue;

    const res = findClosestPointOnSegment(cursor, n1, n2);
    // Ignore ends very close to existing nodes (within 5% parameter)
    if (res.t > 0.05 && res.t < 0.95 && res.distance < minDistance) {
      minDistance = res.distance;
      bestSegment = {
        segmentIndex: i,
        t: res.t,
        point: res.point,
      };
    }
  }

  return bestSegment;
}


