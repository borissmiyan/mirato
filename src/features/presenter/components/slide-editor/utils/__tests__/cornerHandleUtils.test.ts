import { describe, it, expect } from 'vitest';
import {
  getRectCornerHandles,
  getPolygonCornerHandles,
  getStarCornerHandles,
} from '../cornerHandleUtils';
import { ICanvasItem } from '@/core/types';

describe('cornerHandleUtils', () => {
  it('computes 4 corner handles for a rectangle', () => {
    const item: ICanvasItem = {
      id: 'rect-1',
      type: 'shape',
      shape: { shapeType: 'rect' },
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      fills: [],
      strokes: [],
    };
    const handles = getRectCornerHandles(item, 200, 200, 1);
    expect(handles).toHaveLength(4);
    expect(handles.map((h) => h.id)).toEqual(['tl', 'tr', 'br', 'bl']);
  });

  it('computes N corner handles for a regular polygon', () => {
    const item: ICanvasItem = {
      id: 'poly-1',
      type: 'shape',
      shape: { shapeType: 'polygon', polygonSides: 5 },
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      fills: [],
      strokes: [],
    };
    const handles = getPolygonCornerHandles(item, 200, 200, 1);
    expect(handles).toHaveLength(5);
    // All handles must be inside the bounding box
    for (const h of handles) {
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(200);
      expect(h.y).toBeGreaterThan(0);
      expect(h.y).toBeLessThan(200);
    }
  });

  it('computes handles for a star (outer and inner)', () => {
    const item: ICanvasItem = {
      id: 'star-1',
      type: 'shape',
      shape: { shapeType: 'star', starPoints: 5, starRatio: 0.4 },
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      fills: [],
      strokes: [],
    };
    const handles = getStarCornerHandles(item, 200, 200, 1);
    expect(handles.length).toBeGreaterThanOrEqual(5);
  });
});

