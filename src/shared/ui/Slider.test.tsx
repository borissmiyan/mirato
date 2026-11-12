import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';

describe('Slider Component', () => {
  it('renders track mode by default', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <Slider value={0.5} min={0} max={1} onChange={handleChange} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders block mode with 48px canon and displays label and formatted value', () => {
    const handleChange = vi.fn();
    render(
      <Slider
        mode="block"
        label="Opacity"
        value={80}
        min={0}
        max={100}
        unit="%"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('resets to defaultValue on double click in block mode', () => {
    const handleChange = vi.fn();
    render(
      <Slider
        mode="block"
        label="Zoom"
        value={150}
        min={50}
        max={200}
        defaultValue={100}
        onChange={handleChange}
      />
    );

    const blockSlider = screen.getByText('Zoom').closest('.space-y-2')?.querySelector('.cursor-pointer');
    expect(blockSlider).toBeInTheDocument();
    if (blockSlider) {
      fireEvent.doubleClick(blockSlider);
      expect(handleChange).toHaveBeenCalledWith(100);
    }
  });
});
