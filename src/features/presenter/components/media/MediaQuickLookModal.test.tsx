import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaQuickLookModal } from './MediaQuickLookModal';
import { IMediaItem } from '@/core/types';
import { getDefaultStore } from 'jotai';
import { isQuickLookOpenAtom } from '@/core/store/uiAtoms';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: string) => def || key,
  }),
}));

vi.mock('@/core/hooks/useMediaUrl', () => ({
  useMediaUrl: vi.fn(() => 'blob:http://localhost/test-url'),
}));

describe('MediaQuickLookModal', () => {
  const mockItem: IMediaItem = {
    id: 'test-1',
    name: 'Background-Worship.jpg',
    path: '/path/to/Background-Worship.jpg',
    type: 'image',
    createdAt: Date.now(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MediaQuickLookModal
        item={mockItem}
        isOpen={false}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(getDefaultStore().get(isQuickLookOpenAtom)).toBe(false);
  });

  it('renders image preview and syncs isQuickLookOpenAtom when open', () => {
    render(
      <MediaQuickLookModal
        item={mockItem}
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        currentIndex={0}
        totalCount={5}
      />
    );

    expect(screen.getByText('Background-Worship.jpg')).toBeDefined();
    expect(screen.getByText('1 / 5')).toBeDefined();
    expect(getDefaultStore().get(isQuickLookOpenAtom)).toBe(true);
  });

  it('calls onNavigate with "next" on ArrowRight and "prev" on ArrowLeft', () => {
    const onNavigate = vi.fn();
    render(
      <MediaQuickLookModal
        item={mockItem}
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith('next');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith('prev');
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <MediaQuickLookModal
        item={mockItem}
        isOpen={true}
        onClose={onClose}
        onNavigate={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders video with circular Play button and without duplicate duration in footer', () => {
    const videoItem: IMediaItem = {
      id: 'vid-1',
      name: 'Promo.mp4',
      path: '/media/Promo.mp4',
      type: 'video',
      createdAt: Date.now(),
    };

    render(
      <MediaQuickLookModal
        item={videoItem}
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    const playBtn = screen.getByLabelText('Play');
    expect(playBtn).toBeDefined();
    expect(playBtn.className).toContain('rounded-full');
    expect(screen.getByText('MP4')).toBeDefined();
  });
});
