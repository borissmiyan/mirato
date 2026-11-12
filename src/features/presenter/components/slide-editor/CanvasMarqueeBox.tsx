import React, { memo } from 'react';

export interface IMarqueeRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface CanvasMarqueeBoxProps {
    box: IMarqueeRect | null;
}

/**
 * Figma-style rubberband marquee selection overlay.
 */
export const CanvasMarqueeBox: React.FC<CanvasMarqueeBoxProps> = memo(({ box }) => {
    if (!box || box.width <= 0 || box.height <= 0) return null;

    return (
        <div
            className="absolute pointer-events-none z-50 border border-accent bg-accent/15 rounded-[2px] shadow-sm transition-opacity"
            style={{
                left: `${box.left}%`,
                top: `${box.top}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
            }}
        />
    );
});

CanvasMarqueeBox.displayName = 'CanvasMarqueeBox';
export default CanvasMarqueeBox;

