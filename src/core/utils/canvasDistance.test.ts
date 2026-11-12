import { describe, it, expect } from 'vitest';
import {
    getItemBounds,
    getItemDOMBounds,
    getCompositeGroupItem,
    calculateCanvasEdgeDistances,
    calculateItemToItemDistances,
} from './canvasDistance';

describe('canvasDistance', () => {
    describe('getItemBounds', () => {
        it('calculates bounds with default 50% pivot', () => {
            const item = { x: 50, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const b = getItemBounds(item);
            expect(b.left).toBe(40);
            expect(b.right).toBe(60);
            expect(b.top).toBe(40);
            expect(b.bottom).toBe(60);
            expect(b.centerX).toBe(50);
            expect(b.centerY).toBe(50);
        });

        it('calculates bounds with top-left 0% pivot', () => {
            const item = { x: 10, y: 15, width: 20, height: 30, pivotX: 0, pivotY: 0 };
            const b = getItemBounds(item);
            expect(b.left).toBe(10);
            expect(b.right).toBe(30);
            expect(b.top).toBe(15);
            expect(b.bottom).toBe(45);
        });
    });

    describe('getItemDOMBounds', () => {
        it('falls back to getItemBounds when DOM element does not exist', () => {
            const item = { id: 'non-existent', x: 50, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const b = getItemDOMBounds(item);
            expect(b.left).toBe(40);
            expect(b.right).toBe(60);
            expect(b.top).toBe(40);
            expect(b.bottom).toBe(60);
        });

        it('measures exact visual percentage bounds when DOM elements exist', () => {
            const container = document.createElement('div');
            container.id = 'slide-canvas-container';
            container.getBoundingClientRect = () => ({
                left: 100,
                top: 50,
                right: 1100,
                bottom: 650,
                width: 1000,
                height: 600,
                x: 100,
                y: 50,
                toJSON: () => {},
            });
            document.body.appendChild(container);

            const visualEl = document.createElement('div');
            visualEl.id = 'visual-test-1';
            visualEl.getBoundingClientRect = () => ({
                left: 300,
                top: 200,
                right: 500,
                bottom: 350,
                width: 200,
                height: 150,
                x: 300,
                y: 200,
                toJSON: () => {},
            });
            document.body.appendChild(visualEl);

            const item = { id: 'test-1', x: 0, y: 0, width: 10, height: 10 };
            const b = getItemDOMBounds(item);

            // (300 - 100) / 1000 = 20%
            expect(b.left).toBe(20);
            // (500 - 100) / 1000 = 40%
            expect(b.right).toBe(40);
            // (200 - 50) / 600 = 25%
            expect(b.top).toBe(25);
            // (350 - 50) / 600 = 50%
            expect(b.bottom).toBe(50);
            expect(b.centerX).toBe(30);
            expect(b.centerY).toBe(37.5);

            document.body.removeChild(visualEl);
            document.body.removeChild(container);
        });
    });

    describe('calculateCanvasEdgeDistances', () => {
        it('calculates pixel distances to all four slide edges', () => {
            // item centered at (50, 50) with size 20x20
            // bounds: left 40, right 60, top 40, bottom 60
            // top dist: 40 * 10.8 = 432 px
            // bottom dist: 40 * 10.8 = 432 px
            // left dist: 40 * 19.2 = 768 px
            // right dist: 40 * 19.2 = 768 px
            const item = { x: 50, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const lines = calculateCanvasEdgeDistances(item);

            expect(lines).toHaveLength(4);
            const top = lines.find(l => l.id === 'edge-top')!;
            expect(top.distancePx).toBe(432);
            expect(top.orientation).toBe('vertical');
            expect(top.x1).toBe(50);
            expect(top.y1).toBe(0);
            expect(top.x2).toBe(50);
            expect(top.y2).toBe(40);

            const bottom = lines.find(l => l.id === 'edge-bottom')!;
            expect(bottom.distancePx).toBe(432);
            expect(bottom.orientation).toBe('vertical');
            expect(bottom.x1).toBe(50);
            expect(bottom.y1).toBe(60);
            expect(bottom.x2).toBe(50);
            expect(bottom.y2).toBe(100);

            const left = lines.find(l => l.id === 'edge-left')!;
            expect(left.distancePx).toBe(768);
            expect(left.orientation).toBe('horizontal');
            expect(left.x1).toBe(0);
            expect(left.y1).toBe(50);
            expect(left.x2).toBe(40);
            expect(left.y2).toBe(50);

            const right = lines.find(l => l.id === 'edge-right')!;
            expect(right.distancePx).toBe(768);
            expect(right.orientation).toBe('horizontal');
            expect(right.x1).toBe(60);
            expect(right.y1).toBe(50);
            expect(right.x2).toBe(100);
            expect(right.y2).toBe(50);
        });

        it('calculates full distance to canvas edges without colliding with intermediate items', () => {
            // Selected item: centered at (50, 50), w=20, h=20 -> left 40, right 60
            // Intermediate item to left: centered at (20, 50), w=20, h=20 -> left 10, right 30
            // Canvas edge distance should cleanly reach 0% (768 px), not stopping at the intermediate item
            const item = { id: 'item-1', x: 50, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const intermediateLeft = { id: 'item-2', x: 20, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50, visible: true };

            const lines = calculateCanvasEdgeDistances(item, [intermediateLeft]);
            const leftLine = lines.find(l => l.id === 'edge-left')!;

            expect(leftLine.distancePx).toBe(768);
            expect(leftLine.x1).toBe(0); // Starts at canvas left edge (0%)
            expect(leftLine.x2).toBe(40); // Touches selected item left edge
        });
    });

    describe('calculateItemToItemDistances', () => {
        it('calculates horizontal gap between two adjacent items', () => {
            // Item A: center x=20, w=20 -> right=30
            // Item B: center x=60, w=20 -> left=50
            // Gap: 50 - 30 = 20% -> 20 * 19.2 = 384 px
            const itemA = { x: 20, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const itemB = { x: 60, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 };

            const lines = calculateItemToItemDistances(itemA, itemB);
            expect(lines).toHaveLength(1);
            expect(lines[0].id).toBe('gap-h');
            expect(lines[0].distancePx).toBe(384);
            expect(lines[0].x1).toBe(30);
            expect(lines[0].x2).toBe(50);
        });

        it('calculates vertical gap between stacked items', () => {
            // Item A: center y=20, h=20 -> bottom=30
            // Item B: center y=70, h=20 -> top=60
            // Gap: 60 - 30 = 30% -> 30 * 10.8 = 324 px
            const itemA = { x: 50, y: 20, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const itemB = { x: 50, y: 70, width: 20, height: 20, pivotX: 50, pivotY: 50 };

            const lines = calculateItemToItemDistances(itemA, itemB);
            expect(lines).toHaveLength(1);
            expect(lines[0].id).toBe('gap-v');
            expect(lines[0].distancePx).toBe(324);
        });

        it('calculates both horizontal and vertical gaps when diagonal', () => {
            const itemA = { x: 20, y: 20, width: 20, height: 20, pivotX: 50, pivotY: 50 };
            const itemB = { x: 70, y: 70, width: 20, height: 20, pivotX: 50, pivotY: 50 };

            const lines = calculateItemToItemDistances(itemA, itemB);
            expect(lines).toHaveLength(2);
            expect(lines.find(l => l.id === 'gap-h')).toBeDefined();
            expect(lines.find(l => l.id === 'gap-v')).toBeDefined();
        });
    });

    describe('getCompositeGroupItem', () => {
        it('returns the same item if single item provided', () => {
            const item = { id: 'item-1', x: 20, y: 30, width: 10, height: 10, pivotX: 50, pivotY: 50 } as any;
            const res = getCompositeGroupItem([item]);
            expect(res.id).toBe('item-1');
        });

        it('calculates unified bounding box spanning multiple items', () => {
            // Item 1: left=10, right=30, top=10, bottom=30
            const item1 = { id: 'item-1', x: 20, y: 20, width: 20, height: 20, pivotX: 50, pivotY: 50 } as any;
            // Item 2: left=40, right=60, top=30, bottom=70
            const item2 = { id: 'item-2', x: 50, y: 50, width: 20, height: 40, pivotX: 50, pivotY: 50 } as any;

            const group = getCompositeGroupItem([item1, item2]);
            expect(group.id).toBe('__group_selection__');
            expect(group.x).toBe(10);
            expect(group.y).toBe(10);
            expect(group.width).toBe(50); // right (60) - left (10) = 50
            expect(group.height).toBe(60); // bottom (70) - top (10) = 60
            expect(group.pivotX).toBe(0);
            expect(group.pivotY).toBe(0);

            const bounds = getItemBounds(group);
            expect(bounds.left).toBe(10);
            expect(bounds.right).toBe(60);
            expect(bounds.top).toBe(10);
            expect(bounds.bottom).toBe(70);
        });

        it('calculates edge distances from the outer edges of the group', () => {
            const item1 = { id: 'item-1', x: 30, y: 40, width: 20, height: 20, pivotX: 50, pivotY: 50 } as any;
            const item2 = { id: 'item-2', x: 60, y: 50, width: 20, height: 20, pivotX: 50, pivotY: 50 } as any;
            const group = getCompositeGroupItem([item1, item2]);

            // Group bounds: left=20, right=70, top=30, bottom=60
            const lines = calculateCanvasEdgeDistances(group, []);
            expect(lines).toHaveLength(4);

            const topLine = lines.find(l => l.id === 'edge-top');
            expect(topLine?.y1).toBe(0);
            expect(topLine?.y2).toBe(30);

            const leftLine = lines.find(l => l.id === 'edge-left');
            expect(leftLine?.x1).toBe(0);
            expect(leftLine?.x2).toBe(20);
        });
    });
});

