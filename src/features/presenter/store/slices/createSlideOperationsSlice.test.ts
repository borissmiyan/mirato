import { describe, it, expect, vi } from 'vitest';
import { createSlideOperationsSlice } from './createSlideOperationsSlice';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
      update: vi.fn(),
    },
    audioScopes: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      put: vi.fn(),
    },
    hymnals: {
      get: vi.fn(),
    },
    hymnThemes: {
      get: vi.fn(),
      filter: vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ id: 'global-default-theme' }),
      })),
    },
  },
}));

describe('createSlideOperationsSlice', () => {
    it('should initialize slide operation states', () => {
        const mockSet = vi.fn();
        const mockGet = vi.fn();
        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);
        expect(slice.updatePresentationSlides).toBeDefined();
        expect(slice.duplicateSlide).toBeDefined();
    });

    it('should move multiple slides together using moveSlides', async () => {
        const mockSlides = [
            { id: 'slide-1', order: 0 },
            { id: 'slide-2', order: 1 },
            { id: 'slide-3', order: 2 },
            { id: 'slide-4', order: 3 },
        ];
        
        const mockPresentation = {
            id: 'pres-1',
            slides: mockSlides,
        };

        const mockSet = vi.fn();
        const mockUpdateSlides = vi.fn();
        const mockTakeSnapshot = vi.fn();
        const mockGet = vi.fn(() => ({
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
        }));

        (db.presentationFiles.get as any).mockResolvedValue(mockPresentation);

        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);

        // Test moving slide-2 and slide-3 forward ('forth')
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'forth');
        
        expect(mockTakeSnapshot).toHaveBeenCalledWith('pres-1');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-1', order: 0 },
            { id: 'slide-4', order: 1 },
            { id: 'slide-2', order: 2 },
            { id: 'slide-3', order: 3 },
        ]);

        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 backward ('back')
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'back');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-2', order: 0 },
            { id: 'slide-3', order: 1 },
            { id: 'slide-1', order: 2 },
            { id: 'slide-4', order: 3 },
        ]);
        
        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 to start
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'start');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-2', order: 0 },
            { id: 'slide-3', order: 1 },
            { id: 'slide-1', order: 2 },
            { id: 'slide-4', order: 3 },
        ]);

        mockUpdateSlides.mockClear();

        mockUpdateSlides.mockClear();

        // Test moving slide-2 and slide-3 to end
        mockPresentation.slides = [...mockSlides];
        await slice.moveSlides('pres-1', ['slide-2', 'slide-3'], 'end');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            { id: 'slide-1', order: 0 },
            { id: 'slide-4', order: 1 },
            { id: 'slide-2', order: 2 },
            { id: 'slide-3', order: 3 },
        ]);
    });

    it('should handle detachHymnSlide for non-hymn and hymn slides', async () => {
        const mockSet = vi.fn();
        const mockUpdateSlides = vi.fn();
        const mockTakeSnapshot = vi.fn();
        const mockGet = vi.fn(() => ({
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
        }));

        (db.presentationFiles.get as any).mockImplementation((id: string) => {
            if (id === 'pres-1') {
                return Promise.resolve({
                    id: 'pres-1',
                    slides: [
                        { id: 's1', type: 'hymn', hymnPresentationId: 'hymn-p1', sourceSlideId: 'src-s1', themeId: 'source', order: 0, blockId: 'b1' }
                    ]
                });
            }
            if (id === 'hymn-p1') {
                return Promise.resolve({
                    id: 'hymn-p1',
                    slides: [
                        { id: 'src-s1', type: 'normal', name: 'Verse 1', backgroundOverride: [], content: { canvasItems: [{ id: 'item-1', type: 'text' }] } }
                    ]
                });
            }
            return Promise.resolve(null);
        });

        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);

        const res = await slice.detachHymnSlide('pres-1', 's1');
        expect(res.requiresAudioConfirmation).toBe(false);
        expect(mockTakeSnapshot).toHaveBeenCalledWith('pres-1');
        expect(mockUpdateSlides).toHaveBeenCalledWith('pres-1', [
            expect.objectContaining({
                id: 's1',
                type: 'normal',
                order: 0,
                blockId: 'b1',
            })
        ]);
    });

    it('should add hymn to active presentation as nested presentation slide', async () => {
        const mockSet = vi.fn();
        const mockUpdateSlides = vi.fn();
        const mockTakeSnapshot = vi.fn();
        const mockCreatePres = vi.fn().mockResolvedValue('snapshot-pres-1');
        const mockSetSelected = vi.fn();
        const mockSetPreview = vi.fn();

        const mockActivePres = {
            id: 'active-pres-1',
            serviceId: 'service-1',
            slides: [
                { id: 'slide-1', order: 0, type: 'normal' }
            ]
        };

        const mockHymnPres = {
            id: 'hymn-pres-40',
            name: '40 - Воспою любовь Христа',
            hymnalId: 'hymns-of-hope-ru',
            metadata: { hymnOrder: 40, hymnTitle: 'Воспою любовь Христа' },
            slides: [
                { id: 'h-s1', type: 'normal', content: { canvasItems: [] } },
                { id: 'h-s2', type: 'normal', content: { canvasItems: [] } }
            ]
        };

        (db.presentationFiles.get as any).mockImplementation((id: string) => {
            if (id === 'hymn-pres-40') return Promise.resolve(mockHymnPres);
            return Promise.resolve(null);
        });

        const mockGet = vi.fn(() => ({
            activePresentationId: 'active-pres-1',
            activePresentation: mockActivePres,
            activeServiceId: 'service-1',
            selectedSlideIds: ['slide-1'],
            createPresentation: mockCreatePres,
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
            setSelectedSlideIds: mockSetSelected,
            setPreviewSlide: mockSetPreview,
        }));

        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);
        await slice.addHymnToActivePresentation('hymn-pres-40', 'default', 1);

        expect(mockTakeSnapshot).toHaveBeenCalledWith('active-pres-1');
        expect(mockCreatePres).toHaveBeenCalledWith('40 - Воспою любовь Христа', expect.objectContaining({
            serviceId: 'service-1',
            metadata: expect.objectContaining({ isHymn: true, hymnalId: 'hymns-of-hope-ru' })
        }));
        expect(mockUpdateSlides).toHaveBeenCalledWith('snapshot-pres-1', expect.any(Array));
        expect(mockUpdateSlides).toHaveBeenCalledWith('active-pres-1', expect.arrayContaining([
            expect.objectContaining({ id: 'slide-1', order: 0 }),
            expect.objectContaining({
                type: 'normal',
                order: 1,
                blockId: 'master-presentation',
                masterPresentationId: 'snapshot-pres-1',
                linkedPresentationId: 'hymn-pres-40',
                isExpanded: true
            })
        ]));
    });

    it('duplicateSlide should duplicate a single slide and set it as selected', async () => {
        const mockPres = {
            id: 'p1',
            slides: [
                { id: 's1', type: 'normal', order: 0, content: { canvasItems: [] } },
                { id: 's2', type: 'normal', order: 1, content: { canvasItems: [] } },
            ]
        };

        (db.presentationFiles.get as any).mockResolvedValue(mockPres);
        (db.audioScopes.where as any).mockReturnValue({
            toArray: vi.fn().mockResolvedValue([])
        });

        const mockUpdateSlides = vi.fn().mockResolvedValue(undefined);
        const mockTakeSnapshot = vi.fn().mockResolvedValue(undefined);
        const mockSetPreview = vi.fn().mockResolvedValue(undefined);

        const mockGet = vi.fn(() => ({
            activePresentationId: 'p1',
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
            setPreviewSlide: mockSetPreview,
        }));

        const mockSet = vi.fn();
        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);
        await slice.duplicateSlide('p1', 's1');

        expect(mockTakeSnapshot).toHaveBeenCalledWith('p1');
        expect(mockUpdateSlides).toHaveBeenCalled();
        expect(mockSetPreview).toHaveBeenCalledWith(expect.any(String), 'p1');
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            selectedSlideIds: [expect.any(String)]
        }));
    });

    it('duplicateSlides should duplicate multiple slides and set all of them as selected with preview preserved on duplicate of original preview slide', async () => {
        const mockPres = {
            id: 'p1',
            slides: [
                { id: 's1', type: 'normal', order: 0, content: { canvasItems: [] } },
                { id: 's2', type: 'normal', order: 1, content: { canvasItems: [] } },
                { id: 's3', type: 'normal', order: 2, content: { canvasItems: [] } },
            ]
        };

        (db.presentationFiles.get as any).mockResolvedValue(mockPres);
        (db.audioScopes.where as any).mockReturnValue({
            equals: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([])
            })
        });

        const mockUpdateSlides = vi.fn().mockResolvedValue(undefined);
        const mockTakeSnapshot = vi.fn().mockResolvedValue(undefined);
        const mockSetPreview = vi.fn().mockResolvedValue(undefined);

        const mockGet = vi.fn(() => ({
            activePresentationId: 'p1',
            previewSlideId: 's2',
            updatePresentationSlides: mockUpdateSlides,
            takeSnapshot: mockTakeSnapshot,
            setPreviewSlide: mockSetPreview,
        }));

        const mockSet = vi.fn();
        const slice = createSlideOperationsSlice(mockSet, mockGet as any, {} as any);
        await slice.duplicateSlides('p1', ['s1', 's2']);

        expect(mockTakeSnapshot).toHaveBeenCalledWith('p1');
        expect(mockUpdateSlides).toHaveBeenCalled();
        // Updated slides should contain original 3 + 2 new duplicated = 5 slides
        const updatedSlidesCall = mockUpdateSlides.mock.calls[0][1];
        expect(updatedSlidesCall.length).toBe(5);

        // Verify set was called with ALL newly duplicated slide IDs
        const lastSetCall = mockSet.mock.calls[mockSet.mock.calls.length - 1][0];
        expect(lastSetCall.selectedSlideIds).toHaveLength(2);
        const duplicatedS1 = lastSetCall.selectedSlideIds[0];
        const duplicatedS2 = lastSetCall.selectedSlideIds[1];
        expect(duplicatedS1).not.toBe('s1');
        expect(duplicatedS2).not.toBe('s2');

        // Target preview slide must be the duplicate of s2 (original preview slide), not s1
        expect(mockSetPreview).toHaveBeenCalledWith(duplicatedS2, 'p1');
    });
});
