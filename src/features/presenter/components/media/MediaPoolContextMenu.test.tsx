import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaPoolContextMenu, ContextMenuState } from './MediaPoolContextMenu';
import { IMediaItem } from '@/core/types';
import { ipcService } from '@/core/services/ipcService';

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

const mockModify = vi.fn();
const mockAnyOf = vi.fn(() => ({ modify: mockModify }));
const mockWhere = vi.fn(() => ({ anyOf: mockAnyOf }));

vi.mock('@/core/db', () => ({
  db: {
    mediaPool: {
      update: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          modify: vi.fn().mockResolvedValue(1),
        })),
      })),
    },
    mediaBins: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { useModalStore } from '@/core/store/modalStore';

const mockPresentationStore = {
  activeServiceId: 'service-1',
  activePresentationId: 'pres-1',
  activePresentation: { id: 'pres-1', name: 'Sunday Service', serviceId: 'service-1', slides: [] },
  createPresentation: vi.fn().mockResolvedValue('new-pres-1'),
  updatePresentationSlides: vi.fn().mockResolvedValue(undefined),
  setActivePresentation: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../store/presentationStore', () => {
  const storeHook: any = vi.fn((selector: any) => selector ? selector(mockPresentationStore) : mockPresentationStore);
  storeHook.getState = vi.fn(() => mockPresentationStore);
  storeHook.setState = vi.fn((updates: any) => Object.assign(mockPresentationStore, updates));
  return { usePresentationStore: storeHook };
});

vi.mock('@/core/store/modalStore', () => ({
  ModalType: { PROMPT: 'PROMPT', CONFIRM: 'CONFIRM' },
  useModalStore: vi.fn(() => ({
    openModal: vi.fn(),
  })),
}));

describe('MediaPoolContextMenu', () => {
  const mockItem: IMediaItem = {
    id: 'item-1',
    name: 'Worship.mp4',
    path: '/path/to/Worship.mp4',
    type: 'video',
    createdAt: Date.now(),
  };

  it('renders null when contextMenu is null', () => {
    const { container } = render(
      <MediaPoolContextMenu
        contextMenu={null}
        onClose={vi.fn()}
        selectedIds={new Set()}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Relink and Show in Folder options for an item in Electron', () => {
    vi.spyOn(ipcService, 'isElectron').mockReturnValue(true);

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={vi.fn()}
        selectedIds={new Set()}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
      />
    );

    expect(screen.getByText('Show in Folder')).toBeDefined();
    expect(screen.getByText('Relink File...')).toBeDefined();
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('invokes showItemInFolder when Show in Folder is clicked', () => {
    vi.spyOn(ipcService, 'isElectron').mockReturnValue(true);
    const showSpy = vi.spyOn(ipcService, 'showItemInFolder').mockResolvedValue(true);
    const onClose = vi.fn();

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={onClose}
        selectedIds={new Set()}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
      />
    );

    const showButton = screen.getByText('Show in Folder');
    fireEvent.click(showButton);

    expect(showSpy).toHaveBeenCalledWith('/path/to/Worship.mp4');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Move to Root option when item is inside an active bin', async () => {
    const { db } = await import('@/core/db');
    const onClose = vi.fn();

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: { ...mockItem, binId: 'bin-1' },
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={onClose}
        selectedIds={new Set(['item-1'])}
        handleBulkDelete={vi.fn()}
        activeBinId="bin-1"
        setActiveBinId={vi.fn()}
        bins={[{ id: 'bin-2', name: 'Other Bin', createdAt: 1 }]}
      />
    );

    const moveToRootBtn = screen.getByText('Move to Root');
    expect(moveToRootBtn).toBeDefined();

    fireEvent.click(moveToRootBtn);
    expect(db.mediaPool.where).toHaveBeenCalledWith('id');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders Move to [Bin Name] when bins are available and moves items on click', async () => {
    const { db } = await import('@/core/db');
    const onClose = vi.fn();

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={onClose}
        selectedIds={new Set(['item-1'])}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
        bins={[{ id: 'bin-1', name: 'Youth Videos', createdAt: 1 }]}
      />
    );

    const moveToBinBtn = screen.getByText('Move to Youth Videos');
    expect(moveToBinBtn).toBeDefined();

    fireEvent.click(moveToBinBtn);
    expect(db.mediaPool.where).toHaveBeenCalledWith('id');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders multi-selection context menu when multiple items are selected', () => {
    const item2: IMediaItem = {
      id: 'item-2',
      name: 'Background.png',
      path: '/path/to/Background.png',
      type: 'image',
      createdAt: Date.now(),
    };

    const onClose = vi.fn();
    const onClearSelection = vi.fn();
    const handleBulkDelete = vi.fn();

    const contextMenu: ContextMenuState = {
      x: 150,
      y: 150,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={onClose}
        selectedIds={new Set(['item-1', 'item-2'])}
        handleBulkDelete={handleBulkDelete}
        activeBinId={null}
        setActiveBinId={vi.fn()}
        mediaItems={[mockItem, item2]}
        onClearSelection={onClearSelection}
      />
    );

    expect(screen.getByText('Create Presentation (2)')).toBeDefined();
    expect(screen.getByText('Add to Current Presentation (2)')).toBeDefined();
    expect(screen.getByText('Clear Selection')).toBeDefined();
    expect(screen.getByText('Delete Selected (2)')).toBeDefined();

    fireEvent.click(screen.getByText('Clear Selection'));
    expect(onClearSelection).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Quick Look option for single item and calls onQuickLook', () => {
    const onClose = vi.fn();
    const onQuickLook = vi.fn();

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={onClose}
        selectedIds={new Set(['item-1'])}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
        onQuickLook={onQuickLook}
      />
    );

    const quickLookBtn = screen.getByText('Quick Look');
    expect(quickLookBtn).toBeDefined();

    fireEvent.click(quickLookBtn);
    expect(onQuickLook).toHaveBeenCalledWith(mockItem);
    expect(onClose).toHaveBeenCalled();
  });

  it('creates presentation within the current active service', async () => {
    let promptCallback: ((name: string | null) => Promise<void>) | null = null;
    vi.mocked(useModalStore).mockReturnValue({
      openModal: vi.fn((_type: any, props: any) => {
        promptCallback = props?.onSelection;
      }),
    } as any);

    const contextMenu: ContextMenuState = {
      x: 100,
      y: 100,
      kind: 'item',
      item: mockItem,
    };

    render(
      <MediaPoolContextMenu
        contextMenu={contextMenu}
        onClose={vi.fn()}
        selectedIds={new Set(['item-1'])}
        handleBulkDelete={vi.fn()}
        activeBinId={null}
        setActiveBinId={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Create Presentation from Media'));
    expect(promptCallback).toBeDefined();

    if (promptCallback) {
      await (promptCallback as any)('New Presentation');
      expect(mockPresentationStore.createPresentation).toHaveBeenCalledWith(
        'New Presentation',
        { serviceId: 'service-1' }
      );
      expect(mockPresentationStore.setActivePresentation).toHaveBeenCalledWith('new-pres-1');
    }
  });
});
