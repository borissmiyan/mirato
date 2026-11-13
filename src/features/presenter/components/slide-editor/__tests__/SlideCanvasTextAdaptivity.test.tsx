import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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

const mockSlideId = 'slide-123';

const mockTextItemAutoHeight: ICanvasItem = {
    id: 'text-auto-h',
    type: 'text',
    x: 20,
    y: 30,
    width: 60,
    height: 15,
    zIndex: 1,
    visible: true,
    locked: false,
    rotation: 0,
    fills: [],
    strokes: [],
    text: {
        content: 'Auto Height Dynamic Text Line 1<br>Line 2',
        fontFamily: 'Inter',
        fontWeight: 'normal',
        fontSize: 32,
        lineHeight: 1.4,
        alignHorizontal: 'center',
        alignVertical: 'middle',
        resizingMode: 'auto-height',
    },
};

const mockTextItemAutoWidth: ICanvasItem = {
    id: 'text-auto-w',
    type: 'text',
    x: 10,
    y: 10,
    width: 50,
    height: 10,
    zIndex: 2,
    visible: true,
    locked: false,
    rotation: 0,
    fills: [],
    strokes: [],
    text: {
        content: 'Auto Width Line',
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fontSize: 48,
        lineHeight: 1.2,
        alignHorizontal: 'left',
        alignVertical: 'top',
        resizingMode: 'auto-width',
    },
};

const mockShapeItem: ICanvasItem = {
    id: 'shape-rect',
    type: 'shape',
    x: 5,
    y: 5,
    width: 25,
    height: 25,
    zIndex: 0,
    visible: true,
    locked: false,
    rotation: 0,
    fills: [],
    strokes: [],
    shape: {
        shapeType: 'rect',
    },
};

describe('SlideCanvas Text Adaptivity & Bounding Box Contract', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders text content inside the interaction container item-${id} to ensure non-flat bounding box', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas slideId={mockSlideId} canvasItems={[mockTextItemAutoHeight]} />
            </Provider>
        );

        const interactiveItem = container.querySelector('#item-text-auto-h');
        expect(interactiveItem).toBeInTheDocument();

        // The interactive container must contain the rendered text content (in-flow)
        expect(interactiveItem?.textContent).toContain('Auto Height Dynamic Text Line 1');

        // Layer 1 (visual content) must NOT duplicate the text item
        const visualItem = container.querySelector('#visual-text-auto-h');
        expect(visualItem).toBeNull();

        // Check CSS sizing rules for auto-height
        const element = interactiveItem as HTMLElement;
        expect(element.style.width).toBe('60%');
        expect(element.style.height).toBe('max-content');
    });

    it('renders auto-width text with max-content for both width and height', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas slideId={mockSlideId} canvasItems={[mockTextItemAutoWidth]} />
            </Provider>
        );

        const interactiveItem = container.querySelector('#item-text-auto-w') as HTMLElement;
        expect(interactiveItem).toBeInTheDocument();
        expect(interactiveItem.textContent).toContain('Auto Width Line');
        expect(interactiveItem.style.width).toBe('max-content');
        expect(interactiveItem.style.height).toBe('max-content');
    });

    it('renders fixed size text with explicit percentages and inner alignment', () => {
        const mockTextItemFixed: ICanvasItem = {
            id: 'text-fixed-box',
            type: 'text',
            x: 15,
            y: 25,
            width: 45,
            height: 30,
            zIndex: 3,
            visible: true,
            locked: false,
            rotation: 0,
            fills: [],
            strokes: [],
            text: {
                content: 'Fixed Size Frame Text',
                fontFamily: 'Inter',
                fontWeight: 'normal',
                fontSize: 28,
                lineHeight: 1.5,
                alignHorizontal: 'right',
                alignVertical: 'bottom',
                resizingMode: 'fixed',
            },
        };

        const { container } = render(
            <Provider>
                <SlideCanvas slideId={mockSlideId} canvasItems={[mockTextItemFixed]} />
            </Provider>
        );

        const interactiveItem = container.querySelector('#item-text-fixed-box') as HTMLElement;
        expect(interactiveItem).toBeInTheDocument();
        expect(interactiveItem.textContent).toContain('Fixed Size Frame Text');
        expect(interactiveItem.style.width).toBe('45%');
        expect(interactiveItem.style.height).toBe('30%');

        // Not duplicated in Layer 1
        expect(container.querySelector('#visual-text-fixed-box')).toBeNull();
    });

    it('renders non-text shapes in Layer 1 with fixed percentage dimensions', () => {
        const { container } = render(
            <Provider>
                <SlideCanvas slideId={mockSlideId} canvasItems={[mockShapeItem]} />
            </Provider>
        );

        // Visual layer has the shape
        const visualShape = container.querySelector('#visual-shape-rect');
        expect(visualShape).toBeInTheDocument();

        // Interactive layer has the controls container with fixed dimensions
        const interactiveShape = container.querySelector('#item-shape-rect') as HTMLElement;
        expect(interactiveShape).toBeInTheDocument();
        expect(interactiveShape.style.width).toBe('25%');
        expect(interactiveShape.style.height).toBe('25%');
    });
});
