import { describe, it, expect } from 'vitest';
import { getNormalizedShapePath } from '../shapeGeometry';
import { nodesToNormalizedSVGPath } from '../vectorGeometry';
import { IVectorNode } from '@/core/types';

describe('normalizedShapeGeometry', () => {
  describe('getNormalizedShapePath', () => {
    it('generates a unit diamond in [0, 1] bounding box space touching all 4 edges', () => {
      const d = getNormalizedShapePath('diamond');
      expect(d).toBe('M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z');
    });

    it('generates a unit triangle touching top and bottom corners', () => {
      const d = getNormalizedShapePath('triangle');
      expect(d).toBe('M 0.5 0 L 1 1 L 0 1 Z');
    });

    it('generates a unit circle touching all 4 bounding edges', () => {
      const d = getNormalizedShapePath('circle');
      expect(d).toContain('M 0.5,0');
      expect(d).toContain('A 0.5,0.5');
      expect(d).toContain('Z');
    });

    it('generates a unit star touching boundaries', () => {
      const d = getNormalizedShapePath('star');
      expect(d).toContain('M 0.5 0');
      expect(d).toContain('1 0.35');
      expect(d).toContain('Z');
    });

    it('generates a unit rect for fallback or rect shape', () => {
      const d = getNormalizedShapePath('rect');
      expect(d).toBe('M 0,0 H 1 V 1 H 0 Z');
    });
  });

  describe('nodesToNormalizedSVGPath', () => {
    it('normalizes node coordinates from 0-100 to 0-1', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, isCorner: true },
        { id: '2', x: 50, y: 100, isCorner: true },
        { id: '3', x: 100, y: 0, isCorner: true },
      ];
      const d = nodesToNormalizedSVGPath(nodes, true);
      expect(d).toBe('M 0,0 L 0.5,1 L 1,0 Z');
    });

    it('returns empty string for empty nodes', () => {
      expect(nodesToNormalizedSVGPath([], false)).toBe('');
    });
  });
});

