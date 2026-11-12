import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { IMediaItem } from '@/core/types';
import { useMediaUrl } from '@/core/hooks/useMediaUrl';
import { useSetAtom } from 'jotai';
import { isQuickLookOpenAtom } from '@/core/store/uiAtoms';
import { cn } from '@/core/utils/cn';
import { Slider } from '@/shared/ui/Slider';
import { TypeIcon, getTypeAccent } from './MediaItemCard';

interface MediaQuickLookModalProps {
  item: IMediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  currentIndex?: number;
  totalCount?: number;
}

/**
 * Formats seconds into MM:SS format.
 */
const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * High-performance Quick Look modal for inspecting media items (Shift + Space).
 * Fully isolated from global presentation/Live hotkeys.
 */
export const MediaQuickLookModal: React.FC<MediaQuickLookModalProps> = ({
  item,
  isOpen,
  onClose,
  onNavigate,
  currentIndex,
  totalCount
}) => {
  const { t } = useTranslation();
  const setIsQuickLookOpen = useSetAtom(isQuickLookOpenAtom);

  // Cache item for smooth exit animations when parent unsets item
  const cachedItemRef = useRef<IMediaItem | null>(item);
  if (item) {
    cachedItemRef.current = item;
  }
  const displayItem = item || cachedItemRef.current;
  const displayUrl = useMediaUrl(displayItem);

  // Animated enter / exit state
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [slideDirection, setSlideDirection] = useState<'prev' | 'next' | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Media element refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync quicklook open state with Jotai atom to protect Live broadcast
  useEffect(() => {
    setIsQuickLookOpen(isOpen);
    return () => {
      setIsQuickLookOpen(false);
    };
  }, [isOpen, setIsQuickLookOpen]);

  // Handle smooth enter and exit animation lifecycle
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when switching items
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setDimensions(null);
  }, [displayItem?.id]);

  // Toggle playback for audio/video
  const togglePlay = useCallback(() => {
    if (displayItem?.type === 'video' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else if (displayItem?.type === 'audio' && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [displayItem?.type]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Scrubber change
  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  // Navigating between files with directional slide animation
  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    setSlideDirection(direction);
    onNavigate(direction);
  }, [onNavigate]);

  // Keyboard navigation & controls inside Quick Look
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Shift+Space closes Quick Look
      if (e.key === 'Escape' || (e.shiftKey && (e.key === ' ' || e.code === 'Space'))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      // Left / Right arrows navigate between media items
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleNavigate('prev');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleNavigate('next');
        return;
      }

      // Spacebar toggles playback of media inside Quick Look
      if (e.key === ' ' || e.code === 'Space') {
        if (displayItem?.type === 'video' || displayItem?.type === 'audio') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          togglePlay();
        }
      }
    };

    // Capture phase listener to swallow events before global handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, handleNavigate, displayItem?.type, togglePlay]);

  if (!isRendered || !displayItem) return null;

  const fileExt = displayItem.name.split('.').pop()?.toUpperCase() || displayItem.type.toUpperCase();

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-stone-950/80 backdrop-blur-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-stone-900/95 border border-white/10 rounded-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-stone-950/40 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <TypeIcon type={displayItem.type} className={cn("w-4 h-4 shrink-0", getTypeAccent(displayItem.type))} />
            <span className="text-xs font-semibold text-stone-200 truncate" title={displayItem.name}>
              {displayItem.name}
            </span>
            {displayItem.isMissing && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-800/40">
                <AlertCircle className="w-3 h-3" />
                {t('file_missing', 'Missing')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {typeof currentIndex === 'number' && typeof totalCount === 'number' && (
              <span className="text-xs font-medium text-stone-400 tabular-nums">
                {currentIndex + 1} / {totalCount}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors apple-press cursor-pointer"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewport with directional slide animation */}
        <div
          key={displayItem.id}
          className={cn(
            "relative flex-1 flex items-center justify-center min-h-[320px] max-h-[65vh] bg-black/40 overflow-hidden select-none w-full",
            slideDirection === 'next'
              ? "animate-in fade-in slide-in-from-right-4 duration-200"
              : slideDirection === 'prev'
              ? "animate-in fade-in slide-in-from-left-4 duration-200"
              : "animate-in fade-in duration-200"
          )}
        >
          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={() => handleNavigate('prev')}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white/80 hover:text-white transition-all backdrop-blur-md flex items-center justify-center apple-press cursor-pointer border border-white/10 shadow-lg"
            title="Previous (←)"
            aria-label="Previous file"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNavigate('next')}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white/80 hover:text-white transition-all backdrop-blur-md flex items-center justify-center apple-press cursor-pointer border border-white/10 shadow-lg"
            title="Next (→)"
            aria-label="Next file"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Missing Item State */}
          {displayItem.isMissing ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-red-400">
              <AlertCircle className="w-12 h-12 mb-2 text-red-500/80" />
              <p className="text-sm font-semibold">{t('file_not_found', 'File not found on disk')}</p>
              <p className="text-xs text-stone-500 mt-1 max-w-md truncate">{displayItem.path}</p>
            </div>
          ) : (
            <>
              {/* Image Preview */}
              {displayItem.type === 'image' && displayUrl && (
                <img
                  src={displayUrl}
                  alt={displayItem.name}
                  onLoad={(e) => {
                    setDimensions({
                      width: e.currentTarget.naturalWidth,
                      height: e.currentTarget.naturalHeight
                    });
                  }}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              )}

              {/* Video Preview */}
              {displayItem.type === 'video' && displayUrl && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={displayUrl}
                    playsInline
                    onLoadedMetadata={(e) => {
                      setDuration(e.currentTarget.duration);
                      setDimensions({
                        width: e.currentTarget.videoWidth,
                        height: e.currentTarget.videoHeight
                      });
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {/* Audio Preview */}
              {displayItem.type === 'audio' && displayUrl && (
                <div className="flex flex-col items-center justify-center gap-4 p-8 w-full max-w-md">
                  <div className="w-24 h-24 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                    <TypeIcon type="audio" className="w-12 h-12" />
                  </div>
                  <div className="flex items-center gap-1.5 h-8">
                    {[40, 70, 30, 90, 60, 100, 50, 80, 45, 95, 35, 75].map((h, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1 rounded-full transition-all duration-150",
                          isPlaying ? "bg-purple-400 animate-pulse" : "bg-purple-500/30"
                        )}
                        style={{ height: `${isPlaying ? h : 20}%` }}
                      />
                    ))}
                  </div>
                  <audio
                    ref={audioRef}
                    src={displayUrl}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Video / Audio Playback Control Strip */}
        {!displayItem.isMissing && (displayItem.type === 'video' || displayItem.type === 'audio') && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-stone-950/60 border-t border-white/5 select-none">
            {/* Tactile Play Button styled with system accent */}
            <button
              type="button"
              onClick={togglePlay}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 apple-press cursor-pointer shrink-0 shadow-md shadow-accent/20",
                "bg-accent text-accent-foreground hover:brightness-110 active:scale-95"
              )}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <span className="text-xs font-medium text-stone-300 tabular-nums min-w-[36px] shrink-0">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 h-8 flex items-center">
              <Slider
                mode="track"
                color="accent"
                min={0}
                max={duration || 1}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
              />
            </div>

            <span className="text-xs font-medium text-stone-400 tabular-nums min-w-[36px] shrink-0">
              {formatTime(duration)}
            </span>

            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <button
                type="button"
                onClick={toggleMute}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors apple-press cursor-pointer"
                title={isMuted || volume === 0 ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                aria-label={isMuted || volume === 0 ? t('unmute', 'Unmute') : t('mute', 'Mute')}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="w-16 sm:w-20 h-8 flex items-center" title={t('volume', 'Volume')}>
                <Slider
                  mode="track"
                  color="accent"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(val) => {
                    setVolume(val);
                    if (isMuted && val > 0) setIsMuted(false);
                    if (videoRef.current) {
                      videoRef.current.volume = val;
                      videoRef.current.muted = val === 0;
                    }
                    if (audioRef.current) {
                      audioRef.current.volume = val;
                      audioRef.current.muted = val === 0;
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-950/80 border-t border-white/5 text-[11px] text-stone-400 select-none">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-wider text-stone-300 uppercase px-2 py-0.5 bg-white/10 rounded-xl border border-white/10">
              {fileExt}
            </span>
            {dimensions && (
              <span className="text-stone-400 font-medium tabular-nums">
                {dimensions.width} × {dimensions.height}
              </span>
            )}
          </div>

          <div className="truncate max-w-[50%] text-stone-500 text-[11px]" title={displayItem.path}>
            {displayItem.path}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
export default MediaQuickLookModal;
