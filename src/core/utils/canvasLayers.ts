import { ICanvasItem, ICanvasStyleSnapshot } from '@/core/types';
import { shapeItemToVectorNodes } from '@/features/presenter/components/slide-editor/renderers/vectorGeometry';

/**
 * Bakes/flattens a parametric shape or item into an editable freeform vector path (Figma Flatten / Cmd+E).
 */
export function flattenShapeToPath(item: ICanvasItem): Partial<ICanvasItem> {
    const { nodes, isClosed } = shapeItemToVectorNodes(item);
    return {
        type: 'path',
        path: {
            nodes,
            isClosed,
            fillRule: 'nonzero',
        },
        shape: undefined,
    };
}

/**
 * Extracts visual styling from an item (Figma Copy Style).
 */
export function extractCanvasStyle(item: ICanvasItem): ICanvasStyleSnapshot {
    return {
        fills: item.fills ? structuredClone(item.fills) : undefined,
        strokes: item.strokes ? structuredClone(item.strokes) : undefined,
        borderColor: item.borderColor,
        borderWidth: item.borderWidth,
        strokeAlign: item.strokeAlign,
        strokeJoin: item.strokeJoin,
        strokeLinecap: item.strokeLinecap,
        strokeDashArray: item.strokeDashArray,
        opacity: item.opacity,
        borderRadius: item.borderRadius,
        borderRadiusTL: item.borderRadiusTL,
        borderRadiusTR: item.borderRadiusTR,
        borderRadiusBL: item.borderRadiusBL,
        borderRadiusBR: item.borderRadiusBR,
        lockBorderRadius: item.lockBorderRadius,
        backdropBlur: item.backdropBlur,
        dropShadow: item.dropShadow ? { ...item.dropShadow } : undefined,
        effects: item.effects ? structuredClone(item.effects) : undefined,
        text: item.text ? structuredClone(item.text) : undefined,
        shape: item.shape ? structuredClone(item.shape) : undefined,
    };
}

/**
 * Applies visual styling snapshot onto an item (Figma Paste Style).
 */
export function applyCanvasStyle(targetItem: ICanvasItem, style: ICanvasStyleSnapshot): ICanvasItem {
    const updated: ICanvasItem = { ...targetItem };

    if (style.fills !== undefined) updated.fills = structuredClone(style.fills);
    if (style.strokes !== undefined) updated.strokes = structuredClone(style.strokes);
    if (style.borderColor !== undefined) updated.borderColor = style.borderColor;
    if (style.borderWidth !== undefined) updated.borderWidth = style.borderWidth;
    if (style.strokeAlign !== undefined) updated.strokeAlign = style.strokeAlign;
    if (style.strokeJoin !== undefined) updated.strokeJoin = style.strokeJoin;
    if (style.strokeLinecap !== undefined) updated.strokeLinecap = style.strokeLinecap;
    if (style.strokeDashArray !== undefined) updated.strokeDashArray = style.strokeDashArray;
    if (style.opacity !== undefined) updated.opacity = style.opacity;
    if (style.borderRadius !== undefined) updated.borderRadius = style.borderRadius;
    if (style.borderRadiusTL !== undefined) updated.borderRadiusTL = style.borderRadiusTL;
    if (style.borderRadiusTR !== undefined) updated.borderRadiusTR = style.borderRadiusTR;
    if (style.borderRadiusBL !== undefined) updated.borderRadiusBL = style.borderRadiusBL;
    if (style.borderRadiusBR !== undefined) updated.borderRadiusBR = style.borderRadiusBR;
    if (style.lockBorderRadius !== undefined) updated.lockBorderRadius = style.lockBorderRadius;
    if (style.backdropBlur !== undefined) updated.backdropBlur = style.backdropBlur;
    if (style.dropShadow !== undefined) updated.dropShadow = { ...style.dropShadow };
    if (style.effects !== undefined) updated.effects = structuredClone(style.effects);

    // If both are text or target is text, transfer typography while keeping content
    if (targetItem.type === 'text' && style.text) {
        updated.text = {
            ...style.text,
            content: targetItem.text?.content ?? style.text.content,
        };
    }

    // If both are shape, transfer shape type/details
    if (targetItem.type === 'shape' && style.shape) {
        updated.shape = structuredClone(style.shape);
    }

    return updated;
}

/**
 * Assigns sequential z-indexes (0, 1, 2, ...) based on the current array order.
 */
function reassignZIndex(items: ICanvasItem[]): ICanvasItem[] {
    return items.map((item, idx) => ({ ...item, zIndex: idx }));
}

/**
 * Bring selected items forward by one step.
 */
export function bringForward(items: ICanvasItem[], targetIds: string[]): ICanvasItem[] {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    for (let i = sorted.length - 2; i >= 0; i--) {
        if (targetIds.includes(sorted[i].id) && !targetIds.includes(sorted[i + 1].id)) {
            const swap = sorted[i];
            sorted[i] = sorted[i + 1];
            sorted[i + 1] = swap;
        }
    }
    return reassignZIndex(sorted);
}

/**
 * Bring selected items to the very front.
 */
export function bringToFront(items: ICanvasItem[], targetIds: string[]): ICanvasItem[] {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    const unselected = sorted.filter(it => !targetIds.includes(it.id));
    const selected = sorted.filter(it => targetIds.includes(it.id));
    return reassignZIndex([...unselected, ...selected]);
}

/**
 * Send selected items backward by one step.
 */
export function sendBackward(items: ICanvasItem[], targetIds: string[]): ICanvasItem[] {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    for (let i = 1; i < sorted.length; i++) {
        if (targetIds.includes(sorted[i].id) && !targetIds.includes(sorted[i - 1].id)) {
            const swap = sorted[i];
            sorted[i] = sorted[i - 1];
            sorted[i - 1] = swap;
        }
    }
    return reassignZIndex(sorted);
}

/**
 * Send selected items to the very back.
 */
export function sendToBack(items: ICanvasItem[], targetIds: string[]): ICanvasItem[] {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    const selected = sorted.filter(it => targetIds.includes(it.id));
    const unselected = sorted.filter(it => !targetIds.includes(it.id));
    return reassignZIndex([...selected, ...unselected]);
}

export { groupCanvasItems, ungroupCanvasItems } from './canvasMasks';
