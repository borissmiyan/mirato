import { db } from '@/core/db';
import type { ISlide, ICanvasItem } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

/**
 * Copies or cuts slide identifiers into store clipboard state.
 */
export function performCopySlides(
    set: SetFn,
    presentationId: string,
    slideIds: string[],
    isCut?: boolean
): void {
    if (slideIds.length === 0) return;
    set({ clipboard: { presentationId, slideIds, isCut: !!isCut } });
    toast.success(isCut ? i18n.t('slides_cut', 'Slides cut to clipboard') : i18n.t('slides_copied', 'Slides copied to clipboard'));
}

/**
 * Pastes clipboard slides into target presentation at target index.
 */
export async function performPasteSlides(
    get: GetFn,
    set: SetFn,
    presentationId: string,
    targetIndex?: number
): Promise<void> {
    const { clipboard } = get();
    if (!clipboard || clipboard.slideIds.length === 0) return;

    const sourcePres = await db.presentationFiles.get(clipboard.presentationId);
    const targetPres = await db.presentationFiles.get(presentationId);
    if (!sourcePres || !targetPres) return;

    await get().takeSnapshot(presentationId);

    const slidesToPaste = sourcePres.slides.filter(s => clipboard.slideIds.includes(s.id));
    if (slidesToPaste.length === 0) return;

    const sourceScopes = await db.audioScopes.where('presentationId').equals(clipboard.presentationId).toArray();
    const relatedScopes = sourceScopes.filter(s => clipboard.slideIds.includes(s.startSlideId));

    const slideIdMap = new Map<string, string>();
    const newSlidesToInsert: ISlide[] = slidesToPaste.map(s => {
        const cloned: ISlide = structuredClone(s);
        const newId = crypto.randomUUID();
        slideIdMap.set(s.id, newId);
        cloned.id = newId;
        if (cloned.type === 'normal' && cloned.content && cloned.content.canvasItems) {
            cloned.content.canvasItems = cloned.content.canvasItems.map((item: ICanvasItem) => ({
                ...item,
                id: crypto.randomUUID()
            }));
        }
        return cloned;
    });

    const updatedTargetSlides = [...targetPres.slides];
    const pasteIdx = targetIndex !== undefined ? targetIndex : updatedTargetSlides.length;
    updatedTargetSlides.splice(pasteIdx, 0, ...newSlidesToInsert);

    for (const scope of relatedScopes) {
        const startIdx = sourcePres.slides.findIndex(s => s.id === scope.startSlideId);
        const endIdx = sourcePres.slides.findIndex(s => s.id === scope.endSlideId);
        const length = endIdx - startIdx;

        const newStartId = slideIdMap.get(scope.startSlideId)!;
        let newEndId: string;

        if (slideIdMap.has(scope.endSlideId)) {
            newEndId = slideIdMap.get(scope.endSlideId)!;
        } else {
            const newStartIdxInTarget = updatedTargetSlides.findIndex(s => s.id === newStartId);
            const targetEndIdxInTarget = Math.min(updatedTargetSlides.length - 1, newStartIdxInTarget + length);
            newEndId = updatedTargetSlides[targetEndIdxInTarget].id;
        }

        await db.audioScopes.add({
            ...structuredClone(scope),
            id: crypto.randomUUID(),
            presentationId,
            startSlideId: newStartId,
            endSlideId: newEndId
        });
    }

    const ordered = updatedTargetSlides.map((s, i) => ({ ...s, order: i }));
    await get().updatePresentationSlides(presentationId, ordered);

    if (clipboard.isCut) {
        await get().removeSlides(clipboard.presentationId, clipboard.slideIds);
        set({ clipboard: null });
    }

    if (newSlidesToInsert.length > 0) {
        const originalPreviewId = get().previewSlideId;
        const targetPreviewId = (originalPreviewId && slideIdMap.get(originalPreviewId)) || newSlidesToInsert[0].id;
        await get().setPreviewSlide(targetPreviewId, presentationId);
        set({ selectedSlideIds: newSlidesToInsert.map(s => s.id) });
    }
}

