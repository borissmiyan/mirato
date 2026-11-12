/**
 * Generates Figma & Apple iOS-grade Squircle (Continuous G2 Curvature) SVG path in [0, 1] unit space.
 * Uses cubic Bézier approximation with smooth transition parameter `smoothing` in [0, 1].
 */
export function generateSquircleRectPath(
  radius: number, // 0..0.5 in unit space (or 0..50 in percentage)
  smoothing: number = 0.6 // 0..1 (0.6 = Apple iOS standard, 1.0 = full continuous curvature)
): string {
  // Normalize radius to 0..0.5
  const r = radius > 1 ? radius / 100 : radius;
  const clampedR = Math.max(0, Math.min(0.5, r));

  if (clampedR <= 0.001) {
    return 'M 0,0 H 1 V 1 H 0 Z';
  }

  const s = Math.max(0, Math.min(1, smoothing));

  // If smoothing is 0, render standard rounded rectangle arc in [0, 1]
  if (s <= 0.01) {
    return [
      `M ${clampedR},0`,
      `H ${1 - clampedR}`,
      `A ${clampedR},${clampedR} 0 0 1 1,${clampedR}`,
      `V ${1 - clampedR}`,
      `A ${clampedR},${clampedR} 0 0 1 ${1 - clampedR},1`,
      `H ${clampedR}`,
      `A ${clampedR},${clampedR} 0 0 1 0,${1 - clampedR}`,
      `V ${clampedR}`,
      `A ${clampedR},${clampedR} 0 0 1 ${clampedR},0`,
      'Z',
    ].join(' ');
  }

  // Smooth transition length along edge: p = s * r
  // Total corner span along edge = r + p (clamped to max 0.5)
  const p = Math.min(0.5 - clampedR, s * clampedR);
  const totalOffset = clampedR + p;

  // Cubic Bézier control point coordinates approximating G2 continuous curve:
  // P0 (start on edge): totalOffset from corner
  // P1: totalOffset - p * 0.5
  // P2: clampedR * 0.55228 + p * 0.2
  // P3 (apex of corner transition)
  const cp1 = totalOffset - p * 0.5;
  const cp2 = clampedR * 0.55228 + p * 0.2;

  const round = (num: number) => Math.round(num * 10000) / 10000;

  // Build the 4 symmetric corners clockwise starting from Top-Left:
  // Top edge: from totalOffset to (1 - totalOffset)
  // Top-Right Corner: from (1 - totalOffset, 0) to (1, totalOffset)
  // Right edge: from (1, totalOffset) to (1, 1 - totalOffset)
  // Bottom-Right Corner: from (1, 1 - totalOffset) to (1 - totalOffset, 1)
  // Bottom edge: from (1 - totalOffset, 1) to (totalOffset, 1)
  // Bottom-Left Corner: from (totalOffset, 1) to (0, 1 - totalOffset)
  // Left edge: from (0, 1 - totalOffset) to (0, totalOffset)
  // Top-Left Corner: from (0, totalOffset) to (totalOffset, 0)

  return [
    `M ${round(totalOffset)},0`,
    `H ${round(1 - totalOffset)}`,
    // Top-Right
    `C ${round(1 - cp1)},0 ${round(1 - cp2)},${round(clampedR * 0.1)} ${round(1 - clampedR * 0.3)},${round(clampedR * 0.3)}`,
    `C ${round(1 - clampedR * 0.1)},${round(cp2)} 1,${round(cp1)} 1,${round(totalOffset)}`,
    // Right Edge
    `V ${round(1 - totalOffset)}`,
    // Bottom-Right
    `C 1,${round(1 - cp1)} ${round(1 - clampedR * 0.1)},${round(1 - cp2)} ${round(1 - clampedR * 0.3)},${round(1 - clampedR * 0.3)}`,
    `C ${round(1 - cp2)},${round(1 - clampedR * 0.1)} ${round(1 - cp1)},1 ${round(1 - totalOffset)},1`,
    // Bottom Edge
    `H ${round(totalOffset)}`,
    // Bottom-Left
    `C ${round(cp1)},1 ${round(cp2)},${round(1 - clampedR * 0.1)} ${round(clampedR * 0.3)},${round(1 - clampedR * 0.3)}`,
    `C ${round(clampedR * 0.1)},${round(1 - cp2)} 0,${round(1 - cp1)} 0,${round(1 - totalOffset)}`,
    // Left Edge
    `V ${round(totalOffset)}`,
    // Top-Left
    `C 0,${round(cp1)} ${round(clampedR * 0.1)},${round(cp2)} ${round(clampedR * 0.3)},${round(clampedR * 0.3)}`,
    `C ${round(cp2)},${round(clampedR * 0.1)} ${round(cp1)},0 ${round(totalOffset)},0`,
    'Z',
  ].join(' ');
}

