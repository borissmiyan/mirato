import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Switch } from './Switch';

describe('Switch Component', () => {
  it('renders correctly with label', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Enable Feature" />);
    expect(screen.getByText('Enable Feature')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} label="Toggle Me" />);
    
    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('supports keyboard navigation via Space and Enter', () => {
    const handleChange = vi.fn();
    render(<Switch checked={true} onChange={handleChange} />);
    const switchEl = screen.getByRole('switch');

    fireEvent.keyDown(switchEl, { key: ' ' });
    expect(handleChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(switchEl, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('does not trigger onChange when disabled', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} disabled label="Disabled Switch" />);
    
    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
