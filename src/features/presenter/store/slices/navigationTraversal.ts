import { db } from '@/core/db';
import { ICanvasSlide, INestedSlide, IPresentationFile } from '@/core/types';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

// Prevents overlapping async key-repeat calls from racing on presentationStack / previewSlideId
let isTraversing = false;

async function resolvePresentation(state: PresentationState, presId: string | null | undefined): Promise<IPresentationFile | null> {
    if (!presId) return null;
    if (state.activePresentation && state.activePresentation.id === presId) return state.activePresentation;
    if (state.selectedPresentation && state.selectedPresentation.id === presId) return state.selectedPresentation;
    if (state.nestedPresentationsCache[presId]) return state.nestedPresentationsCache[presId];
    return (await db.presentationFiles.get(presId)) || null;
}

/**
 * Traverses forward to the next slide, handling nested stacks and parent returns.
 * Stops cleanly at the absolute end of the root timeline (never wraps around).
 */
export async function performNavigateNext(
    get: GetFn,
    set: SetFn,
    detached = false,
    preferLiveAnchor = false
): Promise<void> {
    if (isTraversing) return;
    isTraversing = true;
    try {
        const state = get();
        const {
            activePresentationId,
            selectedPresentationId,
            previewSlideId,
            setPreviewSlide,
            setLiveSlide,
            liveSlideId,
            presentationStack
        } = state;

        if (!activePresentationId) return;

        const currentPresId = selectedPresentationId || activePresentationId;
        const presentation = await resolvePresentation(state, currentPresId);

        if (!presentation || !presentation.slides?.length) return;

        const slides = presentation.slides;
        const useLiveAnchor = preferLiveAnchor && Boolean(liveSlideId);
        const anchorId = useLiveAnchor
            ? liveSlideId
            : (previewSlideId || (slides.length > 0 ? slides[0].id : null));

        let idx = -1;
        if (anchorId) {
            idx = slides.findIndex(s => s.id === anchorId);
        }
        if (idx === -1) idx = 0;

        // If the user clicked a nested/master-presentation container tile (which already previews slide 0)
        // and presses Right, enter that nested presentation and advance directly to slide 1 (or 0 if single-slide).
        const currentSlide = slides[idx];
        const currentMasterId = currentSlide?.type === 'nested'
            ? (currentSlide as INestedSlide).presentationId
            : (currentSlide?.type === 'normal' ? (currentSlide as ICanvasSlide).masterPresentationId : undefined);
        if (currentSlide && (currentSlide.type === 'nested' || currentMasterId)) {
            set({ navigationDirection: 'forward' });
            await setPreviewSlide(currentSlide.id, currentPresId);
            const entered = get();
            if (entered.selectedPresentation && entered.selectedPresentation.slides.length > 1) {
                const secondSlideId = entered.selectedPresentation.slides[1].id;
                await setPreviewSlide(secondSlideId, entered.selectedPresentation.id, undefined, entered.navigationParentSlideId);
            }
            if (!detached && liveSlideId) {
                const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                setLiveSlide(pId!, sId || undefined, undefined, npId);
            }
            return;
        }

        // Boundary: End of current presentation -> Walk up stack without mutating until an ancestor has a next slide
        if (idx === slides.length - 1) {
            if (presentationStack.length > 0 || currentPresId !== activePresentationId) {
                const candidateStack = [...presentationStack];
                let parentPresId: string | null | undefined;
                let parentNestedSlideId: string | null | undefined;
                let targetParentPres: IPresentationFile | null = null;
                let targetNextIdx = -1;

                while (candidateStack.length > 0) {
                    const lastState = candidateStack.pop()!;
                    parentPresId = lastState.presentationId;
                    parentNestedSlideId = lastState.parentNestedSlideId;
                    const parentPres = await resolvePresentation(get(), parentPresId);
                    if (parentPres && parentNestedSlideId) {
                        const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                        if (parentIdx !== -1 && parentIdx < parentPres.slides.length - 1) {
                            targetParentPres = parentPres;
                            targetNextIdx = parentIdx + 1;
                            break;
                        }
                    }
                }

                // Fallback when stack was empty (e.g. entered nested slide via direct click on expanded timeline)
                if (!targetParentPres && presentationStack.length === 0 && currentPresId !== activePresentationId) {
                    parentPresId = useLiveAnchor
                        ? (get().liveNavigationParentPresentationId || activePresentationId)
                        : (get().navigationParentPresentationId || activePresentationId);
                    parentNestedSlideId = useLiveAnchor ? get().liveNavigationParentSlideId : get().navigationParentSlideId;
                    const parentPres = await resolvePresentation(get(), parentPresId);
                    if (parentPres && parentNestedSlideId) {
                        const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                        if (parentIdx !== -1 && parentIdx < parentPres.slides.length - 1) {
                            targetParentPres = parentPres;
                            targetNextIdx = parentIdx + 1;
                        }
                    }
                }

                // Absolute end of root presentation: stay on the last nested slide, do not wrap or mutate stack
                if (!targetParentPres || targetNextIdx === -1) {
                    return;
                }

                set({ presentationStack: candidateStack, navigationDirection: 'forward' });
                const nextId = targetParentPres.slides[targetNextIdx].id;
                const nextParentSlideId = candidateStack.length > 0 ? candidateStack[candidateStack.length - 1].parentNestedSlideId : null;

                if (useLiveAnchor) {
                    const isSynced = !detached && liveSlideId === previewSlideId;
                    if (isSynced) {
                        await setPreviewSlide(nextId, targetParentPres.id, undefined, nextParentSlideId);
                        const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                        setLiveSlide(pId!, sId || undefined, undefined, npId);
                    } else {
                        setLiveSlide(nextId, targetParentPres.id, undefined, nextParentSlideId);
                    }
                } else {
                    await setPreviewSlide(nextId, targetParentPres.id, undefined, nextParentSlideId);
                    if (!detached && liveSlideId) {
                        const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                        setLiveSlide(pId!, sId || undefined, undefined, npId);
                    }
                }
                return;
            }
            // At absolute last slide of root presentation -> do nothing
            return;
        }

        const nextIdx = Math.min(slides.length - 1, idx + 1);
        const nextId = slides[nextIdx].id;

        if (useLiveAnchor) {
            set({ navigationDirection: 'forward' });
            const isSynced = !detached && liveSlideId === previewSlideId;
            if (isSynced) {
                await setPreviewSlide(nextId, currentPresId);
                const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
            } else {
                setLiveSlide(nextId, currentPresId, undefined, get().liveNavigationParentSlideId);
            }
        } else {
            set({ navigationDirection: 'forward' });
            await setPreviewSlide(nextId, currentPresId);
            if (!detached && liveSlideId) {
                const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                setLiveSlide(pId!, sId || undefined, undefined, npId);
            }
        }
    } finally {
        isTraversing = false;
    }
}

/**
 * Traverses backward to the previous slide, handling nested stacks and parent returns.
 * Stops cleanly at the absolute start of the root timeline (never wraps around).
 */
export async function performNavigatePrev(
    get: GetFn,
    set: SetFn,
    detached = false,
    preferLiveAnchor = false
): Promise<void> {
    if (isTraversing) return;
    isTraversing = true;
    try {
        const state = get();
        const {
            activePresentationId,
            selectedPresentationId,
            previewSlideId,
            setPreviewSlide,
            setLiveSlide,
            liveSlideId,
            presentationStack
        } = state;

        if (!activePresentationId) return;

        const currentPresId = selectedPresentationId || activePresentationId;
        const presentation = await resolvePresentation(state, currentPresId);

        if (!presentation || !presentation.slides?.length) return;

        const slides = presentation.slides;
        const useLiveAnchor = preferLiveAnchor && Boolean(liveSlideId);
        const anchorId = useLiveAnchor
            ? liveSlideId
            : (previewSlideId || (slides.length > 0 ? slides[0].id : null));

        let idx = -1;
        if (anchorId) {
            idx = slides.findIndex(s => s.id === anchorId);
        }
        if (idx === -1) idx = slides.length - 1;

        // Boundary: Start of current presentation -> Walk up stack without mutating until an ancestor has a previous slide
        if (idx === 0) {
            if (presentationStack.length > 0 || currentPresId !== activePresentationId) {
                const candidateStack = [...presentationStack];
                let parentPresId: string | null | undefined;
                let parentNestedSlideId: string | null | undefined;
                let targetParentPres: IPresentationFile | null = null;
                let targetPrevIdx = -1;

                while (candidateStack.length > 0) {
                    const lastState = candidateStack.pop()!;
                    parentPresId = lastState.presentationId;
                    parentNestedSlideId = lastState.parentNestedSlideId;
                    const parentPres = await resolvePresentation(get(), parentPresId);
                    if (parentPres && parentNestedSlideId) {
                        const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                        if (parentIdx > 0) {
                            targetParentPres = parentPres;
                            targetPrevIdx = parentIdx - 1;
                            break;
                        }
                    }
                }

                // Fallback when stack was empty (e.g. entered nested slide via direct click on expanded timeline)
                if (!targetParentPres && presentationStack.length === 0 && currentPresId !== activePresentationId) {
                    parentPresId = useLiveAnchor
                        ? (get().liveNavigationParentPresentationId || activePresentationId)
                        : (get().navigationParentPresentationId || activePresentationId);
                    parentNestedSlideId = useLiveAnchor ? get().liveNavigationParentSlideId : get().navigationParentSlideId;
                    const parentPres = await resolvePresentation(get(), parentPresId);
                    if (parentPres && parentNestedSlideId) {
                        const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                        if (parentIdx > 0) {
                            targetParentPres = parentPres;
                            targetPrevIdx = parentIdx - 1;
                        }
                    }
                }

                // Absolute start of root presentation: stay on slide 0, do not wrap or mutate stack
                if (!targetParentPres || targetPrevIdx === -1) {
                    return;
                }

                set({ presentationStack: candidateStack, navigationDirection: 'backward' });
                const prevId = targetParentPres.slides[targetPrevIdx].id;
                const prevParentSlideId = candidateStack.length > 0 ? candidateStack[candidateStack.length - 1].parentNestedSlideId : null;

                if (useLiveAnchor) {
                    const isSynced = !detached && liveSlideId === previewSlideId;
                    if (isSynced) {
                        await setPreviewSlide(prevId, targetParentPres.id, undefined, prevParentSlideId);
                        const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                        setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
                    } else {
                        setLiveSlide(prevId, targetParentPres.id, undefined, prevParentSlideId);
                    }
                } else {
                    await setPreviewSlide(prevId, targetParentPres.id, undefined, prevParentSlideId);
                    if (!detached && liveSlideId) {
                        const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                        setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
                    }
                }
                return;
            }
            // At absolute first slide of root presentation -> do nothing
            return;
        }

        const prevIdx = Math.max(0, idx - 1);
        const prevId = slides[prevIdx].id;

        if (useLiveAnchor) {
            set({ navigationDirection: 'backward' });
            const isSynced = !detached && liveSlideId === previewSlideId;
            if (isSynced) {
                await setPreviewSlide(prevId, currentPresId);
                const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
            } else {
                setLiveSlide(prevId, currentPresId, undefined, get().liveNavigationParentSlideId);
            }
        } else {
            set({ navigationDirection: 'backward' });
            await setPreviewSlide(prevId, currentPresId);
            if (!detached && liveSlideId) {
                const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
            }
        }
    } finally {
        isTraversing = false;
    }
}
