import React, { memo } from 'react';
import { DrawingPreview } from './hooks/useCanvasDrawing';

export const CanvasDrawingPreview: React.FC<{ preview: DrawingPreview | null }> = memo(({ preview }) => {
  if (!preview) return null;

  if (preview.type === 'shape') {
    return (
      <div
        className="absolute border-2 border-dashed border-accent bg-accent/15 rounded-md pointer-events-none z-50 transition-none"
        style={{
          left: `${preview.left}%`,
          top: `${preview.top}%`,
          width: `${preview.width}%`,
          height: `${preview.height}%`,
        }}
      />
    );
  }

  if (preview.type === 'line') {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          x1={preview.x1}
          y1={preview.y1}
          x2={preview.x2}
          y2={preview.y2}
          stroke="var(--color-accent, #3b82f6)"
          strokeWidth={0.3}
          strokeDasharray="1.5 1.5"
        />
      </svg>
    );
  }

  return null;
});

CanvasDrawingPreview.displayName = 'CanvasDrawingPreview';

