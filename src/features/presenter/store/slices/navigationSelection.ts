import type { ISlide } from '@/core/types';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

/**
 * Handles multi-select, range-select, and deselect operations for slides.
 */
export function handleToggleSlideSelection(
    get: GetFn,
    set: SetFn,
    id: string,
    multi?: boolean,
    range?: boolean,
    deselect?: boolean,
    slidesList?: ISlide[]
): void {
    const { selectedSlideIds, activePresentation, selectedPresentation, previewSlideId } = get();

    if (deselect) {
        if (!id) {
            set({ selectedSlideIds: [], previewSlideId: null });
            return;
        }
        if (selectedSlideIds.includes(id)) {
            const newSelected = selectedSlideIds.filter(sid => sid !== id);
            const newPreviewId = previewSlideId === id
                ? (newSelected.length > 0 ? newSelected[newSelected.length - 1] : null)
                : previewSlideId;
            set({ selectedSlideIds: newSelected, previewSlideId: newPreviewId });
        }
        return;
    }

    if (range) {
        const anchorId = previewSlideId || (selectedSlideIds.length > 0 ? selectedSlideIds[0] : null);
        if (!anchorId) {
            set({ selectedSlideIds: [id], previewSlideId: id });
            return;
        }
        const slides = slidesList || activePresentation?.slides || selectedPresentation?.slides || [];
        const lastIdx = slides.findIndex(s => s.id === anchorId);
        const currentIdx = slides.findIndex(s => s.id === id);

        if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            const rangeIds = slides.slice(start, end + 1).map(s => s.id);
            set({ selectedSlideIds: Array.from(new Set([...selectedSlideIds, ...rangeIds])), previewSlideId: id });
        } else {
            set({ selectedSlideIds: [id], previewSlideId: id });
        }
        return;
    }

    if (multi) {
        const isCurrentlySelected = selectedSlideIds.includes(id);
        const newSelected = isCurrentlySelected
            ? selectedSlideIds.filter(sid => sid !== id)
            : [...selectedSlideIds, id];
        const newPreviewId = isCurrentlySelected
            ? (previewSlideId === id ? (newSelected.length > 0 ? newSelected[newSelected.length - 1] : null) : previewSlideId)
            : id;
        set({ selectedSlideIds: newSelected, previewSlideId: newPreviewId });
        return;
    }

    set({ selectedSlideIds: [id], previewSlideId: id });
}

