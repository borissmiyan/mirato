import { describe, it, expect, vi } from 'vitest';
import {
    alignCanvasSelection,
    distributeCanvasSelection,
    toggleCanvasAutoLayout,
} from '../canvasHotkeyHelpers';
import { normalizePathItemBounds } from '@/features/presenter/components/slide-editor/utils/createPathItem';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem, ICanvasSlide } from '@/core/types';

describe('canvasFigmaExtensions', () => {
    describe('normalizePathItemBounds', () => {
        it('normalizes full-slide path into tight bounding box', () => {
            const item: ICanvasItem = {
                id: 'p1',
                type: 'path',
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                rotation: 0,
                zIndex: 1,
                locked: false,
                visible: true,
                fills: [],
                strokes: [],
                path: {
                    nodes: [
                        { id: 'n1', x: 20, y: 30, isCorner: true },
                        { id: 'n2', x: 40, y: 70, isCorner: true },
                    ],
                    isClosed: false,
                },
            };

            const normalized = normalizePathItemBounds(item);
            expect(normalized.width).toBe(20);
            expect(normalized.height).toBe(40);
            expect(normalized.x).toBe(30);
            expect(normalized.y).toBe(50);
            expect(normalized.path?.nodes[0].x).toBe(0);
            expect(normalized.path?.nodes[0].y).toBe(0);
            expect(normalized.path?.nodes[1].x).toBe(100);
            expect(normalized.path?.nodes[1].y).toBe(100);
        });

        it('normalizes deformed path item whose nodes went out of bounds', () => {
            const item: ICanvasItem = {
                id: 'p2',
                type: 'path',
                x: 50,
                y: 50,
                width: 20,
                height: 20,
                rotation: 0,
                zIndex: 1,
                locked: false,
                visible: true,
                fills: [],
                strokes: [],
                path: {
                    nodes: [
                        { id: 'n1', x: 0, y: 0, isCorner: true },
                        { id: 'n2', x: 150, y: 100, isCorner: true },
                    ],
                    isClosed: true,
                },
            };

            const normalized = normalizePathItemBounds(item);
            expect(normalized.width).toBe(30);
            expect(normalized.height).toBe(20);
            expect(normalized.x).toBe(55);
            expect(normalized.path?.nodes[1].x).toBe(100);
        });
    });

    describe('alignCanvasSelection', () => {
        it('aligns multiple items to the left', async () => {
            const mockUpdate = vi.fn().mockResolvedValue(undefined);
            const mockSnapshot = vi.fn().mockResolvedValue(undefined);
            usePresentationStore.setState({
                selectedPresentation: {
                    id: 'p1',
                    slides: [{
                        id: 's1',
                        type: 'normal',
                        content: {
                            canvasItems: [
                                { id: 'i1', x: 30, y: 20, width: 10, height: 10 } as ICanvasItem,
                                { id: 'i2', x: 50, y: 40, width: 10, height: 10 } as ICanvasItem,
                            ],
                        },
                    } as ICanvasSlide],
                } as any,
                updateCanvasItems: mockUpdate,
                takeSnapshot: mockSnapshot,
            });

            const res = await alignCanvasSelection('s1', ['i1', 'i2'], 'left');
            expect(res).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith('s1', expect.arrayContaining([
                expect.objectContaining({ id: 'i2', updates: expect.objectContaining({ x: 30 }) }),
            ]));
        });
    });

    describe('distributeCanvasSelection', () => {
        it('distributes 3 items with equal spacing', async () => {
            const mockUpdate = vi.fn().mockResolvedValue(undefined);
            const mockSnapshot = vi.fn().mockResolvedValue(undefined);
            usePresentationStore.setState({
                selectedPresentation: {
                    id: 'p1',
                    slides: [{
                        id: 's1',
                        type: 'normal',
                        content: {
                            canvasItems: [
                                { id: 'a', x: 10, y: 20, width: 10, height: 10 } as ICanvasItem,
                                { id: 'b', x: 20, y: 20, width: 10, height: 10 } as ICanvasItem,
                                { id: 'c', x: 50, y: 20, width: 10, height: 10 } as ICanvasItem,
                            ],
                        },
                    } as ICanvasSlide],
                } as any,
                updateCanvasItems: mockUpdate,
                takeSnapshot: mockSnapshot,
            });

            const res = await distributeCanvasSelection('s1', ['a', 'b', 'c'], 'horizontal');
            expect(res).toBe(true);
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('toggleCanvasAutoLayout', () => {
        it('toggles autoLayout on single item', async () => {
            const mockUpdate = vi.fn().mockResolvedValue(undefined);
            const mockSnapshot = vi.fn().mockResolvedValue(undefined);
            usePresentationStore.setState({
                selectedPresentation: {
                    id: 'p1',
                    slides: [{
                        id: 's1',
                        type: 'normal',
                        content: {
                            canvasItems: [
                                { id: 'single', x: 10, y: 10, width: 20, height: 20 } as ICanvasItem,
                            ],
                        },
                    } as ICanvasSlide],
                } as any,
                updateCanvasItems: mockUpdate,
                takeSnapshot: mockSnapshot,
            });

            const res = await toggleCanvasAutoLayout('s1', ['single']);
            expect(res).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith('s1', [
                {
                    id: 'single',
                    updates: {
                        autoLayout: expect.objectContaining({ enabled: true }),
                    },
                },
            ]);
        });
    });
});

