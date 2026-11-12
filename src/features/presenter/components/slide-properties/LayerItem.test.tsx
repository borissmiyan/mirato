import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LayerItem } from './LayerItem';
import { IStyleLayer } from '@/core/types/style';

// Mock dnd-kit sortable to avoid wrapping in DndContext in isolation
vi.mock('@dnd-kit/sortable', () => ({
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
    }),
}));

vi.mock('../slide-properties/BackgroundPicker', () => ({
    BackgroundPicker: () => <div data-testid="mock-background-picker" />,
}));

vi.mock('../display/SlideBackground', () => ({
    SlideBackground: () => <div data-testid="mock-slide-background" />,
}));

describe('LayerItem', () => {
    const mockLayer: IStyleLayer = {
        id: 'layer-1',
        type: 'color',
        color: '#ff0000',
        opacity: 0.8,
        visible: true,
        blendMode: 'normal',
    };

    const mockOnUpdate = vi.fn();
    const mockOnRemove = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock setPointerCapture and releasePointerCapture
        HTMLElement.prototype.setPointerCapture = vi.fn();
        HTMLElement.prototype.releasePointerCapture = vi.fn();
    });

    it('renders layer opacity and handles direct text entry', () => {
        render(
            <LayerItem
                layer={mockLayer}
                index={0}
                total={1}
                onUpdate={mockOnUpdate}
                onRemove={mockOnRemove}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('80% ');

        fireEvent.change(input, { target: { value: '50' } });
        fireEvent.blur(input);

        expect(mockOnUpdate).toHaveBeenCalledWith({ opacity: 0.5 });
    });

    it('scrubs opacity horizontally on pointer drag with capture', () => {
        render(
            <LayerItem
                layer={mockLayer}
                index={0}
                total={1}
                onUpdate={mockOnUpdate}
                onRemove={mockOnRemove}
            />
        );

        const input = screen.getByRole('textbox');
        const scrubContainer = input.parentElement!;

        // 1. Pointer Down
        fireEvent.pointerDown(scrubContainer, {
            clientX: 100,
            clientY: 100,
            pointerId: 1,
        });
        expect(scrubContainer.setPointerCapture).toHaveBeenCalledWith(1);

        // 2. Drag > 3px (e.g. +10px) -> triggers scrubbing
        fireEvent.pointerMove(scrubContainer, {
            clientX: 110,
            clientY: 100,
            pointerId: 1,
        });

        // Opacity should have adjusted: 80 + 10 = 90%
        expect(mockOnUpdate).toHaveBeenCalledWith({ opacity: 0.9 });

        // 3. Pointer Up cleans up
        fireEvent.pointerUp(scrubContainer, {
            clientX: 110,
            clientY: 100,
            pointerId: 1,
        });
        expect(scrubContainer.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('focuses and selects input on click without drag (< 3px)', () => {
        render(
            <LayerItem
                layer={mockLayer}
                index={0}
                total={1}
                onUpdate={mockOnUpdate}
                onRemove={mockOnRemove}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        const scrubContainer = input.parentElement!;
        const focusSpy = vi.spyOn(input, 'focus');
        const selectSpy = vi.spyOn(input, 'select');

        // Click with 1px movement (< 3px threshold)
        fireEvent.pointerDown(scrubContainer, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(scrubContainer, { clientX: 101, pointerId: 1 });
        fireEvent.pointerUp(scrubContainer, { clientX: 101, pointerId: 1 });

        expect(focusSpy).toHaveBeenCalled();
        expect(selectSpy).toHaveBeenCalled();
    });
});

