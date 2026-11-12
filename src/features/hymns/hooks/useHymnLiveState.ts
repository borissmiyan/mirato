import { useMemo } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { IPresentationFile } from '@/core/types/presentation';

export interface HymnLiveState {
    isLive: boolean;
    isPreview: boolean;
}

/**
 * Helper to resolve presentation for a slide via direct O(1) DB lookup.
 */
async function resolvePresentationForSlide(
    slideId: string | null,
    rootPresentationId: string | null,
    activePresentation: IPresentationFile | null,
    selectedPresentation: IPresentationFile | null
): Promise<IPresentationFile | null> {
    if (!slideId) return null;

    const allSlides = [...(activePresentation?.slides || []), ...(selectedPresentation?.slides || [])];
    const activeSlide = allSlides.find(s => s.id === slideId);

    if (activeSlide) {
        if (activeSlide.type === 'hymn' && activeSlide.hymnPresentationId) {
            return (await db.presentationFiles.get(activeSlide.hymnPresentationId)) ?? null;
        }
        return activePresentation || selectedPresentation;
    }

    if (rootPresentationId) {
        return (await db.presentationFiles.get(rootPresentationId)) ?? null;
    }

    return null;
}

/**
 * Centralized hook to compute live and preview state for a hymn or hymnal.
 * Supports dual modes:
 * Mode 1: Single Hymn (`hymnPresentationId` provided)
 * Mode 2: Hymnal (`hymnalId` provided)
 */
export function useHymnLiveState(hymnPresentationId?: string, hymnalId?: string): HymnLiveState {
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const liveRootPresentationId = usePresentationStore(s => s.liveRootPresentationId);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);
    const rootPresentationId = usePresentationStore(s => s.rootPresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const selectedPresentation = usePresentationStore(s => s.selectedPresentation);

    const livePresentation = useLiveQuery(
        () => resolvePresentationForSlide(
            liveSlideId,
            liveRootPresentationId,
            activePresentation,
            selectedPresentation
        ),
        [liveSlideId, liveRootPresentationId, activePresentation, selectedPresentation]
    );

    const previewPresentation = useLiveQuery(
        () => resolvePresentationForSlide(
            previewSlideId,
            rootPresentationId,
            activePresentation,
            selectedPresentation
        ),
        [previewSlideId, rootPresentationId, activePresentation, selectedPresentation]
    );

    return useMemo(() => {
        if (hymnPresentationId) {
            const isLive = livePresentation?.id === hymnPresentationId;
            const isPreview = previewPresentation?.id === hymnPresentationId;
            return { isLive, isPreview };
        }

        if (hymnalId) {
            const isLive = livePresentation?.hymnalId === hymnalId && !!livePresentation?.metadata?.isHymnLibraryItem;
            const isPreview = previewPresentation?.hymnalId === hymnalId && !!previewPresentation?.metadata?.isHymnLibraryItem;
            return { isLive, isPreview };
        }

        return { isLive: false, isPreview: false };
    }, [hymnPresentationId, hymnalId, livePresentation, previewPresentation]);
}
