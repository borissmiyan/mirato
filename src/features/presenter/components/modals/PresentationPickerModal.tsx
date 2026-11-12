import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, ICanvasSlide, IPresentationFile, IAudioScope } from '@/core/types';
import { Layers, Monitor, Music, Plus, Edit2, Copy, Download, Trash2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { useContainFit } from '@/core/hooks/useContainFit';
import TrackContainer from '../timeline/TrackContainer';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import Button from '@/shared/ui/Button';
import { getUniquePresentationName } from '@/core/utils/nameUtils';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import PresentationPickerSidebar from './PresentationPickerSidebar';
import { ModalAudioScope } from './ModalAudioScope';

const PresentationPickerModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const closeModal = useModalStore(s => s.closeModal);
    const openModal = useModalStore(s => s.openModal);
    // Find the LAST instance to correctly support nested modals
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.PRESENTATION_PICKER))
    );
    const isOpen = !!modalData;

    const { addPresentationToTimeline, activeServiceId } = usePresentationStore(
        useShallow(s => ({
            addPresentationToTimeline: s.addPresentationToTimeline,
            activeServiceId: s.activeServiceId,
        }))
    );

    const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
    const [previewSlideId, setPreviewSlideId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        presentation: IPresentationFile;
    } | null>(null);

    const allPresentations = useLiveQuery(
        () => {
            if (!isOpen || !activeServiceId) return [];
            return db.presentationFiles.where('serviceId').equals(activeServiceId).toArray();
        },
        [isOpen, activeServiceId]
    );
    const allTemplates = useLiveQuery(() => (isOpen ? db.templates.toArray() : []), [isOpen]);
    const allBlocks = useLiveQuery(() => (isOpen ? db.blocks.toArray() : []), [isOpen]);

    const templatesMap = useMemo(() => new Map((allTemplates || []).map(t => [t.id, t])), [allTemplates]);
    const blocksMap = useMemo(() => new Map((allBlocks || []).map(b => [b.id, b])), [allBlocks]);

    // Filter for current service's presentations
    const availablePresentations = useMemo(() => {
        if (!activeServiceId) return [];
        let filtered = allPresentations || [];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
        }

        return [...filtered].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }, [allPresentations, searchQuery, activeServiceId]);

    // Lazy load only the selected presentation's full slides for preview
    const liveSelectedPresentation = useLiveQuery(
        () => {
            if (!isOpen || !selectedPresentationId) return null;
            return db.presentationFiles.get(selectedPresentationId);
        },
        [isOpen, selectedPresentationId]
    );

    const activePresentation = liveSelectedPresentation || null;

    // Auto-select first presentation when modal opens or presentations change
    useEffect(() => {
        if (!isOpen) return;
        if (!selectedPresentationId && availablePresentations.length > 0) {
            setSelectedPresentationId(availablePresentations[0].id);
        }
    }, [isOpen, selectedPresentationId, availablePresentations]);

    const slides = useMemo(() => {
        const s = activePresentation?.slides || [];
        return [...s].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [activePresentation]);

    const visualTimeline = useMemo(() => {
        const items: Array<{
            id: string,
            width: number,
            x: number,
            type: 'slide',
            slide: ISlide,
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
        const scopes: Array<{ scope: IAudioScope; startIdx: number; endIdx: number }> = [];
        const seenScopeIds = new Set<string>();

        slides.forEach((s) => {
            if (s.type === 'normal') {
                const audioScopes = (s as ICanvasSlide).audioScopes;
                if (audioScopes) {
                    for (const scope of audioScopes) {
                        if (seenScopeIds.has(scope.id)) continue;

                        const sIdx = slideToIndexMap.get(scope.startSlideId);
                        const eIdx = slideToIndexMap.get(scope.endSlideId);

                        if (sIdx !== undefined && eIdx !== undefined) {
                            scopes.push({ scope: { ...scope, fileName: scope.fileName || scope.fileId.split('/').pop() }, startIdx: sIdx, endIdx: eIdx });
                            seenScopeIds.add(scope.id);
                        }
                    }
                }
            }
        });
        return scopes;
    }, [slides, slideToIndexMap]);

    // Auto-select first slide for preview when presentation changes
    useEffect(() => {
        if (slides.length > 0) {
            setPreviewSlideId(slides[0].id);
        } else {
            setPreviewSlideId(null);
        }
    }, [selectedPresentationId, slides]);

    const { width: fitWidth, height: fitHeight, containerRef } = useContainFit(16 / 9, 32);

    if (!isOpen) return null;

    const handleAdd = () => {
        if (!selectedPresentationId) return;

        // Find insertion index: after the currently selected slide
        const { activePresentation: currentActive, selectedSlideIds } = usePresentationStore.getState();
        let insertionIndex: number | undefined;

        if (currentActive && selectedSlideIds.length > 0) {
            const lastSelectedIndex = currentActive.slides.findIndex(s => s.id === selectedSlideIds[selectedSlideIds.length - 1]);
            if (lastSelectedIndex !== -1) {
                insertionIndex = lastSelectedIndex + 1;
            }
        }

        addPresentationToTimeline(selectedPresentationId, insertionIndex);
        closeModal(ModalType.PRESENTATION_PICKER);
    };

    const currentPreviewSlide = slides.find(s => s.id === previewSlideId) || slides[0];

    const mainPortal = createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-7xl h-[90vh] flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] apple-modal">

                {/* Left Sidebar - Presentation Selection */}
                <PresentationPickerSidebar
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onClose={() => closeModal(ModalType.PRESENTATION_PICKER)}
                    availablePresentations={availablePresentations}
                    selectedPresentationId={selectedPresentationId}
                    onSelectPresentation={setSelectedPresentationId}
                    onContextMenu={(e, presentation) => {
                        setContextMenu({ x: e.clientX, y: e.clientY, presentation });
                    }}
                />

                {/* Right Area - Preview */}
                <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                    {/* Top: Large Preview Area */}
                    <div
                        ref={containerRef}
                        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden group/main-preview"
                    >
                        {!activePresentation ? (
                            <div className="text-stone-700 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                                    <Layers className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest opacity-30">{t('select_to_preview')}</p>
                            </div>
                        ) : currentPreviewSlide && fitWidth && fitHeight ? (
                            <>
                                {/* Background Decor */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none">
                                    <div className="absolute inset-0 bg-radial-gradient from-accent/30 to-transparent scale-150" />
                                </div>

                                <div
                                    className="relative shadow-[0_40px_100px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden border border-white/10 ring-4 ring-white/5 animate-in fade-in zoom-in-95 duration-700 pointer-events-none"
                                    style={{ width: fitWidth, height: fitHeight }}
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

                                    <div className="absolute bottom-8 left-8 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 shadow-2xl">
                                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">
                                            {(currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables?.title : undefined) || t('no_title')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                                {blocksMap.get(currentPreviewSlide.blockId)?.name || currentPreviewSlide.blockId}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-stone-700 flex flex-col items-center gap-6 animate-pulse">
                                <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/5">
                                    <Monitor className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest opacity-30">{t('preparing_preview')}</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Horizontal Timeline Area */}
                    <div className={cn(
                        "h-[240px] shrink-0 bg-stone-950 border-t border-white/10 flex flex-col relative shadow-[0_-20px_50px_rgba(0,0,0,0.4)] z-10 transition-opacity duration-300",
                        activePresentation ? "opacity-100" : "opacity-50 pointer-events-none grayscale"
                    )}>
                        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-stone-900/40 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                    {t('timeline')}
                                </span>
                                <div className="w-px h-3 bg-white/10" />
                                <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest">
                                    {t('slides_count', { count: slides.length, defaultValue: '{{count}} slides' })}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 relative flex">
                            {/* Track Names */}
                            <div className="w-16 shrink-0 border-r border-white/5 bg-stone-900/40 flex flex-col z-20 backdrop-blur-md">
                                <div className="h-[104px] flex flex-col items-center justify-center gap-1 opacity-40">
                                    <Monitor className="w-4 h-4 text-stone-400" />
                                    <span className="text-[7px] font-black uppercase tracking-widest text-stone-500">{t('slides')}</span>
                                </div>
                                <div className="h-14 border-t border-white/5 flex flex-col items-center justify-center gap-1 bg-purple-500/5 opacity-50">
                                    <Music className="w-3 h-3 text-purple-400" />
                                    <span className="text-[7px] font-black uppercase tracking-widest text-purple-500">{t('audio')}</span>
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
                                                const isCurrent = previewSlideId === slide.id;

                                                return (
                                                    <div
                                                        key={slide.id}
                                                        data-slide-id={slide.id}
                                                        className={cn(
                                                            "group relative shrink-0 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden leading-none",
                                                            isCurrent
                                                                ? "border-accent ring-4 ring-accent/10 scale-105 z-10 shadow-xl shadow-accent/10"
                                                                : "border-white/5 hover:border-white/20 bg-stone-900"
                                                        )}
                                                        style={{ width: item.width }}
                                                        onClick={() => setPreviewSlideId(slide.id)}
                                                    >
                                                        <div className="absolute inset-0 z-0 pointer-events-none">
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

                                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/5 text-[8px] font-black text-stone-400 z-10 tracking-widest">
                                                            {(slide.order || index) + 1}
                                                        </div>

                                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/80 to-transparent z-10 p-2 flex flex-col justify-end">
                                                            <p className="text-[7px] font-black text-white/80 uppercase truncate">
                                                                {(slide.type === 'normal' ? (slide as ICanvasSlide).content?.variables?.title : undefined) || `${t('slide')} ${index + 1}`}
                                                            </p>
                                                        </div>

                                                        <div className={cn(
                                                            "absolute inset-0 bg-accent/5 transition-opacity duration-300",
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
                                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                    <span className="text-[8px] text-stone-500 font-bold uppercase tracking-widest">{t('no_audio_tracks')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TrackContainer>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 border-t border-white/5 bg-stone-900 flex items-center justify-end shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-20">
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleAdd}
                            disabled={!selectedPresentationId}
                            leftIcon={<Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90 duration-500", !selectedPresentationId && "opacity-20")} />}
                            className="px-10 py-3.5 uppercase tracking-widest font-black"
                        >
                            {t('add_to_timeline')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );

    // ContextMenu portals itself internally — render it in the component tree (not in another createPortal)
    const contextMenuEl = contextMenu ? (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
        >
            <ContextMenuItem
                icon={<Edit2 className="w-3 h-3" />}
                label={t('rename', 'Rename')}
                onClick={() => {
                    openModal(ModalType.PROMPT, {
                        title: t('rename_presentation', 'New name:'),
                        defaultValue: contextMenu.presentation.name,
                        onSelection: (newName: string | null) => {
                            if (newName) {
                                db.presentationFiles.update(contextMenu.presentation.id, { name: newName });
                            }
                        }
                    });
                    setContextMenu(null);
                }}
            />
            <ContextMenuItem
                icon={<Copy className="w-3 h-3" />}
                label={t('duplicate', 'Duplicate')}
                onClick={async () => {
                    const original = await db.presentationFiles.get(contextMenu.presentation.id);
                    if (original) {
                        const newName = await getUniquePresentationName(original.name);
                        const clone = structuredClone(original);
                        clone.id = crypto.randomUUID();
                        clone.name = newName;
                        const now = new Date();
                        clone.createdAt = now;
                        clone.updatedAt = now;
                        clone.lastOpened = now;
                        await db.presentationFiles.add(clone);
                    }
                    setContextMenu(null);
                }}
            />
            <ContextMenuItem
                icon={<Download className="w-3 h-3" />}
                label={t('export', 'Export')}
                onClick={() => {
                    GraceLibExportService.exportItem(
                        contextMenu.presentation.id,
                        'presentation',
                        contextMenu.presentation.name
                    );
                    setContextMenu(null);
                }}
            />
            <div className="h-px bg-white/5 my-1 mx-2" />
            <ContextMenuItem
                icon={<Trash2 className="w-3 h-3" />}
                label={t('delete', 'Delete')}
                danger
                onClick={() => {
                    openModal(ModalType.CONFIRM, {
                        title: t('confirm_delete', 'Confirm Delete'),
                        message: t('confirm_remove_presentation', 'Remove this presentation from library?'),
                        variant: 'danger',
                        onSelection: (confirmed: boolean) => {
                            if (confirmed) {
                                db.presentationFiles.delete(contextMenu.presentation.id);
                                if (selectedPresentationId === contextMenu.presentation.id) {
                                    setSelectedPresentationId(null);
                                }
                            }
                        }
                    });
                    setContextMenu(null);
                }}
            />
        </ContextMenu>
    ) : null;

    return <>{mainPortal}{contextMenuEl}</>;

};

export default PresentationPickerModal;
