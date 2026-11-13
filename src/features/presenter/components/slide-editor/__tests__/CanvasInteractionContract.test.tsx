import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Provider } from 'jotai';
import SlideCanvas from '../SlideCanvas';
import { ICanvasItem } from '@/core/types';

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback?: string) => fallback || key,
        }),
    };
});

const mockItems: ICanvasItem[] = [
    {
        id: 'interactive-text-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 40,
        height: 10,
        zIndex: 1,
        visible: true,
        locked: false,
        rotation: 0,
        fills: [],
        strokes: [],
        text: {
            content: 'Interactive Worship Text',
            fontFamily: 'Inter',
            fontWeight: 'normal',
            fontSize: 28,
            lineHeight: 1.2,
            alignHorizontal: 'center',
            alignVertical: 'top',
            resizingMode: 'auto-height',
        },
    },
    {
        id: 'interactive-rect-1',
        type: 'shape',
        shape: {
            shapeType: 'rect',
        },
        x: 50,
        y: 50,
        width: 30,
        height: 30,
        zIndex: 2,
        visible: true,
        locked: false,
        rotation: 0,
        fills: [{ id: 'fill-1', type: 'color', color: '#ff0000', opacity: 1, visible: true, blendMode: 'normal' }],
        strokes: [],
    },
];

describe('CanvasInteractionContract (Behavioral Harness Invariants)', () => {
    it('dispatches pointer down on text element in Layer 2 without aborting', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas
                    slideId="slide-contract-1"
                    canvasItems={mockItems}
                />
            </Provider>
        );

        const textWrapper = container.querySelector('#item-interactive-text-1');
        expect(textWrapper).not.toBeNull();

        // Mouse down on the interactive container should not throw or abort
        expect(() => {
            fireEvent.mouseDown(textWrapper!, { clientX: 100, clientY: 100, button: 0 });
        }).not.toThrow();
    });

    it('ensures interaction layer contains selection handles when an item is clicked/selected', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas
                    slideId="slide-contract-2"
                    canvasItems={mockItems}
                />
            </Provider>
        );

        const rectWrapper = container.querySelector('#item-interactive-rect-1');
        expect(rectWrapper).not.toBeNull();

        // Clicking on the rectangle selects it in Jotai state
        fireEvent.mouseDown(rectWrapper!, { clientX: 50, clientY: 50, button: 0 });

        // Selection frame must now be present inside selected item container
        const selectionFrame = rectWrapper?.querySelector('[data-selection-frame]');
        expect(selectionFrame).not.toBeNull();
    });

    it('guarantees text item in Layer 2 has in-flow DOM content and is not empty', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas
                    slideId="slide-contract-3"
                    canvasItems={mockItems}
                />
            </Provider>
        );

        const textWrapper = container.querySelector('#item-interactive-text-1');
        expect(textWrapper).not.toBeNull();
        expect(textWrapper?.textContent).toContain('Interactive Worship Text');
    });
});
