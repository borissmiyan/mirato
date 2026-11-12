import { ICanvasItemShape } from '@/core/types';

interface Point {
  x: number;
  y: number;
}

/**
 * Clamps a number between min and max.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Rounds a number to 4 decimal places for clean SVG output.
 */
function r4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Generates an SVG path for an N-pointed star in normalized [0, 1] coordinate space.
 * Fills 100% of the bounding box and supports inner/outer corner fillets.
 */
export function generateStarPath(shape?: Partial<ICanvasItemShape>): string {
  const points = clamp(shape?.starPoints ?? 5, 3, 60);
  const ratio = clamp(shape?.starRatio ?? 0.382, 0.05, 0.95);
  const innerRadius = clamp(shape?.starInnerRadius ?? 0, 0, 100);
  const outerRadius = clamp(shape?.starOuterRadius ?? 0, 0, 100);
  const outerRadii = shape?.starOuterRadii;

  const totalVertices = points * 2;
  const angleStep = Math.PI / points;
  const rOut = 0.5;
  const rIn = 0.5 * ratio;

  // 1. Generate raw vertices centered at (0.5, 0.5)
  const rawVertices: Point[] = [];
  for (let i = 0; i < totalVertices; i++) {
    const isOuter = i % 2 === 0;
    const r = isOuter ? rOut : rIn;
    const angle = -Math.PI / 2 + i * angleStep;
    rawVertices.push({
      x: 0.5 + r * Math.cos(angle),
      y: 0.5 + r * Math.sin(angle),
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

  // 3. Build SVG path with optional corner rounding
  const parts: string[] = [];

  for (let i = 0; i < totalVertices; i++) {
    const prev = vertices[(i - 1 + totalVertices) % totalVertices];
    const curr = vertices[i];
    const next = vertices[(i + 1) % totalVertices];

    const isOuter = i % 2 === 0;
    const rayIdx = Math.floor(i / 2);
    const filletPct = isOuter
      ? (outerRadii?.[rayIdx] ?? outerRadius)
      : innerRadius;

    if (filletPct <= 0) {
      if (i === 0) {
        parts.push(`M ${r4(curr.x)} ${r4(curr.y)}`);
      } else {
        parts.push(`L ${r4(curr.x)} ${r4(curr.y)}`);
      }
      continue;
    }

    // Compute vectors to neighbors
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

    // Maximum safe cutoff along edges
    const maxCut = Math.min(len1, len2) * 0.45;
    const targetCut = (filletPct / 100) * 0.25;
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

  // If vertex 0 was rounded, close with the curve for vertex 0
  if ((outerRadii?.[0] ?? outerRadius) > 0) {
    const prev = vertices[totalVertices - 1];
    const curr = vertices[0];
    const next = vertices[1];

    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const len1 = Math.hypot(d1x, d1y);
    const maxCut = Math.min(len1, Math.hypot(next.x - curr.x, next.y - curr.y)) * 0.45;
    const cut = Math.min(maxCut, ((outerRadii?.[0] ?? outerRadius) / 100) * 0.25);

    const pInX = curr.x + (d1x / len1) * cut;
    const pInY = curr.y + (d1y / len1) * cut;
    const pOutX = curr.x + ((next.x - curr.x) / Math.hypot(next.x - curr.x, next.y - curr.y)) * cut;
    const pOutY = curr.y + ((next.y - curr.y) / Math.hypot(next.x - curr.x, next.y - curr.y)) * cut;

    parts.push(`L ${r4(pInX)} ${r4(pInY)} Q ${r4(curr.x)} ${r4(curr.y)} ${r4(pOutX)} ${r4(pOutY)}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

