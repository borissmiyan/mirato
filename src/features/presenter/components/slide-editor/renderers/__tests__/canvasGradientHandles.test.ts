import { describe, it, expect } from 'vitest';
import { calculateGradientEndpoints, calculateGradientAngleFromDrag } from '../../renderers/shapes/gradientGeometry';

describe('gradientGeometry', () => {
  const itemBounds = { x: 50, y: 50, width: 20, height: 20 }; // center at (50, 50)

  it('calculates start and end endpoints for angle 90 (left to right)', () => {
    // 90 degrees in CSS gradient is left to right (from 40 to 60 on x, y stays 50)
    const { start, end } = calculateGradientEndpoints(itemBounds, 90);
    expect(start.x).toBeCloseTo(40, 1);
    expect(start.y).toBeCloseTo(50, 1);
    expect(end.x).toBeCloseTo(60, 1);
    expect(end.y).toBeCloseTo(50, 1);
  });

  it('calculates start and end endpoints for angle 180 (top to bottom)', () => {
    // 180 degrees in CSS gradient is top to bottom
    const { start, end } = calculateGradientEndpoints(itemBounds, 180);
    expect(start.x).toBeCloseTo(50, 1);
    expect(start.y).toBeCloseTo(40, 1);
    expect(end.x).toBeCloseTo(50, 1);
    expect(end.y).toBeCloseTo(60, 1);
  });

  it('calculates new angle from dragged pointer position', () => {
    // Pointer dragged to right of center (60, 50) => angle 90 deg
    const angleRight = calculateGradientAngleFromDrag(itemBounds, { x: 60, y: 50 }, false);
    expect(angleRight).toBe(90);

    // Pointer dragged to bottom of center (50, 60) => angle 180 deg
    const angleBottom = calculateGradientAngleFromDrag(itemBounds, { x: 50, y: 60 }, false);
    expect(angleBottom).toBe(180);
  });

  it('snaps angle to 45 deg increments when shiftKey is held', () => {
    // Angle near 50 deg snaps to 45 deg
    const angleSnapped = calculateGradientAngleFromDrag(itemBounds, { x: 58, y: 44 }, true);
    expect(angleSnapped % 45).toBe(0);
  });
});

