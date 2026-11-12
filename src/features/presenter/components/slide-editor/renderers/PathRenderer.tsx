import React, { memo } from 'react';
import { ICanvasItem } from '@/core/types';
import { nodesToSVGPath } from './vectorGeometry';

interface PathRendererProps {
  item: ICanvasItem;
  idPrefix?: string;
}

export const PathRenderer: React.FC<PathRendererProps> = memo(({ item }) => {
  const path = item.path;
  if (!path || !path.nodes || path.nodes.length === 0) return null;

  // If item has borderWidth > 0, StrokeRenderer handles the stroke with full layer styling
  if (item.borderWidth && item.borderWidth > 0) return null;

  const pathD = nodesToSVGPath(path.nodes, path.isClosed);

  return (
    <div className="w-full h-full relative pointer-events-none">
      {/* For open paths without explicit border width, render fallback 1px stroke line */}
      {!path.isClosed && (
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={pathD}
            fill="none"
            stroke={item.strokes?.[0]?.color || item.borderColor || item.stroke?.color || '#ffffff'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin={item.strokeJoin || 'round'}
            strokeLinecap={item.strokeLinecap || 'round'}
            strokeDasharray={item.strokeDashArray}
          />
        </svg>
      )}
    </div>
  );
});

PathRenderer.displayName = 'PathRenderer';

