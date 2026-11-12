import { describe, it, expect } from 'vitest';
import { calculateShapeDragBounds, calculateLineDrag } from '../canvasDrawingMath';

describe('canvasDrawingMath', () => {
  const container = { width: 1000, height: 500 };

  describe('calculateShapeDragBounds', () => {
    it('calculates regular drag bounds from top-left to bottom-right', () => {
      const bounds = calculateShapeDragBounds(
        { pctX: 10, pctY: 20 },
        30,
        40,
        container,
        false, // alt
        false  // shift
      );

      expect(bounds.left).toBe(10);
      expect(bounds.top).toBe(20);
      expect(bounds.width).toBe(20);
      expect(bounds.height).toBe(20);
      expect(bounds.x).toBe(20);
      expect(bounds.y).toBe(30);
    });

    it('calculates Alt-drag bounds centered at start point', () => {
      const bounds = calculateShapeDragBounds(
        { pctX: 50, pctY: 50 },
        60,
        70,
        container,
        true, // alt
        false // shift
      );

      expect(bounds.left).toBe(40);
      expect(bounds.top).toBe(30);
      expect(bounds.width).toBe(20);
      expect(bounds.height).toBe(40);
      expect(bounds.x).toBe(50);
      expect(bounds.y).toBe(50);
    });

    it('enforces 1:1 aspect ratio in pixel space when Shift is held', () => {
      const bounds = calculateShapeDragBounds(
        { pctX: 10, pctY: 10 },
        20,
        15,
        container,
        false,
        true // shift
      );

      // 10% of width (1000px) is 100px.
      // 5% of height (500px) is 25px.
      // Max pixel is 100px.
      // 100px in height is 20% (100 / 500 * 100 = 20%).
      expect(bounds.width).toBe(10);
      expect(bounds.height).toBe(20);
    });
  });

  describe('calculateLineDrag', () => {
    it('calculates line coordinates and angle without snapping', () => {
      const line = calculateLineDrag(
        { pctX: 0, pctY: 0 },
        20,
        0,
        container,
        false
      );

      expect(line.x1).toBe(0);
      expect(line.y1).toBe(0);
      expect(line.width).toBe(20);
      expect(line.rotation).toBe(0);
    });

    it('snaps angle to 45 degree steps when Shift is held', () => {
      // 10% width = 100px, 10% height = 50px -> dy is scaled by height/width (0.5)
      const line = calculateLineDrag(
        { pctX: 10, pctY: 10 },
        20,
        30,
        container,
        true
      );

      expect(line.rotation % 45).toBe(0);
    });
  });
});

