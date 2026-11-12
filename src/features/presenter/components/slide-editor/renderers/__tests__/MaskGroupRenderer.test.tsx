import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MaskGroupRenderer } from '../MaskGroupRenderer';
import { ICanvasItem } from '@/core/types';
import { IMaskGroupData } from '@/core/utils/canvasMasks';

function createMockItem(id: string, zIndex: number, overrides: Partial<ICanvasItem> = {}): ICanvasItem {
    return {
        id,
        type: 'shape',
        shape: { shapeType: 'circle' },
        x: 20,
        y: 20,
        width: 40,
        height: 40,
        rotation: 0,
        zIndex,
        locked: false,
        visible: true,
        fills: [],
        strokes: [],
        ...overrides,
    };
}

describe('MaskGroupRenderer', () => {
    it('renders null when maskGroups map is empty', () => {
        const { container } = render(<MaskGroupRenderer maskGroups={new Map()} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders SVG clipPath and masked container matching mask geometry', () => {
        const maskItem = createMockItem('mask-item-1', 1, {
            type: 'shape',
            shape: { shapeType: 'circle' },
            x: 20,
            y: 30,
            width: 40,
            height: 50,
        });

        const maskedChild = createMockItem('child-item-1', 2, {
            type: 'image',
            x: 10,
            y: 10,
            width: 80,
            height: 80,
        });

        const maskGroups = new Map<string, IMaskGroupData>([
            ['g-1', { maskItem, maskedItems: [maskedChild] }],
        ]);

        const { container } = render(<MaskGroupRenderer maskGroups={maskGroups} />);

        // Check SVG clipPath definition
        const clipPath = container.querySelector('#slide-mask-mask-item-1');
        expect(clipPath).not.toBeNull();
        expect(clipPath?.getAttribute('clipPathUnits')).toBe('userSpaceOnUse');

        // Check masked container
        const clipId = 'slide-mask-mask-item-1';
        const maskedContainer = container.querySelector(`[data-mask-group="g-1"]`) ||
            Array.from(container.querySelectorAll('div')).find(el => el.style.clipPath.includes(clipId));
        expect(maskedContainer).not.toBeNull();
    });

    it('renders vector bezier path mask correctly', () => {
        const maskItem = createMockItem('path-mask', 1, {
            type: 'path',
            path: {
                isClosed: true,
                nodes: [
                    { id: 'n1', x: 0, y: 0, handleOut: { x: 50, y: 0 } },
                    { id: 'n2', x: 100, y: 100, handleIn: { x: 50, y: 100 } },
                ],
            },
        });

        const child = createMockItem('child-1', 2);
        const maskGroups = new Map<string, IMaskGroupData>([
            ['g-2', { maskItem, maskedItems: [child] }],
        ]);

        const { container } = render(<MaskGroupRenderer maskGroups={maskGroups} />);
        const pathEl = container.querySelector('#slide-mask-path-mask path');
        expect(pathEl).not.toBeNull();
        expect(pathEl?.getAttribute('d')).toContain('C 50,0 50,100 100,100');
    });
});
