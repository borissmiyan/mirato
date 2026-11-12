import { describe, it, expect } from 'vitest';
import { ICanvasItem } from '@/core/types';
import {
    extractCanvasStyle,
    applyCanvasStyle,
    bringForward,
    bringToFront,
    sendBackward,
    sendToBack,
    groupCanvasItems,
    ungroupCanvasItems,
    flattenShapeToPath,
} from './canvasLayers';

const createMockItem = (id: string, zIndex: number, extra: Partial<ICanvasItem> = {}): ICanvasItem => ({
    id,
    type: 'shape',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    fills: [{ id: 'f1', type: 'color', color: '#ff0000', opacity: 1, visible: true, blendMode: 'normal' }],
    strokes: [],
    ...extra,
});

describe('canvasLayers', () => {
    describe('Style Copy & Paste', () => {
        it('extracts style and applies to another item without overwriting geometry or content', () => {
            const source = createMockItem('source', 0, {
                opacity: 0.75,
                borderRadius: 16,
                borderColor: '#ffffff',
                borderWidth: 2,
                dropShadow: { x: 4, y: 4, blur: 8, color: 'rgba(0,0,0,0.5)' },
            });

            const target = createMockItem('target', 1, {
                x: 80,
                y: 80,
                width: 30,
                height: 30,
                opacity: 1,
            });

            const style = extractCanvasStyle(source);
            expect(style.opacity).toBe(0.75);
            expect(style.borderRadius).toBe(16);

            const updated = applyCanvasStyle(target, style);
            expect(updated.x).toBe(80); // preserved geometry
            expect(updated.width).toBe(30);
            expect(updated.opacity).toBe(0.75);
            expect(updated.borderRadius).toBe(16);
            expect(updated.borderColor).toBe('#ffffff');
            expect(updated.borderWidth).toBe(2);
            expect(updated.dropShadow?.blur).toBe(8);
        });

        it('transfers text typography while preserving target text content', () => {
            const textSource = createMockItem('txt1', 0, {
                type: 'text',
                text: {
                    content: 'Source text',
                    fontFamily: 'Roboto',
                    fontSize: 48,
                    fontWeight: 700,
                    alignHorizontal: 'center',
                    alignVertical: 'middle',
                    color: '#ff00ff',
                    isBold: true,
                    resizingMode: 'fixed',
                },
            });

            const textTarget = createMockItem('txt2', 1, {
                type: 'text',
                text: {
                    content: 'Target preserve me',
                    fontFamily: 'Arial',
                    fontSize: 24,
                    fontWeight: 400,
                    alignHorizontal: 'left',
                    alignVertical: 'top',
                    color: '#000000',
                    resizingMode: 'fixed',
                },
            });

            const style = extractCanvasStyle(textSource);
            const updated = applyCanvasStyle(textTarget, style);

            expect(updated.text?.content).toBe('Target preserve me');
            expect(updated.text?.fontFamily).toBe('Roboto');
            expect(updated.text?.fontSize).toBe(48);
            expect(updated.text?.isBold).toBe(true);
        });
    });

    describe('Layer Ordering', () => {
        const items = [
            createMockItem('item-0', 0),
            createMockItem('item-1', 1),
            createMockItem('item-2', 2),
            createMockItem('item-3', 3),
        ];

        it('bringForward moves target item one step forward', () => {
            const res = bringForward(items, ['item-1']);
            const idsInOrder = res.map(i => i.id);
            expect(idsInOrder).toEqual(['item-0', 'item-2', 'item-1', 'item-3']);
        });

        it('bringToFront moves target item to the end', () => {
            const res = bringToFront(items, ['item-1']);
            const idsInOrder = res.map(i => i.id);
            expect(idsInOrder).toEqual(['item-0', 'item-2', 'item-3', 'item-1']);
        });

        it('sendBackward moves target item one step backward', () => {
            const res = sendBackward(items, ['item-2']);
            const idsInOrder = res.map(i => i.id);
            expect(idsInOrder).toEqual(['item-0', 'item-2', 'item-1', 'item-3']);
        });

        it('sendToBack moves target item to the start', () => {
            const res = sendToBack(items, ['item-2']);
            const idsInOrder = res.map(i => i.id);
            expect(idsInOrder).toEqual(['item-2', 'item-0', 'item-1', 'item-3']);
        });
    });

    describe('Grouping & Ungrouping', () => {
        it('assigns common groupId on grouping and removes on ungrouping', () => {
            const items = [
                createMockItem('i1', 0),
                createMockItem('i2', 1),
                createMockItem('i3', 2),
            ];

            const grouped = groupCanvasItems(items, ['i1', 'i2'], 'group-abc');
            expect(grouped.find(i => i.id === 'i1')?.groupId).toBe('group-abc');
            expect(grouped.find(i => i.id === 'i2')?.groupId).toBe('group-abc');
            expect(grouped.find(i => i.id === 'i3')?.groupId).toBeUndefined();

            const ungrouped = ungroupCanvasItems(grouped, ['i1']);
            expect(ungrouped.find(i => i.id === 'i1')?.groupId).toBeUndefined();
            expect(ungrouped.find(i => i.id === 'i2')?.groupId).toBe('group-abc');
        });
    });

    describe('Flatten to Path', () => {
        it('flattens a shape into an editable vector path with nodes', () => {
            const shapeItem = createMockItem('shape-1', 0, {
                shape: { shapeType: 'rect' }
            });

            const updates = flattenShapeToPath(shapeItem);
            expect(updates.type).toBe('path');
            expect(updates.path?.nodes).toBeDefined();
            expect(updates.path?.nodes.length).toBeGreaterThanOrEqual(4);
            expect(updates.path?.isClosed).toBe(true);
            expect(updates.shape).toBeUndefined();
        });
    });
});
