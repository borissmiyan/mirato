import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaItemCard } from './MediaItemCard';
import { IMediaItem } from '@/core/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: string) => def || key,
  }),
}));

vi.mock('@/core/hooks/useMediaUrl', () => ({
  useMediaUrl: vi.fn(() => 'blob:http://localhost/test-url'),
}));

describe('MediaItemCard', () => {
  const mockItem: IMediaItem = {
    id: 'item-1',
    name: 'Worship-Song.mp3',
    path: '/path/to/Worship-Song.mp3',
    type: 'audio',
    createdAt: Date.now(),
  };

  it('renders item name and triggers onDoubleClick on double click', () => {
    const onDoubleClick = vi.fn();
    const onSelect = vi.fn();

    render(
      <MediaItemCard
        item={mockItem}
        isSelected={false}
        isPlaying={false}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        onDragStart={vi.fn()}
        onContextMenu={vi.fn()}
        onTogglePlayback={vi.fn()}
        onPlaybackEnded={vi.fn()}
        videoRefs={{ current: {} }}
        onTimeUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Worship-Song.mp3')).toBeDefined();

    const card = screen.getByText('Worship-Song.mp3').closest('.group');
    expect(card).toBeDefined();

    if (card) {
      fireEvent.doubleClick(card);
      expect(onDoubleClick).toHaveBeenCalledWith(mockItem);
    }
  });
});
