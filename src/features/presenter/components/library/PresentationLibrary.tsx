import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom } from 'jotai';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { BookOpen, Monitor, Music, Coins, Baby, Mic2, Megaphone, Plus, Presentation, LayoutTemplate, Layers, Layout, type LucideIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/utils/cn';
import { themeAccentAtom, devModeAtom } from '@/core/store/uiAtoms';
import { IBlock, ISlide, ICanvasSlide, ITemplate, ITemplateSlide, ICanvasItem, IPresentationFile, IPresentationBin } from '@/core/types';
import PresentationSelector from './PresentationSelector';
import SlideContentRenderer from '@/features/presenter/components/slide-editor/SlideContentRenderer';
import { GraceLibBin } from './GraceLibBin';
import { EktpService } from '@/features/presenter/services/ektpService';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { MediaType } from '@/core/types';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { Edit2, RefreshCw, ChevronRight, FolderPlus, MoreVertical, Folder, Download } from 'lucide-react';
import { IpcService } from '@/core/services/ipcService';
import { TemplatePreviewItem } from './TemplatePreviewItem';
import { LibraryImportService } from '../../services/LibraryImportService';
import { LibraryTemplatesSection } from './LibraryTemplatesSection';
import { LibraryPresentationsSection } from './LibraryPresentationsSection';
import { LibraryMediaSection } from './LibraryMediaSection';
import { LibraryContextMenu, LibraryContextMenuData } from './LibraryContextMenu';

import { LibraryHeader } from './LibraryHeader';
import { useLibraryInteraction } from '../../hooks/useLibraryInteraction';

const ICON_MAP: Record<string, LucideIcon> = {
    Monitor, Music, Coins, Baby, Mic2, Megaphone, BookOpen, Plus, Presentation, Layers, Layout
};

const EMPTY_PRESENTATIONS: IPresentationFile[] = [];
const EMPTY_BINS: IPresentationBin[] = [];
const EMPTY_BLOCKS: IBlock[] = [];
const EMPTY_TEMPLATES: ITemplate[] = [];

interface IPresentationLibraryProps {
    className?: string;
}

const PresentationLibrary: React.FC<IPresentationLibraryProps> = ({ className }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isRu = lang === 'ru';

    const {
        activePresentationId,
        activeServiceId,
        activeService,
        updatePresentationSlides,
        setPreviewSlide,
        activeBlockId,
        setActiveBlockId,
        previewSlideId,
        graceLibSection,
        setGraceLibSection,
        graceLibMediaBins,
        addMediaBin,
        updateMediaBin,
        removeMediaBin,
        templateNavPath,
        pushTemplateNav,
        popTemplateNav,
        setTemplateNavPath,
        presentationBinNavPath,
        setPresentationBinNavPath,
        createPresentationBin,
        renamePresentationBin,
        removePresentationBin,
        movePresentationToBin,
        overrideTemplateSlide,
        updateTemplate,
        removeTemplate,
        renameTemplateSlide,
        removeTemplateSlide
    } = usePresentationStore(
        useShallow(s => ({
            activePresentationId: s.activePresentationId,
            activeServiceId: s.activeServiceId,
            activeService: s.activeService,
            updatePresentationSlides: s.updatePresentationSlides,
            setPreviewSlide: s.setPreviewSlide,
            activeBlockId: s.activeBlockId,
            setActiveBlockId: s.setActiveBlockId,
            previewSlideId: s.previewSlideId,
            graceLibSection: s.graceLibSection,
            setGraceLibSection: s.setGraceLibSection,
            graceLibMediaBins: s.graceLibMediaBins,
            addMediaBin: s.addMediaBin,
            updateMediaBin: s.updateMediaBin,
            removeMediaBin: s.removeMediaBin,
            templateNavPath: s.templateNavPath,
            pushTemplateNav: s.pushTemplateNav,
            popTemplateNav: s.popTemplateNav,
            setTemplateNavPath: s.setTemplateNavPath,
            presentationBinNavPath: s.presentationBinNavPath,
            setPresentationBinNavPath: s.setPresentationBinNavPath,
            createPresentationBin: s.createPresentationBin,
            renamePresentationBin: s.renamePresentationBin,
            removePresentationBin: s.removePresentationBin,
            movePresentationToBin: s.movePresentationToBin,
            overrideTemplateSlide: s.overrideTemplateSlide,
            updateTemplate: s.updateTemplate,
            removeTemplate: s.removeTemplate,
            renameTemplateSlide: s.renameTemplateSlide,
            removeTemplateSlide: s.removeTemplateSlide
        }))
    );

    const openGlobalModal = useModalStore(s => s.openModal);
    const [devMode] = useAtom(devModeAtom);

    const [contextMenu, setContextMenu] = useState<LibraryContextMenuData | null>(null);

    const blocks = useLiveQuery(() => db.blocks.toArray()) ?? EMPTY_BLOCKS;
    const presentation = useLiveQuery(
        () => activePresentationId ? db.presentationFiles.get(activePresentationId) : undefined,
        [activePresentationId]
    );
    const presentationBins = useLiveQuery(() => db.presentationBins.toArray());
    const allTemplates = useLiveQuery(() => db.templates.toArray()) ?? EMPTY_TEMPLATES;

    const selectedSlide = useMemo(() =>
        presentation?.slides?.find((s: ISlide) => s.id === previewSlideId),
        [presentation, previewSlideId]
    );

    const currentBinId = presentationBinNavPath.length > 0 ? presentationBinNavPath[presentationBinNavPath.length - 1] : null;

    // Load only library presentations (excluding hymns and service presentations to save RAM)
    const filteredPresentations = useLiveQuery(async () => {
        if (currentBinId) {
            return db.presentationFiles.where('binId').equals(currentBinId).toArray();
        }
        return db.presentationFiles
            .filter((p: IPresentationFile) => !p.serviceId && !p.hymnalId && !p.binId)
            .toArray();
    }, [currentBinId]) ?? EMPTY_PRESENTATIONS;

    const filteredBins = useMemo(() => {
        if (!presentationBins) return EMPTY_BINS;
        return presentationBins.filter((b: IPresentationBin) => (b.parentId || null) === (currentBinId || null));
    }, [presentationBins, currentBinId]);

    const {
        isDragging,
        handleImportClick,
        handleDragOver,
        handleDragLeave,
        handleDrop
    } = useLibraryInteraction({
        currentBinId,
        t,
        createPresentationBin
    });

    useEffect(() => {
        if (!IpcService.isElectron()) return;

        const unsubs = [
            IpcService.on('menu:export-gracelib', () => {
                GraceLibExportService.exportGraceLib();
            }),
            IpcService.on('menu:export-presentations', () => {
                GraceLibExportService.exportCollection('presentations');
            }),
            IpcService.on('menu:export-templates', () => {
                GraceLibExportService.exportCollection('templates');
            })
        ];

        return () => {
            unsubs.forEach((unsub) => unsub());
        };
    }, []);

    const handleTemplateClick = async (template: ITemplate, templateSlideId?: string, isBefore?: boolean) => {
        if (!activePresentationId || !presentation) return;

        const slides = presentation.slides || [];
        const currentSlideIdx = slides.findIndex((s: ISlide) => s.id === previewSlideId);

        let slideLayout: ITemplateSlide | undefined;
        if (templateSlideId && template.templateSlides) {
            slideLayout = template.templateSlides.find((s: ITemplateSlide) => s.id === templateSlideId);
        }

        const sourceCanvasItems = slideLayout?.canvasItems || template.canvasItems || [];
        const newCanvasItems = sourceCanvasItems.map((item: ICanvasItem) => ({
            ...item,
            id: crypto.randomUUID()
        }));

        const newSlide: ICanvasSlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: slides.length,
            blockId: slideLayout?.categoryId || template.category,
            templateId: template.id,
            backgroundOverride: slideLayout?.backgroundOverride || undefined,
            content: {
                variables: template.assets?.[0]?.type === 'text' ? { content: template.assets[0].content } : {},
                canvasItems: newCanvasItems.length > 0 ? newCanvasItems : undefined
            },
        };

        let newSlides = [...slides];
        if (isBefore && currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx, 0, newSlide);
        } else if (currentSlideIdx !== -1) {
            newSlides.splice(currentSlideIdx + 1, 0, newSlide);
        } else {
            newSlides.push(newSlide);
        }

        newSlides = newSlides.map((s, i) => ({ ...s, order: i }));

        await updatePresentationSlides(activePresentationId, newSlides);
        setPreviewSlide(newSlide.id);
    };

    const handleOverrideTemplateSlideInLibrary = async (template: ITemplate | { id: string }, layoutSlideId: string) => {
        if (!selectedSlide) return;
        await overrideTemplateSlide(template.id, layoutSlideId, selectedSlide, devMode);
    };

    const currentNav = templateNavPath[templateNavPath.length - 1];

    return (
        <div className={cn("h-full flex flex-col bg-stone-900/80 backdrop-blur-xl border-r border-white/5 @container", className)}>
            <LibraryHeader
                graceLibSection={graceLibSection}
                templateNavPath={templateNavPath}
                presentationBinNavPath={presentationBinNavPath}
                presentationBins={presentationBins ?? EMPTY_BINS}
                isRu={isRu}
                t={t}
                setTemplateNavPath={setTemplateNavPath}
                setPresentationBinNavPath={setPresentationBinNavPath}
                handleImportClick={handleImportClick}
            />

            <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                {!graceLibSection ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-full max-w-sm p-8 rounded-3xl bg-stone-950/20 border border-white/5 flex flex-col items-center gap-4 group transition-all hover:bg-stone-950/30">
                            <div className="w-16 h-16 rounded-2xl bg-stone-800/50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                <Layers className="w-8 h-8 text-stone-500 opacity-40 group-hover:text-accent group-hover:opacity-100 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-stone-300 uppercase tracking-widest">{t('empty_library', 'Empty Selection')}</h3>
                                <p className="text-xs font-medium italic text-stone-500 max-w-[220px]">
                                    {t('select_library_hint', 'Select a section in GraceLib to browse content')}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {graceLibSection === 'templates' && (
                            <LibraryTemplatesSection
                                currentNav={currentNav}
                                allTemplates={allTemplates}
                                blocks={blocks}
                                isRu={isRu}
                                lang={lang}
                                selectedSlide={selectedSlide}
                                activePresentationId={activePresentationId}
                                devMode={devMode}
                                t={t}
                                pushTemplateNav={pushTemplateNav}
                                setContextMenu={setContextMenu}
                                handleTemplateClick={handleTemplateClick}
                                handleOverrideTemplateSlide={handleOverrideTemplateSlideInLibrary}
                            />
                        )}
                        {graceLibSection === 'presentations' && (
                            <LibraryPresentationsSection
                                filteredPresentations={filteredPresentations}
                                filteredBins={filteredBins}
                                currentBinId={currentBinId}
                                isDragging={isDragging}
                                isRu={isRu}
                                t={t}
                                activePresentationId={activePresentationId}
                                handlePresentationClick={(pres) => {
                                    openGlobalModal(ModalType.PRESENTATION_IMPORTER, { presentationId: pres.id });
                                }}
                                pushPresentationBinNav={(id) => setPresentationBinNavPath([...presentationBinNavPath, id])}
                                handleCreateBin={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('enter_bin_name', 'Enter bin name:'),
                                        onSelection: (name: string | null) => {
                                            if (name) createPresentationBin(name);
                                        }
                                    });
                                }}
                                setContextMenu={setContextMenu}
                                handleDragOver={handleDragOver}
                                handleDragLeave={handleDragLeave}
                                handleDrop={handleDrop}
                            />
                        )}
                        {graceLibSection === 'media' && (
                            <LibraryMediaSection
                                graceLibMediaBins={graceLibMediaBins}
                                t={t}
                                handleAddBin={() => {
                                    openGlobalModal(ModalType.PROMPT, {
                                        title: t('enter_bin_name', 'Enter bin name:'),
                                        onSelection: (name: string | null) => {
                                            if (name) addMediaBin(name);
                                        }
                                    });
                                }}
                                setContextMenu={setContextMenu}
                            />
                        )}
                    </>
                )}
            </div>

            <div className="shrink-0 p-3 border-t border-white/5 bg-stone-950/60 relative z-30">
                <PresentationSelector />
            </div>

            <LibraryContextMenu
                contextMenu={contextMenu}
                onClose={() => setContextMenu(null)}
                t={t}
                isRu={isRu}
                devMode={devMode}
                openGlobalModal={openGlobalModal}
                updateTemplate={updateTemplate}
                renamePresentationBin={renamePresentationBin}
                updateMediaBin={updateMediaBin}
                removeTemplate={removeTemplate}
                templateNavPath={templateNavPath}
                setTemplateNavPath={setTemplateNavPath}
                removePresentationBin={removePresentationBin}
                presentationBinNavPath={presentationBinNavPath}
                setPresentationBinNavPath={setPresentationBinNavPath}
                removeMediaBin={removeMediaBin}
                renameTemplateSlide={renameTemplateSlide}
                removeTemplateSlide={removeTemplateSlide}
                handleOverrideTemplateSlide={handleOverrideTemplateSlideInLibrary}
            />
        </div>
    );
};

export default PresentationLibrary;
