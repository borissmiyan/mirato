import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationSelectorCard } from './NavigationSelectorCard';

describe('NavigationSelectorCard', () => {
  it('renders title, subtitle, and text badge correctly', () => {
    render(
      <NavigationSelectorCard
        title="БЫТИЕ"
        subtitle="ГЛАВА 1"
        badge="KJV"
      />
    );

    expect(screen.getByText('БЫТИЕ')).toBeInTheDocument();
    expect(screen.getByText('ГЛАВА 1')).toBeInTheDocument();
    expect(screen.getByText('KJV')).toBeInTheDocument();
  });

  it('renders icon badge and applies accent variant by default', () => {
    render(
      <NavigationSelectorCard
        title="111"
        subtitle="ЛОКАЛЬНЫЕ"
        badge={<span data-testid="icon-badge">icon</span>}
      />
    );

    expect(screen.getByTestId('icon-badge')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-14');
    expect(button).toHaveClass('rounded-2xl');
  });

  it('supports muted variant for empty/unselected state', () => {
    const { container } = render(
      <NavigationSelectorCard
        title="Select Presentation"
        subtitle="None Active"
        badge="+"
        badgeVariant="muted"
      />
    );

    const badgeContainer = container.querySelector('.bg-stone-800\\/80');
    expect(badgeContainer).toBeInTheDocument();
  });

  it('renders cover image when coverImageUrl is provided', () => {
    render(
      <NavigationSelectorCard
        title="ГИМНЫ НАДЕЖДЫ"
        subtitle="3 RU"
        coverImageUrl="https://example.com/cover.jpg"
      />
    );

    const img = screen.getByRole('img', { hidden: true });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('handles click and double click handlers', () => {
    const handleClick = vi.fn();
    const handleDoubleClick = vi.fn();

    render(
      <NavigationSelectorCard
        title="Test Title"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.doubleClick(button);
    expect(handleDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('applies open/active styling when isOpen is true', () => {
    render(
      <NavigationSelectorCard
        title="Active Menu"
        isOpen={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveClass('border-accent/60');
  });

  it('renders trailing slot content', () => {
    render(
      <NavigationSelectorCard
        title="Hymn Item"
        trailing={<span data-testid="live-tag">LIVE</span>}
      />
    );

    expect(screen.getByTestId('live-tag')).toBeInTheDocument();
  });
});
