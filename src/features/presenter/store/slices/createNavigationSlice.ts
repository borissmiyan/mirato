import { db } from '@/core/db';
import { PresentationSliceCreator } from '../types';
import { IPresentationSummary, INestedSlide } from '@/core/types';
import { performNavigateNext, performNavigatePrev } from './navigationTraversal';
import { migratePresentationAudioScopes } from './navigationMigration';
import { handleToggleSlideSelection } from './navigationSelection';

export const createNavigationSlice: PresentationSliceCreator = (set, get) => ({
    activeServiceId: null,
    activePresentationId: null,
    selectedPresentationId: null,
    previewSlideId: null,
    liveSlideId: null,
    rootPresentationId: null,
    liveRootPresentationId: null,
    activeBlockId: null,
    selectedAudioScopeId: null,
    graceLibSection: null,
    graceLibMediaBins: [],
    templateNavPath: [{ id: 'root', type: 'root', name: 'Templates' }],
    presentationBinNavPath: [],
    selectedSlideIds: [],
    clipboard: null,
    presentationStack: [],

    activeService: null,
    activePresentation: null,
    selectedPresentation: null,
    cachedPresentation: null,
    nestedPresentationsCache: {},
    recents: [],
    navigationParentSlideId: null,
    navigationParentPresentationId: null,
    liveNavigationParentSlideId: null,
    liveNavigationParentPresentationId: null,
    navigationDirection: 'forward',

    setActiveService: async (id) => {
        if (!id) {
            set({ activeServiceId: null, activeService: null, activePresentationId: null, activePresentation: null });
            return;
        }

        const service = await db.serviceFiles.get(id);
        if (service) {
            const now = new Date();
            await db.serviceFiles.update(id, { lastOpened: now });
            set({ activeServiceId: id, activeService: { ...service, lastOpened: now } });

            await get().setActivePresentation(service.masterPresentationId);
            await get().loadRecents();
        }
    },

    setActivePresentation: async (id) => {
        const { activePresentationId, activePresentation, activeServiceId } = get();
        if (id === activePresentationId && activePresentation) return;

        if (activePresentation) {
            set({ cachedPresentation: activePresentation });
        }

        if (!id) {
            set({
                activePresentationId: null,
                activePresentation: null,
                previewSlideId: null,
                selectedSlideIds: []
            });
            return;
        }

        const pres = await db.presentationFiles.get(id);
        if (pres) {
            const now = new Date();
            await db.presentationFiles.update(id, { lastOpened: now });
            await migratePresentationAudioScopes(id, pres);

            const firstSlideId = pres.slides.length > 0 ? pres.slides[0].id : null;
            let serviceUpdate = {};
            if (pres.serviceId) {
                if (pres.serviceId !== activeServiceId) {
                    const service = await db.serviceFiles.get(pres.serviceId);
                    if (service) {
                        serviceUpdate = {
                            activeServiceId: pres.serviceId,
                            activeService: { ...service, lastOpened: now }
                        };
                    }
                }
            } else {
                serviceUpdate = { activeServiceId: null, activeService: null };
            }

            set({
                ...serviceUpdate,
                activePresentationId: id,
                rootPresentationId: id,
                selectedPresentationId: id,
                activePresentation: { ...pres, lastOpened: now },
                selectedPresentation: { ...pres, lastOpened: now },
                previewSlideId: firstSlideId,
                selectedSlideIds: firstSlideId ? [firstSlideId] : [],
                liveSlideId: null,
                presentationStack: []
            });

            await get().loadRecents();
        }
    },

    setPreviewSlide: async (id, presentationId, rootPresentationId, navigationParentSlideId, navigationParentPresentationId, preventAutoEnter) => {
        const { activePresentationId: currentRootId } = get();
        const targetPresId = presentationId || currentRootId;
        
        if (rootPresentationId !== undefined || navigationParentSlideId !== undefined || navigationParentPresentationId !== undefined) {
             set({ 
                 rootPresentationId: rootPresentationId ?? get().rootPresentationId,
                 navigationParentSlideId: navigationParentSlideId ?? get().navigationParentSlideId,
                 navigationParentPresentationId: navigationParentPresentationId ?? get().navigationParentPresentationId
             });
        }

        const { activePresentationId, activePresentation, selectedPresentationId, selectedPresentation, presentationStack } = get();
        let currentPres = (targetPresId === activePresentationId && activePresentation)
            ? activePresentation
            : (targetPresId === selectedPresentationId && selectedPresentation)
                ? selectedPresentation
                : null;

        if (!currentPres && targetPresId) {
            currentPres = (await db.presentationFiles.get(targetPresId)) || null;
        }

        if (!preventAutoEnter && currentPres && id) {
            const slide = currentPres.slides.find(s => s.id === id);
            const nestedSlide = slide as Partial<INestedSlide> | undefined;
            if (slide?.type === 'nested' || nestedSlide?.masterPresentationId) {
                const childId = nestedSlide?.presentationId || nestedSlide?.masterPresentationId;
                if (childId) {
                    const nestedPres = await db.presentationFiles.get(childId);
                    if (nestedPres && nestedPres.slides.length > 0) {
                        const { navigationDirection } = get();
                        set({
                            presentationStack: [...presentationStack, { 
                                presentationId: currentPres.id,
                                parentNestedSlideId: id
                            }]
                        });
                        const entryIdx = navigationDirection === 'backward' ? nestedPres.slides.length - 1 : 0;
                        const entrySlideId = nestedPres.slides[entryIdx].id;

                        set({
                            previewSlideId: entrySlideId,
                            selectedSlideIds: [entrySlideId],
                            selectedPresentationId: nestedPres.id,
                            selectedPresentation: nestedPres,
                            navigationParentSlideId: id
                        });
                        return;
                    }
                }
            }
        }

        set({
            previewSlideId: id,
            selectedSlideIds: id ? [id] : [],
            selectedPresentationId: targetPresId,
            navigationDirection: 'forward'
        });

        if (targetPresId === activePresentationId) {
            set({ navigationParentSlideId: null });
        }

        if (targetPresId && targetPresId !== selectedPresentationId) {
            const pres = currentPres || await db.presentationFiles.get(targetPresId);
            if (pres) {
                set({
                    previewSlideId: id,
                    selectedSlideIds: id ? [id] : [],
                    selectedPresentationId: targetPresId,
                    selectedPresentation: pres,
                    navigationDirection: 'forward'
                });
            }
        }
    },

    setLiveSlide: (id, presentationId, rootPresentationId, navigationParentSlideId, navigationParentPresentationId) => set((state) => ({ 
        liveSlideId: id,
        liveRootPresentationId: rootPresentationId !== undefined ? rootPresentationId : state.liveRootPresentationId,
        liveNavigationParentSlideId: navigationParentSlideId !== undefined ? navigationParentSlideId : state.liveNavigationParentSlideId,
        liveNavigationParentPresentationId: navigationParentPresentationId !== undefined ? navigationParentPresentationId : state.liveNavigationParentPresentationId
    })),

    syncPreviewToLive: () => {
        const { liveSlideId, activePresentationId, activePresentation } = get();
        if (liveSlideId) {
            set({
                previewSlideId: liveSlideId,
                selectedSlideIds: [liveSlideId],
                selectedPresentationId: activePresentationId,
                selectedPresentation: activePresentation
            });
        }
    },

    loadRecents: async () => {
        const presentations = await db.presentationFiles.orderBy('lastOpened').reverse().limit(10).toArray();
        const services = await db.serviceFiles.orderBy('lastOpened').reverse().limit(10).toArray();

        const summaries: IPresentationSummary[] = [
            ...presentations.map(p => ({
                id: p.id,
                name: p.name,
                lastOpened: p.lastOpened || p.updatedAt,
                type: 'presentation' as const
            })),
            ...services.map(s => ({
                id: s.id,
                name: s.name,
                lastOpened: s.lastOpened || s.updatedAt,
                type: 'service' as const
            }))
        ].sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()).slice(0, 10);

        set({ recents: summaries });
    },

    navigateNext: async (detached = false, preferLiveAnchor = false) => {
        await performNavigateNext(get, set, detached, preferLiveAnchor);
    },
    navigatePrev: async (detached = false, preferLiveAnchor = false) => {
        await performNavigatePrev(get, set, detached, preferLiveAnchor);
    },

    setActiveBlockId: (id) => set({ activeBlockId: id, graceLibSection: id ? 'templates' : get().graceLibSection }),
    setGraceLibSection: (section) => set({ graceLibSection: section, activeBlockId: section === 'templates' ? get().activeBlockId : null, templateNavPath: section === 'templates' ? [{ id: 'root', type: 'root', name: 'Templates' }] : [] }),
    setSelectedSlideIds: (ids) => set({ selectedSlideIds: ids }),
    toggleSlideSelection: (id, multi, range, deselect, slidesList) => {
        handleToggleSlideSelection(get, set, id, multi, range, deselect, slidesList);
    },
    clearSelection: () => set({ selectedSlideIds: [], previewSlideId: null }),
});
