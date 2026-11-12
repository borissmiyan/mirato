import { ICanvasItem } from '@/core/types';
import { getItemBounds } from './canvasDistance';

export interface IBoxBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * Checks if a canvas item intersects an axis-aligned bounding box.
 */
export function checkItemIntersectsBox(
    item: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number },
    box: IBoxBounds
): boolean {
    const rawPX = item.pivotX ?? 50;
    const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
    const rawPY = item.pivotY ?? 50;
    const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;

    const itemLeft = item.x - item.width * (pX / 100);
    const itemRight = itemLeft + item.width;
    const itemTop = item.y - item.height * (pY / 100);
    const itemBottom = itemTop + item.height;

    return itemLeft < box.right && itemRight > box.left && itemTop < box.bottom && itemBottom > box.top;
}

export interface IDistributeUpdate {
    id: string;
    updates: Partial<Pick<ICanvasItem, 'x' | 'y'>>;
}

/**
 * Distributes 3+ canvas items equally along horizontal or vertical axis.
 */
export function calculateDistribution(
    items: Array<Pick<ICanvasItem, 'id' | 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number }>,
    axis: 'horizontal' | 'vertical'
): IDistributeUpdate[] {
    if (items.length < 3) return [];

    const normalized = items.map(item => {
        const rawPX = item.pivotX ?? 50;
        const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
        const rawPY = item.pivotY ?? 50;
        const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;

        const left = item.x - item.width * (pX / 100);
        const top = item.y - item.height * (pY / 100);

        return {
            id: item.id,
            item,
            pX,
            pY,
            left,
            right: left + item.width,
            top,
            bottom: top + item.height,
        };
    });

    if (axis === 'horizontal') {
        normalized.sort((a, b) => a.left - b.left);
        const first = normalized[0];
        const last = normalized[normalized.length - 1];

        const totalSpan = last.right - first.left;
        const totalItemsWidth = normalized.reduce((acc, curr) => acc + curr.item.width, 0);
        const availableGap = totalSpan - totalItemsWidth;
        const gap = availableGap / (normalized.length - 1);

        const results: IDistributeUpdate[] = [];
        let currentPos = first.right + gap;

        for (let i = 1; i < normalized.length - 1; i++) {
            const curr = normalized[i];
            const newLeft = currentPos;
            const newX = Math.round((newLeft + curr.item.width * (curr.pX / 100)) * 100) / 100;
            results.push({ id: curr.id, updates: { x: newX } });
            currentPos += curr.item.width + gap;
        }
        return results;
    } else {
        normalized.sort((a, b) => a.top - b.top);
        const first = normalized[0];
        const last = normalized[normalized.length - 1];

        const totalSpan = last.bottom - first.top;
        const totalItemsHeight = normalized.reduce((acc, curr) => acc + curr.item.height, 0);
        const availableGap = totalSpan - totalItemsHeight;
        const gap = availableGap / (normalized.length - 1);

        const results: IDistributeUpdate[] = [];
        let currentPos = first.bottom + gap;

        for (let i = 1; i < normalized.length - 1; i++) {
            const curr = normalized[i];
            const newTop = currentPos;
            const newY = Math.round((newTop + curr.item.height * (curr.pY / 100)) * 100) / 100;
            results.push({ id: curr.id, updates: { y: newY } });
            currentPos += curr.item.height + gap;
        }
        return results;
    }
}

export type CanvasAlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom';

/**
 * Aligns 2+ canvas items along a specified axis.
 */
export function calculateAlignment(
    items: Array<Pick<ICanvasItem, 'id' | 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number }>,
    mode: CanvasAlignMode,
    relativeToCanvas: boolean = false
): IDistributeUpdate[] {
    if (items.length === 0) return [];
    if (!relativeToCanvas && items.length < 2) return [];

    const normalized = items.map(item => {
        const rawPX = item.pivotX ?? 50;
        const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
        const rawPY = item.pivotY ?? 50;
        const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;

        const left = item.x - item.width * (pX / 100);
        const top = item.y - item.height * (pY / 100);

        return {
            id: item.id,
            item,
            pX,
            pY,
            left,
            right: left + item.width,
            top,
            bottom: top + item.height,
        };
    });

    const minLeft = Math.min(...normalized.map(n => n.left));
    const maxRight = Math.max(...normalized.map(n => n.right));
    const centerH = (minLeft + maxRight) / 2;

    const minTop = Math.min(...normalized.map(n => n.top));
    const maxBottom = Math.max(...normalized.map(n => n.bottom));
    const middleV = (minTop + maxBottom) / 2;

    if (relativeToCanvas) {
        // Aligns the entire group or single item as a whole relative to 100% canvas boundaries (0, 50, 100)
        let deltaX = 0;
        let deltaY = 0;
        let isX = false;

        if (mode === 'left') {
            deltaX = 0 - minLeft;
            isX = true;
        } else if (mode === 'center-h') {
            deltaX = 50 - centerH;
            isX = true;
        } else if (mode === 'right') {
            deltaX = 100 - maxRight;
            isX = true;
        } else if (mode === 'top') {
            deltaY = 0 - minTop;
            isX = false;
        } else if (mode === 'middle-v') {
            deltaY = 50 - middleV;
            isX = false;
        } else if (mode === 'bottom') {
            deltaY = 100 - maxBottom;
            isX = false;
        }

        return normalized.map(n => {
            if (isX) {
                return { id: n.id, updates: { x: Math.round((n.item.x + deltaX) * 10) / 10 } };
            } else {
                return { id: n.id, updates: { y: Math.round((n.item.y + deltaY) * 10) / 10 } };
            }
        });
    }

    return normalized.map(n => {
        if (mode === 'left') {
            const newX = Math.round((minLeft + n.item.width * (n.pX / 100)) * 10) / 10;
            return { id: n.id, updates: { x: newX } };
        } else if (mode === 'center-h') {
            const newLeft = centerH - n.item.width / 2;
            const newX = Math.round((newLeft + n.item.width * (n.pX / 100)) * 10) / 10;
            return { id: n.id, updates: { x: newX } };
        } else if (mode === 'right') {
            const newLeft = maxRight - n.item.width;
            const newX = Math.round((newLeft + n.item.width * (n.pX / 100)) * 10) / 10;
            return { id: n.id, updates: { x: newX } };
        } else if (mode === 'top') {
            const newY = Math.round((minTop + n.item.height * (n.pY / 100)) * 10) / 10;
            return { id: n.id, updates: { y: newY } };
        } else if (mode === 'middle-v') {
            const newTop = middleV - n.item.height / 2;
            const newY = Math.round((newTop + n.item.height * (n.pY / 100)) * 10) / 10;
            return { id: n.id, updates: { y: newY } };
        } else {
            // 'bottom'
            const newTop = maxBottom - n.item.height;
            const newY = Math.round((newTop + n.item.height * (n.pY / 100)) * 10) / 10;
            return { id: n.id, updates: { y: newY } };
        }
    });
}

/**
 * Calculates horizontal or vertical reflection updates for canvas items.
 * If 1 item: mirrors rotation in place.
 * If 2+ items: mirrors both rotation and position across the group's central axis.
 */
export function flipCanvasItems(
    items: Array<Pick<ICanvasItem, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'> & { pivotX?: number; pivotY?: number }>,
    axis: 'horizontal' | 'vertical'
): Array<{ id: string; updates: Partial<Pick<ICanvasItem, 'x' | 'y' | 'rotation'>> }> {
    if (items.length === 0) return [];

    if (items.length === 1) {
        const item = items[0];
        const newRot = axis === 'horizontal'
            ? (-item.rotation + 360) % 360
            : (180 - item.rotation + 360) % 360;
        return [{ id: item.id, updates: { rotation: newRot } }];
    }

    const bounds = items.map(getItemBounds);

    if (axis === 'horizontal') {
        const minLeft = Math.min(...bounds.map(b => b.left));
        const maxRight = Math.max(...bounds.map(b => b.right));
        const groupCenterX = (minLeft + maxRight) / 2;

        return items.map(item => {
            const rawPX = item.pivotX ?? 50;
            const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
            const left = item.x - item.width * (pX / 100);
            const itemCenterX = left + item.width / 2;

            const newItemCenterX = 2 * groupCenterX - itemCenterX;
            const newLeft = newItemCenterX - item.width / 2;
            const newX = Math.round((newLeft + item.width * (pX / 100)) * 10) / 10;
            const newRot = (-item.rotation + 360) % 360;

            return {
                id: item.id,
                updates: { x: newX, rotation: newRot },
            };
        });
    } else {
        const minTop = Math.min(...bounds.map(b => b.top));
        const maxBottom = Math.max(...bounds.map(b => b.bottom));
        const groupCenterY = (minTop + maxBottom) / 2;

        return items.map(item => {
            const rawPY = item.pivotY ?? 50;
            const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;
            const top = item.y - item.height * (pY / 100);
            const itemCenterY = top + item.height / 2;

            const newItemCenterY = 2 * groupCenterY - itemCenterY;
            const newTop = newItemCenterY - item.height / 2;
            const newY = Math.round((newTop + item.height * (pY / 100)) * 10) / 10;
            const newRot = (180 - item.rotation + 360) % 360;

            return {
                id: item.id,
                updates: { y: newY, rotation: newRot },
            };
        });
    }
}

