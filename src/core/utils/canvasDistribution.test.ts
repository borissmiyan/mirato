import { describe, it, expect } from 'vitest';
import { calculateDistribution, checkItemIntersectsBox, calculateAlignment, flipCanvasItems } from './canvasDistribution';

describe('canvasDistribution', () => {
    describe('checkItemIntersectsBox', () => {
        it('returns true when item intersects the box', () => {
            const item = { x: 50, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const box = { left: 30, top: 30, right: 60, bottom: 60 };
            expect(checkItemIntersectsBox(item, box)).toBe(true);
        });

        it('returns false when item is outside the box', () => {
            const item = { x: 10, y: 10, width: 10, height: 10, pivotX: 50, pivotY: 50 };
            const box = { left: 40, top: 40, right: 80, bottom: 80 };
            expect(checkItemIntersectsBox(item, box)).toBe(false);
        });
    });

    describe('calculateDistribution', () => {
        it('returns empty array when fewer than 3 items', () => {
            const items = [
                { id: '1', x: 10, y: 10, width: 10, height: 10 },
                { id: '2', x: 50, y: 10, width: 10, height: 10 },
            ];
            expect(calculateDistribution(items, 'horizontal')).toEqual([]);
        });

        it('distributes 3 items horizontally with equal gaps', () => {
            // 3 items with width 10 each, pivot 0
            // Item 1: left 0, right 10
            // Item 2: currently at left 20 (gap 10), right 30
            // Item 3: left 50, right 60
            // Total span: 0 to 60 = 60. Items width = 30. Available gap = 30 / 2 = 15.
            // Expected Item 2 left: 10 + 15 = 25.
            const items = [
                { id: '1', x: 0, y: 10, width: 10, height: 10, pivotX: 0, pivotY: 0 },
                { id: '2', x: 20, y: 10, width: 10, height: 10, pivotX: 0, pivotY: 0 },
                { id: '3', x: 50, y: 10, width: 10, height: 10, pivotX: 0, pivotY: 0 },
            ];
            const updates = calculateDistribution(items, 'horizontal');
            expect(updates).toHaveLength(1);
            expect(updates[0]).toEqual({ id: '2', updates: { x: 25 } });
        });

        it('distributes 3 items vertically with equal gaps', () => {
            const items = [
                { id: '1', x: 10, y: 0, width: 10, height: 10, pivotX: 0, pivotY: 0 },
                { id: '2', x: 10, y: 20, width: 10, height: 10, pivotX: 0, pivotY: 0 },
                { id: '3', x: 10, y: 60, width: 10, height: 10, pivotX: 0, pivotY: 0 },
            ];
            // Total span = 70. Items height = 30. Gap = 40 / 2 = 20.
            // Item 2 top = 10 + 20 = 30.
            const updates = calculateDistribution(items, 'vertical');
            expect(updates).toHaveLength(1);
            expect(updates[0]).toEqual({ id: '2', updates: { y: 30 } });
        });
    });

    describe('calculateAlignment', () => {
        const itemA = { id: 'a', x: 20, y: 10, width: 20, height: 10, pivotX: 50, pivotY: 50 }; // left 10, right 30, top 5, bottom 15
        const itemB = { id: 'b', x: 60, y: 40, width: 20, height: 20, pivotX: 50, pivotY: 50 }; // left 50, right 70, top 30, bottom 50

        it('aligns items to the left edge', () => {
            const res = calculateAlignment([itemA, itemB], 'left');
            // minLeft = 10. Item B width = 20 -> center x should be 10 + 10 = 20
            expect(res.find(r => r.id === 'b')?.updates.x).toBe(20);
        });

        it('aligns items to the horizontal center', () => {
            const res = calculateAlignment([itemA, itemB], 'center-h');
            // minLeft = 10, maxRight = 70 -> center = 40.
            expect(res.find(r => r.id === 'a')?.updates.x).toBe(40);
            expect(res.find(r => r.id === 'b')?.updates.x).toBe(40);
        });

        it('aligns items to the top edge', () => {
            const res = calculateAlignment([itemA, itemB], 'top');
            // minTop = 5. Item B height = 20 -> center y should be 5 + 10 = 15
            expect(res.find(r => r.id === 'b')?.updates.y).toBe(15);
        });

        it('aligns group as a whole relative to canvas when relativeToCanvas is true', () => {
            // Group span: left 10 to right 70 (width 60). Canvas is 0-100.
            // Left align to canvas: group left should become 0. deltaX = -10.
            const resLeft = calculateAlignment([itemA, itemB], 'left', true);
            expect(resLeft.find(r => r.id === 'a')?.updates.x).toBe(10);
            expect(resLeft.find(r => r.id === 'b')?.updates.x).toBe(50);

            // Center-h align to canvas: group center = 40. Target = 50. deltaX = +10.
            const resCenter = calculateAlignment([itemA, itemB], 'center-h', true);
            expect(resCenter.find(r => r.id === 'a')?.updates.x).toBe(30);
            expect(resCenter.find(r => r.id === 'b')?.updates.x).toBe(70);

            // Right align to canvas: group right = 70. Target = 100. deltaX = +30.
            const resRight = calculateAlignment([itemA, itemB], 'right', true);
            expect(resRight.find(r => r.id === 'a')?.updates.x).toBe(50);
            expect(resRight.find(r => r.id === 'b')?.updates.x).toBe(90);
        });
    });

    describe('flipCanvasItems', () => {
        const item1 = { id: '1', x: 20, y: 10, width: 20, height: 10, rotation: 30, pivotX: 50, pivotY: 50 }; // center x=20
        const item2 = { id: '2', x: 60, y: 30, width: 20, height: 20, rotation: 0, pivotX: 50, pivotY: 50 };  // center x=60

        it('flips single item in place', () => {
            const resH = flipCanvasItems([item1], 'horizontal');
            expect(resH[0]).toEqual({ id: '1', updates: { rotation: 330 } });

            const resV = flipCanvasItems([item1], 'vertical');
            expect(resV[0]).toEqual({ id: '1', updates: { rotation: 150 } });
        });

        it('flips group horizontally across central axis', () => {
            // Group center X = (10 + 70) / 2 = 40.
            // item1 center 20 -> reflected = 40 + (40 - 20) = 60.
            // item2 center 60 -> reflected = 40 + (40 - 60) = 20.
            const res = flipCanvasItems([item1, item2], 'horizontal');
            expect(res.find(r => r.id === '1')?.updates.x).toBe(60);
            expect(res.find(r => r.id === '1')?.updates.rotation).toBe(330);
            expect(res.find(r => r.id === '2')?.updates.x).toBe(20);
            expect(res.find(r => r.id === '2')?.updates.rotation).toBe(0);
        });

        it('flips group vertically across central axis', () => {
            // item1 top 5, bottom 15 -> center y = 10
            // item2 top 20, bottom 40 -> center y = 30
            // Group bounds top 5, bottom 40 -> center Y = 22.5.
            // item1 center 10 -> reflected = 22.5 + (22.5 - 10) = 35.
            // item2 center 30 -> reflected = 22.5 + (22.5 - 30) = 15.
            const res = flipCanvasItems([item1, item2], 'vertical');
            expect(res.find(r => r.id === '1')?.updates.y).toBe(35);
            expect(res.find(r => r.id === '1')?.updates.rotation).toBe(150);
            expect(res.find(r => r.id === '2')?.updates.y).toBe(15);
            expect(res.find(r => r.id === '2')?.updates.rotation).toBe(180);
        });
    });
});

