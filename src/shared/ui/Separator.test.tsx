import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Separator } from './Separator';

describe('Separator Component', () => {
  it('renders horizontal separator by default', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('renders vertical separator', () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('renders separator with label', () => {
    render(<Separator label="Or Continue With" />);
    expect(screen.getByText('Or Continue With')).toBeInTheDocument();
  });
});
