import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IconButton } from './IconButton';

describe('IconButton Component', () => {
  it('renders with accessible label and title', () => {
    render(
      <IconButton
        icon={<span data-testid="icon" />}
        label="Play Media"
        onClick={vi.fn()}
      />
    );
    const btn = screen.getByRole('button', { name: 'Play Media' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', 'Play Media');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(
      <IconButton
        icon={<span />}
        label="Edit Item"
        onClick={handleClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('reflects active state styling', () => {
    const { rerender } = render(
      <IconButton
        icon={<span />}
        label="Bold"
        variant="ghost"
        active={false}
      />
    );
    expect(screen.getByRole('button', { name: 'Bold' })).not.toHaveClass('shadow-inner');

    rerender(
      <IconButton
        icon={<span />}
        label="Bold"
        variant="ghost"
        active={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass('shadow-inner');
  });
});
