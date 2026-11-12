import { db } from '@/core/db';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

/**
 * Traverses forward to the next slide, handling nested stacks and parent returns.
 */
export async function performNavigateNext(
    get: GetFn,
    set: SetFn,
    detached = false,
    preferLiveAnchor = false
): Promise<void> {
    const {
        activePresentationId,
        selectedPresentationId,
        selectedPresentation,
        previewSlideId,
        setPreviewSlide,
        setLiveSlide,
        liveSlideId,
        activePresentation,
        presentationStack
    } = get();

    if (!activePresentationId) return;

    const currentPresId = selectedPresentationId || activePresentationId;
    const presentation = (activePresentation && activePresentation.id === currentPresId)
        ? activePresentation
        : (selectedPresentation && selectedPresentation.id === currentPresId)
            ? selectedPresentation
            : await db.presentationFiles.get(currentPresId);

    if (!presentation || !presentation.slides?.length) return;

    const slides = presentation.slides;
    const anchorId = (preferLiveAnchor && liveSlideId)
        ? liveSlideId
        : (previewSlideId || (slides.length > 0 ? slides[0].id : null));

    let idx = -1;
    if (anchorId) {
        idx = slides.findIndex(s => s.id === anchorId);
    }
    if (idx === -1) idx = 0;

    // Boundary: End of current presentation -> Pop stack or return to parent
    if (idx === slides.length - 1) {
        if (presentationStack.length > 0 || currentPresId !== activePresentationId) {
            let parentPresId: string | null | undefined;
            let parentNestedSlideId: string | null | undefined;
            const stack = [...presentationStack];

            if (stack.length > 0) {
                const lastState = stack.pop()!;
                parentPresId = lastState.presentationId;
                parentNestedSlideId = lastState.parentNestedSlideId;
                set({ presentationStack: stack, navigationDirection: 'forward' });
            } else {
                parentPresId = preferLiveAnchor
                    ? (get().liveNavigationParentPresentationId || activePresentationId)
                    : (get().navigationParentPresentationId || activePresentationId);
                parentNestedSlideId = preferLiveAnchor ? get().liveNavigationParentSlideId : get().navigationParentSlideId;
            }

            const parentPres = parentPresId ? await db.presentationFiles.get(parentPresId) : null;
            if (parentPres && parentNestedSlideId) {
                const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                if (parentIdx !== -1) {
                    const nextIdx = Math.min(parentPres.slides.length - 1, parentIdx + 1);
                    const nextId = parentPres.slides[nextIdx].id;
                    const nextParentSlideId = stack.length > 0 ? stack[stack.length - 1].parentNestedSlideId : null;

                    if (preferLiveAnchor) {
                        const isSynced = !detached && liveSlideId === previewSlideId;
                        if (isSynced) {
                            await setPreviewSlide(nextId, parentPres.id, undefined, nextParentSlideId);
                            const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                            setLiveSlide(pId!, sId || undefined, undefined, npId);
                        } else {
                            setLiveSlide(nextId, parentPres.id, undefined, nextParentSlideId);
                        }
                    } else {
                        await setPreviewSlide(nextId, parentPres.id, undefined, nextParentSlideId);
                        if (!detached && liveSlideId) {
                            const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                            setLiveSlide(pId!, sId || undefined, undefined, npId);
                        }
                    }
                    return;
                }
            }
        }
    }

    const nextIdx = Math.min(slides.length - 1, idx + 1);
    const nextId = slides[nextIdx].id;

    if (preferLiveAnchor) {
        set({ navigationDirection: 'forward' });
        const isSynced = !detached && liveSlideId === previewSlideId;
        if (isSynced) {
            await setPreviewSlide(nextId, currentPresId);
            const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
            setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
        } else {
            setLiveSlide(nextId, currentPresId, undefined, get().navigationParentSlideId);
        }
    } else {
        set({ navigationDirection: 'forward' });
        await setPreviewSlide(nextId, currentPresId);
        if (!detached && liveSlideId) {
            const { previewSlideId: pId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
            setLiveSlide(pId!, sId || undefined, undefined, npId);
        }
    }
}

/**
 * Traverses backward to the previous slide, handling nested stacks and parent returns.
 */
export async function performNavigatePrev(
    get: GetFn,
    set: SetFn,
    detached = false,
    preferLiveAnchor = false
): Promise<void> {
    const {
        activePresentationId,
        selectedPresentationId,
        selectedPresentation,
        previewSlideId,
        setPreviewSlide,
        setLiveSlide,
        liveSlideId,
        activePresentation,
        presentationStack
    } = get();

    if (!activePresentationId) return;

    const currentPresId = selectedPresentationId || activePresentationId;
    const presentation = (activePresentation && activePresentation.id === currentPresId)
        ? activePresentation
        : await db.presentationFiles.get(currentPresId);

    if (!presentation || !presentation.slides?.length) return;

    const slides = presentation.slides;
    const anchorId = (preferLiveAnchor && liveSlideId)
        ? liveSlideId
        : (previewSlideId || (slides.length > 0 ? slides[0].id : null));

    let idx = -1;
    if (anchorId) {
        idx = slides.findIndex(s => s.id === anchorId);
    }
    if (idx === -1) idx = slides.length - 1;

    // Boundary: Start of presentation -> Pop stack or return to previous parent slide
    if (idx === 0) {
        if (presentationStack.length > 0 || currentPresId !== activePresentationId) {
            let parentPresId: string | null | undefined;
            let parentNestedSlideId: string | null | undefined;
            const stack = [...presentationStack];

            if (stack.length > 0) {
                const lastState = stack.pop()!;
                parentPresId = lastState.presentationId;
                parentNestedSlideId = lastState.parentNestedSlideId;
                set({ presentationStack: stack, navigationDirection: 'backward' });
            } else {
                parentPresId = preferLiveAnchor
                    ? (get().liveNavigationParentPresentationId || activePresentationId)
                    : (get().navigationParentPresentationId || activePresentationId);
                parentNestedSlideId = preferLiveAnchor ? get().liveNavigationParentSlideId : get().navigationParentSlideId;
            }

            const parentPres = parentPresId ? await db.presentationFiles.get(parentPresId) : null;
            if (parentPres && parentNestedSlideId) {
                const parentIdx = parentPres.slides.findIndex(s => s.id === parentNestedSlideId);
                if (parentIdx !== -1) {
                    const prevIdx = Math.max(0, parentIdx - 1);
                    const prevId = parentPres.slides[prevIdx].id;
                    const prevParentSlideId = stack.length > 0 ? stack[stack.length - 1].parentNestedSlideId : null;

                    if (preferLiveAnchor) {
                        const isSynced = !detached && liveSlideId === previewSlideId;
                        if (isSynced) {
                            await setPreviewSlide(prevId, parentPres.id, undefined, prevParentSlideId);
                            const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                            setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
                        } else {
                            setLiveSlide(prevId, parentPres.id, undefined, prevParentSlideId);
                        }
                    } else {
                        await setPreviewSlide(prevId, parentPres.id, undefined, prevParentSlideId);
                        if (!detached && liveSlideId) {
                            const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
                            setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
                        }
                    }
                    return;
                }
            }
        }
    }

    const prevIdx = Math.max(0, idx - 1);
    const prevId = slides[prevIdx].id;

    if (preferLiveAnchor) {
        set({ navigationDirection: 'backward' });
        const isSynced = !detached && liveSlideId === previewSlideId;
        if (isSynced) {
            await setPreviewSlide(prevId, currentPresId);
            const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
            setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
        } else {
            setLiveSlide(prevId, currentPresId, undefined, get().navigationParentSlideId);
        }
    } else {
        set({ navigationDirection: 'backward' });
        await setPreviewSlide(prevId, currentPresId);
        if (!detached && liveSlideId) {
            const { previewSlideId: resolvedId, selectedPresentationId: sId, navigationParentSlideId: npId } = get();
            setLiveSlide(resolvedId!, sId || undefined, undefined, npId);
        }
    }
}
