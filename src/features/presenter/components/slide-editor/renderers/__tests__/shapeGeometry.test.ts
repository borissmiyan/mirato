import { describe, it, expect } from 'vitest';
import {
  getShapePathData,
  getLineAngleAndLength,
  snapAngleToStep,
} from '../shapeGeometry';

describe('shapeGeometry', () => {
  describe('getShapePathData', () => {
    it('generates a triangle path in 0-100 space', () => {
      const path = getShapePathData('triangle');
      expect(path).toContain('M 50');
      expect(path).toContain('Z');
    });

    it('generates a diamond path in 0-100 space', () => {
      const path = getShapePathData('diamond');
      expect(path).toContain('M 50 2');
      expect(path).toContain('Z');
    });

    it('generates a star path with 10 vertices', () => {
      const path = getShapePathData('star');
      expect(path).toContain('M 50 5');
      expect(path).toContain('Z');
    });

    it('generates a circle path in 0-100 space', () => {
      const path = getShapePathData('circle');
      expect(path).toContain('A');
      expect(path).toContain('Z');
    });

    it('generates a rect path with uniform radius', () => {
      const path = getShapePathData('rect', { tl: 10, tr: 10, br: 10, bl: 10 });
      expect(path).toContain('M');
      expect(path).toContain('a 10,10');
      expect(path).toContain('Z');
    });

    it('generates a rect path with zero radius', () => {
      const path = getShapePathData('rect', { tl: 0, tr: 0, br: 0, bl: 0 });
      expect(path).toBe('M 0,0 H 100 V 100 H 0 Z');
    });

    it('generates a rect path with independent radii', () => {
      const path = getShapePathData('rect', { tl: 20, tr: 0, br: 15, bl: 5 });
      expect(path).toContain('a 20,20');
      expect(path).toContain('a 15,15');
      expect(path).toContain('a 5,5');
    });
  });

  describe('getLineAngleAndLength', () => {
    it('computes 0 degrees and correct length for horizontal right line', () => {
      const res = getLineAngleAndLength(0, 50, 100, 50);
      expect(res.angleDeg).toBe(0);
      expect(res.length).toBe(100);
    });

    it('computes 90 degrees for vertical downward line', () => {
      const res = getLineAngleAndLength(50, 0, 50, 100);
      expect(res.angleDeg).toBe(90);
      expect(res.length).toBe(100);
    });

    it('handles zero-length line safely without NaN', () => {
      const res = getLineAngleAndLength(50, 50, 50, 50);
      expect(Number.isNaN(res.angleDeg)).toBe(false);
      expect(res.length).toBe(0);
    });
  });

  describe('snapAngleToStep', () => {
    it('snaps angles to nearest 45 degree increment', () => {
      expect(snapAngleToStep(42, 45)).toBe(45);
      expect(snapAngleToStep(88, 45)).toBe(90);
      expect(snapAngleToStep(12, 45)).toBe(0);
      expect(snapAngleToStep(-40, 45)).toBe(-45);
    });
  });
});

