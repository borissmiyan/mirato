import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import {
  slidePreviewHoveredAtom,
  isTimelineHoveredAtom,
  selectedCanvasItemIdsAtom,
  editingCanvasItemIdAtom,
  vectorEditingItemIdAtom,
  canvasToolAtom,
  latestInteractionAreaAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { presentationService } from '@/core/services/presentationService';
import { useGlobalShortcuts } from '../useGlobalShortcuts';
import type { IPresentationFile } from '@/core/types';

vi.mock('@/core/services/ipcService', () => ({
  IpcService: {
    isElectron: () => false,
    on: vi.fn(),
  },
}));

vi.mock('../useRemoteCommands', () => ({
  registerRemoteCommands: () => () => {},
}));

describe('useGlobalShortcuts zone priority & Enter/Space/H behavior', () => {
  const store = getDefaultStore();
  const handleNext = vi.fn().mockResolvedValue(undefined);
  const handlePrev = vi.fn().mockResolvedValue(undefined);
  const openProjector = vi.fn().mockResolvedValue(undefined);
  const closeProjector = vi.fn();
  const toggleOverride = vi.fn();
  const onRequestRemoteUpdate = vi.fn();
  const setPreviewSlide = vi.fn();
  const setLiveSlide = vi.fn();
  const syncPreviewToLive = vi.fn();
  const moveSlide = vi.fn().mockResolvedValue(undefined);
  const moveSlides = vi.fn().mockResolvedValue(undefined);

  const rootPresentation = {
    id: 'pres-root',
    name: 'Root',
    slides: [
      {
        id: 'slide-root-1',
        type: 'normal',
        order: 0,
        blockId: 'b1',
        templateId: 't1',
        content: {
          variables: {},
          canvasItems: [
            { id: 'txt-1', type: 'text', x: 10, y: 10, width: 30, height: 10, zIndex: 1, text: { content: 'Hello', fontSize: 32 } },
            { id: 'img-1', type: 'image', x: 10, y: 10, width: 30, height: 30, zIndex: 2 },
            { id: 'locked-txt', type: 'text', locked: true, x: 10, y: 10, width: 30, height: 10, zIndex: 3, text: { content: 'Locked', fontSize: 32 } },
          ],
        },
      },
    ],
  } as unknown as IPresentationFile;

  const nestedPresentation = {
    id: 'pres-nested',
    name: 'Nested',
    slides: [
      {
        id: 'slide-nested-1',
        type: 'normal',
        order: 0,
        blockId: 'b1',
        templateId: 't1',
        content: {
          variables: {},
          canvasItems: [
            { id: 'nested-shape', type: 'shape', x: 10, y: 10, width: 20, height: 20, zIndex: 1, shape: { shapeType: 'rect' } },
            { id: 'nested-text', type: 'text', x: 10, y: 10, width: 20, height: 10, zIndex: 2, text: { content: 'Nested', fontSize: 28 } },
          ],
        },
      },
    ],
  } as unknown as IPresentationFile;

  beforeEach(() => {
    vi.clearAllMocks();
    store.set(slidePreviewHoveredAtom, false);
    store.set(isTimelineHoveredAtom, false);
    store.set(selectedCanvasItemIdsAtom, []);
    store.set(editingCanvasItemIdAtom, null);
    store.set(vectorEditingItemIdAtom, null);
    store.set(canvasToolAtom, 'select');
    store.set(latestInteractionAreaAtom, 'timeline');

    usePresentationStore.setState({
      activePresentationId: 'pres-root',
      selectedPresentationId: 'pres-root',
      activePresentation: rootPresentation,
      selectedPresentation: rootPresentation,
      previewSlideId: 'slide-root-1',
      liveSlideId: null,
      selectedSlideIds: [],
      setPreviewSlide,
      setLiveSlide,
      syncPreviewToLive,
      moveSlide,
      moveSlides,
    } as never);
  });

  const fireKey = async (init: KeyboardEventInit) => {
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
    });
  };

  it('launches slide on Enter when timeline is hovered even if a canvas item is still selected', async () => {
    store.set(isTimelineHoveredAtom, true);
    store.set(selectedCanvasItemIdsAtom, ['txt-1']);

    renderHook(() =>
      useGlobalShortcuts({
        appMode: 'presentation',
        previewSlideId: 'slide-root-1',
        activePresentation: rootPresentation,
        activeVerse: null,
        selectedCanvasItemIds: ['txt-1'],
        isTimelineHovered: true,
        handleNext,
        handlePrev,
        openProjector,
        closeProjector,
        toggleOverride,
        onRequestRemoteUpdate,
      })
    );

    await fireKey({ key: 'Enter', code: 'Enter' });

    expect(store.get(editingCanvasItemIdAtom)).toBeNull();
    expect(setLiveSlide).toHaveBeenCalledWith('slide-root-1');
    expect(openProjector).toHaveBeenCalled();
  });

  it('moves slide on Cmd+] when timeline is hovered even if canvas item is selected and area was canvas', async () => {
    store.set(isTimelineHoveredAtom, true);
    store.set(latestInteractionAreaAtom, 'canvas');
    store.set(selectedCanvasItemIdsAtom, ['txt-1']);

    renderHook(() =>
      useGlobalShortcuts({
        appMode: 'presentation',
        previewSlideId: 'slide-root-1',
        activePresentation: rootPresentation,
        activeVerse: null,
        selectedCanvasItemIds: ['txt-1'],
        isTimelineHovered: true,
        handleNext,
        handlePrev,
        openProjector,
        closeProjector,
        toggleOverride,
        onRequestRemoteUpdate,
      })
    );

    await fireKey({ key: ']', code: 'BracketRight', metaKey: true });

    expect(moveSlide).toHaveBeenCalledWith('pres-root', 'slide-root-1', 'forth');
  });

  it('enters vector editing on Enter for a shape inside a nested (selectedPresentation) slide', async () => {
    store.set(slidePreviewHoveredAtom, true);
    store.set(latestInteractionAreaAtom, 'canvas');
    store.set(selectedCanvasItemIdsAtom, ['nested-shape']);

    usePresentationStore.setState({
      selectedPresentationId: 'pres-nested',
      selectedPresentation: nestedPresentation,
      previewSlideId: 'slide-nested-1',
    } as never);

    renderHook(() =>
      useGlobalShortcuts({
        appMode: 'presentation',
        previewSlideId: 'slide-nested-1',
        activePresentation: rootPresentation,
        activeVerse: null,
        selectedCanvasItemIds: ['nested-shape'],
        isTimelineHovered: false,
        handleNext,
        handlePrev,
        openProjector,
        closeProjector,
        toggleOverride,
        onRequestRemoteUpdate,
      })
    );

    await fireKey({ key: 'Enter', code: 'Enter' });

    expect(store.get(vectorEditingItemIdAtom)).toBe('nested-shape');
    expect(store.get(editingCanvasItemIdAtom)).toBeNull();
  });

  it('does not lock editingCanvasItemIdAtom on Enter for image or locked items', async () => {
    store.set(slidePreviewHoveredAtom, true);
    store.set(latestInteractionAreaAtom, 'canvas');
    store.set(selectedCanvasItemIdsAtom, ['img-1']);

    const { rerender } = renderHook(
      ({ ids }) =>
        useGlobalShortcuts({
          appMode: 'presentation',
          previewSlideId: 'slide-root-1',
          activePresentation: rootPresentation,
          activeVerse: null,
          selectedCanvasItemIds: ids,
          isTimelineHovered: false,
          handleNext,
          handlePrev,
          openProjector,
          closeProjector,
          toggleOverride,
          onRequestRemoteUpdate,
        }),
      { initialProps: { ids: ['img-1'] } }
    );

    await fireKey({ key: 'Enter', code: 'Enter' });
    expect(store.get(editingCanvasItemIdAtom)).toBeNull();

    store.set(selectedCanvasItemIdsAtom, ['locked-txt']);
    rerender({ ids: ['locked-txt'] });
    await fireKey({ key: 'Enter', code: 'Enter' });
    expect(store.get(editingCanvasItemIdAtom)).toBeNull();
  });

  it('Spacebar only toggles live media and never advances slides', async () => {
    const toggleSpy = vi.spyOn(presentationService, 'toggleLiveMedia').mockReturnValue(true);
    const hasMediaSpy = vi.spyOn(presentationService, 'hasLiveMedia').mockReturnValue(true);

    store.set(isTimelineHoveredAtom, true);

    renderHook(() =>
      useGlobalShortcuts({
        appMode: 'presentation',
        previewSlideId: 'slide-root-1',
        activePresentation: rootPresentation,
        activeVerse: null,
        selectedCanvasItemIds: [],
        isTimelineHovered: true,
        handleNext,
        handlePrev,
        openProjector,
        closeProjector,
        toggleOverride,
        onRequestRemoteUpdate,
      })
    );

    await fireKey({ key: ' ', code: 'Space' });

    expect(toggleSpy).toHaveBeenCalled();
    expect(handleNext).not.toHaveBeenCalled();

    toggleSpy.mockRestore();
    hasMediaSpy.mockRestore();
  });

  it('splits H key by zone: pan tool on preview hover, syncPreviewToLive on timeline', async () => {
    const { unmount } = renderHook(() =>
      useGlobalShortcuts({
        appMode: 'presentation',
        previewSlideId: 'slide-root-1',
        activePresentation: rootPresentation,
        activeVerse: null,
        selectedCanvasItemIds: [],
        isTimelineHovered: false,
        handleNext,
        handlePrev,
        openProjector,
        closeProjector,
        toggleOverride,
        onRequestRemoteUpdate,
      })
    );

    // On preview -> pan tool only
    store.set(slidePreviewHoveredAtom, true);
    await fireKey({ key: 'h', code: 'KeyH' });
    expect(store.get(canvasToolAtom)).toBe('pan');
    expect(syncPreviewToLive).not.toHaveBeenCalled();

    // On timeline -> syncPreviewToLive only
    store.set(slidePreviewHoveredAtom, false);
    store.set(isTimelineHoveredAtom, true);
    store.set(canvasToolAtom, 'select');
    await fireKey({ key: 'h', code: 'KeyH' });
    expect(syncPreviewToLive).toHaveBeenCalledTimes(1);
    expect(store.get(canvasToolAtom)).toBe('select');

    unmount();
  });
});
