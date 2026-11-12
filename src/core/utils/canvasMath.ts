import { ICanvasItem, ICustomGuide, IVectorNode } from '@/core/types';

export interface DraggedItemState {
    id: string;
    startItemX: number;
    startItemY: number;
    startItemW: number;
    startItemH: number;
    startRotation: number;
    startPivotX: number;
    startPivotY: number;
}

export interface DragState {
    type: 'move' | 'resize' | 'rotate' | 'pivot';
    itemId: string;
    startX: number;
    startY: number;
    startItemX: number;
    startItemY: number;
    startItemW: number;
    startItemH: number;
    startRotation: number;
    startPivotX: number;
    startPivotY: number;
    corner?: string;
    hasMoved?: boolean;
    draggedItems?: DraggedItemState[];
    initialPathNodes?: IVectorNode[];
    isAltDrag?: boolean;
    originalTargetIds?: string[];
}

export function calculateMove(
    state: DragState,
    deltaXPct: number,
    deltaYPct: number
): Partial<ICanvasItem> {
    return {
        x: state.startItemX + deltaXPct,
        y: state.startItemY + deltaYPct
    };
}

export function calculateResize(
    state: DragState,
    deltaXPx: number,
    deltaYPx: number,
    containerW: number,
    containerH: number,
    item: ICanvasItem,
    shiftKey?: boolean,
    altKey?: boolean
): Partial<ICanvasItem> | null {
    if (!state.corner || !containerW || !containerH) return null;

    const angleRad = (state.startRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate screen deltas back to item's local coordinate space for resizing
    const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
    const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

    const localDeltaXPct = (localDeltaXPx / containerW) * 100;
    const localDeltaYPct = (localDeltaYPx / containerH) * 100;

    const corner = state.corner;
    const lockRatio = item.lockAspectRatio || !!shiftKey;
    const startRatio = state.startItemW / state.startItemH;

    let width = state.startItemW;
    let height = state.startItemH;

    // Handle changes based on local deltas
    if (corner.includes('right')) width = Math.max(1, state.startItemW + localDeltaXPct);
    if (corner.includes('left')) width = Math.max(1, state.startItemW - localDeltaXPct);
    if (corner.includes('bottom')) height = Math.max(1, state.startItemH + localDeltaYPct);
    if (corner.includes('top')) height = Math.max(1, state.startItemH - localDeltaYPct);

    // Apply Aspect Ratio Lock (Shift or item toggle)
    if (lockRatio) {
        if (corner === 'middle-left' || corner === 'middle-right') {
            height = width / startRatio;
        } else if (corner === 'top-center' || corner === 'bottom-center') {
            width = height * startRatio;
        } else {
            const dw = Math.abs(width - state.startItemW);
            const dh = Math.abs(height - state.startItemH);
            if (dw > dh) {
                height = width / startRatio;
            } else {
                width = height * startRatio;
            }
        }
    }

    const dw = width - state.startItemW;
    const dh = height - state.startItemH;

    let newX = state.startItemX;
    let newY = state.startItemY;

    // Figma Anchor-based Resize: unless Alt is held, the opposite edge/corner is anchored in world space!
    if (!altKey) {
        let localShiftX = 0;
        let localShiftY = 0;

        if (corner.includes('right')) localShiftX = dw / 2;
        else if (corner.includes('left')) localShiftX = -dw / 2;

        if (corner.includes('bottom')) localShiftY = dh / 2;
        else if (corner.includes('top')) localShiftY = -dh / 2;

        // Transform local center shift into world space
        const worldShiftX = localShiftX * cos - localShiftY * sin;
        const worldShiftY = localShiftX * sin + localShiftY * cos;

        newX = state.startItemX + worldShiftX;
        newY = state.startItemY + worldShiftY;
    }

    // Auto-switch text resizing mode based on which dimension is being constrained
    const updates: Partial<ICanvasItem> = {
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
    };

    if (item.type === 'text' && item.text) {
        const mode = item.text.resizingMode;
        const changesWidth = corner.includes('left') || corner.includes('right');
        const changesHeight = corner.includes('top') || corner.includes('bottom');

        if (changesHeight && (mode === 'auto-width' || mode === 'auto-height')) {
            updates.text = { ...item.text, resizingMode: 'fixed' };
        } else if (changesWidth && mode === 'auto-width') {
            updates.text = { ...item.text, resizingMode: 'auto-height' };
        }
    }

    return updates;
}

export function calculateRotation(
    state: DragState,
    clientX: number,
    clientY: number,
    centerX: number,
    centerY: number,
    shiftKey?: boolean
): Partial<ICanvasItem> {
    const currentAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    const startAngle = Math.atan2(state.startY - centerY, state.startX - centerX) * (180 / Math.PI);

    let deltaRotation = currentAngle - startAngle;
    let targetRotation = state.startRotation + deltaRotation;

    if (shiftKey) {
        // Snap to nearest 15 degrees (Figma standard)
        targetRotation = Math.round(targetRotation / 15) * 15;
    }

    // Normalize between -180 and 180
    targetRotation = ((targetRotation % 360) + 360) % 360;
    if (targetRotation > 180) targetRotation -= 360;

    return { rotation: Math.round(targetRotation * 10) / 10 };
}

export function calculatePivot(
    state: DragState,
    deltaXPx: number,
    deltaYPx: number,
    containerW: number,
    containerH: number
): Partial<ICanvasItem> | null {
    if (!containerW || !containerH) return null;

    // Angle in radians for rotation calculations
    const angleRad = (state.startRotation * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate screen deltas back to item's local coordinate space
    const localDeltaXPx = deltaXPx * cos + deltaYPx * sin;
    const localDeltaYPx = -deltaXPx * sin + deltaYPx * cos;

    // Items unrotated design width/height in pixels
    const itemPxW = (state.startItemW / 100) * containerW;
    const itemPxH = (state.startItemH / 100) * containerH;

    if (itemPxW > 0 && itemPxH > 0) {
        const deltaPX = (localDeltaXPx / itemPxW) * 100;
        const deltaPY = (localDeltaYPx / itemPxH) * 100;

        const newPivotX = state.startPivotX + deltaPX;
        const newPivotY = state.startPivotY + deltaPY;

        // New world position of pivot is simply the mouse position
        const deltaXWorldPct = (deltaXPx / containerW) * 100;
        const deltaYWorldPct = (deltaYPx / containerH) * 100;

        return {
            pivotX: Math.round(newPivotX * 10) / 10,
            pivotY: Math.round(newPivotY * 10) / 10,
            x: state.startItemX + deltaXWorldPct,
            y: state.startItemY + deltaYWorldPct
        };
    }
    return null;
}

export const getCursorForCorner = (pos: string, rotation: number): string => {
    const angles: Record<string, number> = {
        'top-center': 0,
        'top-right': 45,
        'middle-right': 90,
        'bottom-right': 135,
        'bottom-center': 180,
        'bottom-left': 225,
        'middle-left': 270,
        'top-left': 315,
    };

    const baseAngle = angles[pos] || 0;
    const totalAngle = ((baseAngle + rotation) % 360 + 360) % 360;
    const normalized = Math.round(totalAngle / 45) * 45 % 180;

    switch (normalized) {
        case 0: return 'ns-resize';
        case 45: return 'nesw-resize';
        case 90: return 'ew-resize';
        case 135: return 'nwse-resize';
        default: return 'ns-resize';
    }
};

export const getRotateAngle = (pos: string, rotation: number): number => {
    const cornerAngles: Record<string, number> = {
        'top-left': 0,
        'top-right': 90,
        'bottom-right': 180,
        'bottom-left': 270,
    };
    return (cornerAngles[pos] ?? 0) + rotation;
};

export interface ISnapGuide {
    id: string;
    orientation: 'vertical' | 'horizontal';
    positionPct: number;
    type: 'slide-center' | 'safe-margin' | 'slide-edge' | 'item-edge' | 'item-center' | 'custom-guide';
}

export interface ISnapResult {
    snappedX: number;
    snappedY: number;
    guides: ISnapGuide[];
}

/**
 * Calculates matrix magnetic snapping for all points of an element
 * (left, center, right / top, center, bottom) against slide center (50%),
 * boundaries (0%, 100%), safe margins (5%, 95%), all edges/centers of other items,
 * and user-defined custom guides.
 */
export function calculateSmartSnap(
    x: number,
    y: number,
    width: number,
    height: number,
    otherItems: Array<Pick<ICanvasItem, 'id' | 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number }>,
    thresholdPct: number = 1.2,
    pivotX?: number,
    pivotY?: number,
    customGuides?: ICustomGuide[],
    gridSnapPct?: number
): ISnapResult {
    let snappedX = x;
    let snappedY = y;
    const guides: ISnapGuide[] = [];

    // Pivot percentages: if not specified, default to 0 for backwards compatibility with top-left tests.
    // In canvas runtime, pivotX/pivotY are passed as 50 (or the item's configured pivot).
    const rawPX = pivotX ?? 0;
    const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
    const rawPY = pivotY ?? 0;
    const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;

    // Visual bounds of the dragged item
    const itemLeft = x - width * (pX / 100);
    const itemCenter = itemLeft + width / 2;
    const itemRight = itemLeft + width;

    const itemTop = y - height * (pY / 100);
    const itemMiddle = itemTop + height / 2;
    const itemBottom = itemTop + height;

    // --- 1. Vertical Target Lines (X axis) ---
    interface XTarget {
        target: number;
        type: ISnapGuide['type'];
    }

    const xTargets: XTarget[] = [
        { target: 50, type: 'slide-center' },
        { target: 5, type: 'safe-margin' },
        { target: 95, type: 'safe-margin' },
        { target: 0, type: 'slide-edge' },
        { target: 100, type: 'slide-edge' },
    ];

    if (customGuides) {
        for (const g of customGuides) {
            if (g.orientation === 'vertical') {
                xTargets.push({ target: g.positionPct, type: 'custom-guide' });
            }
        }
    }

    for (const other of otherItems) {
        const rawOPX = other.pivotX !== undefined ? other.pivotX : (pivotX !== undefined ? 50 : 0);
        const oPivotX = rawOPX > 0 && rawOPX <= 1 ? rawOPX * 100 : rawOPX;
        const oLeft = other.x - other.width * (oPivotX / 100);
        const oCenter = oLeft + other.width / 2;
        const oRight = oLeft + other.width;

        xTargets.push({ target: oLeft, type: 'item-edge' });
        xTargets.push({ target: oCenter, type: 'item-center' });
        xTargets.push({ target: oRight, type: 'item-edge' });
    }

    let minDiffX = thresholdPct + 0.0001;
    let bestXSnap: { snappedX: number; guide: ISnapGuide } | null = null;

    for (const t of xTargets) {
        // Test Candidate Point 1: Left Edge
        const diffLeft = Math.abs(itemLeft - t.target);
        if (diffLeft <= thresholdPct && diffLeft < minDiffX) {
            minDiffX = diffLeft;
            bestXSnap = {
                snappedX: Math.round((t.target + width * (pX / 100)) * 100) / 100,
                guide: { id: `guide-v-${t.target}`, orientation: 'vertical', positionPct: t.target, type: t.type }
            };
        }

        // Test Candidate Point 2: Center
        const diffCenter = Math.abs(itemCenter - t.target);
        if (diffCenter <= thresholdPct && diffCenter < minDiffX) {
            minDiffX = diffCenter;
            bestXSnap = {
                snappedX: Math.round((t.target + width * (pX / 100 - 0.5)) * 100) / 100,
                guide: { id: `guide-v-${t.target}`, orientation: 'vertical', positionPct: t.target, type: t.type }
            };
        }

        // Test Candidate Point 3: Right Edge
        const diffRight = Math.abs(itemRight - t.target);
        if (diffRight <= thresholdPct && diffRight < minDiffX) {
            minDiffX = diffRight;
            bestXSnap = {
                snappedX: Math.round((t.target - width * (1 - pX / 100)) * 100) / 100,
                guide: { id: `guide-v-${t.target}`, orientation: 'vertical', positionPct: t.target, type: t.type }
            };
        }
    }

    if (bestXSnap) {
        snappedX = bestXSnap.snappedX;
        guides.push(bestXSnap.guide);
    } else if (gridSnapPct && gridSnapPct > 0) {
        const nearestGridX = Math.round(itemLeft / gridSnapPct) * gridSnapPct;
        if (Math.abs(itemLeft - nearestGridX) <= thresholdPct) {
            snappedX = Math.round((nearestGridX + width * (pX / 100)) * 100) / 100;
        }
    }

    // --- 2. Horizontal Target Lines (Y axis) ---
    interface YTarget {
        target: number;
        type: ISnapGuide['type'];
    }

    const yTargets: YTarget[] = [
        { target: 50, type: 'slide-center' },
        { target: 5, type: 'safe-margin' },
        { target: 95, type: 'safe-margin' },
        { target: 0, type: 'slide-edge' },
        { target: 100, type: 'slide-edge' },
    ];

    if (customGuides) {
        for (const g of customGuides) {
            if (g.orientation === 'horizontal') {
                yTargets.push({ target: g.positionPct, type: 'custom-guide' });
            }
        }
    }

    for (const other of otherItems) {
        const rawOPY = other.pivotY !== undefined ? other.pivotY : (pivotY !== undefined ? 50 : 0);
        const oPivotY = rawOPY > 0 && rawOPY <= 1 ? rawOPY * 100 : rawOPY;
        const oTop = other.y - other.height * (oPivotY / 100);
        const oCenterY = oTop + other.height / 2;
        const oBottom = oTop + other.height;

        yTargets.push({ target: oTop, type: 'item-edge' });
        yTargets.push({ target: oCenterY, type: 'item-center' });
        yTargets.push({ target: oBottom, type: 'item-edge' });
    }

    let minDiffY = thresholdPct + 0.0001;
    let bestYSnap: { snappedY: number; guide: ISnapGuide } | null = null;

    for (const t of yTargets) {
        // Test Candidate Point 1: Top Edge
        const diffTop = Math.abs(itemTop - t.target);
        if (diffTop <= thresholdPct && diffTop < minDiffY) {
            minDiffY = diffTop;
            bestYSnap = {
                snappedY: Math.round((t.target + height * (pY / 100)) * 100) / 100,
                guide: { id: `guide-h-${t.target}`, orientation: 'horizontal', positionPct: t.target, type: t.type }
            };
        }

        // Test Candidate Point 2: Center
        const diffCenter = Math.abs(itemMiddle - t.target);
        if (diffCenter <= thresholdPct && diffCenter < minDiffY) {
            minDiffY = diffCenter;
            bestYSnap = {
                snappedY: Math.round((t.target + height * (pY / 100 - 0.5)) * 100) / 100,
                guide: { id: `guide-h-${t.target}`, orientation: 'horizontal', positionPct: t.target, type: t.type }
            };
        }

        // Test Candidate Point 3: Bottom Edge
        const diffBottom = Math.abs(itemBottom - t.target);
        if (diffBottom <= thresholdPct && diffBottom < minDiffY) {
            minDiffY = diffBottom;
            bestYSnap = {
                snappedY: Math.round((t.target - height * (1 - pY / 100)) * 100) / 100,
                guide: { id: `guide-h-${t.target}`, orientation: 'horizontal', positionPct: t.target, type: t.type }
            };
        }
    }

    if (bestYSnap) {
        snappedY = bestYSnap.snappedY;
        guides.push(bestYSnap.guide);
    } else if (gridSnapPct && gridSnapPct > 0) {
        const nearestGridY = Math.round(itemTop / gridSnapPct) * gridSnapPct;
        if (Math.abs(itemTop - nearestGridY) <= thresholdPct) {
            snappedY = Math.round((nearestGridY + height * (pY / 100)) * 100) / 100;
        }
    }

    return {
        snappedX,
        snappedY,
        guides,
    };
}
