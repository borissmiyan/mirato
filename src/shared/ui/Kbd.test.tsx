import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from './Kbd';

describe('Kbd', () => {
  it('renders children correctly', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('applies custom size and className', () => {
    const { container } = render(<Kbd size="xs" className="extra-class">Esc</Kbd>);
    const el = container.querySelector('kbd');
    expect(el).toHaveClass('extra-class');
    expect(el).toHaveClass('text-[9px]');
  });
});
