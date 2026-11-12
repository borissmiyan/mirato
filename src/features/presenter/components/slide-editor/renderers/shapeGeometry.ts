import { ShapeType, ICanvasItemShape } from '@/core/types';
import { generateStarPath } from './shapes/starGeometry';
import { generatePolygonPath } from './shapes/polygonGeometry';
import { generateArcDonutPath } from './shapes/arcGeometry';
import { generateSquircleRectPath } from './shapes/squircleGeometry';

export { generateStarPath, generatePolygonPath, generateArcDonutPath, generateSquircleRectPath };

export interface IShapeRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/**
 * Returns an SVG path `d` string in normalized 0-100 coordinate space.
 */
export function getShapePathData(shapeType: ShapeType, radii?: IShapeRadii): string {
  switch (shapeType) {
    case 'circle':
      // Circle centered at (50, 50) with radius 48
      return 'M 50,2 A 48,48 0 1,1 49.99,2 Z';

    case 'triangle':
      return 'M 50 2 L 98 98 L 2 98 Z';

    case 'star':
      return 'M 50 5 L 61 35 L 95 35 L 68 57 L 79 90 L 50 70 L 21 90 L 32 57 L 5 35 L 39 35 Z';

    case 'diamond':
      return 'M 50 2 L 98 50 L 50 98 L 2 50 Z';

    case 'rect':
    default: {
      const tl = Math.max(0, Math.min(50, radii?.tl ?? 0));
      const tr = Math.max(0, Math.min(50, radii?.tr ?? 0));
      const br = Math.max(0, Math.min(50, radii?.br ?? 0));
      const bl = Math.max(0, Math.min(50, radii?.bl ?? 0));

      if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
        return 'M 0,0 H 100 V 100 H 0 Z';
      }

      return `
        M ${tl},0
        H ${100 - tr}
        ${tr > 0 ? `a ${tr},${tr} 0 0 1 ${tr},${tr}` : ''}
        V ${100 - br}
        ${br > 0 ? `a ${br},${br} 0 0 1 -${br},${br}` : ''}
        H ${bl}
        ${bl > 0 ? `a ${bl},${bl} 0 0 1 -${bl},-${bl}` : ''}
        V ${tl}
        ${tl > 0 ? `a ${tl},${tl} 0 0 1 ${tl},-${tl}` : ''}
        Z
      `.replace(/\s+/g, ' ').trim();
    }
  }
}

/**
 * Returns an SVG path `d` string in normalized 0-1 coordinate space for objectBoundingBox clipping.
 * Scales dynamically to cover 100% of any bounding box dimensions like in Figma.
 */
export function getNormalizedShapePath(
  shapeType: ShapeType,
  shapeData?: Partial<ICanvasItemShape>
): string {
  switch (shapeType) {
    case 'circle':
      if (
        (shapeData?.innerRadius && shapeData.innerRadius > 0) ||
        (shapeData?.arcSweep !== undefined && shapeData.arcSweep < 360) ||
        (shapeData?.arcStart && shapeData.arcStart !== 0) ||
        (shapeData?.sectorCount && shapeData.sectorCount > 1)
      ) {
        return generateArcDonutPath(shapeData);
      }
      return 'M 0.5,0 A 0.5,0.5 0 1,1 0.4999,0 Z';

    case 'triangle':
      if (
        shapeData &&
        ((shapeData.polygonCornerRadius && shapeData.polygonCornerRadius > 0) ||
          shapeData.polygonCornerRadii?.some((r) => r > 0))
      ) {
        return generatePolygonPath({ ...shapeData, polygonSides: 3 });
      }
      return 'M 0.5 0 L 1 1 L 0 1 Z';

    case 'polygon':
      return generatePolygonPath(shapeData);

    case 'diamond':
      return 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z';

    case 'star':
      if (
        shapeData &&
        (shapeData.starPoints !== undefined ||
          shapeData.starRatio !== undefined ||
          shapeData.starInnerRadius !== undefined ||
          shapeData.starOuterRadius !== undefined ||
          shapeData.starOuterRadii !== undefined)
      ) {
        return generateStarPath(shapeData);
      }
      return 'M 0.5 0 L 0.61 0.35 L 1 0.35 L 0.68 0.57 L 0.81 1 L 0.5 0.70 L 0.19 1 L 0.32 0.57 L 0 0.35 L 0.39 0.35 Z';

    case 'rect':
    default:
      if (shapeData?.cornerSmoothing && shapeData.cornerSmoothing > 0) {
        return generateSquircleRectPath(shapeData.polygonCornerRadius ?? 16, shapeData.cornerSmoothing);
      }
      return 'M 0,0 H 1 V 1 H 0 Z';
  }
}

/**
 * Calculates angle in degrees and distance length between two points.
 */
export function getLineAngleAndLength(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { angleDeg: number; length: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return { angleDeg: 0, length: 0 };
  }

  const rad = Math.atan2(dy, dx);
  const angleDeg = (rad * 180) / Math.PI;

  return {
    angleDeg: Math.round(angleDeg * 100) / 100,
    length: Math.round(length * 100) / 100,
  };
}

/**
 * Snaps angle to nearest step (e.g. 45 degrees when holding Shift).
 */
export function snapAngleToStep(angleDeg: number, stepDeg: number = 45): number {
  if (stepDeg <= 0) return angleDeg;
  return Math.round(angleDeg / stepDeg) * stepDeg;
}

