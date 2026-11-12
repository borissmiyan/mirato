import React from 'react';
import { Music, Film, Image as ImageIcon, Play, Pause, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaItem, MediaType } from '@/core/types';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';
import { useTranslation } from 'react-i18next';

export const THUMB_BG = "bg-stone-900";
export const CARD_BG = "bg-stone-700/40 hover:bg-stone-700/60";
const STRIP_BG = "bg-stone-950/20";

const TAG_DOT_COLORS: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-amber-400',
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

interface MediaItemCardProps {
  item: IMediaItem;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onHover?: (id: string | null) => void;
  onDragStart: (e: React.DragEvent, item: IMediaItem) => void;
  onContextMenu: (e: React.MouseEvent, item: IMediaItem) => void;
  onTogglePlayback: (e: React.MouseEvent, item: IMediaItem) => void;
  onPlaybackEnded: (id: string) => void;
  onDoubleClick?: (item: IMediaItem) => void;
  videoRefs?: React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  onTimeUpdate: (id: string, current: number, duration: number) => void;
  mediaTimes?: { current: number; duration: number };
}

export const MediaItemCard: React.FC<MediaItemCardProps> = React.memo(({
  item,
  isSelected,
  isPlaying,
  onSelect,
  onHover,
  onDragStart,
  onContextMenu,
  onTogglePlayback,
  onPlaybackEnded,
  onDoubleClick,
  videoRefs,
  onTimeUpdate,
  mediaTimes
}) => {
  const { t } = useTranslation();
  const displayUrl = useMediaUrl(item);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      draggable
      onClick={(e) => onSelect(item.id, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(item);
      }}
      onMouseEnter={() => onHover?.(item.id)}
      onMouseLeave={() => onHover?.(null)}
      onDragStart={(e) => onDragStart(e, item)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isSelected) {
          onSelect(item.id, e);
        }
        onContextMenu(e, item);
      }}
      className={cn(
        "group flex flex-col rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all ring-offset-2 ring-offset-stone-900",
        isSelected ? "bg-accent/20 ring-2 ring-accent" : CARD_BG,
        item.isMissing && "ring-2 ring-red-500/80 bg-red-950/30"
      )}
    >
      <div className={cn(
        "flex items-center gap-1.5 px-1.5 py-1 min-w-0 border-b border-white/5",
        item.isMissing && "bg-red-500/10"
      )}>
        <TypeIcon type={item.type} className={cn("w-3 h-3 shrink-0", getTypeAccent(item.type))} />
        {item.colorTag && TAG_DOT_COLORS[item.colorTag] && (
          <div
            className={cn("w-2 h-2 rounded-full shrink-0 shadow-sm border border-black/30", TAG_DOT_COLORS[item.colorTag])}
            title={item.colorTag}
          />
        )}
        <span className={cn(
          "text-[10px] truncate min-w-0 flex-1 font-medium group-hover:text-white transition-colors",
          item.isMissing ? "text-red-400" : "text-stone-300"
        )}>
          {item.name}
        </span>
        {item.isMissing && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
      </div>

      <div className={cn("relative aspect-video overflow-hidden", THUMB_BG)}>
        {item.type === 'image' && displayUrl && !item.isMissing && (
          <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        )}

        {item.type === 'video' && !item.isMissing && (
          <>
            {item.thumbnailUrl ? (
              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
            ) : displayUrl ? (
              <video
                src={`${displayUrl}#t=0.5`}
                preload="metadata"
                muted
                playsInline
                disablePictureInPicture
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-6 h-6 text-sky-500/40" />
              </div>
            )}
            {/* Quick Look hover pill - video plays strictly in Quick Look */}
            <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 z-10 pointer-events-none">
              <div className="px-2 py-1 rounded-xl bg-stone-950/80 backdrop-blur-md flex items-center gap-1.5 text-[10px] text-white font-medium border border-white/10 shadow-lg">
                <Eye className="w-3 h-3 text-accent" />
                <span>{t('media_pool.quick_look', 'Quick Look')}</span>
              </div>
            </div>
            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] font-bold text-stone-300 uppercase tracking-wider pointer-events-none">
              VIDEO
            </div>
          </>
        )}

        {item.type === 'audio' && (
          <div className="w-full h-full flex items-center justify-center">
            <Music className={cn("w-6 h-6", item.isMissing ? "text-red-500/20" : "text-purple-500/30")} />
          </div>
        )}

        {item.isMissing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/40 backdrop-blur-[1px]">
            <AlertCircle className="w-8 h-8 text-red-500/50 mb-1" />
            <span className="text-[9px] uppercase tracking-wider font-bold text-red-500/80">
              {t('file_missing')}
            </span>
          </div>
        )}

        {!item.isMissing && item.type === 'audio' && (
          <>
            <button
              type="button"
              onClick={(e) => onTogglePlayback(e, item)}
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity z-10",
                isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white translate-x-px" />}
              </div>
            </button>

            {mediaTimes && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
                <div 
                  className="h-full transition-all bg-purple-500"
                  style={{ width: `${(mediaTimes.current / mediaTimes.duration) * 100}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {mediaTimes && !item.isMissing && (
        <div className={cn("flex items-center justify-end px-1.5 py-0.5", STRIP_BG)}>
          <span className="text-[9px] text-stone-500 tabular-nums font-medium">
            {formatTime(mediaTimes.current)} / {formatTime(mediaTimes.duration)}
          </span>
        </div>
      )}

      {item.isMissing && (
        <div className={cn("px-1.5 py-0.5 bg-red-500/5 overflow-hidden")}>
          <span className="text-[8px] text-red-500/60 truncate block" title={item.path}>
            {item.path}
          </span>
        </div>
      )}
    </div>
  );
});

export const TypeIcon = ({ type, className }: { type: MediaType; className?: string }) => {
  switch (type) {
    case 'image': return <ImageIcon className={className} />;
    case 'video': return <Film className={className} />;
    case 'audio': return <Music className={className} />;
  }
};

export const getTypeAccent = (type: MediaType) => {
  switch (type) {
    case 'video': return 'text-blue-400';
    case 'audio': return 'text-purple-400';
    case 'image': return 'text-emerald-400';
    default: return 'text-stone-400';
  }
};
