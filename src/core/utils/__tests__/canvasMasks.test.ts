import { describe, it, expect } from 'vitest';
import { ICanvasItem } from '@/core/types';
import {
    groupCanvasItems,
    ungroupCanvasItems,
    toggleCanvasMask,
    partitionMaskedItems,
} from '../canvasMasks';

function createMockItem(id: string, zIndex: number, overrides: Partial<ICanvasItem> = {}): ICanvasItem {
    return {
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
        fills: [],
        strokes: [],
        ...overrides,
    };
}

describe('canvasMasks utility', () => {
    describe('groupCanvasItems', () => {
        it('assigns common groupId to specified target items', () => {
            const items = [
                createMockItem('i1', 1),
                createMockItem('i2', 2),
                createMockItem('i3', 3),
            ];

            const grouped = groupCanvasItems(items, ['i1', 'i2'], 'group-1');
            expect(grouped.find(i => i.id === 'i1')?.groupId).toBe('group-1');
            expect(grouped.find(i => i.id === 'i2')?.groupId).toBe('group-1');
            expect(grouped.find(i => i.id === 'i3')?.groupId).toBeUndefined();
        });
    });

    describe('ungroupCanvasItems', () => {
        it('removes groupId and resets isMask for targeted items', () => {
            const items = [
                createMockItem('i1', 1, { groupId: 'group-1', isMask: true }),
                createMockItem('i2', 2, { groupId: 'group-1' }),
                createMockItem('i3', 3, { groupId: 'group-2' }),
            ];

            const ungrouped = ungroupCanvasItems(items, ['i1']);
            expect(ungrouped.find(i => i.id === 'i1')?.groupId).toBeUndefined();
            expect(ungrouped.find(i => i.id === 'i1')?.isMask).toBeUndefined();
            expect(ungrouped.find(i => i.id === 'i2')?.groupId).toBe('group-1');
            expect(ungrouped.find(i => i.id === 'i3')?.groupId).toBe('group-2');
        });
    });

    describe('toggleCanvasMask', () => {
        it('toggles isMask off if already active', () => {
            const items = [
                createMockItem('i1', 1, { groupId: 'g1', isMask: true }),
                createMockItem('i2', 2, { groupId: 'g1' }),
            ];

            const res = toggleCanvasMask(items, 'i1');
            expect(res.find(i => i.id === 'i1')?.isMask).toBe(false);
            expect(res.find(i => i.id === 'i1')?.groupId).toBe('g1');
        });

        it('automatically creates a group with the layer above when masking an ungrouped item', () => {
            const items = [
                createMockItem('i1', 1),
                createMockItem('i2', 2),
                createMockItem('i3', 3),
            ];

            const res = toggleCanvasMask(items, 'i1');
            const i1 = res.find(i => i.id === 'i1')!;
            const i2 = res.find(i => i.id === 'i2')!;
            const i3 = res.find(i => i.id === 'i3')!;

            expect(i1.isMask).toBe(true);
            expect(i1.groupId).toBeDefined();
            expect(i2.groupId).toBe(i1.groupId);
            expect(i3.groupId).toBeUndefined();
        });

        it('enables isMask on target item inside an existing group', () => {
            const items = [
                createMockItem('i1', 1, { groupId: 'existing-g' }),
                createMockItem('i2', 2, { groupId: 'existing-g' }),
            ];

            const res = toggleCanvasMask(items, 'i1');
            expect(res.find(i => i.id === 'i1')?.isMask).toBe(true);
            expect(res.find(i => i.id === 'i1')?.groupId).toBe('existing-g');
        });
    });

    describe('partitionMaskedItems', () => {
        it('separates regular items and mask groups correctly based on zIndex', () => {
            const mask = createMockItem('mask-1', 1, { groupId: 'g1', isMask: true });
            const child1 = createMockItem('child-1', 2, { groupId: 'g1' });
            const child2 = createMockItem('child-2', 3, { groupId: 'g1' });
            const regular = createMockItem('regular-1', 4);

            const result = partitionMaskedItems([mask, child1, child2, regular]);

            expect(result.regularItems.map(i => i.id)).toEqual(['regular-1']);
            expect(result.maskGroups.size).toBe(1);

            const group = result.maskGroups.get('g1')!;
            expect(group.maskItem.id).toBe('mask-1');
            expect(group.maskedItems.map(i => i.id)).toEqual(['child-1', 'child-2']);
        });

        it('does not mask items that have lower zIndex than the mask item', () => {
            const below = createMockItem('below', 1, { groupId: 'g1' });
            const mask = createMockItem('mask', 2, { groupId: 'g1', isMask: true });
            const above = createMockItem('above', 3, { groupId: 'g1' });

            const result = partitionMaskedItems([below, mask, above]);

            expect(result.regularItems.map(i => i.id)).toEqual(['below']);
            const group = result.maskGroups.get('g1')!;
            expect(group.maskItem.id).toBe('mask');
            expect(group.maskedItems.map(i => i.id)).toEqual(['above']);
        });
    });
});
