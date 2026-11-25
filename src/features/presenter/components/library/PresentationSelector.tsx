import React, { useState, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Plus, X, HardDrive, MousePointerClick } from 'lucide-react';
import { CustomServiceIcon, CustomSlideStackIcon } from '@/shared/ui/SlideIcons';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { createPortal } from 'react-dom';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { IPresentationFile } from '@/core/types';
import { Button } from '@/shared/ui/Button';
import { NavigationSelectorCard, VirtualList, VirtualListHandle } from '@/shared/ui';
import { PresentationListItem } from './PresentationListItem';
import { PresentationContextMenu } from './PresentationContextMenu';
import { PresentationExportMenu } from './PresentationExportMenu';
import { PresentationSearchHeader } from './PresentationSearchHeader';
import { usePresentationManagement } from '../../hooks/usePresentationManagement';

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

interface PresentationSelectorProps {
    className?: string;
}

const PresentationSelector: React.FC<PresentationSelectorProps> = ({ className }) => {
    const { t } = useTranslation();
    const {
        activeService,
        activeServiceId,
        activePresentation,
        activePresentationId,
        setActivePresentation,
        setActiveService,
        createPresentation,
        renamePresentation,
        removePresentation
    } = usePresentationStore(
        useShallow(s => ({
            activeService: s.activeService,
            activeServiceId: s.activeServiceId,
            activePresentation: s.activePresentation,
            activePresentationId: s.activePresentationId,
            setActivePresentation: s.setActivePresentation,
            setActiveService: s.setActiveService,
            createPresentation: s.createPresentation,
            renamePresentation: s.renamePresentation,
            removePresentation: s.removePresentation,
        }))
    );

    const openModal = useModalStore(s => s.openModal);

    const [isOpen, setIsOpen] = useState(false);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listScrollRef = useRef<VirtualListHandle>(null);
    const [search, setSearch] = useState('');
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        presentation: IPresentationFile;
    } | null>(null);
    const [exportMenu, setExportMenu] = useState<{
        x: number;
        y: number;
        presentation: IPresentationFile;
    } | null>(null);

    const [filterStarredOnly, setFilterStarredOnly] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'master' | 'usual'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [sortBy, setSortBy] = useState<'lastOpened' | 'alphabetical' | 'createdAt'>('lastOpened');
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [tagSearchInput, setTagSearchInput] = useState('');

    // Keep lightweight presentation summaries preloaded for the active service (~40 KB for 385 items)
    // so opening the dropdown is instant with zero loading flash or layout shift.
    const livePresentations = useLiveQuery(async () => {
        if (!activeService?.presentationIds?.length) return [];
        const all = await db.presentationFiles.bulkGet(activeService.presentationIds);
        return all
            .filter((p): p is IPresentationFile => Boolean(p))
            .map(p => ({
                ...p,
                // Strip heavy slide payloads from dropdown list state while preserving .length
                slides: { length: p.slides?.length ?? 0 } as unknown as IPresentationFile['slides'],
            }));
    }, [activeService?.presentationIds]);
    const presentations = useMemo(() => livePresentations || [], [livePresentations]);

    const allExistingTags = useMemo(() => {
        const tagsSet = new Set<string>();
        presentations.forEach(p => {
            if (p.tags) {
                p.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet);
    }, [presentations]);

    const filteredPresentations = useMemo(() => {
        let list = [...presentations];

        // 1. Search Query
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q));
        }

        // 2. Starred Filter
        if (filterStarredOnly) {
            list = list.filter(p => p.isStarred);
        }

        // 3. Type Filter
        if (filterType === 'master') {
            list = list.filter(p => p.isMaster);
        } else if (filterType === 'usual') {
            list = list.filter(p => !p.isMaster);
        }

        // 4. Tag Filter
        if (selectedTag) {
            list = list.filter(p => p.tags && p.tags.includes(selectedTag));
        }

        // 5. Sorting
        list.sort((a, b) => {
            if (sortBy === 'lastOpened') {
                if (a.isStarred && !b.isStarred) return -1;
                if (!a.isStarred && b.isStarred) return 1;
            }

            if (sortBy === 'alphabetical') {
                return naturalCollator.compare(a.name, b.name);
            }
            if (sortBy === 'createdAt') {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            }
            // Default: lastOpened / updatedAt (fallback when both are starred or both are unstarred)
            const dateA = a.lastOpened ? new Date(a.lastOpened).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const dateB = b.lastOpened ? new Date(b.lastOpened).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            return dateB - dateA;
        });

        return list;
    }, [presentations, search, filterStarredOnly, filterType, selectedTag, sortBy]);

    const hasScrolledOnOpenRef = useRef(false);

    const getItemKey = useCallback((pres: IPresentationFile) => pres.id, []);
    const estimatePresSize = useCallback(() => 56, []);

    // Scroll synchronously before first paint to the active presentation each time the dropdown opens
    useLayoutEffect(() => {
        if (!isOpen) {
            hasScrolledOnOpenRef.current = false;
            return;
        }
        if (hasScrolledOnOpenRef.current || !activePresentationId || filteredPresentations.length === 0) {
            return;
        }
        const activeIndex = filteredPresentations.findIndex(p => p.id === activePresentationId);
        if (activeIndex === -1) return;

        hasScrolledOnOpenRef.current = true;
        listScrollRef.current?.scrollToIndex(activeIndex, 'center');
    }, [isOpen, activePresentationId, filteredPresentations]);

    const {
        handleCreatePresentation: createPres,
        handleRenamePresentation: renamePres,
        handleAddTag,
        handleRemoveTag,
        handleToggleStar,
        handleExportPresentation,
        handleImportPresentation: importPres,
    } = usePresentationManagement(activeServiceId);

    const handleCreatePresentation = async () => {
        await createPres(newName);
        setNewName('');
        setAddingNew(false);
    };

    const handleRenamePresentation = async (id: string) => {
        await renamePres(id, renameValue);
        setRenamingId(null);
        setRenameValue('');
    };

    const handleImportPresentation = async () => {
        await importPres();
        setIsOpen(false);
    };

    const handleToggle = () => {
        if (!isOpen && triggerRef.current) {
            setTriggerRect(triggerRef.current.getBoundingClientRect());
        }
        setIsOpen(!isOpen);
    };

    // Position above trigger button with rock-solid width (never jitters while opening or filtering)
    const dropdownPosition = useMemo(() => {
        if (!triggerRect) return { bottom: '4.5rem', left: '1rem', width: '500px' };
        const spacing = 8;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const menuHeight = 520;
        const bottom = windowHeight - triggerRect.top + spacing;

        const width = Math.min(Math.max(triggerRect.width * 1.8, 520), windowWidth - 32);

        let left = Math.max(16, triggerRect.left);
        if (left + width > windowWidth - 16) {
            left = Math.max(16, windowWidth - width - 16);
        }

        if (triggerRect.top < menuHeight + spacing) {
            return { top: triggerRect.bottom + spacing, left, width };
        }
        return { bottom, left, width };
    }, [triggerRect]);

    const typeOptions = [
        { value: 'all', label: t('type_all', 'All Types') },
        { value: 'master', label: t('type_master', 'Master') },
        { value: 'usual', label: t('type_usual', 'Usual') }
    ];

    const tagOptions = [
        { value: '', label: t('filter_tags', 'Tags') },
        ...allExistingTags.map(tag => ({ value: tag, label: tag }))
    ];

    const sortOptions = [
        { value: 'lastOpened', label: t('last_opened', 'Recent') },
        { value: 'alphabetical', label: t('alphabetical', 'A-Z') },
        { value: 'createdAt', label: t('date_created', 'Created') }
    ];

    return (
        <div className={cn("relative", className)}>
            <NavigationSelectorCard
                ref={triggerRef}
                onClick={handleToggle}
                title={activePresentation ? activePresentation.name : t('select_presentation', 'Select Presentation')}
                subtitle={
                    activePresentation
                        ? (() => {
                            const count = activePresentation.slides.length;
                            const label = t('slides_count', { count, defaultValue: `${count} slides` });
                            return label === 'slides_count' ? `${count} slides` : label;
                        })()
                        : t('no_presentation_active', 'None Active')
                }
                badge={<CustomSlideStackIcon className="w-4 h-4" />}
                badgeVariant={activePresentation ? 'accent' : 'muted'}
                trailing={
                    activePresentation?.fileHandle ? (
                        <div title={t('linked_to_disk', 'Linked to disk')}>
                            <HardDrive className="w-3.5 h-3.5 text-accent" />
                        </div>
                    ) : undefined
                }
                isOpen={isOpen}
                ariaLabel={activePresentation ? activePresentation.name : t('select_presentation', 'Select Presentation')}
            />

            {isOpen && createPortal(
                <div className="fixed inset-0 z-10002 pointer-events-none">
                    <button
                        type="button"
                        aria-label={t('close_menu', 'Close menu')}
                        className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default pointer-events-auto"
                        onClick={() => setIsOpen(false)}
                    />

                    <div
 className="absolute bg-stone-900 border border-white/10 rounded-xl shadow-2xl flex flex-col h-[520px] max-h-[calc(100vh-100px)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                        style={dropdownPosition}
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40">
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                {t('presentations', 'Presentations')}
                            </h3>
                            <div className="flex items-center gap-1">
                                {activeServiceId && !addingNew && (
                                    <Button
                                        size="xs"
                                        square
                                        variant="ghost"
                                        onClick={() => setAddingNew(true)}
                                        title={t('new_presentation', 'New Presentation')}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                                <Button
                                    size="xs"
                                    square
                                    variant="ghost"
                                    onClick={() => setIsOpen(false)}
                                    title={t('close_menu', 'Close menu')}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>

                        <PresentationSearchHeader
                            search={search}
                            setSearch={setSearch}
                            filterStarredOnly={filterStarredOnly}
                            setFilterStarredOnly={setFilterStarredOnly}
                            filterType={filterType}
                            setFilterType={setFilterType}
                            selectedTag={selectedTag}
                            setSelectedTag={setSelectedTag}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            typeOptions={typeOptions}
                            tagOptions={tagOptions}
                            sortOptions={sortOptions}
                            addingNew={addingNew}
                            setAddingNew={setAddingNew}
                            newName={newName}
                            setNewName={setNewName}
                            handleCreatePresentation={handleCreatePresentation}
                            t={t as never}
                        />

                        {/* Presentations List (Unified VirtualList) */}
                        {activeService ? (
                            <VirtualList
                                listRef={listScrollRef}
                                items={filteredPresentations}
                                getItemKey={getItemKey}
                                estimateItemHeight={estimatePresSize}
                                gap={4}
                                overscan={8}
                                className="p-2"
                                renderItem={(pres) => (
                                    <PresentationListItem
                                        pres={pres}
                                        isActive={activePresentationId === pres.id}
                                        isRenaming={renamingId === pres.id}
                                        renameValue={renameValue}
                                        setRenameValue={setRenameValue}
                                        onStartRename={() => { setRenamingId(pres.id); setRenameValue(pres.name); }}
                                        onCancelRename={() => setRenamingId(null)}
                                        onSaveRename={() => handleRenamePresentation(pres.id)}
                                        isEditingTags={editingTagsId === pres.id}
                                        setEditingTagsId={setEditingTagsId}
                                        tagSearchInput={tagSearchInput}
                                        setTagSearchInput={setTagSearchInput}
                                        allExistingTags={allExistingTags}
                                        onAddTag={(tag) => handleAddTag(pres.id, tag)}
                                        onRemoveTag={(tag) => handleRemoveTag(pres.id, tag)}
                                        onToggleStar={() => handleToggleStar(pres.id)}
                                        onExport={() => handleExportPresentation(pres.id)}
                                        onExportContextMenu={(e) => {
                                            setContextMenu(null);
                                            setExportMenu({ x: e.clientX, y: e.clientY, presentation: pres });
                                        }}
                                        onDelete={() => {
                                            openModal(ModalType.CONFIRM, {
                                                title: t('confirm_delete', 'Confirm Delete'),
                                                message: t('confirm_delete_presentation', 'Delete this presentation?'),
                                                variant: 'danger',
                                                onSelection: (confirmed: boolean) => {
                                                    if (confirmed) {
                                                        removePresentation(pres.id);
                                                    }
                                                }
                                            });
                                        }}
                                        onSelect={() => {
                                            setActivePresentation(pres.id);
                                            setIsOpen(false);
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, presentation: pres });
                                        }}
                                    />
                                )}
                                emptyState={
                                    <div className="py-8 flex flex-col items-center justify-center gap-2.5">
                                        <CustomSlideStackIcon className="w-8 h-8 text-stone-500/60" />
                                        <p className="text-xs font-medium text-stone-500 tracking-tight">
                                            {search ? t('no_results', 'No results') : t('no_presentations', 'No presentations')}
                                        </p>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 py-12 flex flex-col items-center justify-center gap-3">
                                <div className="relative flex items-center justify-center">
                                    <CustomServiceIcon className="w-10 h-10 text-stone-400/60" />
                                    <MousePointerClick
                                        className="absolute -right-2.5 -bottom-2 w-7 h-7 text-accent drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none"
                                        fill="#181614"
                                        strokeWidth={1.6}
                                    />
                                </div>
                                <p className="text-xs font-medium text-stone-400 tracking-tight">
                                    {t('select_service_first', 'Select Service First')}
                                </p>
                            </div>
                        )}

                        {/* Footer: Import */}
                        {activeServiceId && (
                            <div className="p-2 border-t border-white/5 bg-stone-950/40 shrink-0">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full text-xs font-bold uppercase tracking-wider"
                                    leftIcon={<Download className="w-4 h-4" />}
                                    onClick={handleImportPresentation}
                                >
                                    {t('import_presentation', 'Import (.mrtp / .pptx)')}
                                </Button>
                            </div>
                        )}

                        {contextMenu && (
                            <PresentationContextMenu
                                contextMenu={contextMenu}
                                onClose={() => setContextMenu(null)}
                                activeServiceId={activeServiceId}
                                handleToggleStar={handleToggleStar}
                                setEditingTagsId={setEditingTagsId}
                                setTagSearchInput={setTagSearchInput}
                                setRenamingId={setRenamingId}
                                setRenameValue={setRenameValue}
                                handleExportPresentation={handleExportPresentation}
                            />
                        )}

                        {exportMenu && (
                            <PresentationExportMenu
                                x={exportMenu.x}
                                y={exportMenu.y}
                                presentationId={exportMenu.presentation.id}
                                onExportMrtp={handleExportPresentation}
                                onClose={() => setExportMenu(null)}
                            />
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PresentationSelector;
