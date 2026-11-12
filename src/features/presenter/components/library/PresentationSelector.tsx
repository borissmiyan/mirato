import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Plus, X, Layers, HardDrive } from 'lucide-react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { cn } from '@/core/utils/cn';
import { createPortal } from 'react-dom';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { IPresentationFile } from '@/core/types';
import { Button } from '@/shared/ui/Button';
import { NavigationSelectorCard } from '@/shared/ui';
import { PresentationListItem } from './PresentationListItem';
import { PresentationContextMenu } from './PresentationContextMenu';
import { PresentationSearchHeader } from './PresentationSearchHeader';
import { usePresentationManagement } from '../../hooks/usePresentationManagement';

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

    const [filterStarredOnly, setFilterStarredOnly] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'master' | 'usual'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [sortBy, setSortBy] = useState<'lastOpened' | 'alphabetical' | 'createdAt'>('lastOpened');
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [tagSearchInput, setTagSearchInput] = useState('');

    // Load presentations from DB for the active service only when dropdown is open to save RAM
    const livePresentations = useLiveQuery(async () => {
        if (!isOpen || !activeService?.presentationIds?.length) return [];
        const all = await db.presentationFiles.bulkGet(activeService.presentationIds);
        return all.filter(Boolean) as IPresentationFile[];
    }, [isOpen, activeService?.presentationIds]);
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
                return a.name.localeCompare(b.name);
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

    // Position above trigger button
    const dropdownPosition = useMemo(() => {
        if (!triggerRect) return { bottom: '4.5rem', left: '1rem', width: '380px' };
        const spacing = 8;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const menuHeight = 520;
        const bottom = windowHeight - triggerRect.top + spacing;

        // Dynamic width based on longest presentation name, badges, and action buttons
        // Overhead: thumbnail (48px) + padding (32px) + action buttons (124px) + active dot (14px) + buffer (12px) = 230px
        const maxNameLen = filteredPresentations.reduce((max, p) => Math.max(max, p.name?.length || 0), 0);
        const contentWidth = Math.round(230 + maxNameLen * 11);
        const minWidth = Math.max(triggerRect.width, 480);
        const maxWidth = Math.min(Math.max(triggerRect.width * 2, 540), windowWidth - 32);
        const width = Math.min(Math.max(contentWidth, minWidth), maxWidth);

        let left = Math.max(16, triggerRect.left);
        if (left + width > windowWidth - 16) {
            left = Math.max(16, windowWidth - width - 16);
        }

        if (triggerRect.top < menuHeight + spacing) {
            return { top: triggerRect.bottom + spacing, left, width };
        }
        return { bottom, left, width };
    }, [triggerRect, filteredPresentations]);

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
                        ? `${activePresentation.slides.length} ${t('slides', 'slides')}`
                        : t('no_presentation_active', 'None Active')
                }
                badge={<Layers className="w-4 h-4" />}
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
                        className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
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

                        {/* Presentations List */}
                        {activeService ? (
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                                {filteredPresentations.length > 0 ? (
                                    filteredPresentations.map((pres) => (
                                        <PresentationListItem
                                            key={pres.id}
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
                                    ))
                                ) : (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                                        <Layers className="w-8 h-8 text-stone-500" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">
                                            {search ? t('no_results', 'No results') : t('no_presentations', 'No presentations')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 py-12 flex flex-col items-center justify-center gap-3 opacity-30">
                                <Layers className="w-8 h-8" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
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
                                    {t('import_presentation', 'Import (.ektp / .pptx)')}
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
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PresentationSelector;
