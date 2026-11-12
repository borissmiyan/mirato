import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Tooltip } from './Tooltip';

describe('Tooltip Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children without showing tooltip initially', () => {
    render(
      <Tooltip content="Helper text">
        <button type="button">Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip after mouseEnter and delay', () => {
    render(
      <Tooltip content="Helper text" delay={200}>
        <button type="button">Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button.parentElement!);

    // Initially still hidden before delay expires
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Fast-forward past delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Helper text')).toBeInTheDocument();
  });

  it('hides tooltip on mouseLeave', () => {
    render(
      <Tooltip content="Helper text" delay={100}>
        <button type="button">Hover me</button>
      </Tooltip>
    );

    const container = screen.getByText('Hover me').parentElement!;
    fireEvent.mouseEnter(container);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(container);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not display tooltip when disabled is true', () => {
    render(
      <Tooltip content="Helper text" disabled delay={100}>
        <button type="button">Hover me</button>
      </Tooltip>
    );

    const container = screen.getByText('Hover me').parentElement!;
    fireEvent.mouseEnter(container);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
