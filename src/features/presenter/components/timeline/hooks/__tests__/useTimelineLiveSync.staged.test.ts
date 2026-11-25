import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { hasPendingLiveUpdateAtom, liveUpdateTriggerAtom } from '@/core/store/liveSyncAtoms';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useTimelineLiveSync } from '../useTimelineLiveSync';
import type { IPresentationFile, ISlide } from '@/core/types';

vi.mock('@/core/services/liveSyncService', () => ({
  LiveSyncService: {
    showSlide: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('useTimelineLiveSync staged live updates', () => {
  const store = getDefaultStore();

  const makeSlide = (id: string, title: string): ISlide => ({
    id,
    type: 'normal',
    order: 0,
    blockId: 'b1',
    templateId: 't1',
    content: {
      variables: { title },
      canvasItems: [],
    },
  } as unknown as ISlide);

  beforeEach(() => {
    vi.clearAllMocks();
    store.set(hasPendingLiveUpdateAtom, false);
    store.set(liveUpdateTriggerAtom, 0);
    usePresentationStore.setState({
      liveNavigationParentSlideId: null,
      nestedPresentationsCache: {},
    } as never);
  });

  it('pushes on initial live slide, stages subsequent edits without realtime push, and pushes on trigger', () => {
    const slideV1 = makeSlide('s1', 'Original');
    const presV1 = { id: 'p1', name: 'P1', slides: [slideV1] } as unknown as IPresentationFile;

    const { rerender } = renderHook(
      ({ pres, liveId, previewId }) =>
        useTimelineLiveSync({
          appMode: 'presentation',
          liveSlideId: liveId,
          previewSlideId: previewId,
          activePresentationId: 'p1',
          selectedPresentationId: 'p1',
          activePresentation: pres,
          selectedPresentation: pres,
          visualTimeline: [{ id: 's1', width: 128, x: 0, type: 'slide', slide: pres.slides[0], presentationId: 'p1' }],
          navigationParentSlideId: null,
        }),
      { initialProps: { pres: presV1, liveId: 's1', previewId: 's1' } }
    );

    // 1. Initial go-live sends slide immediately
    expect(LiveSyncService.showSlide).toHaveBeenCalledTimes(1);
    expect(store.get(hasPendingLiveUpdateAtom)).toBe(false);

    // 2. Operator edits the live slide -> MUST NOT push to projector yet, MUST set pending flag
    const slideV2 = makeSlide('s1', 'Edited Text');
    const presV2 = { id: 'p1', name: 'P1', slides: [slideV2] } as unknown as IPresentationFile;
    rerender({ pres: presV2, liveId: 's1', previewId: 's1' });

    expect(LiveSyncService.showSlide).toHaveBeenCalledTimes(1);
    expect(store.get(hasPendingLiveUpdateAtom)).toBe(true);

    // 3. Operator switches preview to another slide -> live projection unaffected
    rerender({ pres: presV2, liveId: 's1', previewId: 's2' });
    expect(LiveSyncService.showSlide).toHaveBeenCalledTimes(1);

    // 4. Operator clicks "Update Live" (increments liveUpdateTriggerAtom) -> pushes v2 immediately
    act(() => {
      store.set(liveUpdateTriggerAtom, 1);
    });

    expect(LiveSyncService.showSlide).toHaveBeenCalledTimes(2);
    expect(LiveSyncService.showSlide).toHaveBeenLastCalledWith(slideV2, 'p1', 'p1', null);
    expect(store.get(hasPendingLiveUpdateAtom)).toBe(false);
  });
});
