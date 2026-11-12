import { getDefaultStore } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    canvasToolAtom,
    canvasZoomAtom,
    canvasOffsetAtom,
    latestInteractionAreaAtom,
    lastDuplicateOffsetAtom,
    showCanvasQuickActionsAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { createCanvasItem } from '@/features/presenter/components/slide-properties/helpers';
import { ShapeType, ICanvasSlide } from '@/core/types';
import { tidyUpItems } from '@/core/utils/tidyUpUtils';
import {
    calculateOpacityFromKey,
    reorderCanvasLayers,
    calculateZoomToSelection,
    resetCanvasZoom,
    copyCanvasStyleFromSelection,
    pasteCanvasStyleToSelection,
    toggleCanvasLock,
    toggleCanvasVisibility,
    toggleCanvasMaskForSelection,
    toggleCanvasAutoLayout,
    flipCanvasSelection,
    alignCanvasSelection,
    distributeCanvasSelection,
    groupOrUngroupSelection,
    flattenSelectedShapes,
    runCanvasEyeDropper,
    OpacityPressState,
} from './canvasHotkeyHelpers';

let lastOpacityPress: OpacityPressState | null = null;

export interface HotkeyEvent {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    isRelayed?: boolean;
    preventDefault?: () => void;
}

/**
 * Handles presentation mode canvas, audio scope, and timeline hotkeys.
 */
export async function executePresentationHotkeys(
    e: HotkeyEvent,
    isMod: boolean,
    isPreviewHovered: boolean,
    selectedCanvasItemIds: string[]
): Promise<boolean> {
    const store = getDefaultStore();
    const area = store.get(latestInteractionAreaAtom);

    const {
        previewSlideId, selectedPresentationId, duplicateSlide, duplicateSlides,
        duplicateCanvasItems, duplicateAudioScope, moveSlide, moveSlides,
        removeSlide, removeSlides, removeCanvasItem, selectedSlideIds,
        selectedAudioScopeId, removeAudioScope, addCanvasItem
    } = usePresentationStore.getState();

    // ── DUPLICATE (⌘D) ───────────────────────────────────────────
    if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
        e.preventDefault?.();

        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            const lastOffset = store.get(lastDuplicateOffsetAtom);
            const offset = lastOffset || { dx: 2, dy: 2 };
            const newIds = await duplicateCanvasItems(previewSlideId, selectedCanvasItemIds, offset);
            store.set(lastDuplicateOffsetAtom, offset);
            store.set(selectedCanvasItemIdsAtom, newIds);
            return true;
        } else if (area === 'audio' && selectedAudioScopeId) {
            const newId = await duplicateAudioScope(selectedAudioScopeId);
            if (newId) usePresentationStore.getState().selectAudioScope(newId);
            return true;
        } else if (area === 'timeline' && selectedPresentationId) {
            if (selectedSlideIds.length > 0) {
                await duplicateSlides(selectedPresentationId, selectedSlideIds);
            } else if (previewSlideId) {
                await duplicateSlide(selectedPresentationId, previewSlideId);
            }
            return true;
        }
    }

    // ── TIDY UP (⌥⇧⌘T) ───────────────────────────────────────────
    if (isMod && e.altKey && e.shiftKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length >= 2) {
            e.preventDefault?.();
            const storeState = usePresentationStore.getState();
            const pres = storeState.selectedPresentation || storeState.activePresentation;
            const slide = pres?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide | undefined;
            if (slide?.content?.canvasItems) {
                const selected = slide.content.canvasItems.filter(i => selectedCanvasItemIds.includes(i.id));
                const tidied = tidyUpItems(selected);
                const updates = tidied.map(item => ({ id: item.id, updates: { x: item.x, y: item.y } }));
                if (updates.length > 0) {
                    await storeState.updateCanvasItems(previewSlideId, updates);
                    await storeState.takeSnapshot(previewSlideId);
                }
            }
            return true;
        }
    }

    // ── CREATE COMPONENT (⌥⌘K) ──────────────────────────────────
    if (isMod && e.altKey && !e.shiftKey && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            const storeState = usePresentationStore.getState();
            const updates = selectedCanvasItemIds.map(id => ({
                id,
                updates: { isMasterComponent: true }
            }));
            await storeState.updateCanvasItems(previewSlideId, updates);
            await storeState.takeSnapshot(previewSlideId);
            return true;
        }
    }

    // ── DETACH INSTANCE (⌥⇧⌘B) ──────────────────────────────────
    if (isMod && e.altKey && e.shiftKey && (e.code === 'KeyB' || e.key.toLowerCase() === 'b')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            const storeState = usePresentationStore.getState();
            const updates = selectedCanvasItemIds.map(id => ({
                id,
                updates: { masterComponentId: undefined, componentOverrides: undefined }
            }));
            await storeState.updateCanvasItems(previewSlideId, updates);
            await storeState.takeSnapshot(previewSlideId);
            return true;
        }
    }

    // ── COPY PROPERTIES (⌥⌘C) ────────────────────────────────────
    if (isMod && e.altKey && !e.shiftKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (copyCanvasStyleFromSelection(previewSlideId, selectedCanvasItemIds[0])) return true;
        }
    }

    // ── PASTE PROPERTIES (⌥⌘V) ───────────────────────────────────
    if (isMod && e.altKey && !e.shiftKey && (e.code === 'KeyV' || e.key.toLowerCase() === 'v')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await pasteCanvasStyleToSelection(previewSlideId, selectedCanvasItemIds)) return true;
        }
    }

    // ── FLATTEN TO PATH (⌘E) ─────────────────────────────────────
    if (isMod && !e.altKey && !e.shiftKey && (e.code === 'KeyE' || e.key.toLowerCase() === 'e')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await flattenSelectedShapes(previewSlideId, selectedCanvasItemIds)) return true;
        }
    }

    // ── GROUP (⌘G) / UNGROUP (⇧⌘G) ───────────────────────────────
    if (isMod && !e.altKey && (e.code === 'KeyG' || e.key.toLowerCase() === 'g')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await groupOrUngroupSelection(previewSlideId, selectedCanvasItemIds, Boolean(e.shiftKey))) return true;
        }
    }

    // ── LOCK / UNLOCK (⇧⌘L) ──────────────────────────────────────
    if (isMod && e.shiftKey && !e.altKey && (e.code === 'KeyL' || e.key.toLowerCase() === 'l')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await toggleCanvasLock(previewSlideId, selectedCanvasItemIds)) return true;
        }
    }

    // ── HIDE / SHOW (⇧⌘H) ────────────────────────────────────────
    if (isMod && e.shiftKey && !e.altKey && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await toggleCanvasVisibility(previewSlideId, selectedCanvasItemIds)) return true;
        }
    }

    // ── MASK / UNMASK (^⌘M) ──────────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && isMod && (e.code === 'KeyM' || e.key.toLowerCase() === 'm')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await toggleCanvasMaskForSelection(previewSlideId, selectedCanvasItemIds[0])) return true;
        }
    }

    // ── AUTO LAYOUT TOGGLE (⇧A) ──────────────────────────────────
    if (!isMod && e.shiftKey && !e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            if (await toggleCanvasAutoLayout(previewSlideId, selectedCanvasItemIds)) return true;
        }
    }

    // ── FIGMA ALIGNMENT & DISTRIBUTION (⌥A, ⌥D, ⌥W, ⌥S, ⌥H, ⌥V, ⌥⇧H, ⌥⇧V) ────
    if (!isMod && e.altKey && (area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
        if (e.shiftKey) {
            if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') {
                e.preventDefault?.();
                if (await distributeCanvasSelection(previewSlideId, selectedCanvasItemIds, 'horizontal')) return true;
            }
            if (e.code === 'KeyV' || e.key.toLowerCase() === 'v') {
                e.preventDefault?.();
                if (await distributeCanvasSelection(previewSlideId, selectedCanvasItemIds, 'vertical')) return true;
            }
        } else {
            const alignMap: Record<string, 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom'> = {
                KeyA: 'left',
                KeyD: 'right',
                KeyW: 'top',
                KeyS: 'bottom',
                KeyH: 'center-h',
                KeyV: 'middle-v',
            };
            const mode = e.code ? alignMap[e.code] : undefined;
            if (mode) {
                e.preventDefault?.();
                if (await alignCanvasSelection(previewSlideId, selectedCanvasItemIds, mode)) return true;
            }
        }
    }

    // ── FLIP HORIZONTAL (⇧H) / FLIP VERTICAL (⇧V) ────────────────
    if (!isMod && e.shiftKey && !e.altKey && (area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
        if (e.code === 'KeyH' || e.key.toLowerCase() === 'h') {
            e.preventDefault?.();
            if (await flipCanvasSelection(previewSlideId, selectedCanvasItemIds, 'horizontal')) return true;
        }
        if (e.code === 'KeyV' || e.key.toLowerCase() === 'v') {
            e.preventDefault?.();
            if (await flipCanvasSelection(previewSlideId, selectedCanvasItemIds, 'vertical')) return true;
        }
    }

    // ── SELECT ALL ON CANVAS (⌘A) ─────────────────────────────────
    if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId) {
            e.preventDefault?.();
            const pres = usePresentationStore.getState().selectedPresentation || usePresentationStore.getState().activePresentation;
            const slide = pres?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide | undefined;
            if (slide?.content?.canvasItems) {
                const allSelectable = slide.content.canvasItems
                    .filter(i => !i.locked && i.visible !== false)
                    .map(i => i.id);
                store.set(selectedCanvasItemIdsAtom, allSelectable);
                return true;
            }
        }
    }

    // ── OPACITY SHORTCUTS (0-9) ───────────────────────────────────
    if (!isMod && !e.altKey && !e.shiftKey && !e.ctrlKey && /^[0-9]$/.test(e.key)) {
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            const { opacity, nextPress } = calculateOpacityFromKey(e.key, lastOpacityPress);
            lastOpacityPress = nextPress;
            const updates = selectedCanvasItemIds.map(id => ({ id, updates: { opacity } }));
            await usePresentationStore.getState().updateCanvasItems(previewSlideId, updates);
            await usePresentationStore.getState().takeSnapshot(previewSlideId);
            return true;
        }
    }

    // ── ZOOM SHORTCUTS (⇧1, ⇧2, ⇧0) ──────────────────────────────
    if (!isMod && e.shiftKey && !e.altKey && !e.ctrlKey && (area === 'canvas' || isPreviewHovered)) {
        if (e.code === 'Digit1' || e.key === '1' || e.key === '!') {
            e.preventDefault?.();
            resetCanvasZoom('fit');
            return true;
        }
        if (e.code === 'Digit2' || e.key === '2' || e.key === '@' || e.key === '"') {
            e.preventDefault?.();
            if (previewSlideId && selectedCanvasItemIds.length > 0) {
                const pres = usePresentationStore.getState().selectedPresentation || usePresentationStore.getState().activePresentation;
                const slide = pres?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide | undefined;
                const selected = slide?.content?.canvasItems?.filter(i => selectedCanvasItemIds.includes(i.id)) || [];
                const fit = calculateZoomToSelection(selected);
                if (fit) {
                    store.set(canvasZoomAtom, fit.zoom);
                    store.set(canvasOffsetAtom, fit.offset);
                }
            }
            return true;
        }
        if (e.code === 'Digit0' || e.key === '0') {
            e.preventDefault?.();
            resetCanvasZoom('100%');
            return true;
        }
    }

    // ── LAYER ORDERING (⌘[, ⌘], ⌥⌘[, ⌥⌘]) OR SLIDE NAVIGATION ────
    if (isMod && (e.key === '[' || e.code === 'BracketLeft' || e.key === ']' || e.code === 'BracketRight')) {
        const isLeft = e.key === '[' || e.code === 'BracketLeft';
        if ((area === 'canvas' || isPreviewHovered) && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            const action = isLeft
                ? (e.altKey || e.shiftKey ? 'back' : 'backward')
                : (e.altKey || e.shiftKey ? 'front' : 'forward');
            await reorderCanvasLayers(previewSlideId, selectedCanvasItemIds, action);
            return true;
        } else if (selectedPresentationId) {
            e.preventDefault?.();
            const direction = isLeft ? (e.shiftKey ? 'start' : 'back') : (e.shiftKey ? 'end' : 'forth');
            if (selectedSlideIds.length > 0) {
                await moveSlides(selectedPresentationId, selectedSlideIds, direction);
            } else if (previewSlideId) {
                await moveSlide(selectedPresentationId, previewSlideId, direction);
            }
            return true;
        }
    }

    // ── DELETE (Del/Backspace) ───────────────────────────────────
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (area === 'canvas' && previewSlideId && selectedCanvasItemIds.length > 0) {
            e.preventDefault?.();
            for (const id of selectedCanvasItemIds) {
                await removeCanvasItem(previewSlideId, id);
            }
            store.set(selectedCanvasItemIdsAtom, []);
            return true;
        } else if (area === 'audio' && selectedAudioScopeId) {
            e.preventDefault?.();
            await removeAudioScope(selectedAudioScopeId);
            return true;
        } else if (area === 'timeline' && selectedPresentationId) {
            e.preventDefault?.();
            if (selectedSlideIds.length > 0) {
                await removeSlides(selectedPresentationId, selectedSlideIds);
            } else if (previewSlideId) {
                await removeSlide(selectedPresentationId, previewSlideId);
            }
            return true;
        }
    }

    // ── TOOL SWITCHING (V, H) ────────────────────────────────────
    if (!isMod) {
        if (e.key.toLowerCase() === 'v') {
            e.preventDefault?.();
            store.set(canvasToolAtom, 'select');
            return true;
        } else if (e.key.toLowerCase() === 'h') {
            e.preventDefault?.();
            store.set(canvasToolAtom, 'pan');
            return true;
        }
    }

    // ── ELEMENT CREATION (T, R, O, L) ─────────────────────────────
    if (!isMod && area === 'canvas' && previewSlideId) {
        const addElement = (type: 'text' | 'shape' | 'stroke' | 'image' | 'video', shapeType?: ShapeType) => {
            const item = createCanvasItem(type);
            if (shapeType && item.shape) item.shape.shapeType = shapeType;
            item.x = 50; item.y = 50;
            addCanvasItem(previewSlideId, item);
            store.set(selectedCanvasItemIdsAtom, [item.id]);
        };

        if (e.key.toLowerCase() === 't') { e.preventDefault?.(); addElement('text'); return true; }
        else if (e.key.toLowerCase() === 'r') { e.preventDefault?.(); addElement('shape', 'rect'); return true; }
        else if (e.key.toLowerCase() === 'o') { e.preventDefault?.(); addElement('shape', 'circle'); return true; }
        else if (e.key.toLowerCase() === 'l') { e.preventDefault?.(); addElement('stroke'); return true; }
        else if (e.key.toLowerCase() === 'p') {
            e.preventDefault?.();
            store.set(canvasToolAtom, store.get(canvasToolAtom) === 'pen' ? 'select' : 'pen');
            return true;
        }
    }

    // ── EYEDROPPER TOOL (I) ──────────────────────────────────────
    if (!isMod && (e.key.toLowerCase() === 'i' || e.code === 'KeyI') && (area === 'canvas' || isPreviewHovered) && previewSlideId) {
        e.preventDefault?.();
        if (await runCanvasEyeDropper(previewSlideId, selectedCanvasItemIds)) return true;
    }

    // ── QUICK ACTIONS PALETTE (⌘/ or ⌘K) ─────────────────────────
    if (isMod && !e.altKey && (e.key === '/' || e.code === 'Slash' || e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault?.();
        store.set(showCanvasQuickActionsAtom, true);
        return true;
    }

    // ── ZOOM CONTROLS (⌘+, ⌘-, ⌘0) ────────────────────────────────
    if (isMod && area === 'canvas') {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault?.();
            store.set(canvasZoomAtom, (prev: number) => Math.min(prev + 0.1, 4));
            return true;
        } else if (e.key === '-') {
            e.preventDefault?.();
            store.set(canvasZoomAtom, (prev: number) => Math.max(prev - 0.1, 0.1));
            return true;
        } else if (e.key === '0') {
            e.preventDefault?.();
            store.set(canvasZoomAtom, 1.0);
            return true;
        }
    }

    return false;
}

