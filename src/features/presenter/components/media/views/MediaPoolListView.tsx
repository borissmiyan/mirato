import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Search, Play, Pause, AlertCircle, Eye, MoreVertical } from 'lucide-react';
import { IMediaItem, IMediaBin } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { TypeIcon, getTypeAccent } from '../MediaItemCard';
import { TAG_COLORS } from '../MediaPoolContextMenu';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';

interface MediaPoolListViewProps {
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
  onClearSearch: () => void;
  onImportMedia: () => void;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || !isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit'
  });
};

const MediaListRow: React.FC<{
  item: IMediaItem;
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
  isSelected,
  isPlaying,
  mediaTime,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onTogglePlayback
}) => {
  const displayUrl = useMediaUrl(item.type === 'image' ? item : null);

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
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-xs",
        isSelected
          ? "bg-accent/15 border-accent/30 text-white"
          : "bg-stone-900/40 hover:bg-stone-800/60 border-white/5 hover:border-white/10 text-stone-300",
        item.isMissing && "border-red-500/30 bg-red-950/20"
      )}
    >
      {/* Thumbnail or Type Icon */}
      <div className="w-8 h-8 rounded-xl overflow-hidden bg-stone-950 shrink-0 flex items-center justify-center border border-white/5 relative">
        {item.type === 'image' && displayUrl && !item.isMissing ? (
          <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        ) : item.type === 'video' && item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <TypeIcon type={item.type} className={cn("w-4 h-4", getTypeAccent(item.type))} />
        )}

        {item.type === 'audio' && !item.isMissing && (
          <button
            type="button"
            onClick={onTogglePlayback}
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity",
              isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {isPlaying ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 text-white translate-x-px" />}
          </button>
        )}
      </div>

      {/* Name and path */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("font-medium truncate", isSelected ? "text-accent" : "text-stone-200")}>
            {item.name}
          </span>
          {item.isMissing && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-red-500/20 text-red-400 font-bold uppercase shrink-0">
              Missing
            </span>
          )}
        </div>
        <span className="text-[10px] text-stone-500 truncate block">
          {item.path || item.id}
        </span>
      </div>

      {/* Tag Dot */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        {item.colorTag && TAG_COLORS[item.colorTag] && (
          <div
            className={cn("w-2 h-2 rounded-full", TAG_COLORS[item.colorTag].bg)}
            title={TAG_COLORS[item.colorTag].name}
          />
        )}
      </div>

      {/* Type badge */}
      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-mono shrink-0 w-12 text-center">
        {item.type}
      </span>

      {/* Duration */}
      <span className="text-[10px] text-stone-400 font-mono tabular-nums shrink-0 w-12 text-right">
        {formatDuration(mediaTime?.duration ?? item.duration)}
      </span>

      {/* Date */}
      <span className="text-[10px] text-stone-500 font-mono shrink-0 w-16 text-right">
        {formatDate(item.createdAt)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          className="p-1 rounded-xl hover:bg-white/10 text-stone-400 hover:text-white"
          title="Quick Look"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onContextMenu}
          className="p-1 rounded-xl hover:bg-white/10 text-stone-400 hover:text-white"
          title="Menu"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

export const MediaPoolListView: React.FC<MediaPoolListViewProps> = ({
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
  onClearSearch,
  onImportMedia
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar min-h-0 px-1 pt-1 pb-4">
      {/* Table Header */}
      <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-white/5 select-none shrink-0 mb-1">
        <span className="w-8 shrink-0">#</span>
        <span className="flex-1 min-w-0">{t('media_pool.name', 'Name')}</span>
        <span className="w-4 shrink-0 text-center">•</span>
        <span className="w-12 shrink-0 text-center">{t('media_pool.type', 'Type')}</span>
        <span className="w-12 shrink-0 text-right">{t('media_pool.duration', 'Time')}</span>
        <span className="w-16 shrink-0 text-right">{t('media_pool.date', 'Date')}</span>
        <span className="w-10 shrink-0 text-right" />
      </div>

      <div className="flex flex-col gap-1">
        {/* Bins as list rows */}
        {!activeBinId && !searchQuery.trim() && bins.map(bin => {
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
                "group flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-xs",
                isDraggingOver ? "bg-accent/15 border-accent text-accent" : "bg-stone-900/40 hover:bg-stone-800/60 border-white/5 text-stone-300"
              )}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 shrink-0 flex items-center justify-center border border-amber-500/20">
                <FolderOpen className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-stone-200 group-hover:text-white truncate block">
                  {bin.name}
                </span>
                <span className="text-[10px] text-stone-500">{t('media_pool.folder', 'Folder')}</span>
              </div>
              <span className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">BIN</span>
            </div>
          );
        })}

        {/* Media Items */}
        {visibleItems.map(item => (
          <MediaListRow
            key={item.id}
            item={item}
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

        {/* Empty States */}
        {visibleItems.length === 0 && searchQuery.trim() && (
          <div className="py-8">
            <EmptyState
              size="sm"
              icon={<Search className="w-5 h-5 text-stone-500" />}
              title={t('media_pool.no_results', 'No media found')}
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

        {visibleItems.length === 0 && !searchQuery.trim() && activeBinId && (
          <div className="py-8">
            <EmptyState
              size="sm"
              icon={<FolderOpen className="w-5 h-5 text-stone-500" />}
              title={t('media_pool.bin_empty', 'This bin is empty')}
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

        {visibleItems.length === 0 && !searchQuery.trim() && !activeBinId && bins.length === 0 && (
          <div className="py-8">
            <EmptyState
              size="sm"
              icon={<FolderOpen className="w-5 h-5 text-stone-500" />}
              title={t('media_pool.pool_empty', 'Media pool is empty')}
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
      </div>
    </div>
  );
};
