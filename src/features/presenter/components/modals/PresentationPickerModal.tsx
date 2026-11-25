import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, ICanvasSlide, IPresentationFile, IAudioScope } from '@/core/types';
import { Monitor, Music, Plus, Edit2, Copy, Download, Trash2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { useContainFit } from '@/core/hooks/useContainFit';
import TrackContainer from '../timeline/TrackContainer';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { Button, CustomSlideStackIcon, PickerModalShell, SearchInput } from '@/shared/ui';
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

    const templatesMap = useMemo(() => new Map((allTemplates || []).map(tpl => [tpl.id, tpl])), [allTemplates]);
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
            id: string;
            width: number;
            x: number;
            type: 'slide';
            slide: ISlide;
        }> = [];

        const TILE_WIDTH = 121;
        const TILE_GAP = 10;
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
                            scopes.push({
                                scope: { ...scope, fileName: scope.fileName || scope.fileId.split('/').pop() },
                                startIdx: sIdx,
                                endIdx: eIdx,
                            });
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

    const handleClose = useCallback(() => {
        setContextMenu(null);
        closeModal(ModalType.PRESENTATION_PICKER);
    }, [closeModal]);

    const handleAdd = useCallback(() => {
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
    }, [selectedPresentationId, addPresentationToTimeline, closeModal]);

    const handleModalKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (!searchQuery && selectedPresentationId))) {
            e.preventDefault();
            handleAdd();
        }
    }, [handleAdd, searchQuery, selectedPresentationId]);

    const currentPreviewSlide = slides.find(s => s.id === previewSlideId) || slides[0];

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

    return (
        <PickerModalShell
            isOpen={isOpen}
            onClose={handleClose}
            onKeyDown={handleModalKeyDown}
            disableEscapeClose={!!contextMenu}
            sidebarIcon={<CustomSlideStackIcon className="w-4 h-4" />}
            sidebarTitle={t('add_nested_presentation', 'Вставить презентацию')}
            sidebarHeaderExtra={
                <SearchInput
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    placeholder={t('search_presentations', 'Поиск презентаций...')}
                    autoFocus
                />
            }
            sidebarBody={
                <PresentationPickerSidebar
                    searchQuery={searchQuery}
                    availablePresentations={availablePresentations}
                    selectedPresentationId={selectedPresentationId}
                    onSelectPresentation={setSelectedPresentationId}
                    onContextMenu={(e, presentation) => {
                        setContextMenu({ x: e.clientX, y: e.clientY, presentation });
                    }}
                />
            }
            contentTitle={activePresentation?.name || t('select_to_preview', 'Выберите презентацию')}
            contentBadge={
                slides.length > 0 ? (
                    <span
                        title={t('slides_count', { count: slides.length, defaultValue: `${slides.length} слайдов` })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/10 rounded-md text-[10px] font-semibold text-stone-400 shrink-0 tabular-nums"
                    >
                        <CustomSlideStackIcon className="w-3 h-3 opacity-75 shrink-0" />
                        <span>{slides.length}</span>
                    </span>
                ) : undefined
            }
            preview={
                <div
                    ref={containerRef}
                    className="flex-1 flex flex-col items-center justify-center relative overflow-hidden group/main-preview p-6 min-h-0"
                >
                    {!activePresentation ? (
                        <div className="text-stone-600 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5">
                                <CustomSlideStackIcon className="w-8 h-8 opacity-30" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
                                {t('select_to_preview', 'Выберите презентацию')}
                            </p>
                        </div>
                    ) : currentPreviewSlide ? (() => {
                        const w = fitWidth || 800;
                        const h = fitHeight || Math.round(w / (16 / 9));
                        return (
                            <div
                                className="relative shadow-[0_24px_70px_rgba(0,0,0,0.75)] rounded-xl overflow-hidden border border-white/10 shrink-0 pointer-events-none"
                                style={{ width: w, height: h }}
                            >
                                <SlideContentRenderer
                                    template={templatesMap.get(currentPreviewSlide.templateId)}
                                    block={blocksMap.get(currentPreviewSlide.blockId)}
                                    variables={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.variables : undefined}
                                    lang={lang}
                                    backgroundOverride={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).backgroundOverride : undefined}
                                    canvasItems={currentPreviewSlide.type === 'normal' ? (currentPreviewSlide as ICanvasSlide).content?.canvasItems : []}
                                    slide={currentPreviewSlide}
                                    scale={w / 1920}
                                />
                            </div>
                        );
                    })() : (
                        <div className="text-stone-600 flex flex-col items-center gap-4 animate-pulse">
                            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5">
                                <Monitor className="w-8 h-8 opacity-30" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
                                {t('preparing_preview', 'Подготовка превью...')}
                            </p>
                        </div>
                    )}
                </div>
            }
            tray={
                slides.length > 0 ? (
                    <div className="shrink-0 bg-[#141210] border-t border-white/[0.06] flex flex-col">
                        <TrackContainer className="px-6">
                            <div className="flex flex-col min-w-full py-3.5 gap-2">
                                {/* Slides Strip (matches HymnPickerModal carousel geometry) */}
                                <div className="flex gap-2.5 relative h-[68px]">
                                    {visualTimeline.map((item, index) => {
                                        const slide = item.slide;
                                        const template = templatesMap.get(slide.templateId);
                                        const block = blocksMap.get(slide.blockId);
                                        const isCurrent = previewSlideId === slide.id;

                                        return (
                                            <button
                                                type="button"
                                                key={slide.id}
                                                data-slide-id={slide.id}
                                                onClick={() => setPreviewSlideId(slide.id)}
                                                className={cn(
                                                    'relative h-[68px] aspect-video rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer group apple-press',
                                                    isCurrent
                                                        ? 'border-accent ring-2 ring-accent/30 shadow-lg shadow-black/50'
                                                        : 'border-white/10 hover:border-white/25 opacity-65 hover:opacity-100 bg-black'
                                                )}
                                                style={{ width: item.width }}
                                            >
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
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

                                                <div className={cn(
                                                    'absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold z-10 tabular-nums leading-none',
                                                    isCurrent
                                                        ? 'bg-accent text-stone-950'
                                                        : 'bg-black/70 text-stone-300 border border-white/10'
                                                )}>
                                                    {(slide.order || index) + 1}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Optional Audio Lane (only shown when presentation actually has audio tracks) */}
                                {allScopes.length > 0 && (
                                    <div className="flex relative h-10 bg-purple-500/[0.06] rounded-lg border border-purple-500/15">
                                        {allScopes.map(({ scope, startIdx, endIdx }) => (
                                            <ModalAudioScope
                                                key={scope.id}
                                                scope={scope}
                                                startIdx={startIdx}
                                                endIdx={endIdx}
                                                visualTimeline={visualTimeline}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TrackContainer>
                    </div>
                ) : undefined
            }
            footerLeft={
                activePresentation ? (
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <CustomSlideStackIcon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                            <span>{t('slides_count', { count: slides.length, defaultValue: `${slides.length} слайдов` })}</span>
                        </span>
                        {allScopes.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[11px] font-semibold text-purple-300 tabular-nums">
                                <Music className="w-3 h-3 shrink-0" />
                                <span>{allScopes.length}</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-stone-500">
                        {t('select_to_preview', 'Выберите презентацию')}
                    </span>
                )
            }
            footerRight={
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAdd}
                    disabled={!selectedPresentationId}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="px-5 font-bold tracking-wide shrink-0"
                >
                    {t('add_to_timeline', 'Добавить на таймлайн')}
                </Button>
            }
            extra={contextMenuEl}
        />
    );
};

export default PresentationPickerModal;
