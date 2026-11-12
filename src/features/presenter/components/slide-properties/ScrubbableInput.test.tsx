import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ScrubbableInput } from './ScrubbableInput';

// Mock presentation store
vi.mock('@/features/presenter/store/presentationStore', () => ({
    usePresentationStore: (selector: (s: any) => any) => {
        const state = {
            takeSnapshot: vi.fn(),
            previewSlideId: 'slide-1',
        };
        return selector ? selector(state) : state;
    },
}));

describe('ScrubbableInput', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        HTMLElement.prototype.setPointerCapture = vi.fn();
        HTMLElement.prototype.releasePointerCapture = vi.fn();
    });

    it('renders label and formatted value with design system standards', () => {
        render(
            <ScrubbableInput
                label="W"
                name="W"
                value={100}
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText('W')).toBeInTheDocument();
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('100');
        expect(input).toHaveClass('tabular-nums');
    });

    it('handles direct keyboard entry on blur', () => {
        render(
            <ScrubbableInput
                label="X"
                name="X"
                value={50}
                onChange={mockOnChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '75' } });
        fireEvent.blur(input);

        expect(mockOnChange).toHaveBeenCalledWith(75);
    });

    it('scrubs value on pointer drag >= 3px with pointer capture', () => {
        render(
            <ScrubbableInput
                label="X"
                name="X"
                value={50}
                step={1}
                onChange={mockOnChange}
            />
        );

        const input = screen.getByRole('textbox');
        const container = input.parentElement!;

        // 1. Pointer Down
        fireEvent.pointerDown(container, {
            clientX: 100,
            clientY: 100,
            pointerId: 1,
        });
        expect(container.setPointerCapture).toHaveBeenCalledWith(1);

        // 2. Drag > 3px (e.g. +10px) -> triggers scrubbing
        fireEvent.pointerMove(container, {
            clientX: 110,
            clientY: 100,
            pointerId: 1,
        });

        // 50 + 10 = 60
        expect(mockOnChange).toHaveBeenCalledWith(60);

        // 3. Pointer Up cleans up
        fireEvent.pointerUp(container, {
            clientX: 110,
            clientY: 100,
            pointerId: 1,
        });
        expect(container.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('focuses and selects input on click without drag (< 3px)', () => {
        render(
            <ScrubbableInput
                label="Y"
                name="Y"
                value={25}
                onChange={mockOnChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        const container = input.parentElement!;
        const focusSpy = vi.spyOn(input, 'focus');
        const selectSpy = vi.spyOn(input, 'select');

        // Click with 1px movement (< 3px threshold)
        fireEvent.pointerDown(container, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(container, { clientX: 101, pointerId: 1 });
        fireEvent.pointerUp(container, { clientX: 101, pointerId: 1 });

        expect(focusSpy).toHaveBeenCalled();
        expect(selectSpy).toHaveBeenCalled();
    });

    it('displays Mixed for mixed selection', () => {
        render(
            <ScrubbableInput
                label="W"
                value="mixed"
                onChange={mockOnChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('Mixed');
    });
});

