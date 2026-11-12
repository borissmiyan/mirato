import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaPoolInfoModal } from './MediaPoolInfoModal';
import { IMediaItem, IMediaBin } from '@/core/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defOrOpts?: any, opts?: any) => {
      const def = typeof defOrOpts === 'string' ? defOrOpts : key;
      const options = typeof defOrOpts === 'object' ? defOrOpts : opts;
      if (options && typeof def === 'string') {
        return Object.entries(options).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          def
        );
      }
      return def;
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

describe('MediaPoolInfoModal', () => {
  const mockItems: IMediaItem[] = [
    {
      id: 'item-1',
      name: 'sunset.jpg',
      path: '/media/sunset.jpg',
      type: 'image',
      fileSize: 1024 * 1024 * 2, // 2MB
      colorTag: 'red',
      createdAt: 1000,
    },
    {
      id: 'item-2',
      name: 'intro.mp4',
      path: '/media/intro.mp4',
      type: 'video',
      fileSize: 1024 * 1024 * 20, // 20MB
      colorTag: 'blue',
      createdAt: 2000,
    },
    {
      id: 'item-3',
      name: 'worship.mp3',
      path: '/media/worship.mp3',
      type: 'audio',
      fileSize: 1024 * 1024 * 5, // 5MB
      createdAt: 3000,
    },
  ];

  const mockBins: IMediaBin[] = [
    { id: 'bin-1', name: 'Backgrounds', createdAt: 1000 },
    { id: 'bin-2', name: 'Worship Songs', parentId: 'bin-1', createdAt: 2000 },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MediaPoolInfoModal
        isOpen={false}
        onClose={vi.fn()}
        mediaItems={mockItems}
        bins={mockBins}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with metrics and type breakdown when open', () => {
    render(
      <MediaPoolInfoModal
        isOpen={true}
        onClose={vi.fn()}
        mediaItems={mockItems}
        bins={mockBins}
      />
    );

    expect(screen.getByText('Media Pool Statistics')).toBeDefined();
    expect(screen.getByText('Total Files')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined(); // total items
    expect(screen.getByText('2')).toBeDefined(); // total bins
    expect(screen.getByText('27.0 MB')).toBeDefined(); // 2 + 20 + 5 MB
    expect(screen.getByText('100% OK')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <MediaPoolInfoModal
        isOpen={true}
        onClose={onClose}
        mediaItems={mockItems}
        bins={mockBins}
      />
    );

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('displays missing file warning when an asset is missing', () => {
    const itemsWithMissing: IMediaItem[] = [
      ...mockItems,
      {
        id: 'item-4',
        name: 'deleted.mp4',
        path: '/missing/deleted.mp4',
        type: 'video',
        isMissing: true,
        createdAt: 4000,
      }
    ];

    render(
      <MediaPoolInfoModal
        isOpen={true}
        onClose={vi.fn()}
        mediaItems={itemsWithMissing}
        bins={mockBins}
      />
    );

    expect(screen.getByText('Clean Missing (1)')).toBeDefined();
  });
});
