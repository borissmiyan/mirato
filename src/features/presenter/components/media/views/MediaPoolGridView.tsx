import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Search } from 'lucide-react';
import { IMediaItem, IMediaBin } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { MediaItemCard, CARD_BG, THUMB_BG } from '../MediaItemCard';

interface MediaPoolGridViewProps {
  bins: IMediaBin[];
  visibleItems: IMediaItem[];
  activeBinId: string | null;
  searchQuery: string;
  selectedIds: Set<string>;
  playingItemId: string | null;
  draggingOverId: string | null;
  mediaTimes: Record<string, { current: number; duration: number }>;
  onSelectBin: (id: string) => void;
  onSetDraggingOverId: (id: string | null) => void;
  onBinDrop: (e: React.DragEvent, binId: string | undefined) => void;
  onBinContextMenu: (e: React.MouseEvent, bin: IMediaBin) => void;
  onImportDroppedFiles: (files: FileList | File[], binId?: string | null) => void;
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (item: IMediaItem) => void;
  onHoverItem: (id: string | null) => void;
  onDragStart: (e: React.DragEvent, item: IMediaItem) => void;
  onItemContextMenu: (e: React.MouseEvent, item: IMediaItem) => void;
  onTogglePlayback: (e: React.MouseEvent, item: IMediaItem) => void;
  onPlaybackEnded: (id: string) => void;
  onTimeUpdate: (id: string, current: number, duration: number) => void;
  onClearSearch: () => void;
  onImportMedia: () => void;
}

type GridEntry =
  | { kind: 'bin'; bin: IMediaBin }
  | { kind: 'item'; item: IMediaItem };

export const MediaPoolGridView: React.FC<MediaPoolGridViewProps> = React.memo(({
  bins,
  visibleItems,
  activeBinId,
  searchQuery,
  selectedIds,
  playingItemId,
  draggingOverId,
  mediaTimes,
  onSelectBin,
  onSetDraggingOverId,
  onBinDrop,
  onBinContextMenu,
  onImportDroppedFiles,
  onItemClick,
  onDoubleClick,
  onHoverItem,
  onDragStart,
  onItemContextMenu,
  onTogglePlayback,
  onPlaybackEnded,
  onTimeUpdate,
  onClearSearch,
  onImportMedia
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [colCount, setColCount] = useState(2);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateCols = (width: number) => {
      const next = width >= 400 ? 3 : width >= 240 ? 2 : 1;
      setColCount(prev => (prev === next ? prev : next));
    };

    updateCols(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateCols(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo<GridEntry[][]>(() => {
    const entries: GridEntry[] = [];
    if (!activeBinId && !searchQuery.trim()) {
      for (const bin of bins) {
        entries.push({ kind: 'bin', bin });
      }
    }
    for (const item of visibleItems) {
      entries.push({ kind: 'item', item });
    }

    const chunked: GridEntry[][] = [];
    for (let i = 0; i < entries.length; i += colCount) {
      chunked.push(entries.slice(i, i + colCount));
    }
    return chunked;
  }, [bins, visibleItems, activeBinId, searchQuery, colCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 112,
    overscan: 4,
    initialRect: { width: 320, height: 500 },
  });

  const gridColsClass = colCount === 3 ? 'grid-cols-3' : colCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div ref={scrollRef} className="@container flex-1 overflow-y-auto no-scrollbar min-h-0 px-1 pt-1 pb-4">
      {rows.length > 0 ? (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowEntries = rows[virtualRow.index];
            if (!rowEntries) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '6px',
                }}
              >
                <div className={cn('grid gap-1.5', gridColsClass)}>
                  {rowEntries.map((entry) => {
                    if (entry.kind === 'bin') {
                      const bin = entry.bin;
                      const isDraggingOver = draggingOverId === bin.id;
                      return (
                        <div
                          key={bin.id}
                          onClick={() => onSelectBin(bin.id)}
                          onDragOver={(e) => { e.preventDefault(); onSetDraggingOverId(bin.id); }}
                          onDragLeave={() => onSetDraggingOverId(null)}
                          onDrop={(e) => {
                            if (e.dataTransfer.types.includes('Files')) {
                              e.preventDefault();
                              e.stopPropagation();
                              onSetDraggingOverId(null);
                              onImportDroppedFiles(e.dataTransfer.files, bin.id);
                            } else {
                              onBinDrop(e, bin.id);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            onBinContextMenu(e, bin);
                          }}
                          className={cn(
                            "group flex flex-col rounded-xl overflow-hidden transition-all cursor-pointer",
                            isDraggingOver ? "bg-accent/10 ring-1 ring-accent" : CARD_BG
                          )}
                        >
                          <div className="flex items-center gap-1.5 px-1.5 py-1 min-w-0 border-b border-white/5">
                            <FolderOpen className="w-3 h-3 shrink-0 text-amber-500/60" />
                            <span className="text-[10px] text-stone-300 truncate min-w-0 flex-1 font-medium group-hover:text-white">
                              {bin.name}
                            </span>
                          </div>
                          <div className={cn("aspect-video flex flex-col items-center justify-center gap-1", THUMB_BG)}>
                            <FolderOpen className="w-6 h-6 text-amber-500/50" />
                          </div>
                        </div>
                      );
                    }

                    const item = entry.item;
                    return (
                      <MediaItemCard
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        isPlaying={playingItemId === item.id}
                        onSelect={onItemClick}
                        onDoubleClick={onDoubleClick}
                        onHover={onHoverItem}
                        onDragStart={onDragStart}
                        onContextMenu={onItemContextMenu}
                        onTogglePlayback={onTogglePlayback}
                        onPlaybackEnded={onPlaybackEnded}
                        onTimeUpdate={onTimeUpdate}
                        mediaTimes={mediaTimes[item.id]}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Empty state: search with 0 results */}
          {visibleItems.length === 0 && searchQuery.trim() && (
            <div className="py-8">
              <EmptyState
                size="sm"
                icon={<Search className="w-5 h-5 text-stone-500" />}
                title={t('media_pool.no_results', 'No media found')}
                description={t('media_pool.no_results_desc', 'Try adjusting your search query or filter')}
                action={
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="text-xs text-accent hover:underline mt-1 cursor-pointer font-medium"
                  >
                    {t('media_pool.clear_search', 'Clear Search')}
                  </button>
                }
              />
            </div>
          )}

          {/* Empty state: active bin with 0 items */}
          {visibleItems.length === 0 && !searchQuery.trim() && activeBinId && (
            <div className="py-8">
              <EmptyState
                size="sm"
                icon={<FolderOpen className="w-5 h-5 text-stone-500" />}
                title={t('media_pool.bin_empty', 'This bin is empty')}
                description={t('media_pool.empty_hint', 'Drag and drop files here or click Import')}
                action={
                  <button
                    type="button"
                    onClick={onImportMedia}
                    className="text-xs text-accent hover:underline mt-1 cursor-pointer font-medium"
                  >
                    {t('media_pool.import', 'Import')}
                  </button>
                }
              />
            </div>
          )}

          {/* Empty state: root with 0 bins and 0 items */}
          {visibleItems.length === 0 && !searchQuery.trim() && !activeBinId && bins.length === 0 && (
            <div className="py-8">
              <EmptyState
                size="sm"
                icon={<FolderOpen className="w-5 h-5 text-stone-500" />}
                title={t('media_pool.pool_empty', 'Media pool is empty')}
                description={t('media_pool.empty_hint', 'Drag and drop files here or click Import')}
                action={
                  <button
                    type="button"
                    onClick={onImportMedia}
                    className="text-xs text-accent hover:underline mt-1 cursor-pointer font-medium"
                  >
                    {t('media_pool.import', 'Import')}
                  </button>
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});

MediaPoolGridView.displayName = 'MediaPoolGridView';
