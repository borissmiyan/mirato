import { db } from '@/core/db';
import { PresentationSliceCreator, PresentationState } from '../types';
import type { ISlide, IPresentationFile } from '@/core/types';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { performDuplicateSlide, performDuplicateSlides } from './slideDuplicationHelpers';
import { performCopySlides, performPasteSlides } from './slideClipboardHelpers';
import { performAddHymnToActivePresentation } from './hymnAddOperation';
import { performDetachHymnSlide, performUpdateHymnSlideTheme } from './hymnDetachOperations';

interface PendingUpdateBatch {
    timeout: NodeJS.Timeout;
    slides: ISlide[];
    date: Date;
    deferreds: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
}

const pendingDbUpdates = new Map<string, PendingUpdateBatch>();

async function debouncedDbUpdate(presentationId: string, slides: ISlide[], date: Date): Promise<void> {
    const isTest = import.meta.env?.MODE === 'test';
    if (isTest) {
        await db.presentationFiles.update(presentationId, { slides, updatedAt: date });
        return;
    }

    return new Promise<void>((resolve, reject) => {
        const existing = pendingDbUpdates.get(presentationId);
        const deferreds = existing ? existing.deferreds : [];
        deferreds.push({ resolve, reject });

        if (existing) {
            clearTimeout(existing.timeout);
        }

        const timeout = setTimeout(async () => {
            const batch = pendingDbUpdates.get(presentationId);
            pendingDbUpdates.delete(presentationId);
            const currentDeferreds = batch ? batch.deferreds : deferreds;

            try {
                await db.presentationFiles.update(presentationId, {
                    slides: batch ? batch.slides : slides,
                    updatedAt: batch ? batch.date : date
                });
                currentDeferreds.forEach(d => d.resolve());
            } catch (err) {
                console.error('[SlideOperations] Debounced save failed:', err);
                currentDeferreds.forEach(d => d.reject(err));
            }
        }, 300);

        pendingDbUpdates.set(presentationId, { timeout, slides, date, deferreds });
    });
}

export const createSlideOperationsSlice: PresentationSliceCreator = (set, get) => ({
    updatePresentationSlides: async (presentationId, slides) => {
        const now = new Date();
        const { activePresentationId, activePresentation, selectedPresentationId, selectedPresentation } = get();
        const updates: Partial<PresentationState> = {};

        if (activePresentationId === presentationId) {
            const basePres = activePresentation || { id: presentationId, name: '', slides: [], updatedAt: now, createdAt: now, type: 'presentation' } as IPresentationFile;
            updates.activePresentation = { ...basePres, slides, updatedAt: now };
        }

        if (selectedPresentationId === presentationId) {
            const basePres = selectedPresentation || { id: presentationId, name: '', slides: [], updatedAt: now, createdAt: now, type: 'presentation' } as IPresentationFile;
            updates.selectedPresentation = { ...basePres, slides, updatedAt: now };
        }

        if (Object.keys(updates).length > 0) {
            set(updates);
        }

        const liveId = get().liveSlideId;
        if (liveId) {
            const updatedLive = slides.find(s => s.id === liveId);
            if (updatedLive) {
                LiveSyncService.showSlide(updatedLive, presentationId);
            }
        }

        await debouncedDbUpdate(presentationId, slides, now);
    },

    duplicateSlide: async (presentationId, slideId) => {
        await performDuplicateSlide(get, set, presentationId, slideId);
    },

    duplicateSlides: async (presentationId, slideIds) => {
        await performDuplicateSlides(get, set, presentationId, slideIds);
    },

    moveSlide: async (presentationId, slideId, direction) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        const idx = pres.slides.findIndex(s => s.id === slideId);
        if (idx === -1) return;

        await get().takeSnapshot(presentationId);

        const newSlides = [...pres.slides];
        const [moved] = newSlides.splice(idx, 1);

        if (direction === 'back') {
            if (idx === 0) return;
            newSlides.splice(idx - 1, 0, moved);
        } else if (direction === 'forth') {
            if (idx === pres.slides.length - 1) return;
            newSlides.splice(idx + 1, 0, moved);
        } else if (direction === 'start') {
            newSlides.unshift(moved);
        } else if (direction === 'end') {
            newSlides.push(moved);
        }

        const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, ordered);
    },

    moveSlides: async (presentationId, slideIds, direction) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres || slideIds.length === 0) return;

        const sortedSelected = pres.slides.filter(s => slideIds.includes(s.id));
        if (sortedSelected.length === 0) return;

        const indices = sortedSelected.map(s => pres.slides.findIndex(slide => slide.id === s.id));

        await get().takeSnapshot(presentationId);
        const newSlides = [...pres.slides];

        if (direction === 'start') {
            const remaining = newSlides.filter(s => !slideIds.includes(s.id));
            const ordered = [...sortedSelected, ...remaining].map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(presentationId, ordered);
        } else if (direction === 'end') {
            const remaining = newSlides.filter(s => !slideIds.includes(s.id));
            const ordered = [...remaining, ...sortedSelected].map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(presentationId, ordered);
        } else if (direction === 'back') {
            if (indices[0] === 0) return;
            for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                const temp = newSlides[idx];
                newSlides[idx] = newSlides[idx - 1];
                newSlides[idx - 1] = temp;
            }
            const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(presentationId, ordered);
        } else if (direction === 'forth') {
            if (indices[indices.length - 1] === pres.slides.length - 1) return;
            for (let i = indices.length - 1; i >= 0; i--) {
                const idx = indices[i];
                const temp = newSlides[idx];
                newSlides[idx] = newSlides[idx + 1];
                newSlides[idx + 1] = temp;
            }
            const ordered = newSlides.map((s, i) => ({ ...s, order: i }));
            await get().updatePresentationSlides(presentationId, ordered);
        }
    },

    removeSlide: async (presentationId, slideId) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        await get().takeSnapshot(presentationId);

        const newSlides = pres.slides.filter(s => s.id !== slideId).map((s, i) => ({ ...s, order: i }));
        await get().updatePresentationSlides(presentationId, newSlides);

        if (get().previewSlideId === slideId) {
            get().setPreviewSlide(null);
        }
        if (get().liveSlideId === slideId) {
            get().setLiveSlide(null);
        }
    },

    removeSlides: async (presentationId, slideIds) => {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return;

        await get().takeSnapshot(presentationId);

        const removeSet = new Set(slideIds);
        const newSlides = pres.slides
            .filter(s => !removeSet.has(s.id))
            .map((s, i) => ({ ...s, order: i }));

        await get().updatePresentationSlides(presentationId, newSlides);

        const { previewSlideId, liveSlideId } = get();
        if (previewSlideId && removeSet.has(previewSlideId)) {
            get().setPreviewSlide(null);
        }
        if (liveSlideId && removeSet.has(liveSlideId)) {
            get().setLiveSlide(null);
        }
        set({ selectedSlideIds: [] });
    },

    copySlides: (presentationId, slideIds, isCut) => {
        performCopySlides(set, presentationId, slideIds, isCut);
    },

    pasteSlides: async (presentationId, targetIndex) => {
        await performPasteSlides(get, set, presentationId, targetIndex);
    },

    addHymnToActivePresentation: async (hymnPresentationId, themeId = 'default', index) => {
        await performAddHymnToActivePresentation(get, set, hymnPresentationId, themeId, index);
    },

    detachHymnSlide: async (presentationId, slideId, skipAudioConfirmation = false) => {
        return await performDetachHymnSlide(get, set, presentationId, slideId, skipAudioConfirmation);
    },

    updateHymnSlideTheme: async (presentationId, slideId, newThemeId) => {
        await performUpdateHymnSlideTheme(get, set, presentationId, slideId, newThemeId);
    },
});
