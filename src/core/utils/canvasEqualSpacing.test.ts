import { describe, it, expect } from 'vitest';
import { detectEqualSpacing } from './canvasEqualSpacing';

describe('canvasEqualSpacing', () => {
    it('detects equal horizontal gaps between 3 sequential items', () => {
        // Item 1: x: 10, w: 10 -> right: 15 (pivot 50%: left 5, right 15)
        // Item 2: x: 25, w: 10 -> left: 20, right: 30. Gap 1 = 20 - 15 = 5%
        // Item 3: x: 40, w: 10 -> left: 35, right: 45. Gap 2 = 35 - 30 = 5%
        const item1 = { x: 10, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item2 = { x: 25, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item3 = { x: 40, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };

        const matches = detectEqualSpacing(item2, [item1, item3], 1.0);
        expect(matches.length).toBe(1);
        expect(matches[0].orientation).toBe('horizontal');
        expect(matches[0].gapPx).toBe(Math.round(5 * 19.2));
        expect(matches[0].segments.length).toBe(2);
    });

    it('detects equal vertical gaps between 3 stacked items', () => {
        // Stacked vertically with 10% gap
        const item1 = { x: 50, y: 10, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item2 = { x: 50, y: 30, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item3 = { x: 50, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };

        const matches = detectEqualSpacing(item2, [item1, item3], 1.0);
        expect(matches.length).toBe(1);
        expect(matches[0].orientation).toBe('vertical');
        expect(matches[0].gapPx).toBe(Math.round(10 * 10.8));
    });

    it('returns empty array when spacing is not equal', () => {
        const item1 = { x: 10, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item2 = { x: 20, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item3 = { x: 50, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };

        const matches = detectEqualSpacing(item2, [item1, item3], 1.0);
        expect(matches).toEqual([]);
    });

    it('does not trigger for unrelated items in completely different rows (preventing spurious badges)', () => {
        // Items in separate rows: top row, middle row, bottom row
        const item1 = { x: 10, y: 10, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item2 = { x: 25, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item3 = { x: 40, y: 90, width: 10, height: 10, pivotX: 50, pivotY: 50 };

        const matches = detectEqualSpacing(item2, [item1, item3], 1.0);
        expect(matches).toEqual([]);
    });

    it('does not trigger for accidental micro-gaps (< 8px)', () => {
        // Micro gap of ~0.2% = ~3.8px
        const item1 = { x: 10, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item2 = { x: 20.2, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };
        const item3 = { x: 30.4, y: 50, width: 10, height: 10, pivotX: 50, pivotY: 50 };

        const matches = detectEqualSpacing(item2, [item1, item3], 1.0);
        expect(matches).toEqual([]);
    });
});

