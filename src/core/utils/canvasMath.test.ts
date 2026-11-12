import { describe, it, expect } from 'vitest';
import { calculateSmartSnap } from './canvasMath';

describe('calculateSmartSnap', () => {
    describe('Horizontal snapping (X axis)', () => {
        it('snaps item center to slide center (50%)', () => {
            // item w=20, center=49.5 when x=39.5 -> snaps to x=40 (center 50)
            const result = calculateSmartSnap(39.5, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(40);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item left edge to slide center (50%)', () => {
            // item w=20, left=49.6 -> snaps left to 50
            const result = calculateSmartSnap(49.6, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(50);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item right edge to slide center (50%)', () => {
            // item w=20, right=50.4 when x=30.4 -> snaps right to 50 (x=30)
            const result = calculateSmartSnap(30.4, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(30);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item left edge to safe margin (5%)', () => {
            const result = calculateSmartSnap(5.5, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(5);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 5, type: 'safe-margin' })
                ])
            );
        });

        it('snaps item right edge to safe margin (95%)', () => {
            // item w=30, right=94.5 when x=64.5 -> snaps right to 95 (x=65)
            const result = calculateSmartSnap(64.5, 20, 30, 10, [], 1.2);
            expect(result.snappedX).toBe(65);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 95, type: 'safe-margin' })
                ])
            );
        });

        it('snaps item left edge to slide boundary (0%)', () => {
            const result = calculateSmartSnap(0.8, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(0);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 0, type: 'slide-edge' })
                ])
            );
        });

        it('snaps item right edge to slide boundary (100%)', () => {
            // item w=20, right=99.3 when x=79.3 -> snaps to x=80
            const result = calculateSmartSnap(79.3, 20, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(80);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 100, type: 'slide-edge' })
                ])
            );
        });
    });

    describe('Vertical snapping (Y axis)', () => {
        it('snaps item center to slide center (50%)', () => {
            const result = calculateSmartSnap(20, 44.4, 20, 10, [], 1.2);
            expect(result.snappedY).toBe(45);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item top edge to safe margin (5%)', () => {
            const result = calculateSmartSnap(20, 5.6, 20, 10, [], 1.2);
            expect(result.snappedY).toBe(5);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 5, type: 'safe-margin' })
                ])
            );
        });

        it('snaps item bottom edge to safe margin (95%)', () => {
            // item h=10, bottom=95.5 when y=85.5 -> snaps to y=85
            const result = calculateSmartSnap(20, 85.5, 20, 10, [], 1.2);
            expect(result.snappedY).toBe(85);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 95, type: 'safe-margin' })
                ])
            );
        });

        it('snaps item top edge to slide boundary (0%) and bottom edge to (100%)', () => {
            const resTop = calculateSmartSnap(20, 0.5, 20, 10, [], 1.2);
            expect(resTop.snappedY).toBe(0);

            const resBottom = calculateSmartSnap(20, 89.6, 20, 10, [], 1.2);
            expect(resBottom.snappedY).toBe(90);
        });
    });

    describe('Snapping against neighboring items', () => {
        const otherItem = {
            id: 'other-1',
            x: 20,
            y: 30,
            width: 40, // right = 60, center = 40
            height: 20, // bottom = 50, center = 40
        };

        it('snaps left edge to other item right edge (flush snapping)', () => {
            // other right is 60. dragged left is 59.5 -> snaps left to 60
            const result = calculateSmartSnap(59.5, 70, 15, 10, [otherItem], 1.2);
            expect(result.snappedX).toBe(60);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 60, type: 'item-edge' })
                ])
            );
        });

        it('snaps top edge to other item bottom edge', () => {
            // other bottom is 50, but let's test a non-center bottom like 35 to verify item-edge
            const customOther = { id: 'other-2', x: 20, y: 15, width: 40, height: 20 }; // bottom = 35
            const result = calculateSmartSnap(70, 35.6, 15, 10, [customOther], 1.2);
            expect(result.snappedY).toBe(35);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 35, type: 'item-edge' })
                ])
            );
        });
    });

    describe('Threshold check', () => {
        it('does not snap when distance exceeds threshold', () => {
            const result = calculateSmartSnap(12, 12, 20, 10, [], 1.2);
            expect(result.snappedX).toBe(12);
            expect(result.guides).toHaveLength(0);
        });
    });

    describe('Pivot-aware snapping (50% center anchor, visual bounding box match)', () => {
        it('snaps item center to slide center (50%) when item is centered (pivot=50%)', () => {
            // item x=49.6, w=20, pivot=50% -> center is 49.6 -> snaps to x=50
            const result = calculateSmartSnap(49.6, 20, 20, 10, [], 1.2, 50, 50);
            expect(result.snappedX).toBe(50);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item left edge to slide center (50%) when pivot=50%', () => {
            // item w=20, left edge is 59.5 - 10 = 49.5 -> snaps left edge to 50 -> snappedX = 60
            const result = calculateSmartSnap(59.5, 20, 20, 10, [], 1.2, 50, 50);
            expect(result.snappedX).toBe(60);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });

        it('snaps item bottom edge to slide center (50%) when pivot=50%', () => {
            // item h=20, bottom edge is 40.5 + 10 = 50.5 -> snaps bottom to 50 -> snappedY = 40
            const result = calculateSmartSnap(20, 40.5, 20, 20, [], 1.2, 50, 50);
            expect(result.snappedY).toBe(40);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 50, type: 'slide-center' })
                ])
            );
        });
    });

    describe('Snapping against user custom guides', () => {
        const customGuides = [
            { id: 'g-v1', orientation: 'vertical' as const, positionPct: 33.3 },
            { id: 'g-h1', orientation: 'horizontal' as const, positionPct: 66.7 },
        ];

        it('snaps item center to vertical custom guide', () => {
            const result = calculateSmartSnap(33.0, 10, 10, 10, [], 1.2, 50, 50, customGuides);
            expect(result.snappedX).toBe(33.3);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 33.3, type: 'custom-guide' })
                ])
            );
        });

        it('snaps item top edge to horizontal custom guide', () => {
            // item h=20, pivot=50%, y=76.2 -> top edge = 66.2 -> snaps to 66.7 -> y = 76.7
            const result = calculateSmartSnap(10, 76.2, 10, 20, [], 1.2, 50, 50, customGuides);
            expect(result.snappedY).toBe(76.7);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'horizontal', positionPct: 66.7, type: 'custom-guide' })
                ])
            );
        });
    });

    describe('Grid snapping (gridSnapPct)', () => {
        it('snaps item left and top edges to nearest grid intervals when no other guides match', () => {
            // item at x=10.4, y=20.3, width=20, height=10, gridSnapPct=2 (top-left pivot 0, 0)
            const result = calculateSmartSnap(10.4, 20.3, 20, 10, [], 1.2, 0, 0, undefined, 2);
            expect(result.snappedX).toBe(10);
            expect(result.snappedY).toBe(20);
            expect(result.guides).toHaveLength(0);
        });

        it('preserves center pivot calculation when snapping bounds to grid', () => {
            // item w=20, h=10, pivot 50, 50. x=25.2 -> left=15.2 -> nearest 2% grid = 16 -> snappedX = 26
            // y=31.1 -> top=26.1 -> nearest 2% grid = 26 -> snappedY = 31
            const result = calculateSmartSnap(25.2, 31.1, 20, 10, [], 1.2, 50, 50, undefined, 2);
            expect(result.snappedX).toBe(26);
            expect(result.snappedY).toBe(31);
            expect(result.guides).toHaveLength(0);
        });

        it('gives precedence to smart guides over grid snapping', () => {
            // item near slide center (49.6%) with gridSnapPct=5
            // Slide center (50%) is closer and produces a guide
            const result = calculateSmartSnap(49.6, 20, 20, 10, [], 1.2, 0, 0, undefined, 5);
            expect(result.snappedX).toBe(50);
            expect(result.guides).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ orientation: 'vertical', positionPct: 50, type: 'slide-center' })
                ])
            );
        });
    });
});
