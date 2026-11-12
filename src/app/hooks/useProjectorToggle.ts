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
                    presStore.setPreviewSlide(targetSlideId);
                }
                presStore.setLiveSlide(targetSlideId);

                let slide = pres?.slides?.find(s => s.id === targetSlideId);
                if (!slide) {
                    for (const p of Object.values(presStore.nestedPresentationsCache)) {
                        const s = p.slides?.find((sl) => sl.id === targetSlideId);
                        if (s) { slide = s; break; }
                    }
                }
                if (slide) {
                    LiveSyncService.showSlide(
                        slide,
                        pres?.id,
                        presStore.activePresentationId || undefined,
                        presStore.liveNavigationParentSlideId || null
                    );
                }
            }
        }

        await openProjector();
    }, [appMode, projectorOpen, projectorIsLive, liveSlideId, previewSlideId, closeProjector, openProjector]);
}

