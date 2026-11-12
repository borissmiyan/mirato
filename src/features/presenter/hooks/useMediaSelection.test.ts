import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaSelection } from './useMediaSelection';
import { IMediaItem } from '@/core/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: string) => def || key,
  }),
}));

vi.mock('@/core/store/modalStore', () => ({
  ModalType: { CONFIRM: 'CONFIRM' },
  useModalStore: vi.fn(() => ({
    openModal: vi.fn(),
  })),
}));

describe('useMediaSelection', () => {
  const mockItems: IMediaItem[] = [
    { id: '1', name: 'File 1', type: 'image', path: '/path/file1.png', createdAt: 100 },
    { id: '2', name: 'File 2', type: 'video', path: '/path/file2.mp4', createdAt: 200 },
    { id: '3', name: 'File 3', type: 'audio', path: '/path/file3.mp3', createdAt: 300 },
  ];

  it('selects an item on regular click and clears previous selection', () => {
    const { result } = renderHook(() => useMediaSelection(mockItems, true));

    act(() => {
      result.current.handleItemClick('1', { metaKey: false, ctrlKey: false, shiftKey: false } as any);
    });

    expect(result.current.selectedIds.has('1')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);

    act(() => {
      result.current.handleItemClick('2', { metaKey: false, ctrlKey: false, shiftKey: false } as any);
    });

    expect(result.current.selectedIds.has('1')).toBe(false);
    expect(result.current.selectedIds.has('2')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('toggles selection when meta/ctrl key is held', () => {
    const { result } = renderHook(() => useMediaSelection(mockItems, true));

    act(() => {
      result.current.handleItemClick('1', { metaKey: true, ctrlKey: false, shiftKey: false } as any);
    });
    act(() => {
      result.current.handleItemClick('2', { metaKey: true, ctrlKey: false, shiftKey: false } as any);
    });

    expect(result.current.selectedIds.has('1')).toBe(true);
    expect(result.current.selectedIds.has('2')).toBe(true);
    expect(result.current.selectedIds.size).toBe(2);

    act(() => {
      result.current.handleItemClick('1', { metaKey: true, ctrlKey: false, shiftKey: false } as any);
    });
    expect(result.current.selectedIds.has('1')).toBe(false);
    expect(result.current.selectedIds.has('2')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('selects all items on Cmd+A when isActive is true', () => {
    const { result } = renderHook(() => useMediaSelection(mockItems, true));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
    });

    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.selectedIds.has('1')).toBe(true);
    expect(result.current.selectedIds.has('2')).toBe(true);
    expect(result.current.selectedIds.has('3')).toBe(true);
  });

  it('clears selection on Escape when isActive is true', () => {
    const { result } = renderHook(() => useMediaSelection(mockItems, true));

    act(() => {
      result.current.handleItemClick('1', { metaKey: false, ctrlKey: false, shiftKey: false } as any);
    });
    expect(result.current.selectedIds.size).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.selectedIds.size).toBe(0);
  });

  it('does NOT trigger keyboard shortcuts when isActive is false (shortcut isolation)', () => {
    const { result } = renderHook(() => useMediaSelection(mockItems, false));

    act(() => {
      result.current.handleItemClick('1', { metaKey: false, ctrlKey: false, shiftKey: false } as any);
    });
    expect(result.current.selectedIds.size).toBe(1);

    // Cmd+A should NOT select all when mouse is outside the pool
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
    });
    expect(result.current.selectedIds.size).toBe(1);

    // Escape should NOT clear selection when mouse is outside the pool
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedIds.size).toBe(1);
  });
});

