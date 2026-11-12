import { getDefaultStore } from 'jotai';
import {
    canvasZoomAtom,
    canvasOffsetAtom,
    copiedCanvasStyleAtom,
    selectedCanvasItemIdsAtom,
} from '@/core/store/uiAtoms';
import { ICanvasItem, ICanvasSlide } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { getItemBounds } from '@/core/utils/canvasDistance';
import {
    bringForward,
    bringToFront,
    sendBackward,
    sendToBack,
    extractCanvasStyle,
    applyCanvasStyle,
    flattenShapeToPath,
    groupCanvasItems,
    ungroupCanvasItems,
} from '@/core/utils/canvasLayers';
import { toggleCanvasMask } from '@/core/utils/canvasMasks';
import { flipCanvasItems, calculateAlignment, calculateDistribution } from '@/core/utils/canvasDistribution';
import { computeAutoLayout } from '@/core/utils/autoLayoutEngine';

export interface OpacityPressState {
    digit: string;
    timestamp: number;
}

/**
 * Calculates Figma-style immediate opacity from number keys 0-9.
 * Single digit sets tens (1 -> 0.1, 5 -> 0.5, 0 -> 1.0).
 * Rapid double digit within 600ms sets exact percentage (4 then 5 -> 0.45, 0 then 0 -> 0).
 */
export function calculateOpacityFromKey(
    digit: string,
    lastPress: OpacityPressState | null,
    now: number = Date.now()
): { opacity: number; nextPress: OpacityPressState | null } {
    if (lastPress && (now - lastPress.timestamp) < 600) {
        const twoDigits = parseInt(`${lastPress.digit}${digit}`, 10);
        const opacity = twoDigits === 0 ? 0 : Math.max(0, Math.min(1, twoDigits / 100));
        return { opacity, nextPress: null };
    }

    const opacity = digit === '0' ? 1.0 : parseInt(digit, 10) / 10;
    return { opacity, nextPress: { digit, timestamp: now } };
}

/**
 * Reorders canvas layers (Send Backward, Bring Forward, Send to Back, Bring to Front).
 */
export async function reorderCanvasLayers(
    slideId: string,
    targetIds: string[],
    action: 'forward' | 'backward' | 'front' | 'back'
): Promise<boolean> {
    if (targetIds.length === 0) return false;
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems) return false;

    let updated: ICanvasItem[];
    switch (action) {
        case 'forward':
            updated = bringForward(slide.content.canvasItems, targetIds);
            break;
        case 'backward':
            updated = sendBackward(slide.content.canvasItems, targetIds);
            break;
        case 'front':
            updated = bringToFront(slide.content.canvasItems, targetIds);
            break;
        case 'back':
            updated = sendToBack(slide.content.canvasItems, targetIds);
            break;
    }

    await storeState.updateCanvasItemsOrder(slideId, updated);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Copies visual styling from selected item into atom snapshot.
 */
export function copyCanvasStyleFromSelection(slideId: string, targetId: string): boolean {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    const item = slide?.content?.canvasItems?.find(i => i.id === targetId);
    if (item) {
        getDefaultStore().set(copiedCanvasStyleAtom, extractCanvasStyle(item));
        return true;
    }
    return false;
}

/**
 * Pastes visual styling snapshot onto selected items.
 */
export async function pasteCanvasStyleToSelection(slideId: string, targetIds: string[]): Promise<boolean> {
    const copied = getDefaultStore().get(copiedCanvasStyleAtom);
    if (!copied || targetIds.length === 0) return false;

    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems) return false;

    const updates = targetIds.map(id => {
        const it = slide.content.canvasItems.find(i => i.id === id);
        if (!it) return null;
        return { id, updates: applyCanvasStyle(it, copied) as Partial<ICanvasItem> };
    }).filter((u): u is { id: string; updates: Partial<ICanvasItem> } => u !== null);

    if (updates.length > 0) {
        await storeState.updateCanvasItems(slideId, updates);
        await storeState.takeSnapshot(slideId);
        return true;
    }
    return false;
}

/**
 * Toggles lock state for selected canvas items.
 */
export async function toggleCanvasLock(slideId: string, targetIds: string[]): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const anyLocked = targetIds.some(id => slide.content.canvasItems.find(i => i.id === id)?.locked);
    const updates = targetIds.map(id => ({ id, updates: { locked: !anyLocked } }));
    await storeState.updateCanvasItems(slideId, updates);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Toggles visibility for selected canvas items.
 */
export async function toggleCanvasVisibility(slideId: string, targetIds: string[]): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const anyHidden = targetIds.some(id => slide.content.canvasItems.find(i => i.id === id)?.visible === false);
    const updates = targetIds.map(id => ({ id, updates: { visible: anyHidden } }));
    await storeState.updateCanvasItems(slideId, updates);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Toggles mask clipping group for selected item.
 */
export async function toggleCanvasMaskForSelection(slideId: string, targetId: string): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems) return false;

    const updated = toggleCanvasMask(slide.content.canvasItems, targetId);
    await storeState.updateCanvasItemsOrder(slideId, updated);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Toggles or creates Auto Layout on the selected item(s) (Shift+A).
 * If multiple items selected, groups them and applies Auto Layout flex.
 */
export async function toggleCanvasAutoLayout(slideId: string, targetIds: string[]): Promise<boolean> {
    if (targetIds.length === 0) return false;
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems) return false;

    if (targetIds.length === 1) {
        const item = slide.content.canvasItems.find(i => i.id === targetIds[0]);
        if (!item) return false;
        const isEnabled = item.autoLayout?.enabled ?? false;
        const updates = [{
            id: targetIds[0],
            updates: {
                autoLayout: {
                    enabled: !isEnabled,
                    direction: item.autoLayout?.direction || 'horizontal',
                    gap: item.autoLayout?.gap ?? 16,
                    padding: item.autoLayout?.padding ?? 16,
                    align: item.autoLayout?.align || 'start',
                    hugContents: item.autoLayout?.hugContents ?? false,
                }
            }
        }];
        await storeState.updateCanvasItems(slideId, updates);
        await storeState.takeSnapshot(slideId);
        return true;
    }

    // Multi-selection Shift+A: group items and create Auto Layout frame
    const selected = slide.content.canvasItems.filter(i => targetIds.includes(i.id));
    const bounds = selected.map(getItemBounds);
    const minL = Math.min(...bounds.map(b => b.left));
    const maxR = Math.max(...bounds.map(b => b.right));
    const minT = Math.min(...bounds.map(b => b.top));
    const maxB = Math.max(...bounds.map(b => b.bottom));
    const selW = Math.max(1, maxR - minL);
    const selH = Math.max(1, maxB - minT);
    const newGroupId = crypto.randomUUID();

    const direction: 'horizontal' | 'vertical' = selW >= selH ? 'horizontal' : 'vertical';
    const container: ICanvasItem = {
        id: crypto.randomUUID(),
        type: 'shape',
        shape: { shapeType: 'rect' },
        x: Math.round((minL + selW / 2) * 10) / 10,
        y: Math.round((minT + selH / 2) * 10) / 10,
        width: Math.round(selW * 10) / 10,
        height: Math.round(selH * 10) / 10,
        rotation: 0,
        zIndex: Math.max(...selected.map(i => i.zIndex)) + 1,
        locked: false,
        visible: true,
        groupId: newGroupId,
        autoLayout: {
            enabled: true,
            direction,
            gap: 16,
            padding: 16,
            align: 'start',
            hugContents: true,
        },
        fills: [],
        strokes: [],
        borderWidth: 0,
    };

    const groupedChildren = selected.map(it => ({ ...it, groupId: newGroupId }));
    const { container: laidOutContainer, children: laidOutChildren } = computeAutoLayout(container, groupedChildren);

    const childUpdates = laidOutChildren.map(c => ({
        id: c.id,
        updates: { groupId: newGroupId, x: c.x, y: c.y }
    }));

    await storeState.addCanvasItem(slideId, laidOutContainer);
    await storeState.updateCanvasItems(slideId, childUpdates);
    await storeState.takeSnapshot(slideId);
    getDefaultStore().set(selectedCanvasItemIdsAtom, [laidOutContainer.id]);
    return true;
}

/**
 * Aligns selected canvas items (Option + A/D/W/S/H/V).
 */
export async function alignCanvasSelection(
    slideId: string,
    targetIds: string[],
    mode: 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom'
): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const selected = slide.content.canvasItems.filter(i => targetIds.includes(i.id));
    const relativeToCanvas = targetIds.length === 1;
    const updates = calculateAlignment(selected, mode, relativeToCanvas);
    if (updates.length > 0) {
        await storeState.updateCanvasItems(slideId, updates);
        await storeState.takeSnapshot(slideId);
        return true;
    }
    return false;
}

/**
 * Distributes selected canvas items with equal spacing (Option + Shift + H/V).
 */
export async function distributeCanvasSelection(
    slideId: string,
    targetIds: string[],
    axis: 'horizontal' | 'vertical'
): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length < 3) return false;

    const selected = slide.content.canvasItems.filter(i => targetIds.includes(i.id));
    const updates = calculateDistribution(selected, axis);
    if (updates.length > 0) {
        await storeState.updateCanvasItems(slideId, updates);
        await storeState.takeSnapshot(slideId);
        return true;
    }
    return false;
}

/**
 * Flips selected canvas items horizontally or vertically.
 */
export async function flipCanvasSelection(
    slideId: string,
    targetIds: string[],
    axis: 'horizontal' | 'vertical'
): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const selected = slide.content.canvasItems.filter(i => targetIds.includes(i.id));
    const updates = flipCanvasItems(selected, axis);
    await storeState.updateCanvasItems(slideId, updates);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Groups or ungroups selected canvas items.
 */
export async function groupOrUngroupSelection(
    slideId: string,
    targetIds: string[],
    isUngroup: boolean
): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const updated = isUngroup
        ? ungroupCanvasItems(slide.content.canvasItems, targetIds)
        : groupCanvasItems(slide.content.canvasItems, targetIds, crypto.randomUUID());
    await storeState.updateCanvasItemsOrder(slideId, updated);
    await storeState.takeSnapshot(slideId);
    return true;
}

/**
 * Flattens selected parametric shapes into vector paths (Cmd+E).
 */
export async function flattenSelectedShapes(slideId: string, targetIds: string[]): Promise<boolean> {
    const storeState = usePresentationStore.getState();
    const pres = storeState.selectedPresentation || storeState.activePresentation;
    const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
    if (!slide?.content?.canvasItems || targetIds.length === 0) return false;

    const updates = targetIds.map(id => {
        const it = slide.content.canvasItems.find(i => i.id === id);
        if (!it || it.type === 'path') return null;
        return { id, updates: flattenShapeToPath(it) };
    }).filter((u): u is { id: string; updates: Partial<ICanvasItem> } => u !== null);

    if (updates.length > 0) {
        await storeState.updateCanvasItems(slideId, updates);
        await storeState.takeSnapshot(slideId);
        return true;
    }
    return false;
}

/**
 * Runs native EyeDropper API to pick color for selected canvas items (I).
 */
export async function runCanvasEyeDropper(slideId: string, targetIds: string[]): Promise<boolean> {
    if (typeof window === 'undefined' || !('EyeDropper' in window)) return false;
    try {
        const EyeDropperClass = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
        const eyeDropper = new EyeDropperClass();
        const result = await eyeDropper.open();
        if (result?.sRGBHex && targetIds.length > 0) {
            const storeState = usePresentationStore.getState();
            const pres = storeState.selectedPresentation || storeState.activePresentation;
            const slide = pres?.slides?.find(s => s.id === slideId) as ICanvasSlide | undefined;
            if (slide?.content?.canvasItems) {
                const updates = targetIds.map(id => {
                    const it = slide.content.canvasItems.find(i => i.id === id);
                    if (!it) return null;
                    const fills = [...(it.fills || [])];
                    if (fills.length > 0) {
                        fills[0] = { ...fills[0], color: result.sRGBHex };
                    } else {
                        fills.push({
                            id: crypto.randomUUID(),
                            type: 'color',
                            visible: true,
                            opacity: 1,
                            blendMode: 'normal',
                            color: result.sRGBHex,
                        });
                    }
                    return { id, updates: { fills } };
                }).filter((u): u is { id: string; updates: { fills: ICanvasItem['fills'] } } => u !== null);

                if (updates.length > 0) {
                    await storeState.updateCanvasItems(slideId, updates);
                    await storeState.takeSnapshot(slideId);
                    return true;
                }
            }
        }
    } catch {
        // User cancelled with Esc
    }
    return false;
}

/**
 * Calculates zoom factor and pan offset to frame selected items in canvas viewport (Shift+2).
 */
export function calculateZoomToSelection(items: ICanvasItem[]): { zoom: number; offset: { x: number; y: number } } | null {
    if (items.length === 0) return null;
    const bounds = items.map(getItemBounds);
    const minL = Math.min(...bounds.map(b => b.left));
    const maxR = Math.max(...bounds.map(b => b.right));
    const minT = Math.min(...bounds.map(b => b.top));
    const maxB = Math.max(...bounds.map(b => b.bottom));
    const selW = Math.max(1, maxR - minL);
    const selH = Math.max(1, maxB - minT);
    const cX = (minL + maxR) / 2;
    const cY = (minT + maxB) / 2;
    const factor = Math.min(3.5, Math.max(0.5, 70 / Math.max(selW, selH)));
    const zoom = Math.round(factor * 100) / 100;
    const offset = {
        x: Math.round((50 - cX) * 19.2 * (factor / 1.0)),
        y: Math.round((50 - cY) * 10.8 * (factor / 1.0)),
    };
    return { zoom, offset };
}

/**
 * Resets canvas zoom to fit whole slide (Shift+1) or zoom to 100% (Shift+0).
 */
export function resetCanvasZoom(mode: 'fit' | '100%'): void {
    const store = getDefaultStore();
    store.set(canvasZoomAtom, 1.0);
    if (mode === 'fit') {
        store.set(canvasOffsetAtom, { x: 0, y: 0 });
    }
}
