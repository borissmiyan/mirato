import { db } from '@/core/db';
import { useHistoryStore } from '@/core/store/historyStore';
import { PresentationSliceCreator } from '../types';
import { ICanvasItem, ICanvasSlide, ISlide, IStyleLayer, ITimerSettings, IMediaItem, IVideoSlide } from '@/core/types';

export const createCanvasSlice: PresentationSliceCreator = (set, get) => ({
    addCanvasItem: async (slideId, item) => {
        const targetPresId = get().selectedPresentationId || get().activePresentationId;
        if (!targetPresId) return;

        // Background snapshot (undo/redo) without blocking UI rendering
        get().takeSnapshot(targetPresId).catch(console.error);

        let pres = get().selectedPresentation?.id === targetPresId
            ? get().selectedPresentation
            : (get().activePresentation?.id === targetPresId ? get().activePresentation : null);

        if (!pres) {
            pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const existing = normalSlide.content.canvasItems || [];
                const newItem = { ...item, zIndex: existing.length };
                return {
                    ...normalSlide,
                    content: { ...normalSlide.content, canvasItems: [...existing, newItem] }
                };
            }
            return s;
        });

        // Fire synchronous in-memory store update immediately (0ms lag)
        get().updatePresentationSlides(targetPresId, newSlides).catch(console.error);
    },

    updateCanvasItem: async (slideId, itemId, updates) => {
        const targetPresId = get().selectedPresentationId || get().activePresentationId;
        if (!targetPresId) return;

        let pres = get().selectedPresentation?.id === targetPresId
            ? get().selectedPresentation
            : (get().activePresentation?.id === targetPresId ? get().activePresentation : null);
        if (!pres) {
            pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || []).map(ci => {
                    if (ci.id !== itemId) return ci;
                    const mergedItem = { ...ci, ...updates };
                    if (updates.text && ci.text) mergedItem.text = { ...ci.text, ...updates.text };
                    if (updates.shape && ci.shape) mergedItem.shape = { ...ci.shape, ...updates.shape };
                    return mergedItem;
                });
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        await get().updatePresentationSlides(targetPresId, newSlides);
    },

    updateCanvasItems: async (slideId, updates) => {
        const targetPresId = get().selectedPresentationId || get().activePresentationId;
        if (!targetPresId) return;
        get().takeSnapshot(targetPresId).catch(console.error);

        let pres = get().selectedPresentation?.id === targetPresId
            ? get().selectedPresentation
            : (get().activePresentation?.id === targetPresId ? get().activePresentation : null);
        if (!pres) {
            pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || []).map(ci => {
                    const update = updates.find(u => u.id === ci.id);
                    if (!update) return ci;
                    const mergedItem = { ...ci, ...update.updates };
                    if (update.updates.text && ci.text) mergedItem.text = { ...ci.text, ...update.updates.text };
                    if (update.updates.shape && ci.shape) mergedItem.shape = { ...ci.shape, ...update.updates.shape };
                    return mergedItem;
                });
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        get().updatePresentationSlides(targetPresId, newSlides).catch(console.error);
    },

    updateCanvasItemsOrder: async (slideId, items) => {
        const targetPresId = get().selectedPresentationId || get().activePresentationId;
        if (!targetPresId) return;
        get().takeSnapshot(targetPresId).catch(console.error);

        let pres = get().selectedPresentation?.id === targetPresId
            ? get().selectedPresentation
            : (get().activePresentation?.id === targetPresId ? get().activePresentation : null);
        if (!pres) {
            pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        get().updatePresentationSlides(targetPresId, newSlides).catch(console.error);
    },

    removeCanvasItem: async (slideId, itemId) => {
        const targetPresId = get().selectedPresentationId || get().activePresentationId;
        if (!targetPresId) return;
        get().takeSnapshot(targetPresId).catch(console.error);

        let pres = get().selectedPresentation?.id === targetPresId
            ? get().selectedPresentation
            : (get().activePresentation?.id === targetPresId ? get().activePresentation : null);

        if (!pres) {
            pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const idSet = new Set(Array.isArray(itemId) ? itemId : [itemId]);
        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = (normalSlide.content.canvasItems || [])
                    .filter(ci => !idSet.has(ci.id))
                    .map((ci, idx) => ({ ...ci, zIndex: idx }));
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: items } };
            }
            return s;
        });
        get().updatePresentationSlides(targetPresId, newSlides).catch(console.error);
    },

    reorderCanvasItem: async (slideId, itemId, direction) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;
        await get().takeSnapshot(selectedPresentationId);

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = [...(normalSlide.content.canvasItems || [])];
                const index = items.findIndex(item => item.id === itemId);
                if (index === -1) return s;

                const newIndex = direction === 'up' ? index + 1 : index - 1;
                if (newIndex < 0 || newIndex >= items.length) return s;

                [items[index], items[newIndex]] = [items[newIndex], items[index]];
                const updatedItems = items.map((item, idx) => ({ ...item, zIndex: idx }));
                return { ...normalSlide, content: { ...normalSlide.content, canvasItems: updatedItems } };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    duplicateCanvasItems: async (slideId: string, itemIds: string[], offset?: { dx: number; dy: number }) => {
        if (itemIds.length === 0) return [];
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return [];
        await get().takeSnapshot(selectedPresentationId);
        
        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return [];

        const dx = offset ? offset.dx : 2;
        const dy = offset ? offset.dy : 2;

        const newItems: ICanvasItem[] = [];
        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                const items = [...(normalSlide.content.canvasItems || [])];
                
                const groupMap = new Map<string, string>();
                const clonedItems = items.filter(i => itemIds.includes(i.id)).map(item => {
                    const clone = structuredClone(item);
                    clone.id = crypto.randomUUID();
                    clone.x += dx;
                    clone.y += dy;
                    clone.zIndex = items.length + newItems.length;
                    if (clone.groupId) {
                        if (!groupMap.has(clone.groupId)) {
                            groupMap.set(clone.groupId, crypto.randomUUID());
                        }
                        clone.groupId = groupMap.get(clone.groupId);
                    }
                    newItems.push(clone);
                    return clone;
                });

                return { 
                    ...normalSlide, 
                    content: { 
                        ...normalSlide.content, 
                        canvasItems: [...items, ...clonedItems] 
                    } 
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
        return newItems.map(i => i.id);
    },

    setMediaBackground: async (slideId, mediaItem: IMediaItem) => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
        const stableId = await MediaPersistenceService.ensureMediaInDb(mediaItem);

        const isVideo = mediaItem.type === 'video';
        const layer: IStyleLayer = {
            id: crypto.randomUUID(),
            type: isVideo ? 'video' : 'image',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            ...(isVideo ? {
                video: {
                    url: stableId,
                    id: stableId,
                    isFromDb: true,
                    source: 'local',
                    isMuted: true, // Legacy mute for background
                    isLooping: true,
                }
            } : {
                image: {
                    url: stableId,
                    id: stableId,
                    isFromDb: true,
                    source: 'local',
                }
            })
        } as IStyleLayer;
        await get().updateSlideBackground(slideId, [layer]);
    },

    addMediaLayer: async (slideId, mediaItem: IMediaItem, position) => {
        const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
        const stableId = await MediaPersistenceService.ensureMediaInDb(mediaItem);

        const isVideo = mediaItem.type === 'video';
        const newItem: ICanvasItem = {
            id: crypto.randomUUID(),
            type: isVideo ? 'video' : 'image',
            x: position?.x ?? 50,
            y: position?.y ?? 50,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 0,
            locked: false,
            visible: true,
            opacity: 1,
            fills: [{
                id: crypto.randomUUID(),
                type: isVideo ? 'video' : 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                ...(isVideo ? {
                    video: {
                        url: stableId,
                        source: 'local',
                        id: stableId,
                        isFromDb: true,
                        isMuted: false,
                        isLooping: true
                    }
                } : {
                    image: {
                        url: stableId,
                        source: 'local',
                        id: stableId,
                        isFromDb: true
                    }
                })
            } as IStyleLayer],
            strokes: [],
        };
        await get().addCanvasItem(slideId, newItem);
    },

    updateSlideVariable: async (slideId, name, value) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;
        await get().takeSnapshot(selectedPresentationId);

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return {
                    ...normalSlide,
                    content: {
                        ...normalSlide.content,
                        variables: {
                            ...normalSlide.content.variables,
                            [name]: value
                        }
                    }
                };
            }
            return s;
        });

        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateTimerSettings: async (slideId, updates) => {
        const { selectedPresentationId, selectedPresentation } = get();
        if (!selectedPresentationId) return;

        let pres = selectedPresentation;
        if (!pres || pres.id !== selectedPresentationId) {
            const active = get().activePresentation;
            if (active && active.id === selectedPresentationId) pres = active;
            else pres = await db.presentationFiles.get(selectedPresentationId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'normal') {
                const normalSlide = s as ICanvasSlide;
                return {
                    ...normalSlide,
                    timerSettings: {
                        ...(normalSlide.timerSettings || {
                            duration: 300,
                            style: 'minimal_ring',
                            endAction: 'none'
                        }),
                        ...updates
                    }
                };
            }
            return s;
        });
        await get().updatePresentationSlides(selectedPresentationId, newSlides);
    },

    updateVideoSettings: async (slideId, updates, presentationId) => {
        const { selectedPresentationId, selectedPresentation } = get();
        const targetPresId = presentationId || selectedPresentationId;
        if (!targetPresId) return;

        let pres = (targetPresId === selectedPresentationId) ? selectedPresentation : null;
        
        if (!pres || pres.id !== targetPresId) {
            const active = get().activePresentation;
            if (active && active.id === targetPresId) pres = active;
            else pres = await db.presentationFiles.get(targetPresId) || null;
        }
        if (!pres) return;

        const newSlides = pres.slides.map(s => {
            if (s.id === slideId && s.type === 'video') {
                const videoSlide = s as IVideoSlide;
                return {
                    ...videoSlide,
                    videoSettings: {
                        ...videoSlide.videoSettings,
                        ...updates
                    }
                };
            }
            return s;
        });
        await get().updatePresentationSlides(targetPresId, newSlides);
    },

    undo: async () => {
        const snapshot = useHistoryStore.getState().undo();
        if (!snapshot) return;

        const currentPresId = get().selectedPresentationId || get().activePresentationId;
        if (!currentPresId || snapshot.presentationId !== currentPresId) return;

        // Restore the full slides array from the snapshot
        await get().updatePresentationSlides(snapshot.presentationId, snapshot.slides);
    },

    redo: async () => {
        const snapshot = useHistoryStore.getState().redo();
        if (!snapshot) return;

        const currentPresId = get().selectedPresentationId || get().activePresentationId;
        if (!currentPresId || snapshot.presentationId !== currentPresId) return;

        // Restore the full slides array from the snapshot
        await get().updatePresentationSlides(snapshot.presentationId, snapshot.slides);
    },

    /**
     * Push a "before" snapshot of the given presentation's slides array.
     * Must be called BEFORE any mutating action that should be undoable.
     * Accepts either a presentationId or a slideId.
     */
    takeSnapshot: async (presentationOrSlideId: string) => {
        const { activePresentationId, activePresentation, selectedPresentationId, selectedPresentation } = get();

        let resolvedPresId = presentationOrSlideId;
        let slides: ISlide[] | undefined;

        // 1. Direct presentation ID match
        if (activePresentationId === presentationOrSlideId && activePresentation) {
            slides = activePresentation.slides;
        } else if (selectedPresentationId === presentationOrSlideId && selectedPresentation) {
            slides = selectedPresentation.slides;
        // 2. Slide ID match in active/selected presentations
        } else if (activePresentation?.slides?.some(s => s.id === presentationOrSlideId)) {
            resolvedPresId = activePresentationId!;
            slides = activePresentation.slides;
        } else if (selectedPresentation?.slides?.some(s => s.id === presentationOrSlideId)) {
            resolvedPresId = selectedPresentationId!;
            slides = selectedPresentation.slides;
        // 3. Fallback: query DB or use currently open presentation
        } else {
            const pres = await db.presentationFiles.get(presentationOrSlideId);
            if (pres) {
                slides = pres.slides;
            } else {
                const fallbackId = selectedPresentationId || activePresentationId;
                if (fallbackId) {
                    resolvedPresId = fallbackId;
                    const fallbackPres = (selectedPresentationId && selectedPresentation) || activePresentation;
                    slides = fallbackPres?.slides;
                }
            }
        }

        if (!slides || !resolvedPresId) return;

        useHistoryStore.getState().pushSnapshot({
            presentationId: resolvedPresId,
            slides: structuredClone(slides),
        });
    },
});
