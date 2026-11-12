import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasPanAndMarquee } from '../useCanvasPanAndMarquee';

describe('useCanvasPanAndMarquee', () => {
  const containerRef = { current: document.createElement('div') };
  const getContainerRect = vi.fn(() => ({ left: 0, top: 0, width: 1000, height: 1000 }));
  const setOffset = vi.fn();
  const setSelectedIds = vi.fn();
  const setLatestArea = vi.fn();

  it('detects spacebar keydown to enable temporary pan mode', () => {
    const { result } = renderHook(() =>
      useCanvasPanAndMarquee({
        canvasTool: 'select',
        offset: { x: 0, y: 0 },
        setOffset,
        containerRef,
        getContainerRect,
        sortedItems: [],
        setSelectedIds,
        setLatestArea,
      })
    );

    expect(result.current.isSpaceHeld).toBe(false);

    // Press Space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(result.current.isSpaceHeld).toBe(true);

    // Release Space
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    });
    expect(result.current.isSpaceHeld).toBe(false);
  });
});

