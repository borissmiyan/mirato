import { describe, it, expect } from 'vitest';
import { generateSquircleRectPath } from '../shapes/squircleGeometry';

describe('squircleGeometry', () => {
  it('returns unit rect path when radius is 0', () => {
    const path = generateSquircleRectPath(0, 0.6);
    expect(path).toBe('M 0,0 H 1 V 1 H 0 Z');
  });

  it('generates smooth cubic Bézier squircle when radius and smoothing > 0', () => {
    // Radius 20% (0.2), Smoothing 0.6 (Apple standard)
    const path = generateSquircleRectPath(0.2, 0.6);
    expect(path).toContain('M ');
    expect(path).toContain('C '); // Cubic Bézier curves for G2 continuous corners
    expect(path).toContain('Z');
  });

  it('handles maximum smoothing 1.0 without crashing or producing NaN', () => {
    const path = generateSquircleRectPath(0.3, 1.0);
    expect(path).not.toContain('NaN');
    expect(path).toContain('C ');
  });
});

