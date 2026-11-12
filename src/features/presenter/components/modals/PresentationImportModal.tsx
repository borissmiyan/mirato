import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, ICanvasSlide } from '@/core/types';
import { X, Check, Layers, Plus, Music, Monitor } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { useContainFit } from '@/core/hooks/useContainFit';
import TrackContainer from '../timeline/TrackContainer';
import { Button, IconButton, Badge } from '@/shared/ui';

interface ModalAudioScopeProps {
    scope: { fileName?: string; fileId: string; id: string };
    startIdx: number;
    endIdx: number;
    visualTimeline: Array<{ x: number; width: number }>;
}

const ModalAudioScope: React.FC<ModalAudioScopeProps> = ({ scope, startIdx, endIdx, visualTimeline }) => {
    const left = visualTimeline[startIdx]?.x || 0;
    const right = visualTimeline[endIdx] ? (visualTimeline[endIdx].x + visualTimeline[endIdx].width) : left;
    const width = right - left;

    if (width <= 0) return null;

    return (
        <div
            className="absolute top-0 h-10 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center px-3 overflow-hidden backdrop-blur-sm shadow-lg shadow-purple-500/5 animate-in fade-in zoom-in-95 duration-300"
            style={{ left, width, marginTop: '8px' }}
        >
            <Music className="w-3.5 h-3.5 text-purple-400 mr-2 shrink-0" />
            <span className="text-[10px] font-black text-purple-100 truncate uppercase tracking-wider">{scope.fileName || 'Audio Track'}</span>
        </div>
    );
};

const PresentationImportModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const closeModal = useModalStore(s => s.closeModal);
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.PRESENTATION_IMPORTER))
    );
    const isOpen = !!modalData;
    const presentationId = modalData?.props?.presentationId as string | undefined;

    const importSlidesToService = usePresentationStore(s => s.importSlidesToService);

    const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);
    const [previewSlideId, setPreviewSlideId] = useState<string | null>(null);

    const presentation = useLiveQuery(
        async () => (presentationId ? await db.presentationFiles.get(presentationId) : null),
        [presentationId]
    );

    const rawTemplates = useLiveQuery(() => db.templates.toArray());
    const rawBlocks = useLiveQuery(() => db.blocks.toArray());
    const templatesMap = useMemo(() => new Map((rawTemplates || []).map(t => [t.id, t])), [rawTemplates]);
    const blocksMap = useMemo(() => new Map((rawBlocks || []).map(b => [b.id, b])), [rawBlocks]);

    const slides = useMemo(() => {
        const s = presentation?.slides || [];
        return [...s].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [presentation]);

    const visualTimeline = useMemo(() => {
        const items: Array<{
            id: string;
            width: number;
            x: number;
            type: 'slide';
            slide: ISlide;
        }> = [];

        const TILE_WIDTH = 160;
        const TILE_GAP = 12;

        let currentX = 0;

        for (const slide of slides) {
            items.push({
                id: slide.id,
                width: TILE_WIDTH,
                x: currentX,
                type: 'slide',
                slide,
            });
            currentX += TILE_WIDTH + TILE_GAP;
        }
        return items;
    }, [slides]);

    const slideToIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        visualTimeline.forEach((item, idx) => {
            map.set(item.id, idx);
        });
        return map;
    }, [visualTimeline]);

    // Audio scopes from slides
    const allScopes = useMemo(() => {
        const scopes: Array<{ scope: { fileName?: string; fileId: string; id: string }; startIdx: number; endIdx: number }> = [];
        const seenScopeIds = new Set<string>();

        slides.forEach((s) => {
            if (s.type === 'normal' && (s as ICanvasSlide).audioScopes) {
                for (const scope of (s as ICanvasSlide).audioScopes!) {
                    if (seenScopeIds.has(scope.id)) continue;

                    const sIdx = slideToIndexMap.get(scope.startSlideId);
                    const eIdx = slideToIndexMap.get(scope.endSlideId);

                    if (sIdx !== undefined && eIdx !== undefined) {
                        scopes.push({ scope: { ...scope, fileName: scope.fileName || scope.fileId.split('/').pop() }, startIdx: sIdx, endIdx: eIdx });
                        seenScopeIds.add(scope.id);
                    }
                }
            }
        });
        return scopes;
    }, [slides, slideToIndexMap]);

    useEffect(() => {
        if (slides.length > 0 && !previewSlideId) {
            setPreviewSlideId(slides[0].id);
        }
    }, [slides, previewSlideId]);

    const { width: fitWidth, height: fitHeight, containerRef } = useContainFit(16 / 9, 32);

    if (!isOpen || !presentation) return null;

    const toggleSlideSelection = (id: string) => {
        setSelectedSlideIds(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedSlideIds.length === slides.length) {
            setSelectedSlideIds([]);
        } else {
            setSelectedSlideIds(slides.map(s => s.id));
        }
    };

    const handleImport = async () => {
        const selectedSlides = slides.filter(s => selectedSlideIds.includes(s.id));
        if (selectedSlides.length === 0) return;

        await importSlidesToService(presentation.name, selectedSlides);
        closeModal(ModalType.PRESENTATION_IMPORTER);
    };

    const currentPreviewSlide = slides.find(s => s.id === previewSlideId) || slides[0];

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] apple-modal">
                {/* Header */}
                <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5 shrink-0">
                            <Layers className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight line-clamp-1">
                                {t('preview_presentation', 'Preview Presentation')}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em]">
                                    {presentation.name}
                                </p>
                                <div className="w-1 h-1 rounded-full bg-stone-700" />
                                <Badge variant="accent" size="xs">
                                    {t('slides_count', { count: slides.length, defaultValue: '{{count}} Slides' })}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="secondary"
                            size="xs"
                            onClick={handleSelectAll}
                        >
                            {selectedSlideIds.length === slides.length ? t('deselect_all', 'Deselect All') : t('select_all', 'Select All')}
                        </Button>
                        <IconButton
                            icon={<X className="w-5 h-5" />}
                            label={t('close', 'Close')}
                            variant="surface"
                            size="xs"
                            onClick={() => closeModal(ModalType.PRESENTATION_IMPORTER)}
                        />
                    </div>
                </div>

                {/* Content Area - Vertical Stack */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Top: Large Preview Area */}
                    <div
                        ref={containerRef}
                        className="flex-1 bg-stone-950/40 flex flex-col items-center justify-center relative overflow-hidden group/main-preview"
                    >
                        {/* Background Decor */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute inset-0 bg-radial-gradient from-accent/30 to-transparent scale-150" />
                        </div>

                        {currentPreviewSlide && fitWidth && fitHeight ? (
                            <div
                                className="relative shadow-[0_40px_100px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden border border-white/10 ring-4 ring-white/5 animate-in fade-in zoom-in-95 duration-500 pointer-events-none"
                                style={{
                                    width: fitWidth,
                                    height: fitHeight,
                                }}
                            >
                                <SlideContentRenderer
                                    template={templatesMap.get(currentPreviewSlide.templateId)}
                                    block={blocksMap.get(currentPreviewSlide.blockId)}
                                    variables={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables : undefined}
                                    lang={lang}
                                    backgroundOverride={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).backgroundOverride : undefined}
                                    canvasItems={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.canvasItems : []}
                                    slide={currentPreviewSlide}
                                    scale={fitWidth / 1920}
                                />

                                <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                                        {(currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables?.title : undefined) || t('no_title', 'Untitled Slide')}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                            {blocksMap.get(currentPreviewSlide.blockId)?.name || currentPreviewSlide.blockId}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-stone-700 flex flex-col items-center gap-4 animate-pulse">
                                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                                    <Monitor className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-widest opacity-30">{t('preparing_preview', 'Preparing Preview...')}</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Horizontal Timeline Area */}
                    <div className="h-[240px] shrink-0 bg-stone-950 border-t border-white/10 flex flex-col relative shadow-[0_-20px_50px_rgba(0,0,0,0.4)] z-10">
                        <div className="px-6 py-2.5 border-b border-white/5 flex items-center justify-between bg-stone-900/40 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                    {t('timeline', 'Timeline')}
                                </span>
                                <div className="w-px h-3 bg-white/10" />
                                <Badge variant="secondary" size="xs">
                                    {t('slide_units_count', { count: slides.length, defaultValue: '{{count}} Units' })}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex-1 relative flex">
                            {/* Track Names */}
                            <div className="w-16 shrink-0 border-r border-white/5 bg-stone-900/40 flex flex-col z-20 backdrop-blur-md">
                                <div className="h-[104px] flex flex-col items-center justify-center gap-1 opacity-50">
                                    <Monitor className="w-4 h-4 text-stone-400" />
                                    <span className="text-[7px] font-bold uppercase tracking-widest text-stone-400">{t('slides', 'Slides')}</span>
                                </div>
                                <div className="h-14 border-t border-white/5 flex flex-col items-center justify-center gap-1 bg-purple-500/5 opacity-60">
                                    <Music className="w-3 h-3 text-purple-400" />
                                    <span className="text-[7px] font-bold uppercase tracking-widest text-purple-400">{t('audio', 'Audio')}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                <TrackContainer className="px-8">
                                    <div className="flex flex-col min-w-full py-4 gap-2">
                                        {/* Slides Lane */}
                                        <div className="flex gap-3 relative h-24">
                                            {visualTimeline.map((item, index) => {
                                                const slide = item.slide;
                                                const template = templatesMap.get(slide.templateId);
                                                const block = blocksMap.get(slide.blockId);
                                                const isSelected = selectedSlideIds.includes(slide.id);
                                                const isCurrent = previewSlideId === slide.id;

                                                return (
                                                    <div
                                                        key={slide.id}
                                                        data-slide-id={slide.id}
                                                        className={cn(
                                                            "group relative shrink-0 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden leading-none select-none active:scale-[0.98] will-change-transform",
                                                            isCurrent
                                                                ? "border-accent ring-4 ring-accent/15 scale-105 z-10 shadow-xl shadow-accent/10"
                                                                : "border-white/5 hover:border-white/20 bg-stone-900"
                                                        )}
                                                        style={{ width: item.width }}
                                                        onClick={() => setPreviewSlideId(slide.id)}
                                                    >
                                                        <div className="absolute inset-0 z-0">
                                                            <SlideContentRenderer
                                                                template={template}
                                                                block={block}
                                                                variables={slide.type === 'normal' ? (slide as ICanvasSlide).content?.variables : undefined}
                                                                lang={lang}
                                                                isPreview={true}
                                                                scale={item.width / 1920}
                                                                backgroundOverride={slide.type === 'normal' ? (slide as ICanvasSlide).backgroundOverride : undefined}
                                                                canvasItems={slide.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : []}
                                                                slide={slide}
                                                            />
                                                        </div>

                                                        {/* Checkbox Overlay */}
                                                        <div className="absolute top-1.5 left-1.5 z-20">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleSlideSelection(slide.id);
                                                                }}
                                                                className={cn(
                                                                    "w-5 h-5 rounded-xl border flex items-center justify-center transition-all shadow-md cursor-pointer",
                                                                    isSelected
                                                                        ? "bg-accent border-accent text-accent-foreground"
                                                                        : "bg-black/50 border-white/20 text-transparent hover:border-accent"
                                                                )}
                                                            >
                                                                <Check className={cn("w-3.5 h-3.5 transition-all", isSelected ? "opacity-100" : "opacity-0")} />
                                                            </button>
                                                        </div>

                                                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-[8px] font-bold text-stone-300 z-10 tracking-widest">
                                                            {(slide.order || index) + 1}
                                                        </div>

                                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/80 to-transparent z-10 p-2 flex flex-col justify-end">
                                                            <p className="text-[8px] font-bold text-white/90 uppercase truncate">
                                                                {(slide.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.title : undefined) || `${t('slide', 'Slide')} ${index + 1}`}
                                                            </p>
                                                        </div>

                                                        <div className={cn(
                                                            "absolute inset-0 bg-accent/5 transition-opacity duration-200 pointer-events-none",
                                                            isCurrent ? "opacity-100" : "opacity-0"
                                                        )} />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Audio Lane */}
                                        <div className="flex relative h-14 bg-purple-500/5 rounded-2xl border border-purple-500/5 mt-1">
                                            {allScopes.map(({ scope, startIdx, endIdx }) => (
                                                <ModalAudioScope
                                                    key={scope.id}
                                                    scope={scope}
                                                    startIdx={startIdx}
                                                    endIdx={endIdx}
                                                    visualTimeline={visualTimeline}
                                                />
                                            ))}
                                            {allScopes.length === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                    <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">{t('no_audio_tracks', 'No Audio Tracks')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TrackContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-white/5 bg-stone-900 flex items-center justify-between shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-20">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">
                                {t('import_summary', 'Import Summary')}
                            </span>
                            <div className="flex items-center gap-3">
                                <Badge variant="accent" size="md">
                                    {t('selected_count', { count: selectedSlideIds.length, defaultValue: '{{count}} Selected' })}
                                </Badge>
                                <div className="w-1 h-1 rounded-full bg-stone-700" />
                                <p className="text-xs font-semibold text-stone-400">
                                    {t('ready_to_import', 'Ready to add to service')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => closeModal(ModalType.PRESENTATION_IMPORTER)}
                        >
                            {t('back', 'Go Back')}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={selectedSlideIds.length === 0}
                            onClick={handleImport}
                            leftIcon={<Plus className="w-4 h-4" />}
                        >
                            {t('add_to_service', 'Add to Service')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PresentationImportModal;
