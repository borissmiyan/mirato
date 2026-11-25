import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ICanvasSlide, INestedSlide, IPresentationFile, ISlide } from '@/core/types';
import { TimelineItem } from './useTimelineLayout';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { hasPendingLiveUpdateAtom, liveUpdateTriggerAtom } from '@/core/store/liveSyncAtoms';
import { isEqual } from '@/core/utils/isEqual';

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
 * Encapsulates live slide synchronization to the secondary display / projector.
 * - Switching liveSlideId pushes immediately to projector.
 * - Editing the currently live slide does NOT push in real time; instead it sets
 *   hasPendingLiveUpdateAtom = true until the operator clicks "Update Live" (liveUpdateTriggerAtom).
 * - Preview navigation and preview edits never affect live projection.
 */
export function useTimelineLiveSync({
    appMode,
    liveSlideId,
    activePresentationId,
    selectedPresentationId,
    activePresentation,
    selectedPresentation,
    visualTimeline,
}: UseTimelineLiveSyncProps) {
    const liveNavigationParentSlideId = usePresentationStore(s => s.liveNavigationParentSlideId);
    const liveUpdateTrigger = useAtomValue(liveUpdateTriggerAtom);
    const setHasPendingLiveUpdate = useSetAtom(hasPendingLiveUpdateAtom);

    const lastSentLiveRef = useRef<{
        slideId: string | null;
        presId?: string;
        parentId?: string | null;
        slideSnapshot?: ISlide | null;
        trigger: number;
    } | null>(null);

    // Sync Live slide to projector (staged edits for currently live slide)
    useEffect(() => {
        if (appMode !== 'presentation' && appMode !== 'hymns') {
            lastSentLiveRef.current = null;
            setHasPendingLiveUpdate(false);
            return;
        }
        if (!liveSlideId) {
            if (lastSentLiveRef.current?.slideId !== null) {
                LiveSyncService.clear();
                lastSentLiveRef.current = { slideId: null, trigger: liveUpdateTrigger };
            }
            setHasPendingLiveUpdate(false);
            return;
        }

        const pres = (selectedPresentationId && selectedPresentation?.id === selectedPresentationId)
            ? selectedPresentation
            : activePresentation;

        // Match liveSlideId using liveNavigationParentSlideId (never preview's navigationParentSlideId)
        const liveItem = visualTimeline.find(item =>
            item.id === liveSlideId &&
            (liveNavigationParentSlideId ? item.parentSlideId === liveNavigationParentSlideId : true)
        );

        let targetSlide = liveItem?.slide;
        let targetPresId = liveItem?.presentationId;
        let targetParentId = liveItem?.parentSlideId || null;

        if (!targetSlide) {
            targetSlide = pres?.slides.find(s => s.id === liveSlideId);
            targetPresId = selectedPresentationId || activePresentationId || undefined;
            targetParentId = liveNavigationParentSlideId;

            // Fallback: root presentation or nested cache
            if (!targetSlide) {
                targetSlide = activePresentation?.slides.find(s => s.id === liveSlideId);
                if (targetSlide) targetPresId = activePresentationId || undefined;
            }
            if (!targetSlide) {
                const nestedCache = usePresentationStore.getState().nestedPresentationsCache;
                const parentCached = liveNavigationParentSlideId ? nestedCache[liveNavigationParentSlideId] : undefined;
                if (parentCached) {
                    const found = parentCached.slides?.find(s => s.id === liveSlideId);
                    if (found) {
                        targetSlide = found;
                        targetPresId = parentCached.id;
                    }
                }
                if (!targetSlide) {
                    for (const p of Object.values(nestedCache)) {
                        const found = p.slides?.find(s => s.id === liveSlideId);
                        if (found) {
                            targetSlide = found;
                            targetPresId = p.id;
                            break;
                        }
                    }
                }
            }
        }

        if (!targetSlide) return;

        // Never project a master-presentation / nested container shell (e.g. "1 — HYMN TITLE");
        // always unwrap it to its first materialized child slide from visualTimeline or nestedPresentationsCache.
        const isContainerShell = targetSlide.blockId === 'master-presentation'
            || targetSlide.type === 'nested'
            || (targetSlide.type === 'normal' && Boolean((targetSlide as ICanvasSlide).masterPresentationId));
        if (isContainerShell) {
            const containerId = targetSlide.id;
            const masterPresId = targetSlide.type === 'normal'
                ? (targetSlide as ICanvasSlide).masterPresentationId
                : (targetSlide.type === 'nested' ? (targetSlide as INestedSlide).presentationId : undefined);
            const firstNestedItem = visualTimeline.find(
                item => item.type === 'nested' && item.parentSlideId === containerId && item.slide
            );
            if (firstNestedItem?.slide) {
                targetSlide = firstNestedItem.slide;
                targetPresId = firstNestedItem.presentationId || targetPresId;
                targetParentId = containerId;
            } else {
                const nestedCache = usePresentationStore.getState().nestedPresentationsCache;
                const cachedNested = nestedCache[containerId] || (masterPresId ? nestedCache[masterPresId] : undefined);
                if (cachedNested?.slides?.length) {
                    targetSlide = cachedNested.slides[0];
                    targetPresId = cachedNested.id;
                    targetParentId = containerId;
                } else {
                    // Wait until the nested presentation finishes loading/materializing instead of flashing the shell
                    return;
                }
            }
        }

        const effectiveLiveSlideId = targetSlide.id;
        const prev = lastSentLiveRef.current;
        const isNewLiveSlide = !prev || prev.slideId !== effectiveLiveSlideId || prev.presId !== targetPresId || prev.parentId !== targetParentId;
        const isManualPush = prev !== null && prev.trigger !== liveUpdateTrigger;

        if (isNewLiveSlide || isManualPush) {
            lastSentLiveRef.current = {
                slideId: effectiveLiveSlideId,
                presId: targetPresId,
                parentId: targetParentId,
                slideSnapshot: structuredClone(targetSlide),
                trigger: liveUpdateTrigger,
            };
            setHasPendingLiveUpdate(false);
            LiveSyncService.showSlide(targetSlide, targetPresId, activePresentationId || undefined, targetParentId);
            return;
        }

        // Same liveSlideId: check if the operator edited it -> stage update instead of pushing live
        const hasDiff = !isEqual(prev.slideSnapshot, targetSlide);
        setHasPendingLiveUpdate(hasDiff);
    }, [
        liveSlideId,
        selectedPresentationId,
        selectedPresentation,
        activePresentationId,
        activePresentation,
        visualTimeline,
        appMode,
        liveNavigationParentSlideId,
        liveUpdateTrigger,
        setHasPendingLiveUpdate,
    ]);
}

