import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { db } from '@/core/db';
import { IMediaItem, IMediaBin, MediaType, MediaColorTag } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';

// Hooks
import { useMediaPoolData, MediaSortOrder } from '../../hooks/useMediaPoolData';
import { useMediaSelection } from '../../hooks/useMediaSelection';
import { useMediaImport } from '../../hooks/useMediaImport';

// Components
import { MediaPoolToolbar } from './MediaPoolToolbar';
import { MediaPoolBreadcrumb } from './MediaPoolBreadcrumb';
import { MediaPoolContextMenu, ContextMenuState } from './MediaPoolContextMenu';
import { MediaQuickLookModal } from './MediaQuickLookModal';
import { MediaPoolInfoModal } from './MediaPoolInfoModal';
import { MediaPoolGridView, MediaPoolListView, MediaPoolTreeView, MediaViewMode } from './views';

/**
 * Main Media Pool Panel component.
 * Orchestrates media browsing, importing, organization, and playback.
 * Supports Grid, List, and Tree List view modes with Apple HIG design standards.
 */
export const MediaPoolPanel: React.FC = () => {
    const { t } = useTranslation();
    const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));
    
    // View mode with localStorage persistence
    const [viewMode, setViewModeState] = useState<MediaViewMode>(() => {
        try {
            return (localStorage.getItem('ekk_media_view_mode') as MediaViewMode) || 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleSetViewMode = useCallback((mode: MediaViewMode) => {
        setViewModeState(mode);
        try {
            localStorage.setItem('ekk_media_view_mode', mode);
        } catch {
            // ignore localStorage errors in sandboxed contexts
        }
    }, []);

    // Filter and search state
    const [filter, setFilter] = useState<MediaType | 'all'>('all');
    const [tagFilter, setTagFilter] = useState<MediaColorTag | 'all'>('all');
    // audit-ignore: local modal state isolated to this component
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [activeBinId, setActiveBinId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const [draggingOverId, setDraggingOverId] = useState<string | null>(null);
    const [isMouseOverPool, setIsMouseOverPool] = useState(false);
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const [quickLookItem, setQuickLookItem] = useState<IMediaItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<MediaSortOrder>('date-desc');
    
    // Audio scrubbing ref (video playback is strictly in Quick Look)
    const scrubAudioRef = useRef<HTMLAudioElement | null>(null);

    // ─── Data & Selection Hooks ───
    const { 
        bins, 
        allBins,
        binPath,
        mediaItems, 
        visibleItems, 
        activeBin, 
        mediaTimes, 
        setMediaTimes 
    } = useMediaPoolData(filter, activeBinId, searchQuery, sortBy, tagFilter);

    const { 
        selectedIds, 
        setSelectedIds,
        handleItemClick, 
        handleBulkDelete 
    } = useMediaSelection(visibleItems, isMouseOverPool);

    const {
        isOsDraggingOver,
        setIsOsDraggingOver,
        handleImportMedia,
        importDroppedFiles,
        handlePanelDragOver,
        handlePanelDragLeave,
        handlePanelDrop
    } = useMediaImport(activeBinId);

    // Stop audio playback on bin change or unmount
    useEffect(() => {
        setPlayingItemId(null);
        scrubAudioRef.current?.pause();
    }, [activeBinId]);

    useEffect(() => {
        const audioEl = scrubAudioRef.current;
        return () => {
            audioEl?.pause();
        };
    }, []);

    // Quick Look navigation between items in current folder
    const handleQuickLookNavigate = useCallback((direction: 'prev' | 'next') => {
        if (!quickLookItem || visibleItems.length === 0) return;
        const currentIndex = visibleItems.findIndex(i => i.id === quickLookItem.id);
        if (currentIndex === -1) return;

        let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = visibleItems.length - 1;
        if (nextIndex >= visibleItems.length) nextIndex = 0;

        setQuickLookItem(visibleItems[nextIndex]);
    }, [quickLookItem, visibleItems]);

    // Keyboard shortcuts: Cmd+A, Enter to Quick Look, Shift+Space for Quick Look toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Shift + Space: Toggle or close Quick Look
            if (quickLookItem && e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
                e.preventDefault();
                e.stopPropagation();
                setQuickLookItem(null);
                return;
            }

            if (!isMouseOverPool) return;

            // Cmd+A / Ctrl+A: Select all items
            if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                setSelectedIds(new Set(visibleItems.map(i => i.id)));
                return;
            }

            // Enter key on selected item to open Quick Look
            if (e.key === 'Enter') {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                if (selectedIds.size > 0 && !quickLookItem) {
                    const firstSelectedId = Array.from(selectedIds)[0];
                    const target = visibleItems.find(i => i.id === firstSelectedId);
                    if (target) {
                        e.preventDefault();
                        setQuickLookItem(target);
                    }
                }
                return;
            }

            // Shift + Space: Open Quick Look on focused/hovered/first item
            if (e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
                e.preventDefault();
                e.stopPropagation();

                let targetItem: IMediaItem | undefined;
                if (hoveredItemId) {
                    targetItem = visibleItems.find(i => i.id === hoveredItemId);
                }
                if (!targetItem && selectedIds.size > 0) {
                    const firstSelectedId = Array.from(selectedIds)[0];
                    targetItem = visibleItems.find(i => i.id === firstSelectedId);
                }
                if (!targetItem && visibleItems.length > 0) {
                    targetItem = visibleItems[0];
                }

                if (targetItem) {
                    setQuickLookItem(targetItem);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isMouseOverPool, quickLookItem, hoveredItemId, selectedIds, visibleItems, setSelectedIds]);

    const handleCreateBin = useCallback(() => {
        openModal(ModalType.PROMPT, {
            title: t('media_pool.new_bin', 'New Bin Name'),
            onSelection: async (name: string | null) => {
                if (!name?.trim()) return;
                await db.mediaBins.add({
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    parentId: activeBinId || undefined,
                    createdAt: Date.now()
                });
            }
        });
    }, [openModal, t, activeBinId]);

    const handleDragStart = useCallback((e: React.DragEvent, item: IMediaItem) => {
        const isMulti = selectedIds.has(item.id) && selectedIds.size > 1;
        const itemsToDrag = isMulti
            ? visibleItems.filter(i => selectedIds.has(i.id))
            : [item];

        e.dataTransfer.setData('application/json', JSON.stringify({
            source: 'media-pool',
            media: item,
            items: itemsToDrag
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, [selectedIds, visibleItems]);

    // Audio preview toggle (videos are strictly previewed in Quick Look)
    const togglePlayback = useCallback((e: React.MouseEvent, item: IMediaItem) => {
        e.stopPropagation();
        if (item.type !== 'audio') return;

        if (playingItemId === item.id) {
            setPlayingItemId(null);
            scrubAudioRef.current?.pause();
        } else {
            if (playingItemId) {
                scrubAudioRef.current?.pause();
            }

            setPlayingItemId(item.id);
            const url = getLocalResourceUrl(item.path);
            if (url && scrubAudioRef.current) {
                if (scrubAudioRef.current.src !== url) {
                    scrubAudioRef.current.src = url;
                    scrubAudioRef.current.load();
                }
                scrubAudioRef.current.play().catch(() => {});
            }
        }
    }, [playingItemId]);

    const handleTimeUpdate = useCallback((itemId: string, current: number, duration: number) => {
        setMediaTimes(prev => {
            const existing = prev[itemId];
            if (existing && Math.floor(existing.current) === Math.floor(current) && existing.duration === duration) {
                return prev;
            }
            return {
                ...prev,
                [itemId]: { current, duration }
            };
        });
    }, [setMediaTimes]);

    const handlePlaybackEnded = useCallback((_itemId?: string) => {
        setPlayingItemId(null);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, item: IMediaItem) => {
        setContextMenu({ x: e.clientX, y: e.clientY, kind: 'item', item });
    }, []);

    const handleBinContextMenu = useCallback((e: React.MouseEvent, bin: IMediaBin) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, kind: 'bin', bin });
    }, []);

    const handleClearSearch = useCallback(() => setSearchQuery(''), []);

    const handleBinDrop = useCallback(async (e: React.DragEvent, binId: string | undefined) => {
        e.preventDefault();
        setDraggingOverId(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.source === 'media-pool') {
                if (data.items && Array.isArray(data.items)) {
                    await Promise.all(data.items.map((i: IMediaItem) => db.mediaPool.update(i.id, { binId })));
                } else if (data.media?.id) {
                    await db.mediaPool.update(data.media.id, { binId });
                }
            }
        } catch (err) {
            console.warn('Drop failed:', err);
        }
    }, []);

    return (
        <div 
            className="relative flex flex-col h-full overflow-hidden"
            onMouseEnter={() => setIsMouseOverPool(true)}
            onMouseLeave={() => {
                setIsMouseOverPool(false);
                setHoveredItemId(null);
            }}
            onDragOver={handlePanelDragOver}
            onDragLeave={handlePanelDragLeave}
            onDrop={handlePanelDrop}
        >
            <MediaPoolToolbar
                filter={filter}
                setFilter={setFilter}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                handleImportMedia={handleImportMedia}
                handleCreateBin={handleCreateBin}
                onOpenInfo={() => setIsInfoModalOpen(true)}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                viewMode={viewMode}
                onSetViewMode={handleSetViewMode}
                fileCount={mediaItems.length}
                binCount={allBins.length}
            />

            {viewMode !== 'tree' && (
                <MediaPoolBreadcrumb
                    activeBinId={activeBinId}
                    activeBin={activeBin}
                    binPath={binPath}
                    draggingOverId={draggingOverId}
                    setActiveBinId={setActiveBinId}
                    setDraggingOverId={setDraggingOverId}
                    handleBinDrop={handleBinDrop}
                />
            )}

            {/* Drag & Drop Overlay from OS */}
            {isOsDraggingOver && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-950/85 backdrop-blur-md border-2 border-dashed border-accent/60 rounded-xl m-1 pointer-events-none animate-in fade-in duration-150">
                    <Upload className="w-10 h-10 text-accent animate-bounce mb-2" />
                    <p className="text-xs font-bold text-white tracking-wide">
                        {t('media_pool.drop_files', 'Drop files to import into media pool')}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                        {t('media_pool.supported_formats', 'Images, Videos, Audio')}
                    </p>
                </div>
            )}

            {/* View Modes */}
            {viewMode === 'grid' && (
                <MediaPoolGridView
                    bins={bins}
                    visibleItems={visibleItems}
                    selectedIds={selectedIds}
                    activeBinId={activeBinId}
                    searchQuery={searchQuery}
                    draggingOverId={draggingOverId}
                    playingItemId={playingItemId}
                    mediaTimes={mediaTimes}
                    onSelectBin={setActiveBinId}
                    onSetDraggingOverId={setDraggingOverId}
                    onBinDrop={handleBinDrop}
                    onBinContextMenu={handleBinContextMenu}
                    onImportDroppedFiles={importDroppedFiles}
                    onItemClick={handleItemClick}
                    onDoubleClick={(item) => setQuickLookItem(item)}
                    onHoverItem={setHoveredItemId}
                    onDragStart={handleDragStart}
                    onItemContextMenu={handleContextMenu}
                    onTogglePlayback={togglePlayback}
                    onPlaybackEnded={handlePlaybackEnded}
                    onTimeUpdate={handleTimeUpdate}
                    onClearSearch={handleClearSearch}
                    onImportMedia={handleImportMedia}
                />
            )}

            {viewMode === 'list' && (
                <MediaPoolListView
                    bins={bins}
                    visibleItems={visibleItems}
                    selectedIds={selectedIds}
                    activeBinId={activeBinId}
                    searchQuery={searchQuery}
                    draggingOverId={draggingOverId}
                    playingItemId={playingItemId}
                    mediaTimes={mediaTimes}
                    onSelectBin={setActiveBinId}
                    onSetDraggingOverId={setDraggingOverId}
                    onBinDrop={handleBinDrop}
                    onBinContextMenu={handleBinContextMenu}
                    onImportDroppedFiles={importDroppedFiles}
                    onItemClick={handleItemClick}
                    onDoubleClick={(item) => setQuickLookItem(item)}
                    onHoverItem={setHoveredItemId}
                    onDragStart={handleDragStart}
                    onItemContextMenu={handleContextMenu}
                    onTogglePlayback={togglePlayback}
                    onClearSearch={handleClearSearch}
                    onImportMedia={handleImportMedia}
                />
            )}

            {viewMode === 'tree' && (
                <MediaPoolTreeView
                    allBins={allBins}
                    mediaItems={mediaItems}
                    selectedIds={selectedIds}
                    playingItemId={playingItemId}
                    draggingOverId={draggingOverId}
                    mediaTimes={mediaTimes}
                    onSetDraggingOverId={setDraggingOverId}
                    onBinDrop={handleBinDrop}
                    onBinContextMenu={handleBinContextMenu}
                    onImportDroppedFiles={importDroppedFiles}
                    onItemClick={handleItemClick}
                    onDoubleClick={(item) => setQuickLookItem(item)}
                    onDragStart={handleDragStart}
                    onItemContextMenu={handleContextMenu}
                    onTogglePlayback={togglePlayback}
                />
            )}

            <MediaPoolContextMenu
                contextMenu={contextMenu}
                onClose={() => setContextMenu(null)}
                selectedIds={selectedIds}
                handleBulkDelete={handleBulkDelete}
                activeBinId={activeBinId}
                setActiveBinId={setActiveBinId}
                bins={allBins}
                mediaItems={mediaItems}
                onClearSelection={() => setSelectedIds(new Set())}
                onQuickLook={(item) => setQuickLookItem(item)}
            />

            <audio
                ref={scrubAudioRef}
                onTimeUpdate={(e) => {
                    if (playingItemId) {
                        handleTimeUpdate(playingItemId, e.currentTarget.currentTime, e.currentTarget.duration);
                    }
                }}
                onEnded={() => setPlayingItemId(null)}
            />

            <MediaQuickLookModal
                item={quickLookItem}
                isOpen={!!quickLookItem}
                onClose={() => setQuickLookItem(null)}
                onNavigate={handleQuickLookNavigate}
                currentIndex={quickLookItem ? visibleItems.findIndex(i => i.id === quickLookItem.id) : undefined}
                totalCount={visibleItems.length}
            />

            <MediaPoolInfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                mediaItems={mediaItems}
                bins={allBins}
            />
        </div>
    );
};
