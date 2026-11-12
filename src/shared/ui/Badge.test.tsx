import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Tag</Badge>);
    expect(screen.getByText('Test Tag')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Badge variant="accent">Accent Tag</Badge>);
    expect(container.firstChild).toHaveClass('text-accent');
  });

  it('renders dot indicator when enabled', () => {
    const { container } = render(<Badge dot>Active</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('handles onClick and renders as interactive element', () => {
    const handleClick = vi.fn();
    render(<Badge onClick={handleClick}>Clickable</Badge>);
    const badge = screen.getByRole('button');
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders remove button and handles onRemove', () => {
    const handleRemove = vi.fn();
    render(<Badge onRemove={handleRemove} removeLabel="Delete tag">Tag</Badge>);
    const removeBtn = screen.getByLabelText('Delete tag');
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });
});
