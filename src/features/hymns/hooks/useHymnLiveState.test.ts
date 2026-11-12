import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHymnLiveState } from './useHymnLiveState';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';

vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: vi.fn(() => ({
        id: 'hymn-p1',
        hymnalId: 'hymnal-1',
        metadata: { isHymnLibraryItem: true },
    })),
}));

vi.mock('@/core/db', () => ({
    db: {
        presentationFiles: {
            get: vi.fn().mockResolvedValue({
                id: 'hymn-p1',
                hymnalId: 'hymnal-1',
                metadata: { isHymnLibraryItem: true },
            }),
            filter: vi.fn(() => ({ first: vi.fn() })),
        },
    },
}));

describe('useHymnLiveState', () => {
    beforeEach(() => {
        vi.mocked(useLiveQuery).mockClear();
        usePresentationStore.setState({
            liveSlideId: 'slide-live-1',
            liveRootPresentationId: 'hymn-p1',
            previewSlideId: 'slide-preview-1',
            rootPresentationId: 'hymn-p1',
            activePresentation: null,
            selectedPresentation: null,
        });
    });

    it('passes real store values to useLiveQuery deps — regression guard for wrong store import', () => {
        renderHook(() => useHymnLiveState('hymn-p1'));

        // Безусловная проверка. Если импорт стора сломан — liveSlideId/rootPresentationId будут undefined,
        // toHaveBeenCalledWith не найдёт совпадающего вызова → тест красный, независимо от возвращаемого мока.
        expect(useLiveQuery).toHaveBeenCalledWith(
            expect.any(Function),
            expect.arrayContaining(['slide-live-1', 'hymn-p1'])
        );
        expect(useLiveQuery).toHaveBeenCalledWith(
            expect.any(Function),
            expect.arrayContaining(['slide-preview-1', 'hymn-p1'])
        );
    });

    it('should compute isLive and isPreview for single hymn presentation via real presentationStore', () => {
        const { result } = renderHook(() => useHymnLiveState('hymn-p1'));
        expect(result.current.isLive).toBe(true);
        expect(result.current.isPreview).toBe(true);
    });

    it('should compute isLive and isPreview for hymnal via real presentationStore', () => {
        const { result } = renderHook(() => useHymnLiveState(undefined, 'hymnal-1'));
        expect(result.current.isLive).toBe(true);
        expect(result.current.isPreview).toBe(true);
    });

    it('should return false when no matching presentation ID', () => {
        const { result } = renderHook(() => useHymnLiveState('other-p2'));
        expect(result.current.isLive).toBe(false);
        expect(result.current.isPreview).toBe(false);
    });
});
