import { useCallback } from 'react';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { LiveSyncService } from '@/core/services/liveSyncService';

interface ProjectorToggleProps {
    appMode: 'scripture' | 'presentation' | 'hymns';
    projectorOpen: boolean;
    projectorIsLive: boolean;
    liveSlideId: string | null;
    previewSlideId: string | null;
    closeProjector: () => void;
    openProjector: () => Promise<void>;
}

/**
 * Handles projector toggle logic (starting / stopping live broadcasts).
 */
export function useProjectorToggle({
    appMode,
    projectorOpen,
    projectorIsLive,
    liveSlideId,
    previewSlideId,
    closeProjector,
    openProjector
}: ProjectorToggleProps): () => Promise<void> {
    return useCallback(async () => {
        const isLiveNow = projectorOpen && (appMode === 'scripture' ? projectorIsLive : !!liveSlideId);
        const isCurrentPreviewLive = appMode === 'scripture'
            ? projectorIsLive
            : (liveSlideId && previewSlideId ? liveSlideId === previewSlideId : !!liveSlideId);

        if (isLiveNow && isCurrentPreviewLive) {
            closeProjector();
            return;
        }

        if (appMode === 'scripture') {
            const bibleState = useBibleStore.getState();
            const canProject = bibleState.activeVerse || bibleState.selectedVerses.length >= 2;
            if (canProject) {
                bibleState.commitToProjector();
            }
        } else {
            const presStore = usePresentationStore.getState();
            let targetSlideId = presStore.previewSlideId || presStore.activePresentation?.slides?.[0]?.id || presStore.selectedPresentation?.slides?.[0]?.id;
            let pres = presStore.selectedPresentation || presStore.activePresentation;

            if (!targetSlideId && presStore.activePresentationId) {
                const dbPres = await db.presentationFiles.get(presStore.activePresentationId);
                if (dbPres && dbPres.slides?.length) {
                    targetSlideId = dbPres.slides[0].id;
                    pres = dbPres;
                    if (!presStore.activePresentation) {
                        await presStore.setActivePresentation(presStore.activePresentationId);
                    }
                }
            }

            if (targetSlideId) {
                if (!presStore.previewSlideId) {
                    await presStore.setPreviewSlide(targetSlideId);
                } else {
                    // If currently sitting on a master-presentation/nested container tile, auto-enter its first slide
                    const currentContainer = pres?.slides?.find(s => s.id === targetSlideId);
                    const isNestedContainer = currentContainer && (
                        currentContainer.type === 'nested' ||
                        (currentContainer.type === 'normal' && Boolean((currentContainer as { masterPresentationId?: string }).masterPresentationId))
                    );
                    if (isNestedContainer) {
                        await presStore.setPreviewSlide(targetSlideId, pres?.id || presStore.activePresentationId || undefined);
                    }
                }

                const freshStore = usePresentationStore.getState();
                targetSlideId = freshStore.previewSlideId || targetSlideId;
                pres = freshStore.selectedPresentation || freshStore.activePresentation;

                let slide = pres?.slides?.find(s => s.id === targetSlideId);
                let resolvedPresId = slide ? pres?.id : undefined;
                if (!slide) {
                    slide = freshStore.activePresentation?.slides?.find(s => s.id === targetSlideId);
                    if (slide) resolvedPresId = freshStore.activePresentation?.id;
                }
                if (!slide && freshStore.navigationParentSlideId) {
                    const parentCached = freshStore.nestedPresentationsCache[freshStore.navigationParentSlideId];
                    const s = parentCached?.slides?.find((sl) => sl.id === targetSlideId);
                    if (s && parentCached) {
                        slide = s;
                        resolvedPresId = parentCached.id;
                    }
                }
                if (!slide) {
                    for (const p of Object.values(freshStore.nestedPresentationsCache)) {
                        const s = p.slides?.find((sl) => sl.id === targetSlideId);
                        if (s) {
                            slide = s;
                            resolvedPresId = p.id;
                            break;
                        }
                    }
                }
                const targetParentSlideId = resolvedPresId !== freshStore.activePresentationId
                    ? freshStore.navigationParentSlideId
                    : null;
                freshStore.setLiveSlide(
                    targetSlideId,
                    resolvedPresId,
                    freshStore.activePresentationId || undefined,
                    targetParentSlideId,
                    freshStore.navigationParentPresentationId
                );
                if (slide) {
                    LiveSyncService.showSlide(
                        slide,
                        resolvedPresId,
                        freshStore.activePresentationId || undefined,
                        targetParentSlideId
                    );
                }
            }
        }

        await openProjector();
    }, [appMode, projectorOpen, projectorIsLive, liveSlideId, previewSlideId, closeProjector, openProjector]);
}

