import { db } from '@/core/db';
import type { ISlide, ICanvasSlide, ICanvasItem } from '@/core/types';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

/**
 * Duplicates a single slide and inserts it immediately after the original.
 */
export async function performDuplicateSlide(
    get: GetFn,
    set: SetFn,
    presentationId: string,
    slideId: string
): Promise<void> {
    const pres = await db.presentationFiles.get(presentationId);
    if (!pres) return;

    const slideIdx = pres.slides.findIndex(s => s.id === slideId);
    if (slideIdx === -1) return;

    await get().takeSnapshot(presentationId);

    const original = pres.slides[slideIdx];
    const newId = crypto.randomUUID();
    const newSlide: ISlide = {
        ...original,
        id: newId,
        order: slideIdx + 1,
        isExpanded: false,
    };

    if (newSlide.type === 'normal') {
        const canvasSlide = newSlide as ICanvasSlide;
        canvasSlide.content = {
            ...canvasSlide.content,
            canvasItems: (canvasSlide.content.canvasItems || []).map(item => ({
                ...item,
                id: crypto.randomUUID()
            }))
        };
    }

    const newSlides = [...pres.slides];
    newSlides.splice(slideIdx + 1, 0, newSlide);

    // Duplicate associated audio scopes
    const scopes = await db.audioScopes.where({ startSlideId: slideId }).toArray();
    for (const scope of scopes) {
        const length = pres.slides.findIndex(s => s.id === scope.endSlideId) - pres.slides.findIndex(s => s.id === scope.startSlideId);
        const targetEndIdx = (slideIdx + 1) + (length > 0 ? length : 0);
        const finalEndIdx = Math.min(newSlides.length - 1, targetEndIdx);
        
        await db.audioScopes.add({
            ...structuredClone(scope),
            id: crypto.randomUUID(),
            startSlideId: newId,
            endSlideId: newSlides[finalEndIdx].id
        });
    }

    const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
    await get().updatePresentationSlides(presentationId, ordered);

    await get().setPreviewSlide(newSlide.id, presentationId);
    set({ selectedSlideIds: [newSlide.id] });
}

/**
 * Duplicates multiple slides preserving order and updating audio scope associations.
 */
export async function performDuplicateSlides(
    get: GetFn,
    set: SetFn,
    presentationId: string,
    slideIds: string[]
): Promise<void> {
    if (slideIds.length === 0) return;
    const pres = await db.presentationFiles.get(presentationId);
    if (!pres) return;

    await get().takeSnapshot(presentationId);

    const newSlides = [...pres.slides];
    const createdSlideIds: string[] = [];
    const slideIdMap = new Map<string, string>();

    const sortedIndices = slideIds.map(id => pres.slides.findIndex(s => s.id === id)).sort((a, b) => a - b);
    const lastIdx = sortedIndices[sortedIndices.length - 1];
    let insertionIdx = lastIdx + 1;

    const allScopes = await db.audioScopes.where('presentationId').equals(presentationId).toArray();

    for (const slideId of slideIds.sort((a, b) => pres.slides.findIndex(s => s.id === a) - pres.slides.findIndex(s => s.id === b))) {
        const original = pres.slides.find(s => s.id === slideId);
        if (!original) continue;

        const newId = crypto.randomUUID();
        slideIdMap.set(slideId, newId);
        const newSlide: ISlide = structuredClone(original);
        newSlide.id = newId;
        newSlide.isExpanded = false;

        if (newSlide.type === 'normal' && newSlide.content && newSlide.content.canvasItems) {
            newSlide.content.canvasItems = newSlide.content.canvasItems.map((item: ICanvasItem) => ({
                ...item,
                id: crypto.randomUUID()
            }));
        }

        newSlides.splice(insertionIdx, 0, newSlide);
        createdSlideIds.push(newSlide.id);
        insertionIdx++;
    }

    for (const slideId of slideIdMap.keys()) {
        const scopes = allScopes.filter(s => s.startSlideId === slideId);
        for (const scope of scopes) {
            const startIdx = pres.slides.findIndex(s => s.id === scope.startSlideId);
            const endIdx = pres.slides.findIndex(s => s.id === scope.endSlideId);
            const length = endIdx - startIdx;
            
            const newStartId = slideIdMap.get(slideId)!;
            let newEndId: string;
            if (slideIdMap.has(scope.endSlideId)) {
                newEndId = slideIdMap.get(scope.endSlideId)!;
            } else {
                const newStartInTotal = newSlides.findIndex(s => s.id === newStartId);
                const targetEndInTotal = Math.min(newSlides.length - 1, newStartInTotal + length);
                newEndId = newSlides[targetEndInTotal].id;
            }

            await db.audioScopes.add({
                ...structuredClone(scope),
                id: crypto.randomUUID(),
                startSlideId: newStartId,
                endSlideId: newEndId
            });
        }
    }

    const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
    await get().updatePresentationSlides(presentationId, ordered);

    if (createdSlideIds.length > 0) {
        const originalPreviewId = get().previewSlideId;
        const targetPreviewId = (originalPreviewId && slideIdMap.get(originalPreviewId)) || createdSlideIds[0];

        await get().setPreviewSlide(targetPreviewId, presentationId);
        set({ selectedSlideIds: createdSlideIds });
    }
}

