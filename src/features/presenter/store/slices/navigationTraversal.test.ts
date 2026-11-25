import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePresentationStore } from '../presentationStore';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
        })),
      })),
    },
    serviceFiles: {
      get: vi.fn(),
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
        })),
      })),
    },
    audioScopes: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) })),
    },
  },
}));

describe('navigationTraversal when no live screen is active (liveSlideId === null)', () => {
  const slides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  const presentation = { id: 'p1', name: 'Test', slides };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.presentationFiles.get as ReturnType<typeof vi.fn>).mockResolvedValue(presentation);

    usePresentationStore.setState({
      activePresentationId: 'p1',
      selectedPresentationId: 'p1',
      activePresentation: presentation as never,
      selectedPresentation: presentation as never,
      previewSlideId: 's1',
      selectedSlideIds: ['s1'],
      liveSlideId: null,
      presentationStack: [],
    });
  });

  it('navigateNext with preferLiveAnchor moves only previewSlideId and never sets liveSlideId', async () => {
    await usePresentationStore.getState().navigateNext(false, true);

    const state = usePresentationStore.getState();
    expect(state.previewSlideId).toBe('s2');
    expect(state.liveSlideId).toBeNull();
  });

  it('navigateNext in detached+preferLiveAnchor mode still moves preview and keeps liveSlideId null', async () => {
    await usePresentationStore.getState().navigateNext(true, true);

    const state = usePresentationStore.getState();
    expect(state.previewSlideId).toBe('s2');
    expect(state.liveSlideId).toBeNull();
  });

  it('navigatePrev with preferLiveAnchor moves only previewSlideId and keeps liveSlideId null', async () => {
    usePresentationStore.setState({ previewSlideId: 's3', selectedSlideIds: ['s3'], liveSlideId: null });

    await usePresentationStore.getState().navigatePrev(false, true);

    const state = usePresentationStore.getState();
    expect(state.previewSlideId).toBe('s2');
    expect(state.liveSlideId).toBeNull();
  });
});
