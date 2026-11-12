import React from 'react';
import { ICanvasItem } from '@/core/types';
import {
    calculateCanvasEdgeDistances,
    calculateItemToItemDistances,
    getCompositeGroupItem,
    getItemDOMBounds,
    IDistanceLine,
} from '@/core/utils/canvasDistance';

interface CanvasDistanceGuidesProps {
    isActive: boolean;
    selectedItem?: ICanvasItem | null;
    selectedItems?: ICanvasItem[];
    targetItem: ICanvasItem | null;
    otherItems?: ICanvasItem[];
    canvasScale?: number;
}

/**
 * Figma-grade Alt/Option distance measurement overlay.
 * Renders high-precision distance guides and pixel badges for single items and multi-selection groups.
 * Scale-invariant: badges and lines remain crisp and readable at any canvas zoom level.
 */
export const CanvasDistanceGuides: React.FC<CanvasDistanceGuidesProps> = React.memo(({
    isActive,
    selectedItem,
    selectedItems,
    targetItem,
    otherItems = [],
    canvasScale = 1,
}) => {
    if (!isActive) return null;

    const itemsToMeasure = selectedItems && selectedItems.length > 0
        ? selectedItems
        : (selectedItem ? [selectedItem] : []);

    if (itemsToMeasure.length === 0) return null;

    const sourceItem = getCompositeGroupItem(itemsToMeasure);
    const selectedIdsSet = new Set(itemsToMeasure.map(i => i.id));

    // Target is valid only if it's an external item outside the selected group
    const isValidTarget = targetItem && !selectedIdsSet.has(targetItem.id);

    let lines: IDistanceLine[] = [];
    if (isValidTarget) {
        lines = calculateItemToItemDistances(sourceItem, targetItem);
    } else {
        // Measure directly to slide canvas edges (0% and 100%) without obstacle collisions
        lines = calculateCanvasEdgeDistances(sourceItem);
    }

    const targetBounds = isValidTarget
        ? getItemDOMBounds(targetItem)
        : null;

    // For rotated target items, Figma uses a crisp rectangular (square-cornered) bounding box frame.
    // Corner radius is only mirrored when unrotated, avoiding distorted bounding curves.
    const isTargetRotated = !!targetItem?.rotation && (targetItem.rotation % 360 !== 0);
    const targetBorderRadius = isTargetRotated
        ? '0px'
        : (targetItem?.lockBorderRadius === false
            ? `${targetItem.borderRadiusTL ?? 0}px ${targetItem.borderRadiusTR ?? 0}px ${targetItem.borderRadiusBR ?? 0}px ${targetItem.borderRadiusBL ?? 0}px`
            : `${targetItem?.borderRadius ?? 0}px`);

    const safeScale = canvasScale > 0 ? canvasScale : 1;
    const counterScale = 1 / safeScale;
    const lineWidth = Math.max(1.5, 1.5 / safeScale);
    const shadowWidth = Math.max(1, 1 / safeScale);

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {/* Outline target item with exact matching visual bounds */}
            {targetBounds && (
                <div
                    className="absolute border-2 border-dashed border-accent bg-accent/15 transition-all pointer-events-none"
                    style={{
                        left: `${targetBounds.left}%`,
                        top: `${targetBounds.top}%`,
                        width: `${targetBounds.width}%`,
                        height: `${targetBounds.height}%`,
                        borderRadius: targetBorderRadius,
                    }}
                />
            )}

            {/* Render Measurement Lines and Badges */}
            {lines.map((line) => {
                const isHoriz = line.orientation === 'horizontal';
                const left = Math.min(line.x1, line.x2);
                const top = Math.min(line.y1, line.y2);
                const width = Math.max(0.1, Math.abs(line.x2 - line.x1));
                const height = Math.max(0.1, Math.abs(line.y2 - line.y1));

                return (
                    <React.Fragment key={line.id}>
                        {/* The measurement line — clean, touching bounding box edges without protruding ticks */}
                        <div
                            className="absolute bg-accent pointer-events-none"
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: isHoriz ? `${width}%` : `${lineWidth}px`,
                                height: isHoriz ? `${lineWidth}px` : `${height}%`,
                                transform: isHoriz ? `translateY(-${lineWidth / 2}px)` : `translateX(-${lineWidth / 2}px)`,
                                boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)`,
                            }}
                        />

                        {/* Standardized Pixel Distance Squircle Badge */}
                        <div
                            className="absolute rounded-xl px-2.5 py-0.5 bg-accent text-accent-foreground font-sans tabular-nums text-xs font-bold shadow-xl border border-black/10 select-none whitespace-nowrap pointer-events-none"
                            style={{
                                left: `${line.badgeX}%`,
                                top: `${line.badgeY}%`,
                                transform: `translate(-50%, -50%) scale(${counterScale})`,
                                transformOrigin: 'center center',
                            }}
                        >
                            {line.distancePx}px
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
});

CanvasDistanceGuides.displayName = 'CanvasDistanceGuides';

