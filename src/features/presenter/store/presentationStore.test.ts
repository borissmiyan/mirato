import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePresentationStore } from './presentationStore';
import { db } from '@/core/db';

// Mock DB
vi.mock('@/core/db', () => ({
  db: {
    serviceFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
      add: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    templates: {
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    presentationBins: {
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  },
}));

// Mock Services
vi.mock('../services/ektService', () => ({
  EktService: {
    save: vi.fn(),
    load: vi.fn(),
  },
}));

vi.mock('../services/ektpService', () => ({
  EktpService: {
    save: vi.fn(),
    load: vi.fn(),
  },
}));

describe('usePresentationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state if possible, or just re-import/re-create
    // Note: Zustand persist might keep state between tests if not handled
    usePresentationStore.setState({
      activeServiceId: null,
      activePresentationId: null,
      selectedPresentationId: null,
      previewSlideId: null,
      liveSlideId: null,
      activeService: null,
      activePresentation: null,
      selectedPresentation: null,
      selectedSlideIds: [],
    });
  });

  it('should have initial state', () => {
    const state = usePresentationStore.getState();
    expect(state.activeServiceId).toBeNull();
    expect(state.activePresentationId).toBeNull();
    expect(state.previewSlideId).toBeNull();
  });

  it('setActiveService should load service and master presentation', async () => {
    const mockService = {
      id: 'service-1',
      masterPresentationId: 'master-1',
      name: 'Test Service',
    };
    const mockPresentation = {
      id: 'master-1',
      serviceId: 'service-1',
      slides: [{ id: 'slide-1' }],
    };

    (db.serviceFiles.get as any).mockResolvedValue(mockService);
    (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

    await usePresentationStore.getState().setActiveService('service-1');

    expect(db.serviceFiles.get).toHaveBeenCalledWith('service-1');
    expect(usePresentationStore.getState().activeServiceId).toBe('service-1');
    expect(usePresentationStore.getState().activePresentationId).toBe('master-1');
    expect(usePresentationStore.getState().previewSlideId).toBe('slide-1');
  });

  it('setPreviewSlide should update previewSlideId', async () => {
    await usePresentationStore.getState().setPreviewSlide('slide-2', 'pres-1');
    expect(usePresentationStore.getState().previewSlideId).toBe('slide-2');
    expect(usePresentationStore.getState().selectedPresentationId).toBe('pres-1');
  });

  it('toggleSlideSelection should handle multi-selection', () => {
    usePresentationStore.setState({
      activePresentation: { id: 'p1', slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] } as any
    });

    usePresentationStore.getState().toggleSlideSelection('s1');
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1']);

    usePresentationStore.getState().toggleSlideSelection('s2', true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's2']);

    usePresentationStore.getState().toggleSlideSelection('s1', true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s2']);
  });

  it('toggleSlideSelection should handle multi-selection and range-selection even when activePresentation is null', () => {
    usePresentationStore.setState({
      activePresentation: null,
      selectedPresentation: null,
      selectedSlideIds: ['s1'],
      previewSlideId: 's1',
    });

    // Multi-selection (Ctrl/Cmd + click) with activePresentation null: preview moves to newly selected slide (s2)
    usePresentationStore.getState().toggleSlideSelection('s2', true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's2']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s2');

    // Range-selection (Shift + click) passing slidesList: preview moves to newly selected range endpoint (s4)
    const mockSlides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }] as any[];
    usePresentationStore.getState().toggleSlideSelection('s4', false, true, false, mockSlides);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's2', 's3', 's4']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s4');
  });

  it('navigateNext with preferLiveAnchor should advance live slide independently', async () => {
    const slides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
    const presentation = { id: 'p1', slides };
    (db.presentationFiles.get as any).mockResolvedValue(presentation);

    usePresentationStore.setState({
      activePresentationId: 'p1',
      activePresentation: presentation as any,
      liveSlideId: 's1',
      previewSlideId: 's3', // Detached
    });

    await usePresentationStore.getState().navigateNext(false, true);

    const state = usePresentationStore.getState();
    expect(state.liveSlideId).toBe('s2');
    expect(state.previewSlideId).toBe('s3'); // Should remain on s3
  });

  it('navigateNext with preferLiveAnchor should advance both if synced', async () => {
    const slides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
    const presentation = { id: 'p1', slides };
    (db.presentationFiles.get as any).mockResolvedValue(presentation);

    usePresentationStore.setState({
      activePresentationId: 'p1',
      activePresentation: presentation as any,
      liveSlideId: 's1',
      previewSlideId: 's1', // Synced
    });

    await usePresentationStore.getState().navigateNext(false, true);

    const state = usePresentationStore.getState();
    expect(state.liveSlideId).toBe('s2');
    expect(state.previewSlideId).toBe('s2'); // Should follow to s2
  });

  it('clearSelection should clear selectedSlideIds and previewSlideId', () => {
    usePresentationStore.setState({ selectedSlideIds: ['s1', 's2'], previewSlideId: 's1' });
    usePresentationStore.getState().clearSelection();
    expect(usePresentationStore.getState().selectedSlideIds).toEqual([]);
    expect(usePresentationStore.getState().previewSlideId).toBeNull();
  });

  it('toggleSlideSelection with deselect should remove slide and update preview', () => {
    usePresentationStore.setState({
      activePresentation: { id: 'p1', slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] } as any,
      selectedSlideIds: ['s1', 's2', 's3'],
      previewSlideId: 's2',
    });

    // Deselect s2 (the current preview slide): preview should move to remaining selected slide (s3)
    usePresentationStore.getState().toggleSlideSelection('s2', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's3']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s3');

    // Deselect s3: preview should move to remaining s1
    usePresentationStore.getState().toggleSlideSelection('s3', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s1');

    // Deselect last slide s1: clears all selection and preview becomes null
    usePresentationStore.getState().toggleSlideSelection('s1', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual([]);
    expect(usePresentationStore.getState().previewSlideId).toBeNull();
  });

  it('toggleSlideSelection with deselect on an already unselected slide does not clear remaining selected slides', () => {
    usePresentationStore.setState({
      activePresentation: { id: 'p1', slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] } as any,
      selectedSlideIds: ['s1', 's2'],
      previewSlideId: 's1',
    });

    // s3 is not selected; deselecting an unselected slide does nothing to existing selection
    usePresentationStore.getState().toggleSlideSelection('s3', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1', 's2']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s1');

    // Deselect s2
    usePresentationStore.getState().toggleSlideSelection('s2', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1']);

    // Repeated deselect click on s2 must NOT deselect s1
    usePresentationStore.getState().toggleSlideSelection('s2', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual(['s1']);
    expect(usePresentationStore.getState().previewSlideId).toBe('s1');
  });

  it('toggleSlideSelection with empty id and deselect clears all selection', () => {
    usePresentationStore.setState({
      activePresentation: { id: 'p1', slides: [{ id: 's1' }, { id: 's2' }] } as any,
      selectedSlideIds: ['s1', 's2'],
      previewSlideId: 's1',
    });

    usePresentationStore.getState().toggleSlideSelection('', false, false, true);
    expect(usePresentationStore.getState().selectedSlideIds).toEqual([]);
    expect(usePresentationStore.getState().previewSlideId).toBeNull();
  });
});
