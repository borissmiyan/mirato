import { ICanvasItem } from '@/core/types';
import { getItemBounds } from './canvasDistance';

export interface IEqualSpacingMatch {
    orientation: 'horizontal' | 'vertical';
    gapPx: number;
    // Segments to draw lines and badges
    segments: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        badgeX: number;
        badgeY: number;
    }>;
    snappedPosition?: number;
}

/**
 * Detects equal spacing between a dragged item and neighboring items.
 * Returns match data with segments for drawing system-accent badges.
 */
export function detectEqualSpacing(
    draggedItem: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number },
    otherItems: Array<Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number }>,
    thresholdPct: number = 1.0
): IEqualSpacingMatch[] {
    if (otherItems.length < 2) return [];

    const matches: IEqualSpacingMatch[] = [];
    const bD = getItemBounds(draggedItem);

    // 1. Horizontal check
    // Sort all items by centerX
    const allH = [
        { isDragged: true, bounds: bD },
        ...otherItems.map(it => ({ isDragged: false, bounds: getItemBounds(it) }))
    ].sort((a, b) => a.bounds.left - b.bounds.left);

    for (let i = 0; i < allH.length - 2; i++) {
        // Only trigger when the actively dragged item is part of the triplet
        if (!allH[i].isDragged && !allH[i + 1].isDragged && !allH[i + 2].isDragged) {
            continue;
        }

        const first = allH[i].bounds;
        const second = allH[i + 1].bounds;
        const third = allH[i + 2].bounds;

        // Verify vertical alignment / proximity — items in different rows are not a sequence
        const overlapY = Math.max(0, Math.min(first.bottom, second.bottom, third.bottom) - Math.max(first.top, second.top, third.top));
        const maxCenterYDiff = Math.max(
            Math.abs(first.centerY - second.centerY),
            Math.abs(second.centerY - third.centerY)
        );
        const maxH = Math.max(first.height, second.height, third.height);
        if (overlapY <= 0 && maxCenterYDiff > maxH * 0.5) {
            continue;
        }

        const gap1 = second.left - first.right;
        const gap2 = third.left - second.right;

        if (gap1 > 0 && gap2 > 0 && Math.abs(gap1 - gap2) <= thresholdPct) {
            const avgGap = (gap1 + gap2) / 2;
            const gapPx = Math.round(avgGap * 19.2);

            // Filter out accidental micro-gaps (< 8px)
            if (gapPx < 8) continue;

            const midY = (first.centerY + second.centerY + third.centerY) / 3;

            matches.push({
                orientation: 'horizontal',
                gapPx,
                segments: [
                    {
                        x1: first.right,
                        y1: midY,
                        x2: second.left,
                        y2: midY,
                        badgeX: first.right + gap1 / 2,
                        badgeY: midY,
                    },
                    {
                        x1: second.right,
                        y1: midY,
                        x2: third.left,
                        y2: midY,
                        badgeX: second.right + gap2 / 2,
                        badgeY: midY,
                    },
                ],
            });
        }
    }

    // 2. Vertical check
    const allV = [
        { isDragged: true, bounds: bD },
        ...otherItems.map(it => ({ isDragged: false, bounds: getItemBounds(it) }))
    ].sort((a, b) => a.bounds.top - b.bounds.top);

    for (let i = 0; i < allV.length - 2; i++) {
        // Only trigger when the actively dragged item is part of the triplet
        if (!allV[i].isDragged && !allV[i + 1].isDragged && !allV[i + 2].isDragged) {
            continue;
        }

        const first = allV[i].bounds;
        const second = allV[i + 1].bounds;
        const third = allV[i + 2].bounds;

        // Verify horizontal alignment / proximity — items in different columns are not a sequence
        const overlapX = Math.max(0, Math.min(first.right, second.right, third.right) - Math.max(first.left, second.left, third.left));
        const maxCenterXDiff = Math.max(
            Math.abs(first.centerX - second.centerX),
            Math.abs(second.centerX - third.centerX)
        );
        const maxW = Math.max(first.width, second.width, third.width);
        if (overlapX <= 0 && maxCenterXDiff > maxW * 0.5) {
            continue;
        }

        const gap1 = second.top - first.bottom;
        const gap2 = third.top - second.bottom;

        if (gap1 > 0 && gap2 > 0 && Math.abs(gap1 - gap2) <= thresholdPct) {
            const avgGap = (gap1 + gap2) / 2;
            const gapPx = Math.round(avgGap * 10.8);

            // Filter out accidental micro-gaps (< 8px)
            if (gapPx < 8) continue;

            const midX = (first.centerX + second.centerX + third.centerX) / 3;

            matches.push({
                orientation: 'vertical',
                gapPx,
                segments: [
                    {
                        x1: midX,
                        y1: first.bottom,
                        x2: midX,
                        y2: second.top,
                        badgeX: midX,
                        badgeY: first.bottom + gap1 / 2,
                    },
                    {
                        x1: midX,
                        y1: second.bottom,
                        x2: midX,
                        y2: third.top,
                        badgeX: midX,
                        badgeY: second.bottom + gap2 / 2,
                    },
                ],
            });
        }
    }

    return matches;
}

