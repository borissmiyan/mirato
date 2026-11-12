import { describe, it, expect } from 'vitest';
import {
  findClosestPointOnSegment,
  splitBezierSegment,
  findClosestSegmentInPath,
  evaluateCubicBezier
} from '../vectorGeometry';
import { IVectorNode } from '@/core/types';

describe('vectorGeometry - Curve Point Insertion & Splitting', () => {
  it('finds closest point and parameter t on a linear segment', () => {
    const n1: IVectorNode = { id: 'n1', x: 0, y: 0, isCorner: true };
    const n2: IVectorNode = { id: 'n2', x: 100, y: 0, isCorner: true };
    const cursor = { x: 50, y: 10 };

    const res = findClosestPointOnSegment(cursor, n1, n2);
    expect(res.t).toBeCloseTo(0.5, 2);
    expect(res.point.x).toBe(50);
    expect(res.point.y).toBe(0);
    expect(res.distance).toBe(10);
  });

  it('splits a linear segment at parameter t', () => {
    const n1: IVectorNode = { id: 'n1', x: 0, y: 0, isCorner: true };
    const n2: IVectorNode = { id: 'n2', x: 100, y: 0, isCorner: true };

    const { updatedN1, newNode, updatedN2 } = splitBezierSegment(n1, n2, 0.4);
    expect(updatedN1.x).toBe(0);
    expect(newNode.x).toBe(40);
    expect(newNode.y).toBe(0);
    expect(newNode.isCorner).toBe(true);
    expect(updatedN2.x).toBe(100);
  });

  it('evaluates cubic Bezier at endpoints and midpoint', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: 100 };
    const p2 = { x: 100, y: 100 };
    const p3 = { x: 100, y: 0 };

    const ptStart = evaluateCubicBezier(p0, p1, p2, p3, 0);
    expect(ptStart.x).toBe(0);
    expect(ptStart.y).toBe(0);

    const ptEnd = evaluateCubicBezier(p0, p1, p2, p3, 1);
    expect(ptEnd.x).toBe(100);
    expect(ptEnd.y).toBe(0);

    const ptMid = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
    expect(ptMid.x).toBe(50);
    expect(ptMid.y).toBe(75);
  });

  it('splits a cubic Bezier segment using de Casteljau algorithm', () => {
    const n1: IVectorNode = {
      id: 'n1',
      x: 0,
      y: 0,
      handleOut: { x: 0, y: 100 },
      isCorner: false,
    };
    const n2: IVectorNode = {
      id: 'n2',
      x: 100,
      y: 0,
      handleIn: { x: 100, y: 100 },
      isCorner: false,
    };

    const { updatedN1, newNode, updatedN2 } = splitBezierSegment(n1, n2, 0.5);
    expect(newNode.x).toBe(50);
    expect(newNode.y).toBe(75);
    expect(newNode.isCorner).toBe(false);
    expect(newNode.handleIn).toBeDefined();
    expect(newNode.handleOut).toBeDefined();
    expect(updatedN1.handleOut).toBeDefined();
    expect(updatedN2.handleIn).toBeDefined();
  });

  it('finds closest segment in path', () => {
    const nodes: IVectorNode[] = [
      { id: '1', x: 0, y: 0, isCorner: true },
      { id: '2', x: 100, y: 0, isCorner: true },
      { id: '3', x: 100, y: 100, isCorner: true },
      { id: '4', x: 0, y: 100, isCorner: true },
    ];

    const match = findClosestSegmentInPath({ x: 50, y: 1 }, nodes, true, 5);
    expect(match).not.toBeNull();
    expect(match?.segmentIndex).toBe(0);
    expect(match?.point.x).toBe(50);
  });
});

