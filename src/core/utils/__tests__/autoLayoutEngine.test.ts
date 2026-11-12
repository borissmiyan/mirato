import { describe, it, expect } from 'vitest';
import { computeAutoLayout } from '../autoLayoutEngine';
import { ICanvasItem } from '@/core/types';

describe('autoLayoutEngine', () => {
  const container: ICanvasItem = {
    id: 'container-1',
    type: 'shape',
    x: 0,
    y: 0,
    pivotX: 0,
    pivotY: 0,
    width: 50, // 960px
    height: 30, // 324px
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    fills: [],
    strokes: [],
    autoLayout: {
      enabled: true,
      direction: 'horizontal',
      gap: 20, // 20px
      padding: 10, // 10px
      align: 'start',
      hugContents: false,
    },
  };

  const childA: ICanvasItem = {
    id: 'child-a',
    type: 'shape',
    x: 5,
    y: 5,
    pivotX: 0,
    pivotY: 0,
    width: 10, // 192px
    height: 10, // 108px
    rotation: 0,
    zIndex: 2,
    locked: false,
    visible: true,
    fills: [],
    strokes: [],
  };

  const childB: ICanvasItem = {
    id: 'child-b',
    type: 'shape',
    x: 20,
    y: 5,
    pivotX: 0,
    pivotY: 0,
    width: 10, // 192px
    height: 10, // 108px
    rotation: 0,
    zIndex: 3,
    locked: false,
    visible: true,
    fills: [],
    strokes: [],
  };

  it('aligns and distributes children horizontally with gap and padding', () => {
    const { children } = computeAutoLayout(container, [childA, childB]);
    expect(children).toHaveLength(2);

    // Child A left = padding (10px) => 10 / 1920 * 100 = ~0.5%
    expect(children[0].x).toBeCloseTo(0.5, 1);
    // Child B left = 10px + 192px + 20px = 222px => 222 / 1920 * 100 = ~11.6%
    expect(children[1].x).toBeCloseTo(11.6, 1);
  });

  it('aligns children vertically when direction is vertical', () => {
    const vContainer: ICanvasItem = {
      ...container,
      autoLayout: {
        ...container.autoLayout!,
        direction: 'vertical',
      },
    };

    const { children } = computeAutoLayout(vContainer, [childA, childB]);
    expect(children).toHaveLength(2);

    // Child A top = padding (10px) => 10 / 1080 * 100 = ~0.9%
    expect(children[0].y).toBeCloseTo(0.9, 1);
    // Child B top = 10px + 108px + 20px = 138px => 138 / 1080 * 100 = ~12.8%
    expect(children[1].y).toBeCloseTo(12.8, 1);
  });

  it('hugs contents when hugContents is true', () => {
    const hugContainer: ICanvasItem = {
      ...container,
      autoLayout: {
        ...container.autoLayout!,
        hugContents: true,
      },
    };

    const { container: updatedContainer } = computeAutoLayout(hugContainer, [childA, childB]);
    // total width = 10 (pad) + 192 + 20 (gap) + 192 + 10 (pad) = 424px
    // 424 / 1920 * 100 = ~22.1%
    expect(updatedContainer.width).toBeCloseTo(22.1, 1);
  });

  it('bypasses layout positioning for elements with isAbsoluteInLayout', () => {
    const absoluteChild: ICanvasItem = {
      ...childA,
      id: 'abs-child',
      x: 77,
      y: 88,
      isAbsoluteInLayout: true,
    };

    const { children } = computeAutoLayout(container, [childA, absoluteChild]);
    const foundAbs = children.find(c => c.id === 'abs-child');
    expect(foundAbs).toBeDefined();
    expect(foundAbs?.x).toBe(77);
    expect(foundAbs?.y).toBe(88);
  });

  it('supports 4-side asymmetric padding (top, right, bottom, left)', () => {
    const padContainer: ICanvasItem = {
      ...container,
      autoLayout: {
        ...container.autoLayout!,
        paddingLeft: 40,
        paddingTop: 30,
      },
    };

    const { children } = computeAutoLayout(padContainer, [childA]);
    // Left = 40px => 40 / 1920 * 100 = ~2.1%
    expect(children[0].x).toBeCloseTo(2.1, 1);
    // Top = 30px => 30 / 1080 * 100 = ~2.8%
    expect(children[0].y).toBeCloseTo(2.8, 1);
  });

  it('distributes items with space-between when enabled', () => {
    const spaceBetweenContainer: ICanvasItem = {
      ...container,
      width: 50, // 960px
      autoLayout: {
        ...container.autoLayout!,
        isSpaceBetween: true,
        padding: 0,
      },
    };

    // 2 children of 192px each = 384px.
    // Container = 960px.
    // Child A at 0px. Child B at 960 - 192 = 768px => 768 / 1920 * 100 = 40%
    const { children } = computeAutoLayout(spaceBetweenContainer, [childA, childB]);
    expect(children[0].x).toBeCloseTo(0, 1);
    expect(children[1].x).toBeCloseTo(40, 1);
  });
});

