import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasDrawing } from '../useCanvasDrawing';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

describe('useCanvasDrawing', () => {
  const mockGetContainerRect = () => ({
    left: 100,
    top: 100,
    width: 1000,
    height: 500,
  });

  it('detects when an active drawing tool is selected', () => {
    const { result, rerender } = renderHook(
      ({ tool }) =>
        useCanvasDrawing({
          slideId: 's1',
          canvasTool: tool,
          setCanvasTool: vi.fn(),
          getContainerRect: mockGetContainerRect,
          setSelectedIds: vi.fn(),
          vectorEditingId: null,
          setVectorEditingId: vi.fn(),
          resolvedItems: [],
        }),
      { initialProps: { tool: 'select' } }
    );

    expect(result.current.isDrawingTool).toBe(false);

    rerender({ tool: 'shape:circle' });
    expect(result.current.isDrawingTool).toBe(true);

    rerender({ tool: 'line' });
    expect(result.current.isDrawingTool).toBe(true);

    rerender({ tool: 'pen' });
    expect(result.current.isDrawingTool).toBe(true);
  });

  it('creates a shape with proper bounds on drag-to-draw and resets to select', () => {
    const setCanvasTool = vi.fn();
    const setSelectedIds = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrawing({
        slideId: 's1',
        canvasTool: 'shape:triangle',
        setCanvasTool,
        getContainerRect: mockGetContainerRect,
        setSelectedIds,
        vectorEditingId: null,
        setVectorEditingId: vi.fn(),
        resolvedItems: [],
      })
    );

    const targetEl = document.createElement('div');
    targetEl.setPointerCapture = vi.fn();
    targetEl.releasePointerCapture = vi.fn();

    // 1. Pointer Down at 200, 200 (pct: 10%, 20%)
    act(() => {
      result.current.handleDrawingPointerDown({
        clientX: 200,
        clientY: 200,
        pointerId: 1,
        target: targetEl,
      } as any);
    });

    // 2. Pointer Move to 400, 300 (pct: 30%, 40%)
    act(() => {
      result.current.handleDrawingPointerMove({
        clientX: 400,
        clientY: 300,
      } as any);
    });

    expect(result.current.drawingPreview).toEqual({
      type: 'shape',
      shapeType: 'triangle',
      left: 10,
      top: 20,
      width: 20,
      height: 20,
    });

    // 3. Pointer Up
    act(() => {
      result.current.handleDrawingPointerUp({
        clientX: 400,
        clientY: 300,
        pointerId: 1,
        target: targetEl,
      } as any);
    });

    expect(result.current.drawingPreview).toBeNull();
    expect(setCanvasTool).toHaveBeenCalledWith('select');
    expect(setSelectedIds).toHaveBeenCalled();
  });

  it('creates a line on drag-to-draw and resets to select', () => {
    const setCanvasTool = vi.fn();
    const setSelectedIds = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrawing({
        slideId: 's1',
        canvasTool: 'line',
        setCanvasTool,
        getContainerRect: mockGetContainerRect,
        setSelectedIds,
        vectorEditingId: null,
        setVectorEditingId: vi.fn(),
        resolvedItems: [],
      })
    );

    const targetEl = document.createElement('div');
    targetEl.setPointerCapture = vi.fn();
    targetEl.releasePointerCapture = vi.fn();

    // 1. Pointer Down at 100, 100 (0%, 0%)
    act(() => {
      result.current.handleDrawingPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        target: targetEl,
      } as any);
    });

    // 2. Pointer Move to 300, 100 (20%, 0%)
    act(() => {
      result.current.handleDrawingPointerMove({
        clientX: 300,
        clientY: 100,
      } as any);
    });

    expect(result.current.drawingPreview).toEqual({
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 20,
      y2: 0,
    });

    // 3. Pointer Up
    act(() => {
      result.current.handleDrawingPointerUp({
        clientX: 300,
        clientY: 100,
        pointerId: 1,
        target: targetEl,
      } as any);
    });

    expect(setCanvasTool).toHaveBeenCalledWith('select');
  });

  it('interactively appends nodes for pen tool on canvas click', () => {
    const setCanvasTool = vi.fn();
    const setSelectedIds = vi.fn();
    const setVectorEditingId = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDrawing({
        slideId: 's1',
        canvasTool: 'pen',
        setCanvasTool,
        getContainerRect: mockGetContainerRect,
        setSelectedIds,
        vectorEditingId: null,
        setVectorEditingId,
        resolvedItems: [],
      })
    );

    const targetEl = document.createElement('div');

    // First click: creates initial path item
    act(() => {
      const handled = result.current.handleDrawingPointerDown({
        clientX: 200,
        clientY: 200,
        pointerId: 1,
        target: targetEl,
      } as any);
      expect(handled).toBe(true);
    });

    expect(setSelectedIds).toHaveBeenCalled();
    expect(setVectorEditingId).toHaveBeenCalled();
  });
});

