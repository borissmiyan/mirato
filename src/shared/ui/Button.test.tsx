import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { Button } from './Button';

describe('Button component', () => {
  it('renders with default size (md = 56px, p-4) and variant (secondary)', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn.className).toContain('h-14');
    expect(btn.className).toContain('p-4');
    expect(btn.className).toContain('bg-stone-900');
  });

  it('renders sm size (48px = h-12, p-3)', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: /small/i });
    expect(btn.className).toContain('h-12');
    expect(btn.className).toContain('p-3');
    expect(btn.className).toContain('rounded-lg');
  });

  it('renders lg size (64px = h-16, p-5)', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: /large/i });
    expect(btn.className).toContain('h-16');
    expect(btn.className).toContain('p-5');
    expect(btn.className).toContain('rounded-lg');
  });

  it('renders square icon button with equal 1:1 aspect ratio', () => {
    render(<Button size="sm" square aria-label="Icon Button"><Star className="w-4 h-4" /></Button>);
    const btn = screen.getByRole('button', { name: /icon button/i });
    expect(btn.className).toContain('w-12');
    expect(btn.className).toContain('h-12');
    expect(btn.className).toContain('p-3');
  });

  it('renders primary variant with accent styling', () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole('button', { name: /primary/i });
    expect(btn.className).toContain('bg-accent');
  });

  it('handles disabled state properly', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: /disabled/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('opacity-40');
  });

  it('applies Apple HIG tactile press effect (active:scale-[0.97]) and spring transition', () => {
    render(<Button variant="primary">Tactile Apple Button</Button>);
    const btn = screen.getByRole('button', { name: /tactile apple button/i });
    expect(btn.className).toContain('active:scale-[0.97]');
    expect(btn.className).toContain('will-change-transform');
    expect(btn.className).toContain('ease-[cubic-bezier(0.2,0.8,0.2,1)]');
  });
});

