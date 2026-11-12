import React, { memo } from 'react';
import { ICanvasItem } from '@/core/types';
import { CanvasHUD } from './CanvasHUD';

interface CanvasDimensionBadgeProps {
    selectedItems?: ICanvasItem[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    itemScale?: number;
    canvasScale?: number;
    activeMode: 'move' | 'resize' | 'rotate' | null;
}

/**
 * Legacy wrapper forwarding to standardized CanvasHUD.
 */
export const CanvasDimensionBadge: React.FC<CanvasDimensionBadgeProps> = memo(({
    selectedItems,
    activeMode,
}) => {
    return (
        <CanvasHUD
            selectedItems={selectedItems}
            activeMode={activeMode}
        />
    );
});

CanvasDimensionBadge.displayName = 'CanvasDimensionBadge';
export default CanvasDimensionBadge;
