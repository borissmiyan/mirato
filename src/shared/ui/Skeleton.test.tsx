import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Skeleton } from './Skeleton';

describe('Skeleton Component', () => {
  it('renders with role="status" and default pulse styling', () => {
    render(<Skeleton className="w-20 h-5" />);
    const el = screen.getByRole('status');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('rounded-lg');
  });

  it('renders custom rounded corners and shimmer effect', () => {
    render(<Skeleton rounded="full" shimmer className="w-12 h-12" />);
    const el = screen.getByRole('status');
    expect(el).toHaveClass('rounded-full');
    expect(el).not.toHaveClass('animate-pulse');
  });
});
