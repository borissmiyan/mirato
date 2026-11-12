import { ICanvasItem, IVectorNode } from '@/core/types';

/**
 * Converts any standard shape or stroke item into an initial editable vector network.
 */
export function shapeItemToVectorNodes(item: ICanvasItem): { nodes: IVectorNode[]; isClosed: boolean } {
  if (item.type === 'path' && item.path) {
    return {
      nodes: item.path.nodes,
      isClosed: item.path.isClosed,
    };
  }

  if (item.type === 'stroke') {
    return {
      nodes: [
        { id: crypto.randomUUID(), x: 0, y: 50, isCorner: true },
        { id: crypto.randomUUID(), x: 100, y: 50, isCorner: true },
      ],
      isClosed: false,
    };
  }

  const shapeType = item.shape?.shapeType || 'rect';

  switch (shapeType) {
    case 'triangle':
      return {
        nodes: [
          { id: crypto.randomUUID(), x: 50, y: 2, isCorner: true },
          { id: crypto.randomUUID(), x: 98, y: 98, isCorner: true },
          { id: crypto.randomUUID(), x: 2, y: 98, isCorner: true },
        ],
        isClosed: true,
      };

    case 'polygon': {
      const sides = Math.max(3, Math.min(60, item.shape?.polygonSides ?? 5));
      const angleStep = (2 * Math.PI) / sides;
      const rawPoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < sides; i++) {
        const a = -Math.PI / 2 + i * angleStep;
        rawPoints.push({
          x: 0.5 + 0.5 * Math.cos(a),
          y: 0.5 + 0.5 * Math.sin(a),
        });
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of rawPoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const spanX = Math.max(0.001, maxX - minX);
      const spanY = Math.max(0.001, maxY - minY);
      const nodes: IVectorNode[] = rawPoints.map((p) => ({
        id: crypto.randomUUID(),
        x: Math.round(((p.x - minX) / spanX) * 1000) / 10,
        y: Math.round(((p.y - minY) / spanY) * 1000) / 10,
        isCorner: true,
      }));
      return { nodes, isClosed: true };
    }

    case 'diamond':
      return {
        nodes: [
          { id: crypto.randomUUID(), x: 50, y: 2, isCorner: true },
          { id: crypto.randomUUID(), x: 98, y: 50, isCorner: true },
          { id: crypto.randomUUID(), x: 50, y: 98, isCorner: true },
          { id: crypto.randomUUID(), x: 2, y: 50, isCorner: true },
        ],
        isClosed: true,
      };

    case 'star': {
      if (!item.shape?.starPoints || (item.shape.starPoints === 5 && !item.shape?.starRatio)) {
        return {
          nodes: [
            { id: crypto.randomUUID(), x: 50, y: 5, isCorner: true },
            { id: crypto.randomUUID(), x: 61, y: 35, isCorner: true },
            { id: crypto.randomUUID(), x: 95, y: 35, isCorner: true },
            { id: crypto.randomUUID(), x: 68, y: 57, isCorner: true },
            { id: crypto.randomUUID(), x: 79, y: 90, isCorner: true },
            { id: crypto.randomUUID(), x: 50, y: 70, isCorner: true },
            { id: crypto.randomUUID(), x: 21, y: 90, isCorner: true },
            { id: crypto.randomUUID(), x: 32, y: 57, isCorner: true },
            { id: crypto.randomUUID(), x: 5, y: 35, isCorner: true },
            { id: crypto.randomUUID(), x: 39, y: 35, isCorner: true },
          ],
          isClosed: true,
        };
      }
      const points = Math.max(3, Math.min(60, item.shape.starPoints));
      const ratio = Math.max(0.05, Math.min(0.95, item.shape.starRatio ?? 0.382));
      const total = points * 2;
      const step = Math.PI / points;
      const rawPoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < total; i++) {
        const isOuter = i % 2 === 0;
        const r = isOuter ? 0.5 : 0.5 * ratio;
        const a = -Math.PI / 2 + i * step;
        rawPoints.push({
          x: 0.5 + r * Math.cos(a),
          y: 0.5 + r * Math.sin(a),
        });
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of rawPoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const spanX = Math.max(0.001, maxX - minX);
      const spanY = Math.max(0.001, maxY - minY);
      const nodes: IVectorNode[] = rawPoints.map((p) => ({
        id: crypto.randomUUID(),
        x: Math.round(((p.x - minX) / spanX) * 1000) / 10,
        y: Math.round(((p.y - minY) / spanY) * 1000) / 10,
        isCorner: true,
      }));
      return { nodes, isClosed: true };
    }

    case 'circle': {
      // Circle with 4 smooth Bezier nodes
      const k = 48 * 0.5522847498; // cubic kappa for circle approximation
      return {
        nodes: [
          {
            id: crypto.randomUUID(),
            x: 50, y: 2,
            handleIn: { x: 50 - k, y: 2 },
            handleOut: { x: 50 + k, y: 2 },
            isCorner: false,
          },
          {
            id: crypto.randomUUID(),
            x: 98, y: 50,
            handleIn: { x: 98, y: 50 - k },
            handleOut: { x: 98, y: 50 + k },
            isCorner: false,
          },
          {
            id: crypto.randomUUID(),
            x: 50, y: 98,
            handleIn: { x: 50 + k, y: 98 },
            handleOut: { x: 50 - k, y: 98 },
            isCorner: false,
          },
          {
            id: crypto.randomUUID(),
            x: 2, y: 50,
            handleIn: { x: 2, y: 50 + k },
            handleOut: { x: 2, y: 50 - k },
            isCorner: false,
          },
        ],
        isClosed: true,
      };
    }

    case 'rect':
    default:
      return {
        nodes: [
          { id: crypto.randomUUID(), x: 0, y: 0, isCorner: true },
          { id: crypto.randomUUID(), x: 100, y: 0, isCorner: true },
          { id: crypto.randomUUID(), x: 100, y: 100, isCorner: true },
          { id: crypto.randomUUID(), x: 0, y: 100, isCorner: true },
        ],
        isClosed: true,
      };
  }
}

