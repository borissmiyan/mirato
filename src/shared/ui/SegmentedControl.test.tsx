import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl Component', () => {
  const options = [
    { value: 'tab1', label: 'Overview' },
    { value: 'tab2', label: 'Details' },
    { value: 'tab3', label: 'Settings', disabled: true },
  ];

  it('renders all options', () => {
    render(<SegmentedControl options={options} value="tab1" onChange={vi.fn()} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks active option correctly', () => {
    render(<SegmentedControl options={options} value="tab1" onChange={vi.fn()} />);
    const activeRadio = screen.getByRole('radio', { name: 'Overview' });
    expect(activeRadio).toHaveAttribute('aria-checked', 'true');

    const inactiveRadio = screen.getByRole('radio', { name: 'Details' });
    expect(inactiveRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when clicking an inactive option', () => {
    const handleChange = vi.fn();
    render(<SegmentedControl options={options} value="tab1" onChange={handleChange} />);
    
    fireEvent.click(screen.getByRole('radio', { name: 'Details' }));
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });

  it('does not call onChange when clicking a disabled option', () => {
    const handleChange = vi.fn();
    render(<SegmentedControl options={options} value="tab1" onChange={handleChange} />);
    
    fireEvent.click(screen.getByRole('radio', { name: 'Settings' }));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
