import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, IAudioScope } from '@/core/types';

export interface AudioSyncData {
    slides: ISlide[];
    scopes: IAudioScope[];
    nestedSlides: ISlide[];
    nestedScopes: IAudioScope[];
    rootSlides: ISlide[];
    rootScopes: IAudioScope[];
    parentSlides: ISlide[];
    parentScopes: IAudioScope[];
}

type NestedSlideLike = {
    masterPresentationId?: string;
    localNestedPresentationId?: string;
    presentationId?: string;
    linkedPresentationId?: string;
};

const getNestedId = (slide?: ISlide | NestedSlideLike | null): string | undefined => {
    if (!slide) return undefined;
    const s = slide as NestedSlideLike;
    return s.masterPresentationId || s.localNestedPresentationId || s.presentationId || s.linkedPresentationId;
};

/**
 * Hook to resolve Dexie audio scopes, presentations, and nested slide hierarchies.
 */
export function useAudioSyncData(
    activePresentationId: string | null,
    rootPresentationId: string | null,
    navigationParentSlideId: string | null,
    navigationParentPresentationId: string | null,
    liveSlideId: string | null
): AudioSyncData | undefined {
    return useLiveQuery(
        async () => {
            if (!activePresentationId) {
                return {
                    slides: [],
                    scopes: [],
                    rootSlides: [],
                    rootScopes: [],
                    nestedSlides: [],
                    nestedScopes: [],
                    parentSlides: [],
                    parentScopes: []
                };
            }
            
            // Master / active presentation (always the root timeline, never the nested pres)
            const pres = await db.presentationFiles.get(activePresentationId);
            let presSlides = pres?.slides || [];
            if (!pres && activePresentationId === usePresentationStore.getState().activePresentationId) {
                presSlides = usePresentationStore.getState().activePresentation?.slides || [];
            }
            const dbScopes = await db.audioScopes.where('presentationId').equals(activePresentationId).toArray();
            const scopes = [
                ...dbScopes,
                ...(pres?.audioScopes || [])
            ];

            let nestedSlides: ISlide[] = [];
            let nestedScopes: IAudioScope[] = [];
            let parentSlides: ISlide[] = presSlides;
            let parentScopes: IAudioScope[] = scopes;

            let resolvedParentSlideId = navigationParentSlideId;
            let resolvedParentPresId = navigationParentPresentationId;

            // Auto-detect container slide if liveSlideId is inside a nested/hymn presentation on the timeline
            if (liveSlideId && !presSlides.some(s => s.id === liveSlideId)) {
                for (const slide of presSlides) {
                    const nid = getNestedId(slide);
                    if (nid) {
                        const nPres = await db.presentationFiles.get(nid);
                        if (nPres && nPres.slides?.some(s => s.id === liveSlideId)) {
                            resolvedParentSlideId = slide.id;
                            resolvedParentPresId = activePresentationId;
                            nestedSlides = nPres.slides;
                            const dbNestedScopes = await db.audioScopes.where('presentationId').equals(nid).toArray();
                            nestedScopes = [
                                ...dbNestedScopes,
                                ...(nPres.audioScopes || [])
                            ];
                            break;
                        }
                    }
                }
            }

            if (nestedSlides.length === 0 && resolvedParentSlideId) {
                const parentPresContext = (resolvedParentPresId && resolvedParentPresId !== activePresentationId)
                    ? await db.presentationFiles.get(resolvedParentPresId)
                    : pres;

                if (parentPresContext) {
                    parentSlides = parentPresContext.slides || [];
                    const dbParentScopes = await db.audioScopes.where('presentationId').equals(parentPresContext.id).toArray();
                    parentScopes = [
                        ...dbParentScopes,
                        ...(parentPresContext.audioScopes || [])
                    ];
                    
                    const parentSlide = parentSlides.find(s => s.id === resolvedParentSlideId);
                    const nestedPresId = getNestedId(parentSlide);
                    if (nestedPresId) {
                        const nestedPres = await db.presentationFiles.get(nestedPresId);
                        nestedSlides = nestedPres?.slides || [];
                        const dbNestedScopes = await db.audioScopes.where('presentationId').equals(nestedPresId).toArray();
                        nestedScopes = [
                            ...dbNestedScopes,
                            ...(nestedPres?.audioScopes || [])
                        ];
                    }
                }
            }
            
            // Root Presentation (for background audio inheritance)
            let rootSlides: ISlide[] = [];
            let rootScopes: IAudioScope[] = [];
            
            if (rootPresentationId && rootPresentationId !== activePresentationId) {
                const rootPres = await db.presentationFiles.get(rootPresentationId);
                rootSlides = rootPres?.slides || [];
                const dbRootScopes = await db.audioScopes.where('presentationId').equals(rootPresentationId).toArray();
                rootScopes = [
                    ...dbRootScopes,
                    ...(rootPres?.audioScopes || [])
                ];
            }

            return { 
                slides: presSlides, 
                scopes,
                nestedSlides,
                nestedScopes,
                rootSlides,
                rootScopes,
                parentSlides,
                parentScopes
            };
        },
        [activePresentationId, rootPresentationId, navigationParentSlideId, navigationParentPresentationId, liveSlideId]
    );
}

