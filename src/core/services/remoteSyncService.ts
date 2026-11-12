import { db } from '@/core/db';
import { ipcService } from '@/core/services/ipcService';
import { getBookName } from '@/core/data/bookData';
import type { ISlide, IPresentationFile } from '@/core/types/presentation';
import type { IAudioScope } from '@/core/types/audio';
// audit-ignore: remote sync service serializing presentation state
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

type SlideLike = ISlide & {
    id: string;
    name?: string;
    label?: string;
    hymnPresentationId?: string;
    audio?: unknown;
    audioScopes?: IAudioScope[];
    items?: Array<{ type: string; mediaId?: string; text?: string }>;
    content?: {
        canvasItems?: Array<{ type: string; mediaId?: string; text?: { content?: string } }>;
        variables?: Record<string, string | number>;
    };
    canvasItems?: Array<{ type: string; mediaId?: string }>;
    videoSettings?: { mediaId?: string };
    blocks?: Array<{ text?: string }>;
};

let lastUpdateId = 0;

/**
 * Service for synchronizing application state with the remote controller.
 * Handles complex payload construction, recursive slide resolution, and async media status.
 */
export const remoteSyncService = {
  /**
   * Constructs and sends the application state to the remote controller.
   */
  async updateRemoteState(params: {
    appMode: string;
    activeVerse: { bookId: number; chapter: number; verseNumber: number; text: string } | null | unknown;
    activePresentation: IPresentationFile | null | unknown;
    selectedPresentation: IPresentationFile | null | unknown;
    presentationStack: Array<{ presentationId: string; parentNestedSlideId: string }>;
    projectorIsLive: boolean;
    liveSlideId: string | null;
    previewSlideId: string | null;
    lang: string;
    themeAccent: string;
    isPlaying: boolean;
    activeOverride: string | null;
    activeLogo: unknown;
    activeLogoUrl: string | null;
    settings: unknown;
    bibleState?: unknown;
  }) {
    if (!ipcService.isElectron()) return;
    
    const currentUpdateId = ++lastUpdateId;
    const { 
      appMode, activeVerse, activePresentation, selectedPresentation, 
      presentationStack, projectorIsLive, liveSlideId, previewSlideId, 
      lang, themeAccent, isPlaying, activeOverride, activeLogo, activeLogoUrl, settings,
      bibleState 
    } = params;

    const typedActivePresentation = activePresentation as IPresentationFile | null;
    const typedSelectedPresentation = selectedPresentation as IPresentationFile | null;
    const typedActiveVerse = activeVerse as { bookId: number; chapter: number; verseNumber: number; text: string } | null;

    let isLive = projectorIsLive || !!liveSlideId;
    let slideTitle = 'Ready';
    let slidePreviewText = '';
    let slideData: SlideLike | null = null;
    let slideTemplate: unknown = null;
    let slideBlock: unknown = null;
    let prevSlideData: unknown = null;
    let nextSlideData: unknown = null;
    let timelineSlides: unknown[] = [];

    // 1. Resolve Audio Scopes for the current presentation context
    let timelineScopes: IAudioScope[] = [];
    let timelineAudioPresId: string | null = null;
    try {
        const targetPres = typedSelectedPresentation || typedActivePresentation;
        if (targetPres?.id) {
            timelineAudioPresId = targetPres.id;
            timelineScopes = await db.audioScopes.where('presentationId').equals(targetPres.id).toArray();
            if (currentUpdateId !== lastUpdateId) return;
        }
    } catch { }

    const checkHasAudio = (id: string, presContext: IPresentationFile | null | undefined) => {
        if (!presContext?.slides) return false;
        const slide = presContext.slides.find((s) => s.id === id) as SlideLike | undefined;
        if (!slide) return false;
        if ((slide as { audio?: unknown }).audio || (slide.audioScopes && slide.audioScopes.length > 0)) return true;
        
        if (timelineScopes.length > 0 && timelineAudioPresId === presContext.id) {
            const slideIndex = presContext.slides.findIndex((s) => s.id === id);
            return timelineScopes.some((scope: IAudioScope) => {
                const startIndex = presContext.slides.findIndex((s) => s.id === scope.startSlideId);
                const endIndex = presContext.slides.findIndex((s) => s.id === scope.endSlideId);
                return slideIndex >= startIndex && slideIndex <= endIndex && startIndex !== -1 && endIndex !== -1;
            });
        }
        return false;
    };

    // 2. Resolve Main Slide Content
    if (appMode === 'scripture' && typedActiveVerse) {
        slideTitle = `${getBookName(String(typedActiveVerse.bookId), lang)} ${typedActiveVerse.chapter}:${typedActiveVerse.verseNumber}`;
        slidePreviewText = typedActiveVerse.text;
        isLive = projectorIsLive;
    } else if (appMode === 'hymns') {
        const targetId = liveSlideId || previewSlideId;
        let currentPres = typedActivePresentation || typedSelectedPresentation;
        let slide = targetId ? currentPres?.slides?.find((s) => s.id === targetId) as SlideLike | null : null;

        if (!slide && targetId) {
            const storeState = usePresentationStore.getState();
            const rootId = liveSlideId ? storeState.liveRootPresentationId : storeState.rootPresentationId;
            if (rootId) {
                const pres = await db.presentationFiles.get(rootId);
                if (pres) {
                    currentPres = pres;
                    slide = (pres.slides?.find((s) => s.id === targetId) as SlideLike) ?? null;
                }
            }
        }
        
        if (slide) {
            slideData = slide;
            if (slide.type === 'hymn' && slide.hymnPresentationId) {
                const hymnPres = await db.presentationFiles.get(slide.hymnPresentationId);
                slideTitle = hymnPres?.name || 'Hymn';
            } else if (currentPres?.metadata?.isHymnLibraryItem) {
                slideTitle = currentPres.name;
            } else {
                slideTitle = slide.name || slide.label || 'Hymn Slide';
            }
        } else {
            slideTitle = 'Ready';
        }
        isLive = projectorIsLive;
    } else if (appMode === 'presentation' && typedActivePresentation) {
        let targetId = liveSlideId || previewSlideId;
        let currentPres = typedActivePresentation;
        if (typedSelectedPresentation) {
            if (!targetId || !typedActivePresentation || typedSelectedPresentation.slides.some((s) => s.id === targetId)) {
                currentPres = typedSelectedPresentation;
            }
        }

        let slide: SlideLike | null = null;
        if (currentPres?.slides && currentPres.slides.length > 0) {
            if (targetId) {
                slide = (currentPres.slides.find((s) => s.id === targetId) as SlideLike) ?? null;
            }
            if (!slide) {
                slide = currentPres.slides[0] as SlideLike;
                targetId = slide.id;
            }
        }
        
        if (slide) {
            slideData = slide;
            slideTitle = slide.name || slide.label || 'Presentation Slide';
            
            try {
                if (slide.templateId) slideTemplate = await db.templates.get(slide.templateId);
                if (slide.blockId) slideBlock = await db.blocks.get(slide.blockId);
                if (currentUpdateId !== lastUpdateId) return;

                // Attempt to resolve more specific name for video/media slides
                if (slideTitle === 'Presentation Slide') {
                    const canvasItems = slide.content?.canvasItems || slide.canvasItems;
                    const items = slide.items;
                    const isVideo = slide.type === 'video' || items?.some((i) => i.type === 'video') || canvasItems?.some((i) => i.type === 'video');
                    
                    if (isVideo) {
                        const mediaId = slide.videoSettings?.mediaId || items?.find((i) => i.type === 'video')?.mediaId || canvasItems?.find((i) => i.type === 'video')?.mediaId;
                        if (mediaId) {
                            const mediaDoc = await db.mediaPool.get(mediaId);
                            if (currentUpdateId !== lastUpdateId) return;
                            if (mediaDoc?.name) slideTitle = mediaDoc.name;
                        }
                    }
                }
            } catch { }
            
            const s = slide;
            let extractedText = (s.blocks?.[0]?.text) || (s.items?.[0]?.text);
            if (!extractedText && s.content?.canvasItems) {
                const firstTextItem = s.content.canvasItems.find((i) => i.type === 'text');
                if (firstTextItem?.text) extractedText = firstTextItem.text.content;
            }
            slidePreviewText = extractedText || '';
            if (!slidePreviewText) {
                const hasVideo = s.items?.some((i) => i.type === 'video') || s.content?.canvasItems?.some((i) => i.type === 'video') || s.type === 'video';
                if (hasVideo) slidePreviewText = '[ Video Slide ]';
                else slidePreviewText = '[ Slide Content ]';
            }

            if (liveSlideId && targetId === liveSlideId) isLive = true;

            // Internal helper for resolving nested/master slide references recursively
            const resolveNeighbor = async (sRef: ISlide, dir: 'first' | 'last'): Promise<ISlide> => {
                if (sRef.blockId !== 'master-presentation') return sRef;
                const mId = sRef.type === 'normal' ? (sRef as { masterPresentationId?: string }).masterPresentationId : (sRef.type === 'nested' ? (sRef as { presentationId?: string }).presentationId : undefined);
                if (!mId) return sRef;
                const p = await db.presentationFiles.get(mId);
                if (currentUpdateId !== lastUpdateId) throw new Error('stale');
                if (p && p.slides.length > 0) return resolveNeighbor(dir === 'first' ? p.slides[0] : p.slides[p.slides.length-1], dir);
                return sRef;
            };

            try {
                const idx = currentPres.slides.findIndex((s) => s.id === targetId);
                
                // Resolve Previous Slide
                if (idx > 0) {
                    prevSlideData = await resolveNeighbor(currentPres.slides[idx - 1], 'last');
                } else if (presentationStack.length > 0) {
                    const last = presentationStack[presentationStack.length - 1];
                    const pPres = await db.presentationFiles.get(last.presentationId);
                    if (currentUpdateId === lastUpdateId && pPres) {
                        const pIdx = pPres.slides.findIndex((s) => s.id === last.parentNestedSlideId);
                        if (pIdx > 0) prevSlideData = await resolveNeighbor(pPres.slides[pIdx - 1], 'last');
                    }
                }

                // Resolve Next Slide
                if (idx < currentPres.slides.length - 1 && idx !== -1) {
                    nextSlideData = await resolveNeighbor(currentPres.slides[idx + 1], 'first');
                } else if (presentationStack.length > 0) {
                    const last = presentationStack[presentationStack.length - 1];
                    const pPres = await db.presentationFiles.get(last.presentationId);
                    if (currentUpdateId === lastUpdateId && pPres) {
                        const pIdx = pPres.slides.findIndex((s) => s.id === last.parentNestedSlideId);
                        if (pIdx !== -1 && pIdx < pPres.slides.length - 1) nextSlideData = await resolveNeighbor(pPres.slides[pIdx + 1], 'first');
                    }
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.message === 'stale') return;
                console.error('[RemoteSync] Slide resolution error:', err);
            }
            
            // Populate timeline slides
            timelineSlides = currentPres.slides || [];
        }
    }

    // 3. Prepare Remote Assets (Logo)
    let remoteLogoUrl = activeLogoUrl;
    if (activeLogoUrl?.startsWith('blob:') || activeLogoUrl?.startsWith('file:')) {
        let host = 'localhost';
        let port = 3211;
        if (ipcService.isElectron()) {
            try {
                const info = await ipcService.invoke<{ ip: string; port: number } | null>('remote:get-info');
                if (info && info.ip && info.ip !== '127.0.0.1') {
                    host = info.ip;
                    port = info.port || 3211;
                }
            } catch (err) {
                console.error('[RemoteSync] Failed to resolve remote server info:', err);
            }
        }
        const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
        remoteLogoUrl = `${protocol}//${host}:${port}/media/${(activeLogo as { id?: string })?.id || ''}`;
    }

    // 4. Dispatch construction to IPC
    ipcService.send('remote:update-state', {
        active: isLive,
        slideTitle,
        slidePreviewText: slidePreviewText || (previewSlideId ? 'Selected' : 'No slide selected'),
        slideData, 
        slideTemplate, 
        slideBlock, 
        prevSlideData, 
        nextSlideData,
        timelineSlides,
        playing: isPlaying,
        activeOverride,
        activeLogoUrl: remoteLogoUrl,
        themeAccent,
        lang,
        hasAudio: slideData ? checkHasAudio(slideData.id, typedSelectedPresentation || typedActivePresentation) : false,
        settings,
        bibleState
    });
  }
};
