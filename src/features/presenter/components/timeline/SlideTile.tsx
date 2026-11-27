import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown as ChevronDownIcon, RotateCcw } from 'lucide-react';
import { CustomHymnStackIcon } from '@/shared/ui';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile, IVideoSlide } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import SmartBadge from './SmartBadge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useIntersection } from '@/core/hooks/useIntersection';
import { extractPosterFrame } from '@/core/utils/videoUtils';
import { mediaCache } from '@/core/utils/mediaCache';
import { BUILT_IN_HYMN_THEMES } from '@/features/hymns/services/hymnThemeConstants';
import { materializeHymnPresentation, resolveHymnThemeFromList } from '@/features/hymns/services/hymnThemeMaterializer';
import { getNestedPresentationFromMap } from './hooks/useExpandedPresentationsMap';
import type { DraggableSyntheticListeners, DraggableAttributes } from '@dnd-kit/core';

export interface SlideTileProps {
    slide: ISlide;
    index: number;
    activePresentationId: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    liveSlideId: string | null;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    lang: string;
    onSelect: (id: string, e?: React.MouseEvent) => void;
    onLive: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onToggleExpansion: (id: string) => void;
    isSelected?: boolean;
    isMultiSelect?: boolean;
    isSubItemSelected?: boolean;
    isMultiDragHidden?: boolean;
    isNew?: boolean;
    presentationsMap: Map<string, IPresentationFile>;
    navigationParentSlideId: string | null;
    listeners?: DraggableSyntheticListeners;
    attributes?: DraggableAttributes;
}

/**
 * SlideTile component for the presentation timeline.
 * Renders a thumbnail preview of a slide with status indicators and interaction handles.
 */
export const SlideTile: React.FC<SlideTileProps> = React.memo(({
    slide,
    index,
    activePresentationId,
    previewSlideId,
    selectedPresentationId,
    liveSlideId,
    blocksMap,
    templatesMap,
    lang,
    onSelect,
    onLive,
    onContextMenu,
    onToggleExpansion,
    isSelected,
    isMultiSelect,
    isSubItemSelected,
    isMultiDragHidden,
    isNew,
    presentationsMap,
    navigationParentSlideId,
    listeners,
    attributes
}) => {
    const { t } = useTranslation();
    const isMaster = slide.blockId === 'master-presentation';
    const masterPresId = slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : (slide.type === 'nested' ? (slide as INestedSlide).presentationId : undefined);
    const syncNestedPresentation = usePresentationStore(s => s.syncNestedPresentation);
    const setCachedNestedPresentation = usePresentationStore(s => s.setCachedNestedPresentation);
    const liveNavigationParentSlideId = usePresentationStore(s => s.liveNavigationParentSlideId);
    const cachedPres = usePresentationStore(s => s.nestedPresentationsCache[slide.id] || (masterPresId ? s.nestedPresentationsCache[masterPresId] : null));
    const slideHymnThemeId = slide.type === 'normal'
        ? (slide as ICanvasSlide).content?.variables?.hymnThemeId
        : undefined;
    const mappedPres = getNestedPresentationFromMap(presentationsMap, slide.id, masterPresId);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const isNestedActive = isMaster && navigationParentSlideId === slide.id;

    // Viewport-aware lazy loading
    const intersection = useIntersection(containerRef, {
        rootMargin: '200px', // Preload when approaching the viewport
        freezeOnceVisible: true // Once loaded, keep it (cached)
    });
    const isVisible = !!intersection?.isIntersecting;

    // Only fetch if it's a master slide, not already in presentationsMap, and visible in viewport.
    const shouldFetch = isMaster && masterPresId && isVisible && !mappedPres;

    // Isolated lazy fetch for this specific master thumbnail (materializes library hymns per slide.id)
    const liveNestedPres = useLiveQuery(
        async () => {
            if (!shouldFetch || cachedPres) return null;
            const pres = await db.presentationFiles.get(masterPresId!);
            if (!pres) return null;

            if (pres.hymnalId || pres.metadata?.isHymnLibraryItem) {
                const dbThemes = typeof db.hymnThemes?.toArray === 'function' ? await db.hymnThemes.toArray() : [];
                const themes = dbThemes.length > 0 ? dbThemes : BUILT_IN_HYMN_THEMES;
                const themeId = typeof slideHymnThemeId === 'string' ? slideHymnThemeId : (pres.metadata?.themeId as string | undefined);
                const materialized = materializeHymnPresentation(pres, resolveHymnThemeFromList(themeId, themes));
                setCachedNestedPresentation(slide.id, materialized);
                return materialized;
            }

            setCachedNestedPresentation(masterPresId!, pres);
            return pres;
        },
        [shouldFetch, masterPresId, cachedPres, slide.id, slideHymnThemeId]
    );

    // Resolve final presentation (Priority: 1. Props Map (for expanded), 2. Local Query, 3. Cache)
    const nestedPres = mappedPres || liveNestedPres || cachedPres;
    const isHymnMaster = isMaster && Boolean(
        nestedPres?.hymnalId || nestedPres?.metadata?.isHymn || nestedPres?.metadata?.hymnOrder
    );
    const masterHymnalId = isHymnMaster ? (nestedPres?.hymnalId || (nestedPres?.metadata?.hymnalId as string | undefined)) : undefined;
    const masterHymnal = useLiveQuery(
        () => (masterHymnalId ? db.hymnals.get(masterHymnalId) : undefined),
        [masterHymnalId]
    );

    // Use current nested slide for preview if this master presentation is "active", 
    // or fallback to the first slide if we just want a representative thumbnail.
    const activeNestedSlide = isMaster && nestedPres 
        ? (isNestedActive 
            ? (nestedPres.slides.find(s => s.id === previewSlideId) || nestedPres.slides[0]) 
            : nestedPres.slides[0]) 
        : null;
    
    const displaySlide = activeNestedSlide || slide;
    const displayBlock = blocksMap.get(displaySlide.blockId);
    const displayTemplate = templatesMap.get(displaySlide.templateId);

    const isPreview = previewSlideId === slide.id && selectedPresentationId === activePresentationId;
    const isEffectivelyPreviewed = isPreview || isNestedActive;
    
    // The tile is live if a live slide is active AND it is the live slide itself or its master container
    const isLive = Boolean(liveSlideId) && (
        liveSlideId === slide.id ||
        (isMaster && liveNavigationParentSlideId === slide.id)
    );

    const isVideo = displaySlide.type === 'video';
    const videoSettings = isVideo ? (displaySlide as IVideoSlide).videoSettings : undefined;
    const mediaId = isVideo ? videoSettings?.mediaId : null;
    const posterFrame = videoSettings?.posterFrame;

    const [extractedPoster, setExtractedPoster] = React.useState<string | null>(null);
    const extractionAttemptedRef = React.useRef(false);
    const prevMediaIdRef = React.useRef(mediaId);

    React.useEffect(() => {
        if (prevMediaIdRef.current !== mediaId) {
            prevMediaIdRef.current = mediaId;
            extractionAttemptedRef.current = false;
            setExtractedPoster(null);
        }
    }, [mediaId]);

    React.useEffect(() => {
        if (!isVideo || !mediaId || posterFrame || !isVisible || extractionAttemptedRef.current) {
            return;
        }

        extractionAttemptedRef.current = true;
        let cancelled = false;

        (async () => {
            try {
                const videoUrl = await mediaCache.getBackgroundUrl(mediaId);
                if (cancelled || !videoUrl) return;

                const frame = await extractPosterFrame(videoUrl);
                if (cancelled || !frame) return;

                setExtractedPoster(frame);

                const targetPresId = activeNestedSlide ? masterPresId : (activePresentationId || selectedPresentationId);
                if (targetPresId) {
                    usePresentationStore.getState().updateVideoSettings(
                        displaySlide.id,
                        { posterFrame: frame },
                        targetPresId
                    );
                }
            } catch (err) {
                console.warn('[SlideTile] Failed to extract video poster frame:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [isVideo, mediaId, posterFrame, isVisible, displaySlide.id, activeNestedSlide, masterPresId, activePresentationId, selectedPresentationId]);

    const currentPoster = posterFrame || extractedPoster;

    const isVideoSlide = displaySlide.type === 'video';
    const mediaMetadata = useLiveQuery(async () => {
        if (!isVideoSlide || !mediaId) return null;
        const item = await db.mediaPool.get(mediaId);
        if (item) return { name: item.name };
        const bg = await db.backgrounds.get(mediaId);
        if (bg) return { name: bg.name };
        return null;
    }, [isVideoSlide, mediaId]);

    return (
        <div
            ref={containerRef}
            data-slide-id={slide.id}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(slide.id, e);
            }}
            onDoubleClick={() => onLive(slide.id)}
            onContextMenu={(e) => onContextMenu(e, slide.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    // Prevent dnd-kit KeyboardSensor from capturing this
                    e.stopPropagation();
                }
            }}
            className={cn(
                "group relative shrink-0 w-32 aspect-video rounded-[10px] border-2 cursor-grab active:cursor-grabbing overflow-hidden leading-none transition-all duration-300 touch-none bg-stone-900",
                isNew && !isMultiDragHidden && "animate-timeline-slide-in z-20",
                isSelected && isEffectivelyPreviewed && isMultiSelect && "ring-2 ring-accent ring-offset-2 ring-offset-stone-900 border-accent",
                isSelected && (!isEffectivelyPreviewed || !isMultiSelect) && "ring-2 ring-accent border-transparent",
                isMultiDragHidden && "opacity-0 pointer-events-none transition-opacity",
                !isSelected && isEffectivelyPreviewed && !isLive && !isSubItemSelected && "border-accent ring-2 ring-accent/20 scale-105 z-10 shadow-lg shadow-accent/10",
                !isSelected && isEffectivelyPreviewed && !isLive && isSubItemSelected && "border-stone-500/50 ring-1 ring-stone-500/10 scale-[1.02] z-10 shadow-md",
                isLive && !isEffectivelyPreviewed && "border-red-500 ring-2 ring-red-500/20 scale-105 z-10 shadow-lg shadow-red-500/10",
                isEffectivelyPreviewed && isLive && !isSubItemSelected && "border-emerald-500 ring-2 ring-emerald-500/30 scale-105 z-10 shadow-lg shadow-emerald-500/10",
                isEffectivelyPreviewed && isLive && isSubItemSelected && "border-emerald-500/50 ring-1 ring-emerald-500/10 scale-[1.02] z-10 shadow-md",
                !isEffectivelyPreviewed && !isLive && !isSelected && "border-white/5 hover:border-white/20",
                isMaster && !isEffectivelyPreviewed && !isLive && !isSelected && "border-orange-500/30"
            )}
        >
            <div 
                className="absolute top-0 left-0 w-[1920px] h-[1080px] z-0 pointer-events-none isolate origin-top-left"
                style={{ transform: `scale(${128 / 1920})` }}
            >
                {displaySlide && (
                    displaySlide.thumbnailUrl && !isEffectivelyPreviewed ? (
                        <img 
                            src={displaySlide.thumbnailUrl} 
                            className="w-full h-full object-cover" 
                            alt="" 
                            loading="lazy" 
                        />
                    ) : displaySlide.type === 'video' ? (
                        <div className="w-full h-full bg-stone-950 flex items-center justify-center relative">
                            {currentPoster ? (
                                <img src={currentPoster} className="w-full h-full object-cover" alt="Video poster" />
                            ) : (
                                <div className="w-[1920px] h-[1080px] flex items-center justify-center bg-stone-900 border border-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-700"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M17 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 7.5h4" /><path d="M17 16.5h4" /></svg>
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                               <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/80 drop-shadow-xl"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                            </div>
                            {mediaMetadata?.name && (
                                <div className="absolute bottom-0 inset-x-0 h-[400px] bg-linear-to-t from-black/95 via-black/70 to-transparent flex items-end px-16 pb-32 z-10">
                                    <span className="text-[120px] font-black text-white truncate drop-shadow-2xl tracking-tighter uppercase font-mono leading-none">
                                        {mediaMetadata.name}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <SlideContentRenderer
                            template={displayTemplate}
                            block={displayBlock}
                            variables={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.variables : undefined}
                            lang={lang}
                            isPreview={true}
                            scale={1}
                            backgroundOverride={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).backgroundOverride : undefined}
                            canvasItems={displaySlide.type === 'normal' ? (displaySlide as ICanvasSlide).content?.canvasItems : []}
                            slide={displaySlide}
                            slideId={displaySlide.id}
                        />
                    )
                )}
            </div>
            <div className="absolute inset-x-0 top-0 h-8 bg-linear-to-b from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 z-20 pointer-events-none"><SmartBadge slide={slide} /></div>

            {/* Unified top overlay row: zero overlap between slide number, LIVE/progress status, and collapse button */}
            <div className="absolute top-1 left-1 right-1 z-40 flex items-center justify-between gap-1 pointer-events-none">
                <div className="flex items-center gap-1 min-w-0">
                    <div className="px-1.5 py-0.5 rounded-[5px] bg-stone-950 border border-white/10 text-[8px] font-black text-stone-400 tabular-nums shrink-0 leading-none">
                        {slide.order + 1}
                    </div>

                    {isNestedActive && nestedPres ? (
                        isLive ? (
                            <div className="px-1.5 py-0.5 rounded-[5px] bg-red-950 border border-red-500/45 text-[7px] font-black text-red-200 tabular-nums flex items-center gap-1 shrink-0 leading-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                                <span>{Math.max(1, nestedPres.slides.findIndex(s => s.id === previewSlideId) + 1)}/{nestedPres.slides.length}</span>
                            </div>
                        ) : (
                            <div className="px-1.5 py-0.5 rounded-[5px] bg-accent text-[7px] font-black text-stone-950 tabular-nums shrink-0 leading-none">
                                {Math.max(1, nestedPres.slides.findIndex(s => s.id === previewSlideId) + 1)}/{nestedPres.slides.length}
                            </div>
                        )
                    ) : (
                        isLive && isMaster && (
                            <div className="px-1.5 py-0.5 rounded-[5px] bg-red-950 border border-red-500/45 text-[7px] font-black text-red-300 uppercase tracking-wider flex items-center gap-1 shrink-0 leading-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                                <span>LIVE</span>
                            </div>
                        )
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {isLive && !isMaster && (
                        <div className="px-1.5 py-0.5 rounded-[5px] bg-red-950 border border-red-500/45 text-[7px] font-black text-red-300 uppercase tracking-wider leading-none">
                            LIVE
                        </div>
                    )}
                    {isMaster && (
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpansion(slide.id);
                            }}
                            className="pointer-events-auto relative z-50 w-5 h-5 flex items-center justify-center bg-stone-950/90 hover:bg-amber-500/25 text-stone-300 hover:text-amber-300 rounded-[5px] transition-colors border border-white/15 cursor-pointer apple-press"
                            aria-label={slide.isExpanded ? "Collapse" : "Expand"}
                        >
                            {slide.isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                    )}
                </div>
            </div>
            {isMaster && (() => {
                if (isHymnMaster) {
                    const orderNum = nestedPres?.metadata?.hymnOrder;
                    const parsedNum = orderNum !== undefined && orderNum !== null
                        ? String(orderNum)
                        : nestedPres?.name?.match(/^\s*#?(\d+)/)?.[1];
                    const hymnalName = masterHymnal?.name;
                    const hymnBadgeLabel = parsedNum && hymnalName
                        ? `#${parsedNum} — ${hymnalName}`
                        : parsedNum
                            ? `#${parsedNum}`
                            : (hymnalName || nestedPres?.name || t('hymn', 'Гимн'));

                    return (
                        <div
                            title={hymnBadgeLabel}
                            className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-[#2a1d08] border border-amber-500/40 text-[7px] font-bold text-amber-300 tracking-tight z-20 flex items-center gap-1 min-w-0 pointer-events-none"
                        >
                            <CustomHymnStackIcon className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                            <span className="truncate leading-tight">{hymnBadgeLabel}</span>
                        </div>
                    );
                }

                const nestedLabel = nestedPres?.name
                    || (slide.type === 'normal' ? String((slide as ICanvasSlide).content?.variables?.title || '') : '')
                    || t('nested', 'Nested');

                return (
                    <div
                        title={nestedLabel}
                        className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-[#2b1709] border border-orange-500/40 text-[7px] font-bold text-orange-300 tracking-tight z-20 flex items-center min-w-0 pointer-events-none"
                    >
                        <span className="truncate leading-tight">{nestedLabel}</span>
                    </div>
                );
            })()}
            
            {/* Sync Badge */}
            {(() => {
                const canvasSlide = slide.type === 'normal' ? slide as ICanvasSlide : null;
                const nestedSlide = slide.type === 'nested' ? slide as INestedSlide : null;
                const linkedId = nestedSlide?.presentationId || canvasSlide?.linkedPresentationId;
                const lastSynced = canvasSlide?.lastSyncedAt;

                if (!isMaster || !linkedId || !lastSynced) return null;
                const libraryOriginal = presentationsMap.get(linkedId);
                if (!libraryOriginal) return null;

                const isOutOfSync = libraryOriginal.updatedAt && lastSynced && new Date(libraryOriginal.updatedAt) > new Date(lastSynced);
                if (!isOutOfSync) return null;

                return (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            syncNestedPresentation(slide.id);
                        }}
                        className="absolute bottom-1 right-1 px-2 py-0.5 rounded-[5px] bg-blue-500 hover:bg-blue-400 border border-blue-400/50 text-[7px] font-black text-white uppercase tracking-wider z-30 shadow-lg shadow-blue-500/20 animate-in fade-in zoom-in-50 duration-300 flex items-center gap-1 cursor-pointer apple-press"
                        title={t('sync_library_update', 'Sync Library Update')}
                    >
                        <RotateCcw className="w-2.5 h-2.5" />
                        {t('sync', 'Sync')}
                    </button>
                );
            })()}
        </div>
    );
});
SlideTile.displayName = 'SlideTile';
