import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Eye, MoreVertical, Play, Pause } from 'lucide-react';
import { IMediaItem, IMediaBin } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { TypeIcon, getTypeAccent } from '../MediaItemCard';
import { TAG_COLORS } from '../MediaPoolContextMenu';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';

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
  const displayUrl = useMediaUrl(item);

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

export const MediaPoolTreeView: React.FC<MediaPoolTreeViewProps> = ({
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
  const { t } = useTranslation();
  const [expandedBinIds, setExpandedBinIds] = useState<Set<string>>(() => new Set(allBins.map(b => b.id)));

  const toggleBin = useCallback((binId: string) => {
    setExpandedBinIds(prev => {
      const next = new Set(prev);
      if (next.has(binId)) next.delete(binId);
      else next.add(binId);
      return next;
    });
  }, []);

  // Organize bins into tree: Map parentId -> bins
  const binsByParent = useMemo(() => {
    const map = new Map<string | undefined, IMediaBin[]>();
    allBins.forEach(bin => {
      const parent = bin.parentId;
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent)!.push(bin);
    });
    return map;
  }, [allBins]);

  // Map binId -> items
  const itemsByBin = useMemo(() => {
    const map = new Map<string | undefined, IMediaItem[]>();
    mediaItems.forEach(item => {
      const binId = item.binId;
      if (!map.has(binId)) map.set(binId, []);
      map.get(binId)!.push(item);
    });
    return map;
  }, [mediaItems]);

  const renderBinTree = (parentId: string | undefined, level: number = 0): React.ReactNode => {
    const childBins = binsByParent.get(parentId) || [];
    const directItems = itemsByBin.get(parentId) || [];

    return (
      <div className="flex flex-col gap-0.5">
        {/* Render folders at this level */}
        {childBins.map(bin => {
          const isExpanded = expandedBinIds.has(bin.id);
          const isDraggingOver = draggingOverId === bin.id;
          const binItemsCount = (itemsByBin.get(bin.id) || []).length;

          return (
            <div key={bin.id} className="flex flex-col">
              <div
                style={{ paddingLeft: `${level * 16 + 4}px` }}
                onClick={() => toggleBin(bin.id)}
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
                  "group flex items-center gap-1.5 py-1 pr-2 rounded-xl transition-all cursor-pointer select-none text-xs",
                  isDraggingOver
                    ? "bg-accent/20 text-accent font-semibold ring-1 ring-accent"
                    : "hover:bg-white/5 text-stone-200"
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBin(bin.id);
                  }}
                  className="p-0.5 text-stone-500 hover:text-white"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                )}

                <span className="truncate flex-1 min-w-0 font-medium">{bin.name}</span>
                <span className="text-[10px] text-stone-500 font-mono">{binItemsCount}</span>
              </div>

              {/* Render items inside this bin if expanded */}
              {isExpanded && (
                <div className="flex flex-col">
                  {renderBinTree(bin.id, level + 1)}
                </div>
              )}
            </div>
          );
        })}

        {/* Render files at this level */}
        {directItems.map(item => (
          <TreeFileRow
            key={item.id}
            item={item}
            level={level}
            isSelected={selectedIds.has(item.id)}
            isPlaying={playingItemId === item.id}
            mediaTime={mediaTimes[item.id]}
            onClick={(e) => onItemClick(item.id, e)}
            onDoubleClick={() => onDoubleClick(item)}
            onDragStart={(e) => onDragStart(e, item)}
            onContextMenu={(e) => onItemContextMenu(e, item)}
            onTogglePlayback={(e) => onTogglePlayback(e, item)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-1 pt-1 pb-4">
      {/* Root Drop Zone Indicator if dragging over root */}
      <div
        onDragOver={(e) => { e.preventDefault(); onSetDraggingOverId('__root__'); }}
        onDragLeave={() => onSetDraggingOverId(null)}
        onDrop={(e) => onBinDrop(e, undefined)}
        className={cn(
          "rounded-xl p-1 transition-all",
          draggingOverId === '__root__' && "bg-accent/10 ring-2 ring-accent"
        )}
      >
        {renderBinTree(undefined, 0)}
      </div>
    </div>
  );
};
