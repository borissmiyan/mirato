import { describe, it, expect } from 'vitest';
import { calculateAutoFit } from './canvasAutoFit';
import { ICanvasItem } from '@/core/types';

describe('calculateAutoFit', () => {
    const baseTextItem: ICanvasItem = {
        id: 'text-1',
        type: 'text',
        x: 20,
        y: 20,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        locked: false,
        visible: true,
        fills: [],
        strokes: [],
        text: {
            content: 'Hello World',
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: 24,
            resizingMode: 'fixed',
            alignHorizontal: 'left',
            alignVertical: 'top',
        },
    };

    it('returns null if item is locked or container dimensions are invalid', () => {
        expect(calculateAutoFit('middle-right', { ...baseTextItem, locked: true }, 100, 50, 1000, 600)).toBeNull();
        expect(calculateAutoFit('middle-right', baseTextItem, 100, 50, 0, 600)).toBeNull();
    });

    it('calculates auto-width for horizontal handles (middle-right)', () => {
        // container width 1000px, text scrollWidth 250px -> 25% width
        const result = calculateAutoFit('middle-right', baseTextItem, 250, 50, 1000, 600);
        expect(result).not.toBeNull();
        expect(result?.width).toBe(25);
        expect(result?.text?.resizingMode).toBe('auto-width');
    });

    it('calculates auto-height for vertical handles (bottom-center)', () => {
        // container height 600px, text scrollHeight 120px -> 20% height
        const result = calculateAutoFit('bottom-center', baseTextItem, 250, 120, 1000, 600);
        expect(result).not.toBeNull();
        expect(result?.height).toBe(20);
        expect(result?.text?.resizingMode).toBe('auto-height');
    });

    it('calculates both dimensions for corner handles (bottom-right)', () => {
        const result = calculateAutoFit('bottom-right', baseTextItem, 300, 180, 1000, 600);
        expect(result).not.toBeNull();
        expect(result?.width).toBe(30);
        expect(result?.height).toBe(30);
    });

    it('restores 16:9 aspect ratio for media items on corner handle double-click', () => {
        const mediaItem: ICanvasItem = {
            id: 'img-1',
            type: 'image',
            x: 10,
            y: 10,
            width: 40,
            height: 10, // distorted height
            rotation: 0,
            zIndex: 1,
            locked: false,
            visible: true,
            fills: [],
            strokes: [],
        };
        const result = calculateAutoFit('bottom-right', mediaItem, 400, 100, 1000, 600);
        expect(result).not.toBeNull();
        // 40% width * (9 / 16) = 22.5% height
        expect(result?.height).toBe(22.5);
    });
});
