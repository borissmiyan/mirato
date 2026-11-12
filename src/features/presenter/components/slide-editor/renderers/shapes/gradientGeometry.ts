export interface IPoint {
  x: number;
  y: number;
}

export interface IItemBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX?: number;
  pivotY?: number;
}

/**
 * Calculates start and end handle coordinates in canvas percentage space (0-100)
 * for a linear gradient with a given angle.
 */
export function calculateGradientEndpoints(
  box: IItemBox,
  angleDeg: number
): { start: IPoint; end: IPoint } {
  // Center of the item in percentage space
  const cx = box.x;
  const cy = box.y;

  const halfW = box.width / 2;
  const halfH = box.height / 2;

  // In CSS gradients: 0deg = to top, 90deg = to right, 180deg = to bottom, 270deg = to left
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad) * halfW;
  const dy = Math.sin(rad) * halfH;

  return {
    start: {
      x: Math.round((cx - dx) * 10) / 10,
      y: Math.round((cy - dy) * 10) / 10,
    },
    end: {
      x: Math.round((cx + dx) * 10) / 10,
      y: Math.round((cy + dy) * 10) / 10,
    },
  };
}

/**
 * Calculates the gradient angle (0-360 deg) based on the pointer position relative to the item center.
 * If snap is true (Shift held), snaps to the nearest 45 degree increment.
 */
export function calculateGradientAngleFromDrag(
  box: IItemBox,
  pointer: IPoint,
  snap: boolean = false
): number {
  const dx = pointer.x - box.x;
  const dy = pointer.y - box.y;

  if (Math.hypot(dx, dy) < 0.1) {
    return 90;
  }

  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI + 90;

  if (deg < 0) deg += 360;
  deg = deg % 360;

  if (snap) {
    deg = Math.round(deg / 45) * 45;
    if (deg >= 360) deg = 0;
  }

  return Math.round(deg);
}

