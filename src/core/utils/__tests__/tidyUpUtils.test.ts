import { describe, it, expect } from 'vitest';
import {
  analyzeSelectionSpacing,
  tidyUpItems,
  adjustUniformGap,
  swapItemPositions,
} from '../tidyUpUtils';
import { ICanvasItem } from '@/core/types';

describe('tidyUpUtils', () => {
  const itemA: ICanvasItem = {
    id: 'a',
    type: 'shape',
    x: 10, y: 10, width: 10, height: 10,
    rotation: 0, zIndex: 1, locked: false, visible: true,
    fills: [], strokes: [],
  };

  const itemB: ICanvasItem = {
    id: 'b',
    type: 'shape',
    x: 25, y: 10, width: 10, height: 10,
    rotation: 0, zIndex: 2, locked: false, visible: true,
    fills: [], strokes: [],
  };

  const itemC: ICanvasItem = {
    id: 'c',
    type: 'shape',
    x: 40, y: 10, width: 10, height: 10,
    rotation: 0, zIndex: 3, locked: false, visible: true,
    fills: [], strokes: [],
  };

  it('detects a row layout and uniform spacing', () => {
    const info = analyzeSelectionSpacing([itemA, itemB, itemC]);
    expect(info.direction).toBe('row');
    expect(info.isUniform).toBe(true);
    expect(info.averageGapPx).toBeGreaterThan(0);
  });

  it('tidies up items into equal gaps', () => {
    // Messy items
    const messyB = { ...itemB, x: 22 };
    const tidied = tidyUpItems([itemA, messyB, itemC], 30);
    expect(tidied).toHaveLength(3);
    expect(tidied[0].x).toBe(10);
    expect(tidied[1].x).toBeGreaterThan(tidied[0].x);
    expect(tidied[2].x).toBeGreaterThan(tidied[1].x);
  });

  it('adjusts uniform gap dynamically', () => {
    const adjusted = adjustUniformGap([itemA, itemB, itemC], 'row', 50);
    expect(adjusted).toHaveLength(3);
    const gap1 = adjusted[1].x - adjusted[0].x;
    const gap2 = adjusted[2].x - adjusted[1].x;
    expect(gap1).toBeCloseTo(gap2, 1);
  });

  it('swaps positions of two items', () => {
    const { updatedA, updatedB } = swapItemPositions(itemA, itemB);
    expect(updatedA.x).toBe(itemB.x);
    expect(updatedB.x).toBe(itemA.x);
  });
});

