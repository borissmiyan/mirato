import React from 'react';

/**
 * GPU-accelerated dot grid overlay for SlideCanvas.
 * Renders a crisp 24px pitch dot pattern with 0 DOM nodes per dot.
 * Strictly non-interactive and pointer-transparent.
 */
export const CanvasGrid: React.FC = React.memo(() => {
    return (
        <div
            data-testid="canvas-dot-grid"
            className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden"
            style={{
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.18) 1.2px, transparent 1.2px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0',
            }}
        />
    );
});

CanvasGrid.displayName = 'CanvasGrid';

