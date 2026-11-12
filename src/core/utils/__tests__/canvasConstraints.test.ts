import { describe, it, expect } from 'vitest';
import { applyConstraints, IBoxBounds } from '../canvasConstraints';
import { ICanvasItem } from '@/core/types';

describe('canvasConstraints', () => {
  const baseItem: ICanvasItem = {
    id: 'item-1',
    type: 'shape',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    pivotX: 0,
    pivotY: 0,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    fills: [],
    strokes: [],
  };

  const oldBox: IBoxBounds = { width: 100, height: 100 };
  const newBox: IBoxBounds = { width: 120, height: 150 };

  it('keeps left and top distance with default left/top constraints', () => {
    const updated = applyConstraints(
      { ...baseItem, constraints: { horizontal: 'left', vertical: 'top' } },
      oldBox,
      newBox
    );
    expect(updated.x).toBe(10);
    expect(updated.y).toBe(10);
    expect(updated.width).toBe(20);
    expect(updated.height).toBe(20);
  });

  it('keeps right distance with right constraint', () => {
    // Old right distance = 100 - (10 + 20) = 70
    // In newBox (width 120), right edge should be at 120 - 70 = 50 => x = 50 - 20 = 30
    const updated = applyConstraints(
      { ...baseItem, constraints: { horizontal: 'right', vertical: 'top' } },
      oldBox,
      newBox
    );
    expect(updated.x).toBe(30);
    expect(updated.width).toBe(20);
  });

  it('stretches with left-right constraint', () => {
    // Old: left 10, right 70.
    // In newBox (width 120): left remains 10, right remains 70 => width = 120 - 10 - 70 = 40
    const updated = applyConstraints(
      { ...baseItem, constraints: { horizontal: 'left-right', vertical: 'top' } },
      oldBox,
      newBox
    );
    expect(updated.x).toBe(10);
    expect(updated.width).toBe(40);
  });

  it('maintains center relative position with center constraint', () => {
    // Old item center = 10 + 10 = 20. Old container center = 50. Offset = -30.
    // New container center = 60. New item center = 60 - 30 = 30 => x = 30 - 10 = 20.
    const updated = applyConstraints(
      { ...baseItem, constraints: { horizontal: 'center', vertical: 'center' } },
      oldBox,
      newBox
    );
    expect(updated.x).toBe(20);
  });

  it('scales proportionally with scale constraint', () => {
    // Scale factor horizontal: 120 / 100 = 1.2
    // x = 10 * 1.2 = 12, width = 20 * 1.2 = 24
    const updated = applyConstraints(
      { ...baseItem, constraints: { horizontal: 'scale', vertical: 'scale' } },
      oldBox,
      newBox
    );
    expect(updated.x).toBeCloseTo(12, 1);
    expect(updated.width).toBeCloseTo(24, 1);
  });
});

