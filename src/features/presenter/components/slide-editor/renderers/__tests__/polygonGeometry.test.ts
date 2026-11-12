import { describe, it, expect } from 'vitest';
import { generatePolygonPath } from '../shapes/polygonGeometry';

describe('polygonGeometry', () => {
  it('generates a triangle when sides is 3', () => {
    const path = generatePolygonPath({ polygonSides: 3 });
    expect(path).toBeDefined();
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).not.toContain('NaN');
  });

  it('generates hexagon and octagon with sides 6 and 8', () => {
    const hex = generatePolygonPath({ polygonSides: 6 });
    const oct = generatePolygonPath({ polygonSides: 8 });
    expect(hex).toContain('Z');
    expect(oct).toContain('Z');
    expect(hex).not.toEqual(oct);
  });

  it('normalizes polygon to fill 100% of bounding box [0, 1]', () => {
    const path = generatePolygonPath({ polygonSides: 3 });
    const numbers = path
      .replace(/[MLQZ]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    // Must have coordinates touching 0 and 1
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);

    expect(Math.min(...xs)).toBeCloseTo(0, 1);
    expect(Math.max(...xs)).toBeCloseTo(1, 1);
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeCloseTo(1, 1);
  });

  it('supports per-vertex corner rounding and global corner radius', () => {
    const rounded = generatePolygonPath({
      polygonSides: 4,
      polygonCornerRadius: 15,
      polygonCornerRadii: [0, 10, 20, 30],
    });
    expect(rounded).toBeDefined();
    expect(rounded).not.toContain('NaN');
    expect(rounded).toContain('Q');
  });
});

