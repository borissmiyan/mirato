import { ICanvasItem } from '@/core/types';

export interface IItemBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

export interface IDistanceLine {
    id: string;
    x1: number; // 0-100%
    y1: number; // 0-100%
    x2: number; // 0-100%
    y2: number; // 0-100%
    distancePx: number;
    badgeX: number; // 0-100%
    badgeY: number; // 0-100%
    orientation: 'horizontal' | 'vertical';
}

/**
 * Calculates visual bounding box in percentages (0-100)
 */
export function getItemBounds(item: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { pivotX?: number; pivotY?: number }): IItemBounds {
    const rawPX = item.pivotX ?? 50;
    const pX = rawPX > 0 && rawPX <= 1 ? rawPX * 100 : rawPX;
    const rawPY = item.pivotY ?? 50;
    const pY = rawPY > 0 && rawPY <= 1 ? rawPY * 100 : rawPY;

    const left = item.x - item.width * (pX / 100);
    const top = item.y - item.height * (pY / 100);
    const right = left + item.width;
    const bottom = top + item.height;

    return {
        left,
        right,
        top,
        bottom,
        centerX: left + item.width / 2,
        centerY: top + item.height / 2,
        width: item.width,
        height: item.height,
    };
}

/**
 * Resolves ground-truth visual bounding box of a canvas item.
 * When running in the browser and DOM nodes exist, measures actual rendered getBoundingClientRect()
 * against the slide container, guaranteeing 100% pixel-perfect accuracy for rotated, scaled,
 * auto-sized text, and custom pivot items with 0px gap.
 * Falls back to pure mathematical getItemBounds when DOM is unavailable (e.g. in hermetic tests).
 */
export function getItemDOMBounds(
    item: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { id?: string; pivotX?: number; pivotY?: number; type?: string },
    containerEl?: HTMLElement | null
): IItemBounds {
    if (typeof document !== 'undefined' && item.id) {
        const itemEl = document.getElementById(`visual-${item.id}`) || document.getElementById(`item-${item.id}`);
        const cEl = containerEl || document.getElementById('slide-canvas-container');
        if (itemEl && cEl) {
            let measureEl: Element = itemEl;
            // For stroke elements, measure the actual rendered SVG line if available
            // to avoid container height inflation from manual drag resizing
            if (item.type === 'stroke') {
                const svgLine = itemEl.querySelector('svg line');
                if (svgLine) {
                    const lRect = svgLine.getBoundingClientRect();
                    if (lRect.width > 0 || lRect.height > 0) {
                        measureEl = svgLine;
                    }
                }
            }
            const iRect = measureEl.getBoundingClientRect();
            const cRect = cEl.getBoundingClientRect();
            if (cRect.width > 0 && cRect.height > 0) {
                const left = ((iRect.left - cRect.left) / cRect.width) * 100;
                const right = ((iRect.right - cRect.left) / cRect.width) * 100;
                const top = ((iRect.top - cRect.top) / cRect.height) * 100;
                const bottom = ((iRect.bottom - cRect.top) / cRect.height) * 100;
                return {
                    left,
                    right,
                    top,
                    bottom,
                    centerX: (left + right) / 2,
                    centerY: (top + bottom) / 2,
                    width: right - left,
                    height: bottom - top,
                };
            }
        }
    }
    return getItemBounds(item);
}

/**
 * Creates a synthetic composite item representing the unified bounding box of multiple canvas items.
 * If only a single item is passed, returns that item directly.
 * Ensures scale/rotation-accurate bounds via getItemDOMBounds when rendered in the DOM.
 */
export function getCompositeGroupItem(
    items: ICanvasItem[],
    containerEl?: HTMLElement | null
): ICanvasItem {
    if (items.length === 1 && items[0]) {
        return items[0];
    }

    const boundsList = items.map(it => getItemDOMBounds(it, containerEl));
    const minLeft = boundsList.length > 0 ? Math.min(...boundsList.map(b => b.left)) : 0;
    const maxRight = boundsList.length > 0 ? Math.max(...boundsList.map(b => b.right)) : 0;
    const minTop = boundsList.length > 0 ? Math.min(...boundsList.map(b => b.top)) : 0;
    const maxBottom = boundsList.length > 0 ? Math.max(...boundsList.map(b => b.bottom)) : 0;

    const width = Math.max(0.1, maxRight - minLeft);
    const height = Math.max(0.1, maxBottom - minTop);

    return {
        id: '__group_selection__',
        x: minLeft,
        y: minTop,
        width,
        height,
        pivotX: 0,
        pivotY: 0,
        rotation: 0,
        scale: 1,
        type: 'shape',
        zIndex: 1000,
        fills: [],
        strokes: [],
        locked: false,
        visible: true,
    };
}

/**
 * Calculates distance lines from a single selected item or composite group directly to the slide boundaries (edges).
 * Lines project strictly from the 4 side centers (top, bottom, left, right), ensuring lines remain centered, touch bounding box edges,
 * and cleanly reach slide edges (0% and 100%) without colliding with intermediate items on the way to the canvas edges.
 * Logical resolution: 1920x1080.
 */
export function calculateCanvasEdgeDistances(
    item: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { id?: string; pivotX?: number; pivotY?: number },
    _otherItems: Array<Pick<ICanvasItem, 'id' | 'x' | 'y' | 'width' | 'height' | 'visible'> & { pivotX?: number; pivotY?: number }> = [],
    containerEl?: HTMLElement | null
): IDistanceLine[] {
    const b = getItemDOMBounds(item, containerEl);
    const lines: IDistanceLine[] = [];

    // 1. Top canvas edge: cast vertical line straight up from (b.centerX, b.top) to 0%
    if (b.top > 0.05) {
        const distPct = b.top;
        const distPx = Math.round(distPct * 10.8);
        lines.push({
            id: 'edge-top',
            x1: b.centerX,
            y1: 0,
            x2: b.centerX,
            y2: b.top,
            distancePx: distPx,
            badgeX: b.centerX,
            badgeY: distPct / 2,
            orientation: 'vertical',
        });
    }

    // 2. Bottom canvas edge: cast vertical line straight down from (b.centerX, b.bottom) to 100%
    if (100 - b.bottom > 0.05) {
        const distPct = 100 - b.bottom;
        const distPx = Math.round(distPct * 10.8);
        lines.push({
            id: 'edge-bottom',
            x1: b.centerX,
            y1: b.bottom,
            x2: b.centerX,
            y2: 100,
            distancePx: distPx,
            badgeX: b.centerX,
            badgeY: b.bottom + distPct / 2,
            orientation: 'vertical',
        });
    }

    // 3. Left canvas edge: cast horizontal line straight left from (b.left, b.centerY) to 0%
    if (b.left > 0.05) {
        const distPct = b.left;
        const distPx = Math.round(distPct * 19.2);
        lines.push({
            id: 'edge-left',
            x1: 0,
            y1: b.centerY,
            x2: b.left,
            y2: b.centerY,
            distancePx: distPx,
            badgeX: distPct / 2,
            badgeY: b.centerY,
            orientation: 'horizontal',
        });
    }

    // 4. Right canvas edge: cast horizontal line straight right from (b.right, b.centerY) to 100%
    if (100 - b.right > 0.05) {
        const distPct = 100 - b.right;
        const distPx = Math.round(distPct * 19.2);
        lines.push({
            id: 'edge-right',
            x1: b.right,
            y1: b.centerY,
            x2: 100,
            y2: b.centerY,
            distancePx: distPx,
            badgeX: b.right + distPct / 2,
            badgeY: b.centerY,
            orientation: 'horizontal',
        });
    }

    return lines;
}

/**
 * Calculates distance lines between two items (selected and target hovered item).
 */
export function calculateItemToItemDistances(
    selectedItem: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { id?: string; pivotX?: number; pivotY?: number },
    targetItem: Pick<ICanvasItem, 'x' | 'y' | 'width' | 'height'> & { id?: string; pivotX?: number; pivotY?: number },
    containerEl?: HTMLElement | null
): IDistanceLine[] {
    const a = getItemDOMBounds(selectedItem, containerEl);
    const b = getItemDOMBounds(targetItem, containerEl);
    const lines: IDistanceLine[] = [];

    // Check Horizontal relationship
    const isALeftOfB = a.right < b.left;
    const isARightOfB = b.right < a.left;

    // Check Vertical relationship
    const isAAboveB = a.bottom < b.top;
    const isABelowB = b.bottom < a.top;

    // Overlaps
    const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));

    // Common Y anchor for horizontal gap measurement
    let horizAnchorY = a.centerY;
    if (overlapY > 0) {
        const startY = Math.max(a.top, b.top);
        horizAnchorY = startY + overlapY / 2;
    }

    // Common X anchor for vertical gap measurement
    let vertAnchorX = a.centerX;
    if (overlapX > 0) {
        const startX = Math.max(a.left, b.left);
        vertAnchorX = startX + overlapX / 2;
    }

    // 1. Horizontal Gap
    if (isALeftOfB) {
        const distPct = b.left - a.right;
        const distPx = Math.round(distPct * 19.2);
        lines.push({
            id: 'gap-h',
            x1: a.right,
            y1: horizAnchorY,
            x2: b.left,
            y2: horizAnchorY,
            distancePx: distPx,
            badgeX: a.right + distPct / 2,
            badgeY: horizAnchorY,
            orientation: 'horizontal',
        });
    } else if (isARightOfB) {
        const distPct = a.left - b.right;
        const distPx = Math.round(distPct * 19.2);
        lines.push({
            id: 'gap-h',
            x1: b.right,
            y1: horizAnchorY,
            x2: a.left,
            y2: horizAnchorY,
            distancePx: distPx,
            badgeX: b.right + distPct / 2,
            badgeY: horizAnchorY,
            orientation: 'horizontal',
        });
    }

    // 2. Vertical Gap
    if (isAAboveB) {
        const distPct = b.top - a.bottom;
        const distPx = Math.round(distPct * 10.8);
        lines.push({
            id: 'gap-v',
            x1: vertAnchorX,
            y1: a.bottom,
            x2: vertAnchorX,
            y2: b.top,
            distancePx: distPx,
            badgeX: vertAnchorX,
            badgeY: a.bottom + distPct / 2,
            orientation: 'vertical',
        });
    } else if (isABelowB) {
        const distPct = a.top - b.bottom;
        const distPx = Math.round(distPct * 10.8);
        lines.push({
            id: 'gap-v',
            x1: vertAnchorX,
            y1: b.bottom,
            x2: vertAnchorX,
            y2: a.top,
            distancePx: distPx,
            badgeX: vertAnchorX,
            badgeY: b.bottom + distPct / 2,
            orientation: 'vertical',
        });
    }

    // 3. Nested / Overlapping Items (Figma-grade inner edge offsets)
    if (!isALeftOfB && !isARightOfB && !isAAboveB && !isABelowB) {
        if (Math.abs(a.top - b.top) > 0.05) {
            const distPct = Math.abs(a.top - b.top);
            const distPx = Math.round(distPct * 10.8);
            const minY = Math.min(a.top, b.top);
            const maxY = Math.max(a.top, b.top);
            const anchorX = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
            lines.push({
                id: 'nested-top',
                x1: anchorX,
                y1: minY,
                x2: anchorX,
                y2: maxY,
                distancePx: distPx,
                badgeX: anchorX,
                badgeY: minY + distPct / 2,
                orientation: 'vertical',
            });
        }
        if (Math.abs(a.left - b.left) > 0.05) {
            const distPct = Math.abs(a.left - b.left);
            const distPx = Math.round(distPct * 19.2);
            const minX = Math.min(a.left, b.left);
            const maxX = Math.max(a.left, b.left);
            const anchorY = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
            lines.push({
                id: 'nested-left',
                x1: minX,
                y1: anchorY,
                x2: maxX,
                y2: anchorY,
                distancePx: distPx,
                badgeX: minX + distPct / 2,
                badgeY: anchorY,
                orientation: 'horizontal',
            });
        }
    }

    return lines;
}

