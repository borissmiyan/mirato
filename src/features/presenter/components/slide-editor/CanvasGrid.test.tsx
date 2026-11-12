import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CanvasGrid } from './CanvasGrid';

describe('CanvasGrid component', () => {
    it('renders with GPU-accelerated dot pattern and pointer-events-none', () => {
        render(<CanvasGrid />);
        const grid = screen.getByTestId('canvas-dot-grid');
        expect(grid).toBeInTheDocument();
        expect(grid).toHaveClass('pointer-events-none');
        expect(grid.style.backgroundImage).toContain('radial-gradient');
        expect(grid.style.backgroundSize).toBe('24px 24px');
    });
});

