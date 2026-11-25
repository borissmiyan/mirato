import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IAudioScope, ISlide, ICanvasSlide, ITimerSlide, IHymnSlide, HymnalAudioVariant } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useSetAtom } from 'jotai';
import { latestInteractionAreaAtom } from '@/core/store/uiAtoms';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Music, Plus } from 'lucide-react';
import AudioScopeBlock from './AudioScopeBlock';
import TimerAudioClip from './TimerAudioClip';
import { findOverlappingScopes } from '../../utils/timelineUtils';
import { MediaPersistenceService } from '../../services/MediaPersistenceService';
import { buildHymnalAudioFileId } from '@/features/hymns/services/hymnalAudioCatalog';

/** Width of each slide tile in the timeline (matches SlideTimeline w-32 = 128px) */
const TILE_WIDTH = 128;
/** Gap between tiles in the timeline (matches gap-3 = 12px) */
const TILE_GAP = 12;

interface AudioTrackProps {
    visualTimeline: Array<{
        id: string,
        width: number,
        x: number,
        type: 'slide' | 'nested' | 'edit-button' | 'spacer',
        slide?: ISlide,
        presentationId?: string,
        parentSlideId?: string
    }>;
    readOnly?: boolean;
}

const AudioTrack: React.FC<AudioTrackProps> = ({ visualTimeline, readOnly = false }) => {
    const { t } = useTranslation();
    const openModal = useModalStore(s => s.openModal);
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const activePresentation = usePresentationStore(s => s.activePresentation);
    const selectedPresentationId = usePresentationStore(s => s.selectedPresentationId);
    const addAudioScope = usePresentationStore(s => s.addAudioScope);
    const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
    const setLatestArea = useSetAtom(latestInteractionAreaAtom);
    const [hoveredSlotIdx, setHoveredSlotIdx] = React.useState<number | null>(null);

    // Map slide IDs to their first visual index for scope resolution
    const slideToIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        visualTimeline.forEach((item, idx) => {
            if (item.slide) {
                map.set(item.slide.id, idx);
            }
        });
        return map;
    }, [visualTimeline]);

    const activePresentationIds = useMemo(() => {
        const ids = new Set<string>();
        if (activePresentationId) ids.add(activePresentationId);
        if (selectedPresentationId) ids.add(selectedPresentationId);
        visualTimeline.forEach(item => {
            if (item.presentationId) ids.add(item.presentationId);
        });
        return Array.from(ids);
    }, [activePresentationId, selectedPresentationId, visualTimeline]);

    // Live query for all audio scopes in these presentations
    const liveDbScopes = useLiveQuery(
        () => activePresentationIds.length > 0 
            ? db.audioScopes.where('presentationId').anyOf(activePresentationIds).toArray() 
            : [],
        [activePresentationIds]
    );
    const dbScopes = useMemo(() => liveDbScopes || [], [liveDbScopes]);

    // Resolve visual indices for each scope
    const allScopes = useMemo(() => {
        const scopes: Array<{ scope: IAudioScope; startIdx: number; endIdx: number }> = [];

        dbScopes.forEach(scope => {
            const sIdx = slideToIndexMap.get(scope.startSlideId);
            const eIdx = slideToIndexMap.get(scope.endSlideId);

            if (sIdx !== undefined && eIdx !== undefined) {
                scopes.push({ scope, startIdx: sIdx, endIdx: eIdx });
            }
        });
        return scopes;
    }, [dbScopes, slideToIndexMap]);

    // Fetch referenced hymn presentations for IHymnSlide runs on the timeline
    const hymnPresIds = useMemo(() => {
        const ids = new Set<string>();
        visualTimeline.forEach(item => {
            if (item.slide?.type === 'hymn') {
                const hs = item.slide as IHymnSlide;
                if (hs.includeAudio !== false && hs.hymnPresentationId) {
                    ids.add(hs.hymnPresentationId);
                }
            }
        });
        return Array.from(ids);
    }, [visualTimeline]);

    const referencedHymns = useLiveQuery(
        () => hymnPresIds.length > 0 ? db.presentationFiles.where('id').anyOf(hymnPresIds).toArray() : [],
        [hymnPresIds]
    );

    // Group contiguous IHymnSlide runs into single virtual audio clips so users see Minus/Plus & can switch via right-click
    const hymnVirtualScopes = useMemo(() => {
        if (!referencedHymns || referencedHymns.length === 0) return [];
        const hymnMap = new Map(referencedHymns.map(p => [p.id, p]));
        const runs: Array<{
            scope: IAudioScope;
            startIdx: number;
            endIdx: number;
            slideIds: string[];
        }> = [];

        let i = 0;
        while (i < visualTimeline.length) {
            const item = visualTimeline[i];
            if (item.slide?.type !== 'hymn') {
                i++;
                continue;
            }
            const firstSlide = item.slide as IHymnSlide;
            if (firstSlide.includeAudio === false) {
                i++;
                continue;
            }
            const pres = hymnMap.get(firstSlide.hymnPresentationId);
            if (!pres?.hymnalId || typeof pres.metadata?.hymnOrder !== 'number') {
                i++;
                continue;
            }
            const startIdx = i;
            const slideIds = [firstSlide.id];
            const variant: HymnalAudioVariant = firstSlide.audioVariant === 'plus' ? 'plus' : 'minus';
            let j = i + 1;
            while (j < visualTimeline.length) {
                const next = visualTimeline[j];
                if (
                    next.slide?.type === 'hymn'
                    && (next.slide as IHymnSlide).hymnPresentationId === firstSlide.hymnPresentationId
                    && (next.slide as IHymnSlide).includeAudio !== false
                ) {
                    slideIds.push(next.slide.id);
                    j++;
                } else {
                    break;
                }
            }
            const endIdx = j - 1;
            // Skip if an explicit DB audio scope already overlaps this run
            const overlapped = allScopes.some(s => s.startIdx <= endIdx && s.endIdx >= startIdx);
            if (!overlapped) {
                runs.push({
                    startIdx,
                    endIdx,
                    slideIds,
                    scope: {
                        id: `hymn-ref-audio:${firstSlide.id}:${variant}`,
                        presentationId: activePresentationId || '',
                        startSlideId: firstSlide.id,
                        endSlideId: visualTimeline[endIdx].slide!.id,
                        fileId: buildHymnalAudioFileId(pres.hymnalId, pres.metadata.hymnOrder, variant),
                        fileName: `${pres.name} (${variant === 'plus' ? '+' : '-'}).ogg`,
                        volume: 1,
                        loop: false,
                        strategy: firstSlide.audioStrategy ?? 'auto',
                        audioVariant: variant,
                    },
                });
            }
            i = j;
        }
        return runs;
    }, [referencedHymns, visualTimeline, allScopes, activePresentationId]);

    const handleSwitchHymnRunVariant = useCallback(async (slideIds: string[], targetVariant: HymnalAudioVariant) => {
        if (!activePresentationId || !activePresentation?.slides) return;
        const idSet = new Set(slideIds);
        const updatedSlides = activePresentation.slides.map(slide => {
            if (slide.type === 'hymn' && idSet.has(slide.id)) {
                return { ...slide, audioVariant: targetVariant };
            }
            return slide;
        });
        await updatePresentationSlides(activePresentationId, updatedSlides);
    }, [activePresentationId, activePresentation?.slides, updatePresentationSlides]);

    const [isDraggingOver, setIsDraggingOver] = React.useState(false);

    // ── Drag and Drop ─────────────────────────────────────────────────
    const handleDragOver = useCallback((e: React.DragEvent) => {
        const hasAudio = Array.from(e.dataTransfer.items).some(
            item => (item.kind === 'file' && item.type.startsWith('audio/')) ||
                (item.type === 'application/json')
        );
        if (hasAudio) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDraggingOver(true);
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;

        let foundIdx = -1;
        for (let i = 0; i < visualTimeline.length; i++) {
            const item = visualTimeline[i];
            if (relativeX >= item.x && relativeX <= item.x + item.width) {
                foundIdx = i;
                break;
            }
        }
        setHoveredSlotIdx(foundIdx !== -1 ? foundIdx : null);
    }, [visualTimeline]);

    const handleMouseLeave = useCallback((e: React.DragEvent) => {
        setIsDraggingOver(false);
    }, []);

    const handleMouseLeaveContainer = useCallback(() => {
        setHoveredSlotIdx(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        const jsonData = e.dataTransfer.getData('application/json');

        if (files.length === 0 && !jsonData) return;
        if (visualTimeline.length === 0) return;

        // Handle Media Pool items
        let mediaPoolItemId: string | null = null;
        let mediaPoolName: string | null = null;

        try {
            if (jsonData) {
                const data = JSON.parse(jsonData);
                if (data.source === 'media-pool' && data.media.type === 'audio') {
                    mediaPoolItemId = data.media.id || data.media.path;
                    mediaPoolName = data.media.name;
                }
            }
        } catch (err) {
            // Not JSON or wrong format
        }

        if (files.length === 0 && !mediaPoolItemId) return;
        if (visualTimeline.length === 0) return;

        // Determine which slot the drop landed on based on X position
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;

        let targetSlotIdx = -1;
        for (let i = 0; i < visualTimeline.length; i++) {
            const item = visualTimeline[i];
            // Since elements in Lane 1 are positioned with absolute-like logic (p-4 + gaps),
            // and we share the same parent scroll, relativeX is directly comparable to item.x
            // BUT relativeX is 0 at the start of AudioTrack component.
            // visualTimeline.x is also relative to the container (p-4).
            // So they are perfectly aligned.

            if (relativeX >= item.x && relativeX <= item.x + item.width) {
                targetSlotIdx = i;
                break;
            }
        }

        // If no direct hit, find nearest slide if possible
        if (targetSlotIdx === -1) {
            let minDistance = Infinity;
            visualTimeline.forEach((item, idx) => {
                if (item.slide) {
                    const center = item.x + item.width / 2;
                    const dist = Math.abs(relativeX - center);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetSlotIdx = idx;
                    }
                }
            });
        }

        const targetItem = targetSlotIdx !== -1 ? visualTimeline[targetSlotIdx] : null;
        const targetSlideId = targetItem?.slide?.id;
        if (!targetSlideId) return;

        // Process files (Electron provides .path on dropped File objects)
        for (const file of files) {
            const path = (file as File & { path?: string }).path || null;
            const stableId = await MediaPersistenceService.importMediaBlob(file, path, 'audio');
            if (stableId) {
                await addAudioScope(targetSlideId, stableId, file.name);
            }
        }

        if (mediaPoolItemId) {
            const name = mediaPoolName || mediaPoolItemId.split(/[/\\]/).pop() || 'Audio Track';

            // Check for overlaps (assume 1 slide span for new drop)
            const overlaps = findOverlappingScopes(targetSlotIdx, targetSlotIdx, visualTimeline, slideToIndexMap);

            if (overlaps.length > 0) {
                openModal(ModalType.AUDIO_CONFLICT, {
                    targetSlideId,
                    fileId: mediaPoolItemId,
                    fileName: name,
                    overlappingScopes: overlaps
                });
            } else {
                await addAudioScope(targetSlideId, mediaPoolItemId, name);
            }
        }
    }, [visualTimeline, addAudioScope, slideToIndexMap, openModal]);

    // Calculate total width based on the visual model
    const totalWidth = useMemo(() => {
        if (visualTimeline.length === 0) return 0;
        const lastItem = visualTimeline[visualTimeline.length - 1];
        return lastItem.x + lastItem.width;
    }, [visualTimeline]);

    return (
        <div
            onDragOver={readOnly ? undefined : handleDragOver}
            onDragLeave={readOnly ? undefined : handleMouseLeave}
            onMouseMove={readOnly ? undefined : handleMouseMove}
            onMouseLeave={readOnly ? undefined : handleMouseLeaveContainer}
            onPointerDown={() => setLatestArea('audio')}
            onDrop={readOnly ? undefined : handleDrop}
            className={cn(
                'relative shrink-0 transition-all rounded-xl',
                isDraggingOver ? 'outline outline-2 outline-purple-500/50 outline-dashed bg-purple-500/10' : ''
            )}
            style={{
                height: 72,
                width: totalWidth || '100%',
                minWidth: totalWidth || '100%',
            }}
        >
            {isDraggingOver && allScopes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-purple-400">
                    <Music className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('drop_audio_here', 'Drop Audio Here')}</span>
                </div>
            )}

            {/* Hover Highlight & Plus Button */}
            {!readOnly &&
                !isDraggingOver &&
                hoveredSlotIdx !== null &&
                visualTimeline[hoveredSlotIdx]?.type === 'slide' &&
                visualTimeline[hoveredSlotIdx]?.slide &&
                !allScopes.some(s => s.startIdx <= (hoveredSlotIdx || -1) && s.endIdx >= (hoveredSlotIdx || -1)) &&
                !((visualTimeline[hoveredSlotIdx]?.slide as ITimerSlide)?.playlist?.length) &&
                !((visualTimeline[hoveredSlotIdx]?.slide as ICanvasSlide)?.timerSettings?.playlist?.length) && (
                    <div
                        className="absolute top-1 bottom-1 border-2 border-dashed border-purple-500/30 rounded-xl pointer-events-none z-10 flex items-center justify-center transition-all animate-in fade-in duration-200"
                        style={{
                            left: visualTimeline[hoveredSlotIdx].x,
                            width: visualTimeline[hoveredSlotIdx].width
                        }}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const slideId = visualTimeline[hoveredSlotIdx].slide?.id;
                                if (slideId) {
                                    openModal(ModalType.AUDIO_PICKER, { targetSlideId: slideId });
                                }
                            }}
                            className="pointer-events-auto h-8 w-8 rounded-full bg-purple-500/20 text-purple-500 border border-purple-500/30 hover:bg-purple-500 hover:text-white hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer apple-press"
                            title={t('add_audio', 'Add Audio')}
                            aria-label={t('add_audio', 'Add Audio')}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                )}

            {visualTimeline.map((item) => {
                const legacyPlaylist = item.type === 'slide' && item.slide?.type === 'normal' ? (item.slide as ICanvasSlide).timerSettings?.playlist : undefined;
                const newPlaylist = item.type === 'slide' && item.slide?.type === 'timer' ? (item.slide as ITimerSlide).playlist : undefined;
                const playlistLength = legacyPlaylist?.length || newPlaylist?.length;

                if (item.type === 'slide' && item.slide && playlistLength) {
                    return (
                        <TimerAudioClip
                            key={`timer-audio-${item.slide.id}`}
                            slide={item.slide}
                            x={item.x}
                            width={item.width}
                        />
                    );
                }
                return null;
            })}

            {allScopes.map(({ scope, startIdx, endIdx }) => (
                <AudioScopeBlock
                    key={scope.id}
                    scope={scope}
                    startIdx={startIdx}
                    endIdx={endIdx}
                    visualTimeline={visualTimeline}
                    tileGap={TILE_GAP}
                    readOnly={readOnly}
                />
            ))}

            {hymnVirtualScopes.map(({ scope, startIdx, endIdx, slideIds }) => (
                <AudioScopeBlock
                    key={scope.id}
                    scope={scope}
                    startIdx={startIdx}
                    endIdx={endIdx}
                    visualTimeline={visualTimeline}
                    tileGap={TILE_GAP}
                    readOnly={true}
                    onSwitchAudioVariant={(targetVariant) => handleSwitchHymnRunVariant(slideIds, targetVariant)}
                />
            ))}
        </div>
    );
};

export default React.memo(AudioTrack);
