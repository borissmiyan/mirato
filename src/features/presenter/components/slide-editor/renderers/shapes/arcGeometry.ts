import { ICanvasItemShape } from '@/core/types';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function r4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Generates an SVG path for an Arc, Donut, or Segmented Donut in normalized [0, 1] coordinate space.
 * Prevents SVG 360° arc collapse using dual-180° decomposition.
 */
export function generateArcDonutPath(shape?: Partial<ICanvasItemShape>): string {
  const innerRatio = clamp(shape?.innerRadius ?? 0, 0, 0.99);
  const arcStart = ((shape?.arcStart ?? 0) % 360 + 360) % 360;
  const arcSweep = clamp(shape?.arcSweep ?? 360, 0, 360);
  const sectorCount = clamp(shape?.sectorCount ?? 1, 1, 60);
  const sectorGap = clamp(shape?.sectorGap ?? 0, 0, 30);
  const sectorWeights = shape?.sectorWeights;

  const rOut = 0.5;
  const rIn = 0.5 * innerRatio;

  // Single full 360° circle / donut without gaps: optimize with dual-180° arcs
  if (sectorCount === 1 && arcSweep >= 360 && sectorGap === 0) {
    if (rIn <= 0.001) {
      // Full solid circle
      return `M 0.5 0 A 0.5 0.5 0 0 1 0.5 1 A 0.5 0.5 0 0 1 0.5 0 Z`;
    }
    // Full donut: outer circle (CW) + inner cutout (CCW)
    return [
      `M 0.5 0 A 0.5 0.5 0 0 1 0.5 1 A 0.5 0.5 0 0 1 0.5 0 Z`,
      `M 0.5 ${r4(0.5 - rIn)} A ${r4(rIn)} ${r4(rIn)} 0 0 0 0.5 ${r4(0.5 + rIn)} A ${r4(rIn)} ${r4(rIn)} 0 0 0 0.5 ${r4(0.5 - rIn)} Z`,
    ].join(' ');
  }

  // Segmented donut or partial arc/pie
  const totalGaps = (arcSweep >= 360 ? sectorCount : sectorCount - 1) * sectorGap;
  const availableSweep = Math.max(0.1, arcSweep - totalGaps);

  // Normalize weights
  let weights: number[] = [];
  if (sectorWeights && sectorWeights.length === sectorCount && sectorWeights.every((w) => w > 0)) {
    const sum = sectorWeights.reduce((a, b) => a + b, 0);
    weights = sectorWeights.map((w) => (w / sum) * availableSweep);
  } else {
    const uniformSpan = availableSweep / sectorCount;
    weights = Array(sectorCount).fill(uniformSpan);
  }

  const parts: string[] = [];
  let currentAngle = arcStart;

  for (let i = 0; i < sectorCount; i++) {
    const span = weights[i];
    if (span <= 0.01) {
      currentAngle += span + sectorGap;
      continue;
    }

    const startDeg = currentAngle;
    const endDeg = currentAngle + span;
    currentAngle = endDeg + sectorGap;

    const aStart = -Math.PI / 2 + (startDeg * Math.PI) / 180;
    const aEnd = -Math.PI / 2 + (endDeg * Math.PI) / 180;

    const outStartX = 0.5 + rOut * Math.cos(aStart);
    const outStartY = 0.5 + rOut * Math.sin(aStart);
    const outEndX = 0.5 + rOut * Math.cos(aEnd);
    const outEndY = 0.5 + rOut * Math.sin(aEnd);

    const largeArc = span > 180 ? 1 : 0;

    if (rIn > 0.001) {
      // Donut sector
      const inStartX = 0.5 + rIn * Math.cos(aStart);
      const inStartY = 0.5 + rIn * Math.sin(aStart);
      const inEndX = 0.5 + rIn * Math.cos(aEnd);
      const inEndY = 0.5 + rIn * Math.sin(aEnd);

      const sectorPath = [
        `M ${r4(outStartX)} ${r4(outStartY)}`,
        `A 0.5 0.5 0 ${largeArc} 1 ${r4(outEndX)} ${r4(outEndY)}`,
        `L ${r4(inEndX)} ${r4(inEndY)}`,
        `A ${r4(rIn)} ${r4(rIn)} 0 ${largeArc} 0 ${r4(inStartX)} ${r4(inStartY)}`,
        `Z`,
      ].join(' ');
      parts.push(sectorPath);
    } else {
      // Pie slice
      const sectorPath = [
        `M ${r4(outStartX)} ${r4(outStartY)}`,
        `A 0.5 0.5 0 ${largeArc} 1 ${r4(outEndX)} ${r4(outEndY)}`,
        `L 0.5 0.5`,
        `Z`,
      ].join(' ');
      parts.push(sectorPath);
    }
  }

  return parts.join(' ');
}

