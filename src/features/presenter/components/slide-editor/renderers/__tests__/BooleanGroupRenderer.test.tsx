import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BooleanGroupRenderer } from '../BooleanGroupRenderer';
import { ICanvasItem } from '@/core/types';
import { IBooleanGroupData } from '@/core/utils/canvasBooleanGroups';

function createMockItem(id: string, zIndex: number, overrides: Partial<ICanvasItem> = {}): ICanvasItem {
    return {
        id,
        type: 'shape',
        shape: { shapeType: 'rect' },
        x: 50,
        y: 50,
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

describe('BooleanGroupRenderer', () => {
    it('renders null when booleanGroups map is empty', () => {
        const { container } = render(<BooleanGroupRenderer booleanGroups={new Map()} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders SVG mask for subtract operation', () => {
        const baseItem = createMockItem('base-1', 1);
        const opItem = createMockItem('op-1', 2, { x: 60, y: 60, shape: { shapeType: 'circle' } });

        const groups = new Map<string, IBooleanGroupData>([
            ['bg-1', { groupId: 'bg-1', operation: 'subtract', baseItem, operatorItems: [opItem], allItems: [baseItem, opItem] }],
        ]);

        const { container } = render(<BooleanGroupRenderer booleanGroups={groups} />);

        const mask = container.querySelector('#boolean-mask-bg-1');
        expect(mask).not.toBeNull();
        expect(mask?.getAttribute('maskUnits')).toBe('userSpaceOnUse');

        const renderedContainer = container.querySelector('[data-boolean-group="bg-1"]');
        expect(renderedContainer).not.toBeNull();
    });

    it('renders SVG mask for intersect operation', () => {
        const baseItem = createMockItem('base-2', 1);
        const opItem = createMockItem('op-2', 2);

        const groups = new Map<string, IBooleanGroupData>([
            ['bg-2', { groupId: 'bg-2', operation: 'intersect', baseItem, operatorItems: [opItem], allItems: [baseItem, opItem] }],
        ]);

        const { container } = render(<BooleanGroupRenderer booleanGroups={groups} />);

        const mask = container.querySelector('#boolean-mask-bg-2');
        expect(mask).not.toBeNull();
        const rect = mask?.querySelector('rect');
        expect(rect?.getAttribute('fill')).toBe('#000000');
    });

    it('renders SVG mask for exclude operation with difference blend mode', () => {
        const baseItem = createMockItem('base-3', 1);
        const opItem = createMockItem('op-3', 2);

        const groups = new Map<string, IBooleanGroupData>([
            ['bg-3', { groupId: 'bg-3', operation: 'exclude', baseItem, operatorItems: [opItem], allItems: [baseItem, opItem] }],
        ]);

        const { container } = render(<BooleanGroupRenderer booleanGroups={groups} />);

        const mask = container.querySelector('#boolean-mask-bg-3');
        expect(mask).not.toBeNull();
    });
});
