import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Eye, MoreVertical, Play, Pause } from 'lucide-react';
import { IMediaItem, IMediaBin } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { TypeIcon, getTypeAccent } from '../MediaItemCard';
import { TAG_COLORS } from '../MediaPoolContextMenu';

interface MediaPoolTreeViewProps {
  allBins: IMediaBin[];
  mediaItems: IMediaItem[];
  selectedIds: Set<string>;
  playingItemId: string | null;
  draggingOverId: string | null;
  mediaTimes: Record<string, { current: number; duration: number }>;
  onSetDraggingOverId: (id: string | null) => void;
  onBinDrop: (e: React.DragEvent, binId: string | undefined) => void;
  onBinContextMenu: (e: React.MouseEvent, bin: IMediaBin) => void;
  onImportDroppedFiles: (files: FileList | File[], binId?: string | null) => void;
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (item: IMediaItem) => void;
  onDragStart: (e: React.DragEvent, item: IMediaItem) => void;
  onItemContextMenu: (e: React.MouseEvent, item: IMediaItem) => void;
  onTogglePlayback: (e: React.MouseEvent, item: IMediaItem) => void;
}

const TreeFileRow: React.FC<{
  item: IMediaItem;
  level: number;
  isSelected: boolean;
  isPlaying: boolean;
  mediaTime?: { current: number; duration: number };
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTogglePlayback: (e: React.MouseEvent) => void;
}> = React.memo(({
  item,
  level,
  isSelected,
  isPlaying,
  mediaTime,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onTogglePlayback
}) => {
  return (
    <div
      draggable
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: `${level * 16 + 8}px` }}
      className={cn(
        "group flex items-center gap-2 py-1 pr-2 rounded-xl transition-all cursor-pointer select-none text-xs",
        isSelected
          ? "bg-accent/20 text-white font-medium"
          : "hover:bg-white/5 text-stone-300 hover:text-white"
      )}
    >
      <div className="w-4 h-4 shrink-0 flex items-center justify-center relative">
        {item.type === 'audio' ? (
          <button
            type="button"
            onClick={onTogglePlayback}
            className="hover:scale-110 transition-transform"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-accent" /> : <Play className="w-3.5 h-3.5 text-stone-400" />}
          </button>
        ) : (
          <TypeIcon type={item.type} className={cn("w-3.5 h-3.5", getTypeAccent(item.type))} />
        )}
      </div>

      <span className="truncate flex-1 min-w-0">{item.name}</span>

      {item.colorTag && TAG_COLORS[item.colorTag] && (
        <div className={cn("w-2 h-2 rounded-full shrink-0", TAG_COLORS[item.colorTag].bg)} />
      )}

      {mediaTime?.duration && (
        <span className="text-[10px] text-stone-500 font-mono tabular-nums shrink-0">
          {Math.floor(mediaTime.duration / 60)}:{Math.floor(mediaTime.duration % 60).toString().padStart(2, '0')}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white"
          title="Quick Look"
        >
          <Eye className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onContextMenu}
          className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white"
          title="Menu"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});

TreeFileRow.displayName = 'TreeFileRow';

type FlatTreeNode =
  | { kind: 'bin'; bin: IMediaBin; level: number; itemsCount: number }
  | { kind: 'item'; item: IMediaItem; level: number };

export const MediaPoolTreeView: React.FC<MediaPoolTreeViewProps> = React.memo(({
  allBins,
  mediaItems,
  selectedIds,
  playingItemId,
  draggingOverId,
  mediaTimes,
  onSetDraggingOverId,
  onBinDrop,
  onBinContextMenu,
  onImportDroppedFiles,
  onItemClick,
  onDoubleClick,
  onDragStart,
  onItemContextMenu,
  onTogglePlayback
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedBinIds, setExpandedBinIds] = useState<Set<string>>(() => new Set(allBins.map(b => b.id)));

  const toggleBin = useCallback((binId: string) => {
    setExpandedBinIds(prev => {
      const next = new Set(prev);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });
  }, []);

  // Flatten visible tree nodes for O(visible) virtualized rendering
  const flatNodes = useMemo<FlatTreeNode[]>(() => {
    const binsByParent = new Map<string | undefined, IMediaBin[]>();
    for (const bin of allBins) {
      const parent = bin.parentId;
      const arr = binsByParent.get(parent);
      if (arr) arr.push(bin);
      else binsByParent.set(parent, [bin]);
    }

    const itemsByBin = new Map<string | undefined, IMediaItem[]>();
    for (const item of mediaItems) {
      const binId = item.binId;
      const arr = itemsByBin.get(binId);
      if (arr) arr.push(item);
      else itemsByBin.set(binId, [item]);
    }

    const result: FlatTreeNode[] = [];
    const walk = (parentId: string | undefined, level: number) => {
      const childBins = binsByParent.get(parentId) || [];
      for (const bin of childBins) {
        const itemsCount = (itemsByBin.get(bin.id) || []).length;
        result.push({ kind: 'bin', bin, level, itemsCount });
        if (expandedBinIds.has(bin.id)) {
          walk(bin.id, level + 1);
        }
      }
      const directItems = itemsByBin.get(parentId) || [];
      for (const item of directItems) {
        result.push({ kind: 'item', item, level });
      }
    };

    walk(undefined, 0);
    return result;
  }, [allBins, mediaItems, expandedBinIds]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 8,
    initialRect: { width: 320, height: 500 },
  });

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-1 pt-1 pb-4">
      <div
        onDragOver={(e) => { e.preventDefault(); onSetDraggingOverId('__root__'); }}
        onDragLeave={() => onSetDraggingOverId(null)}
        onDrop={(e) => onBinDrop(e, undefined)}
        className={cn(
          "rounded-xl p-1 transition-all",
          draggingOverId === '__root__' && "bg-accent/10 ring-2 ring-accent"
        )}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const node = flatNodes[virtualRow.index];
            if (!node) return null;
            return (
              <div
                key={node.kind === 'bin' ? `bin-${node.bin.id}` : node.item.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '2px',
                }}
              >
                {node.kind === 'bin' ? (
                  <div
                    style={{ paddingLeft: `${node.level * 16 + 4}px` }}
                    onClick={() => toggleBin(node.bin.id)}
                    onDragOver={(e) => { e.preventDefault(); onSetDraggingOverId(node.bin.id); }}
                    onDragLeave={() => onSetDraggingOverId(null)}
                    onDrop={(e) => {
                      if (e.dataTransfer.types.includes('Files')) {
                        e.preventDefault();
                        e.stopPropagation();
                        onSetDraggingOverId(null);
                        onImportDroppedFiles(e.dataTransfer.files, node.bin.id);
                      } else {
                        onBinDrop(e, node.bin.id);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onBinContextMenu(e, node.bin);
                    }}
                    className={cn(
                      "group flex items-center gap-1.5 py-1 pr-2 rounded-xl transition-all cursor-pointer select-none text-xs",
                      draggingOverId === node.bin.id
                        ? "bg-accent/20 text-accent font-semibold ring-1 ring-accent"
                        : "hover:bg-white/5 text-stone-200"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBin(node.bin.id);
                      }}
                      className="p-0.5 text-stone-500 hover:text-white"
                    >
                      {expandedBinIds.has(node.bin.id)
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {expandedBinIds.has(node.bin.id) ? (
                      <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    )}

                    <span className="truncate flex-1 min-w-0 font-medium">{node.bin.name}</span>
                    <span className="text-[10px] text-stone-500 font-mono">{node.itemsCount}</span>
                  </div>
                ) : (
                  <TreeFileRow
                    item={node.item}
                    level={node.level}
                    isSelected={selectedIds.has(node.item.id)}
                    isPlaying={playingItemId === node.item.id}
                    mediaTime={mediaTimes[node.item.id]}
                    onClick={(e) => onItemClick(node.item.id, e)}
                    onDoubleClick={() => onDoubleClick(node.item)}
                    onDragStart={(e) => onDragStart(e, node.item)}
                    onContextMenu={(e) => onItemContextMenu(e, node.item)}
                    onTogglePlayback={(e) => onTogglePlayback(e, node.item)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

MediaPoolTreeView.displayName = 'MediaPoolTreeView';
