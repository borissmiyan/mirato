import React, { memo } from 'react';
import { cn } from '@/core/utils/cn';

interface CanvasSelectionFrameProps {
    isSelected: boolean;
    isEditing: boolean;
    isHovered?: boolean;
    borderRadius?: number;
    canvasScale?: number;
    itemScale?: number;
    isMultiSelected?: boolean;
}

/**
 * Figma-grade High-Contrast Scale-Invariant Selection Frame.
 * Preserves a crisp 1.5 physical pixel line thickness on screen regardless of canvas zoom.
 * Features dual-tone outer and inner halos so the frame is distinct on white, black, or photographic media.
 * Faithfully mirrors the shape's corner borderRadius.
 */
export const CanvasSelectionFrame: React.FC<CanvasSelectionFrameProps> = memo(({
    isSelected,
    isEditing,
    isHovered,
    borderRadius = 0,
    canvasScale = 1,
    itemScale = 1,
    isMultiSelected = false,
}) => {
    if (isEditing) return null;

    const effectiveScale = (itemScale || 1) * (canvasScale || 1);
    const safeScale = effectiveScale > 0 ? effectiveScale : 1;
    // Scale-invariant border and shadow width (at least 1.5 physical pixels on screen)
    const borderWidth = Math.max(1.5, 1.5 / safeScale);
    const shadowWidth = Math.max(1, 1 / safeScale);
    const hoverBorderWidth = Math.max(1, 1 / safeScale);

    if (isSelected) {
        return (
            <div
                data-selection-frame
                className={cn(
                    "absolute inset-0 pointer-events-none z-40 transition-colors duration-75 border-accent",
                    isMultiSelected ? "bg-accent/10" : "bg-accent/5"
                )}
                style={{
                    borderRadius: `var(--item-border-radius, ${borderRadius ? `${borderRadius}px` : '0px'})`,
                    borderStyle: 'solid',
                    borderWidth: `${borderWidth}px`,
                    borderColor: 'rgb(var(--accent, 245 158 11))',
                    boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85), inset 0 0 0 ${shadowWidth}px rgba(0,0,0,0.45)`,
                }}
            />
        );
    }

    if (isHovered) {
        return (
            <div
                className="absolute inset-0 pointer-events-none z-30 transition-all duration-75 border-accent"
                style={{
                    borderRadius: borderRadius ? `${borderRadius}px` : undefined,
                    borderStyle: 'dashed',
                    borderWidth: `${hoverBorderWidth}px`,
                    borderColor: 'rgb(var(--accent, 245 158 11))',
                    opacity: 0.75,
                    boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.6)`,
                }}
            />
        );
    }

    return null;
});

CanvasSelectionFrame.displayName = 'CanvasSelectionFrame';
export default CanvasSelectionFrame;
