import { ICanvasItemShape } from '@/core/types';

interface Point {
  x: number;
  y: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function r4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Generates an SVG path for an N-sided regular polygon in normalized [0, 1] space.
 * Unifies triangle (sides=3) and polygon (sides=3..60), guaranteeing 100% bounding box coverage.
 */
export function generatePolygonPath(shape?: Partial<ICanvasItemShape>): string {
  const sides = clamp(shape?.polygonSides ?? 3, 3, 60);
  const globalRadius = clamp(shape?.polygonCornerRadius ?? 0, 0, 100);
  const cornerRadii = shape?.polygonCornerRadii;

  const angleStep = (2 * Math.PI) / sides;
  const rawVertices: Point[] = [];

  // 1. Generate regular polygon vertices on unit circle
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    rawVertices.push({
      x: 0.5 + 0.5 * Math.cos(angle),
      y: 0.5 + 0.5 * Math.sin(angle),
    });
  }

  // 2. Normalize to 100% of [0, 1] bounding box
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

  const vertices: Point[] = rawVertices.map((v) => ({
    x: (v.x - minX) / spanX,
    y: (v.y - minY) / spanY,
  }));

  // 3. Construct path with per-vertex corner rounding
  const parts: string[] = [];

  for (let i = 0; i < sides; i++) {
    const prev = vertices[(i - 1 + sides) % sides];
    const curr = vertices[i];
    const next = vertices[(i + 1) % sides];

    const filletPct = cornerRadii?.[i] ?? globalRadius;

    if (filletPct <= 0) {
      if (i === 0) {
        parts.push(`M ${r4(curr.x)} ${r4(curr.y)}`);
      } else {
        parts.push(`L ${r4(curr.x)} ${r4(curr.y)}`);
      }
      continue;
    }

    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.hypot(d1x, d1y);
    const len2 = Math.hypot(d2x, d2y);

    if (len1 < 0.001 || len2 < 0.001) {
      parts.push(i === 0 ? `M ${r4(curr.x)} ${r4(curr.y)}` : `L ${r4(curr.x)} ${r4(curr.y)}`);
      continue;
    }

    const maxCut = Math.min(len1, len2) * 0.45;
    const targetCut = (filletPct / 100) * 0.35;
    const cut = Math.min(maxCut, targetCut);

    const pInX = curr.x + (d1x / len1) * cut;
    const pInY = curr.y + (d1y / len1) * cut;
    const pOutX = curr.x + (d2x / len2) * cut;
    const pOutY = curr.y + (d2y / len2) * cut;

    if (i === 0) {
      parts.push(`M ${r4(pOutX)} ${r4(pOutY)}`);
    } else {
      parts.push(`L ${r4(pInX)} ${r4(pInY)} Q ${r4(curr.x)} ${r4(curr.y)} ${r4(pOutX)} ${r4(pOutY)}`);
    }
  }

  // If vertex 0 was rounded, complete curve at the end
  const v0Fillet = cornerRadii?.[0] ?? globalRadius;
  if (v0Fillet > 0) {
    const prev = vertices[sides - 1];
    const curr = vertices[0];
    const next = vertices[1];

    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const len1 = Math.hypot(d1x, d1y);
    const maxCut = Math.min(len1, Math.hypot(next.x - curr.x, next.y - curr.y)) * 0.45;
    const cut = Math.min(maxCut, (v0Fillet / 100) * 0.35);

    const pInX = curr.x + (d1x / len1) * cut;
    const pInY = curr.y + (d1y / len1) * cut;
    const pOutX = curr.x + ((next.x - curr.x) / Math.hypot(next.x - curr.x, next.y - curr.y)) * cut;
    const pOutY = curr.y + ((next.y - curr.y) / Math.hypot(next.x - curr.x, next.y - curr.y)) * cut;

    parts.push(`L ${r4(pInX)} ${r4(pInY)} Q ${r4(curr.x)} ${r4(curr.y)} ${r4(pOutX)} ${r4(pOutY)}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

