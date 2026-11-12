import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PinInput } from './PinInput';

describe('PinInput Component', () => {
    it('renders the correct number of pin slots', () => {
        render(<PinInput value="" onChange={vi.fn()} length={4} />);
        const slots = screen.getAllByTestId(/^pin-slot-/);
        expect(slots).toHaveLength(4);
    });

    it('displays entered digits and placeholders correctly', () => {
        render(<PinInput value="48" onChange={vi.fn()} length={4} />);
        expect(screen.getByTestId('pin-slot-0')).toHaveTextContent('4');
        expect(screen.getByTestId('pin-slot-1')).toHaveTextContent('8');
        expect(screen.getByTestId('pin-slot-2')).toHaveTextContent('•');
        expect(screen.getByTestId('pin-slot-3')).toHaveTextContent('•');
    });

    it('filters out non-digit characters on change', () => {
        const handleChange = vi.fn();
        render(<PinInput value="" onChange={handleChange} length={4} />);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: '12ab34' } });
        expect(handleChange).toHaveBeenCalledWith('1234');
    });

    it('calls onComplete when length is reached', () => {
        const handleComplete = vi.fn();
        render(<PinInput value="" onChange={vi.fn()} onComplete={handleComplete} length={4} />);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: '1234' } });
        expect(handleComplete).toHaveBeenCalledWith('1234');
    });
});
