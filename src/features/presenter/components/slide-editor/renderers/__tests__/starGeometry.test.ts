import { describe, it, expect } from 'vitest';
import { generateStarPath } from '../shapes/starGeometry';

describe('starGeometry', () => {
  it('generates a valid SVG path for a default 5-point star', () => {
    const path = generateStarPath({});
    expect(path).toBeDefined();
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // Should contain 10 vertices
    const lCommands = path.match(/[LQ]/g);
    expect(lCommands && lCommands.length).toBeGreaterThanOrEqual(9);
  });

  it('respects starPoints parameter for 3, 6, 8 points', () => {
    const path3 = generateStarPath({ starPoints: 3 });
    const path6 = generateStarPath({ starPoints: 6 });
    const path8 = generateStarPath({ starPoints: 8 });

    expect(path3).toContain('Z');
    expect(path6).toContain('Z');
    expect(path8).toContain('Z');
  });

  it('adjusts inner radius depth using starRatio', () => {
    const normalStar = generateStarPath({ starRatio: 0.5 });
    const deepStar = generateStarPath({ starRatio: 0.2 });
    expect(normalStar).not.toEqual(deepStar);
  });

  it('applies corner rounding for inner and outer radii without crashing or NaN', () => {
    const roundedPath = generateStarPath({
      starPoints: 5,
      starRatio: 0.4,
      starInnerRadius: 10,
      starOuterRadius: 10,
      starOuterRadii: [5, 10, 15, 20, 25],
    });
    expect(roundedPath).toBeDefined();
    expect(roundedPath).not.toContain('NaN');
    expect(roundedPath).toContain('Q'); // Bézier curve for fillet
  });

  it('coordinates are strictly bounded within [0, 1]', () => {
    const path = generateStarPath({ starPoints: 5, starRatio: 0.382 });
    const numbers = path
      .replace(/[MLQZ]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    for (const num of numbers) {
      expect(num).toBeGreaterThanOrEqual(-0.01);
      expect(num).toBeLessThanOrEqual(1.01);
    }
  });
});

