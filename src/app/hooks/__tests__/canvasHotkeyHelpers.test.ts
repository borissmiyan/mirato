import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    calculateOpacityFromKey,
    reorderCanvasLayers,
    calculateZoomToSelection,
    resetCanvasZoom,
} from '../canvasHotkeyHelpers';
import { getDefaultStore } from 'jotai';
import { canvasZoomAtom, canvasOffsetAtom } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem } from '@/core/types';

describe('canvasHotkeyHelpers', () => {
    describe('calculateOpacityFromKey', () => {
        it('sets single digit opacity correctly', () => {
            const now = 1000;
            const res1 = calculateOpacityFromKey('5', null, now);
            expect(res1.opacity).toBe(0.5);
            expect(res1.nextPress).toEqual({ digit: '5', timestamp: 1000 });

            const res0 = calculateOpacityFromKey('0', null, now);
            expect(res0.opacity).toBe(1.0);

            const res9 = calculateOpacityFromKey('9', null, now);
            expect(res9.opacity).toBe(0.9);
        });

        it('sets two-digit opacity within 600ms', () => {
            const press1 = { digit: '4', timestamp: 1000 };
            const res = calculateOpacityFromKey('5', press1, 1300);
            expect(res.opacity).toBe(0.45);
            expect(res.nextPress).toBeNull();
        });

        it('sets 0% on double zero', () => {
            const press0 = { digit: '0', timestamp: 1000 };
            const res = calculateOpacityFromKey('0', press0, 1200);
            expect(res.opacity).toBe(0);
            expect(res.nextPress).toBeNull();
        });

        it('treats as separate press after 600ms timeout', () => {
            const press1 = { digit: '4', timestamp: 1000 };
            const res = calculateOpacityFromKey('5', press1, 1800);
            expect(res.opacity).toBe(0.5);
            expect(res.nextPress).toEqual({ digit: '5', timestamp: 1800 });
        });
    });

    describe('calculateZoomToSelection', () => {
        it('returns null for empty items', () => {
            expect(calculateZoomToSelection([])).toBeNull();
        });

        it('calculates proper zoom and centered offset for item', () => {
            const mockItem = {
                id: '1',
                type: 'shape',
                x: 50,
                y: 50,
                width: 20,
                height: 20,
                zIndex: 0,
            } as unknown as ICanvasItem;
            const result = calculateZoomToSelection([mockItem]);
            expect(result).not.toBeNull();
            expect(result?.zoom).toBeGreaterThan(0.5);
            expect(result?.offset.x).toBe(0);
            expect(result?.offset.y).toBe(0);
        });
    });

    describe('resetCanvasZoom', () => {
        beforeEach(() => {
            const store = getDefaultStore();
            store.set(canvasZoomAtom, 2.5);
            store.set(canvasOffsetAtom, { x: 100, y: 50 });
        });

        it('resets to 100% and zeros offset in fit mode', () => {
            resetCanvasZoom('fit');
            const store = getDefaultStore();
            expect(store.get(canvasZoomAtom)).toBe(1.0);
            expect(store.get(canvasOffsetAtom)).toEqual({ x: 0, y: 0 });
        });
    });

    describe('reorderCanvasLayers', () => {
        it('calls updateCanvasItemsOrder with reordered items', async () => {
            const mockUpdateOrder = vi.fn().mockResolvedValue(undefined);
            const mockSnapshot = vi.fn().mockResolvedValue(undefined);
            usePresentationStore.setState({
                selectedPresentation: {
                    id: 'p1',
                    slides: [{
                        id: 's1',
                        content: {
                            canvasItems: [
                                { id: 'a', zIndex: 0 } as ICanvasItem,
                                { id: 'b', zIndex: 1 } as ICanvasItem,
                            ]
                        }
                    }]
                },
                updateCanvasItemsOrder: mockUpdateOrder,
                takeSnapshot: mockSnapshot,
            } as any);

            const handled = await reorderCanvasLayers('s1', ['a'], 'forward');
            expect(handled).toBe(true);
            expect(mockUpdateOrder).toHaveBeenCalled();
            expect(mockSnapshot).toHaveBeenCalledWith('s1');
        });
    });
});
