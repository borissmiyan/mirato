import { useEffect, useRef } from 'react';
import { IPresentationFile, ISlide } from '@/core/types';
import { TimelineItem } from './useTimelineLayout';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { ipcService } from '@/core/services/ipcService';

interface UseTimelineLiveSyncProps {
    appMode: string;
    liveSlideId: string | null;
    previewSlideId: string | null;
    activePresentationId: string | null;
    selectedPresentationId: string | null;
    activePresentation: IPresentationFile | null;
    selectedPresentation: IPresentationFile | null;
    visualTimeline: TimelineItem[];
    navigationParentSlideId: string | null;
}

/**
 * Encapsulates live and preview slide synchronization to the secondary display / projector,
 * along with projector-ready recovery events.
 */
export function useTimelineLiveSync({
    appMode,
    liveSlideId,
    previewSlideId,
    activePresentationId,
    selectedPresentationId,
    activePresentation,
    selectedPresentation,
    visualTimeline,
    navigationParentSlideId,
}: UseTimelineLiveSyncProps) {
    const lastSentLiveRef = useRef<{ slideId: string | null; presId?: string; parentId?: string | null; slideRef?: ISlide | null } | null>(null);
    const lastSentPreviewRef = useRef<{ slideId: string | null; presId?: string; parentId?: string | null; slideRef?: ISlide | null } | null>(null);

    // Sync Live slide to projector
    useEffect(() => {
        if (appMode !== 'presentation' && appMode !== 'hymns') {
            lastSentLiveRef.current = null;
            return;
        }
        if (!liveSlideId) {
            if (lastSentLiveRef.current?.slideId !== null) {
                LiveSyncService.clear();
                lastSentLiveRef.current = { slideId: null };
            }
            return;
        }

        const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId)
            ? selectedPresentation
            : activePresentation;

        // Try to match based on the combination of liveSlideId and navigationParentSlideId
        const liveItem = visualTimeline.find(item =>
            item.id === liveSlideId &&
            (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
        );

        let targetSlide = liveItem?.slide;
        let targetPresId = liveItem?.presentationId;
        let targetParentId = liveItem?.parentSlideId || null;

        if (!targetSlide) {
            targetSlide = pres?.slides.find(s => s.id === liveSlideId);
            targetPresId = selectedPresentationId || activePresentationId || undefined;
            targetParentId = navigationParentSlideId;

            // Fallback
            if (!targetSlide) {
                targetSlide = activePresentation?.slides.find(s => s.id === liveSlideId);
                if (targetSlide) targetPresId = activePresentationId || undefined;
            }
        }

        if (targetSlide) {
            const prev = lastSentLiveRef.current;
            if (prev?.slideId === liveSlideId && prev?.presId === targetPresId && prev?.parentId === targetParentId && prev?.slideRef === targetSlide) {
                return;
            }
            lastSentLiveRef.current = { slideId: liveSlideId, presId: targetPresId, parentId: targetParentId, slideRef: targetSlide };
            LiveSyncService.showSlide(targetSlide, targetPresId, activePresentationId || undefined, targetParentId);
        }
    }, [liveSlideId, selectedPresentationId, selectedPresentation, activePresentationId, activePresentation, visualTimeline, appMode, navigationParentSlideId]);

    // Sync preview slide to projector for background preloading
    useEffect(() => {
        if ((appMode !== 'presentation' && appMode !== 'hymns') || !previewSlideId) {
            if (lastSentPreviewRef.current?.slideId !== null) {
                LiveSyncService.showPreviewSlide(null);
                lastSentPreviewRef.current = { slideId: null };
            }
            return;
        }

        const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId)
            ? selectedPresentation
            : activePresentation;

        const previewItem = visualTimeline.find(item =>
            item.id === previewSlideId &&
            (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
        );

        let targetSlide = previewItem?.slide;
        let targetPresId = previewItem?.presentationId;
        let targetParentId = previewItem?.parentSlideId || null;

        if (!targetSlide) {
            targetSlide = pres?.slides.find(s => s.id === previewSlideId);
            targetPresId = selectedPresentationId || activePresentationId || undefined;
            targetParentId = navigationParentSlideId;

            // Fallback
            if (!targetSlide) {
                targetSlide = activePresentation?.slides.find(s => s.id === previewSlideId);
                if (targetSlide) targetPresId = activePresentationId || undefined;
            }
        }

        if (targetSlide) {
            const prev = lastSentPreviewRef.current;
            if (prev?.slideId === previewSlideId && prev?.presId === targetPresId && prev?.parentId === targetParentId && prev?.slideRef === targetSlide) {
                return;
            }
            lastSentPreviewRef.current = { slideId: previewSlideId, presId: targetPresId, parentId: targetParentId, slideRef: targetSlide };
            LiveSyncService.showPreviewSlide(targetSlide, targetPresId, activePresentationId || undefined, targetParentId);
        }
    }, [previewSlideId, selectedPresentationId, selectedPresentation, activePresentationId, activePresentation, visualTimeline, appMode, navigationParentSlideId]);

    // Recover state on projector ready
    useEffect(() => {
        if (!ipcService.isElectron()) return;
        const unsub = ipcService.on('projector-ready', () => {
            if ((appMode === 'presentation' || appMode === 'hymns') && liveSlideId) {
                const liveItem = visualTimeline.find(item =>
                    item.id === liveSlideId &&
                    (navigationParentSlideId ? item.parentSlideId === navigationParentSlideId : true)
                );

                if (liveItem?.slide) {
                    LiveSyncService.showSlide(liveItem.slide, liveItem.presentationId, activePresentationId || undefined, liveItem.parentSlideId || null);
                } else {
                    const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId)
                        ? selectedPresentation
                        : activePresentation;

                    const slide = pres?.slides.find(s => s.id === liveSlideId);
                    const currentPresId = slide ? (selectedPresentationId || activePresentationId) : null;

                    if (slide) {
                        LiveSyncService.showSlide(slide, currentPresId || undefined, activePresentationId || undefined, navigationParentSlideId);
                    }
                }
            }
        });
        return () => unsub?.();
    }, [appMode, liveSlideId, visualTimeline, selectedPresentation, selectedPresentationId, activePresentation, activePresentationId, navigationParentSlideId]);
}

