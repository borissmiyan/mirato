import { describe, it, expect } from 'vitest';
import { generateArcDonutPath } from '../shapes/arcGeometry';

describe('arcGeometry', () => {
  it('generates a full circle when innerRadius is 0 and arcSweep is 360', () => {
    const path = generateArcDonutPath({ innerRadius: 0, arcSweep: 360 });
    expect(path).toBeDefined();
    // Must decompose into dual 180-deg arcs to prevent SVG 360-deg collapse
    expect(path).toContain('A 0.5 0.5');
    expect(path).toContain('Z');
  });

  it('generates a donut when innerRadius is greater than 0', () => {
    const path = generateArcDonutPath({ innerRadius: 0.5, arcSweep: 360 });
    expect(path).toBeDefined();
    // Outer arc and inner cutout arc
    expect(path.match(/A/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('generates a partial pie slice when innerRadius is 0 and arcSweep < 360', () => {
    const path = generateArcDonutPath({ innerRadius: 0, arcStart: 0, arcSweep: 180 });
    expect(path).toBeDefined();
    // Slices converge to center (0.5, 0.5)
    expect(path).toContain('0.5 0.5');
    expect(path).toContain('Z');
  });

  it('generates segmented donut with multiple sectors and gaps', () => {
    const path = generateArcDonutPath({
      innerRadius: 0.6,
      arcStart: 0,
      arcSweep: 360,
      sectorCount: 4,
      sectorGap: 5,
    });
    expect(path).toBeDefined();
    expect(path).not.toContain('NaN');
    // Should have 4 closed subpaths
    const zCount = path.match(/Z/g)?.length;
    expect(zCount).toBe(4);
  });

  it('handles custom sector weights proportionally', () => {
    const path = generateArcDonutPath({
      innerRadius: 0.5,
      sectorCount: 3,
      sectorWeights: [10, 20, 70],
    });
    expect(path).toBeDefined();
    expect(path).not.toContain('NaN');
  });
});

