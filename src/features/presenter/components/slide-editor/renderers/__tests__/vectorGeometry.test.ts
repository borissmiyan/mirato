import { describe, it, expect } from 'vitest';
import { IVectorNode, ICanvasItem } from '@/core/types';
import {
  nodesToSVGPath,
  shapeItemToVectorNodes,
  recalculatePathBounds,
  getCubicBezierExtrema,
} from '../vectorGeometry';

describe('vectorGeometry', () => {
  describe('nodesToSVGPath', () => {
    it('returns empty string for empty nodes array', () => {
      expect(nodesToSVGPath([], false)).toBe('');
    });

    it('generates a simple straight-line open path', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, isCorner: true },
        { id: '2', x: 50, y: 50, isCorner: true },
        { id: '3', x: 100, y: 100, isCorner: true },
      ];
      const d = nodesToSVGPath(nodes, false);
      expect(d).toBe('M 0,0 L 50,50 L 100,100');
    });

    it('generates closed path with Z', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, isCorner: true },
        { id: '2', x: 100, y: 0, isCorner: true },
        { id: '3', x: 100, y: 100, isCorner: true },
      ];
      const d = nodesToSVGPath(nodes, true);
      expect(d).toBe('M 0,0 L 100,0 L 100,100 Z');
    });

    it('generates cubic Bezier curve segments when handles exist', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, handleOut: { x: 25, y: 0 }, isCorner: false },
        { id: '2', x: 100, y: 100, handleIn: { x: 75, y: 100 }, isCorner: false },
      ];
      const d = nodesToSVGPath(nodes, false);
      expect(d).toBe('M 0,0 C 25,0 75,100 100,100');
    });

    it('uses node position as fallback control point if one handle is missing', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, handleOut: { x: 20, y: 10 } },
        { id: '2', x: 100, y: 50 }, // no handleIn
      ];
      const d = nodesToSVGPath(nodes, false);
      expect(d).toBe('M 0,0 C 20,10 100,50 100,50');
    });
  });

  describe('shapeItemToVectorNodes', () => {
    it('converts triangle shape into 3 closed nodes', () => {
      const item = {
        id: 'tri-1',
        type: 'shape',
        shape: { shapeType: 'triangle' },
      } as ICanvasItem;

      const res = shapeItemToVectorNodes(item);
      expect(res.isClosed).toBe(true);
      expect(res.nodes).toHaveLength(3);
      expect(res.nodes[0]?.x).toBe(50);
      expect(res.nodes[0]?.y).toBe(2);
    });

    it('converts rect shape into 4 closed nodes', () => {
      const item = {
        id: 'rect-1',
        type: 'shape',
        shape: { shapeType: 'rect' },
      } as ICanvasItem;

      const res = shapeItemToVectorNodes(item);
      expect(res.isClosed).toBe(true);
      expect(res.nodes).toHaveLength(4);
    });

    it('converts line stroke into 2 open nodes', () => {
      const item = {
        id: 'line-1',
        type: 'stroke',
        stroke: { x2: 100, y2: 0, color: '#fff', width: 2 },
      } as ICanvasItem;

      const res = shapeItemToVectorNodes(item);
      expect(res.isClosed).toBe(false);
      expect(res.nodes).toHaveLength(2);
    });

    it('converts polygon shape into N closed nodes', () => {
      const item = {
        id: 'poly-1',
        type: 'shape',
        shape: { shapeType: 'polygon', polygonSides: 6 },
      } as ICanvasItem;

      const res = shapeItemToVectorNodes(item);
      expect(res.isClosed).toBe(true);
      expect(res.nodes).toHaveLength(6);
    });

    it('converts star shape into 2N closed nodes', () => {
      const item = {
        id: 'star-1',
        type: 'shape',
        shape: { shapeType: 'star', starPoints: 8 },
      } as ICanvasItem;

      const res = shapeItemToVectorNodes(item);
      expect(res.isClosed).toBe(true);
      expect(res.nodes).toHaveLength(16);
    });
  });

  describe('recalculatePathBounds', () => {
    it('computes accurate bounding box of nodes', () => {
      const nodes: IVectorNode[] = [
        { id: '1', x: 10, y: 20 },
        { id: '2', x: 80, y: 90 },
      ];
      const bounds = recalculatePathBounds(nodes);
      expect(bounds.minX).toBe(10);
      expect(bounds.minY).toBe(20);
      expect(bounds.maxX).toBe(80);
      expect(bounds.maxY).toBe(90);
    });

    it('does not inflate bounding box with distant handles when curve does not reach them', () => {
      // Curve between (0, 0) and (100, 0) with handles extending outward to (30, -100) and (70, -100)
      // The curve peak reaches y = -75, but handles extend to -100
      const [minY, maxY] = getCubicBezierExtrema(0, -100, -100, 0);
      expect(minY).toBe(-75);
      expect(maxY).toBe(0);

      const nodes: IVectorNode[] = [
        { id: '1', x: 0, y: 0, handleOut: { x: 30, y: -100 } },
        { id: '2', x: 100, y: 0, handleIn: { x: 70, y: -100 } },
      ];
      const bounds = recalculatePathBounds(nodes, false);
      expect(bounds.minY).toBe(-75);
      expect(bounds.maxY).toBe(0);
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(100);
    });
  });
});

