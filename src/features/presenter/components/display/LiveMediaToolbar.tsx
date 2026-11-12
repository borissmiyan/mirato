import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, VolumeX, Gauge, Monitor, Music, SkipBack, SkipForward } from 'lucide-react';
import { usePresentationStore } from '../../store/presentationStore';
import { IVideoSlide, ISlide, ITimerSlide, ICanvasSlide } from '@/core/types/presentation';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { audioService } from '../../services/AudioService';
import { presentationService } from '@/core/services/presentationService';
import { Slider } from '@/shared/ui';

/**
 * Formats seconds into MM:SS or HH:MM:SS display.
 */
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * LiveMediaToolbar — a control strip at the bottom of the timeline for the
 * Currently-live video slide. It does NOT own its own <video> element.
 * Instead, it reads state ONLY from the projector's periodic heartbeat.
 */
export interface LiveMediaToolbarProps {
  liveSlide?: ISlide;
  presentationId?: string;
}

export const LiveMediaToolbar: React.FC<LiveMediaToolbarProps> = ({ 
  liveSlide: propLiveSlide, 
  presentationId: propPresentationId 
}) => {
  const { t } = useTranslation();
  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ bottom: 0, right: 0 });
  const [currentVolume, setCurrentVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const currentVolumeRef = useRef(1);
  const isMutedRef = useRef(false);
  const lastInteractionRef = useRef(0);
  const lastVolumeInteractionRef = useRef(0);
  const lastInitializedSlideIdRef = useRef<string | null>(null);
  const prevSlideIdRef = useRef<string | null>(null);

  // Polled playback state from the actual preview video element
  const [playState, setPlayState] = useState<{
    isPlaying: boolean; currentTime: number; duration: number; buffered: number; timestampAtPlay?: number;
  }>({ isPlaying: false, currentTime: 0, duration: 0, buffered: 0 });
  
  const [audioStatus, setAudioStatus] = useState<{
    scopeId: string; currentTime: number; duration: number; isPlaying: boolean; fileId: string;
  } | null>(null);

  // Optimization: Prefer passed props if available, otherwise fallback to DB query
  const liveSlideData = useLiveQuery(async () => {
    if (propLiveSlide && propPresentationId) return { slide: propLiveSlide, presentationId: propPresentationId };
    if (!liveSlideId) return null;
    const presentations = await db.presentationFiles.toArray();
    for (const p of presentations) {
      const slide = p.slides.find(s => s.id === liveSlideId);
      if (slide) return { slide, presentationId: p.id };
    }
    return null;
  }, [liveSlideId, propLiveSlide?.id, propPresentationId]);

  const liveSlideInfo = liveSlideData?.slide || propLiveSlide;
  const presentationId = liveSlideData?.presentationId || propPresentationId;
  const settings = liveSlideInfo?.type === 'video' ? (liveSlideInfo as IVideoSlide).videoSettings : null;

  // Keep a ref to the latest settings so the high-frequency poll loop always has up-to-date
  // trim boundaries without requiring the effect to restart on every reference change.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Sync playState.currentTime with settings.trimStart when slide changes or trim changes
  const trimStart = settings?.trimStart;
  const trimEnd = settings?.trimEnd;
  useEffect(() => {
    if (!settings) return;
    const start = trimStart || 0;
    setPlayState(prev => {
      const end = trimEnd || prev.duration || 0;
      if (prev.currentTime < start || (end > 0 && prev.currentTime > end)) {
        return { ...prev, currentTime: start };
      }
      return prev;
    });
  }, [trimStart, trimEnd, liveSlideId, settings]);

  // Reset playState ONLY when switching to a different live slide
  useEffect(() => {
    if (liveSlideId && liveSlideId !== prevSlideIdRef.current) {
      prevSlideIdRef.current = liveSlideId;
      setPlayState({
        isPlaying: false,
        currentTime: settingsRef.current?.trimStart || 0,
        duration: 0,
        buffered: 0,
      });
    }
  }, [liveSlideId]);

  // Initialize volume once when a new slide becomes live
  useEffect(() => {
    if (liveSlideId && settings && lastInitializedSlideIdRef.current !== liveSlideId) {
      lastInitializedSlideIdRef.current = liveSlideId;
      const vol = typeof settings.volume === 'number' ? settings.volume : 1;
      currentVolumeRef.current = vol;
      setCurrentVolume(vol);
      const muted = Boolean(settings.muted);
      isMutedRef.current = muted;
      setIsMuted(muted);
    }
  }, [liveSlideId, settings]);

  // Sync external volume updates, but never within 2s of user interaction
  const volume = settings?.volume;
  const muted = settings?.muted;
  useEffect(() => {
    if (!settings) return;
    if (performance.now() - lastVolumeInteractionRef.current < 2000) return;
    if (typeof volume === 'number' && Math.abs(volume - currentVolumeRef.current) > 0.02) {
      currentVolumeRef.current = volume;
      setCurrentVolume(volume);
    }
    if (typeof muted === 'boolean' && muted !== isMutedRef.current) {
      isMutedRef.current = muted;
      setIsMuted(muted);
    }
  }, [volume, muted, settings]);

  // Audio Status Listener (Local Polling)
  useEffect(() => {
    const interval = setInterval(() => {
        // Optimistic UI: Ignore status if we've interacted recently
        if (performance.now() - lastInteractionRef.current < 1000) return;

        const activeId = audioService.targetScopeId;
        if (activeId) {
            const progress = audioService.getTrackProgress(activeId);
            const track = audioService.activeTracks.get(activeId);
            if (progress && track) {
                setAudioStatus({
                    scopeId: activeId,
                    currentTime: progress.currentTime,
                    duration: progress.duration,
                    isPlaying: progress.isPlaying,
                    fileId: track.scope.fileId
                });
            }
        } else {
            setAudioStatus(null);
        }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const isAudioMode = !settings && !!audioStatus;
  const activePlayState = (isAudioMode && audioStatus) ? {
    isPlaying: audioStatus.isPlaying,
    currentTime: audioStatus.currentTime,
    duration: audioStatus.duration,
    buffered: 0
  } : playState;

  // ── Actions that control the projector virtually ───
  const handleTogglePlayPause = useCallback(() => {
    lastInteractionRef.current = performance.now();
    presentationService.toggleLiveMedia();
  }, []);

  // ── Sync playState with Projector Heartbeat (ground truth) ──
  // The LiveMediaToolbar is fully independent from the preview viewport.
  // It reads state ONLY from the projector's periodic heartbeat.
  const hasSettings = Boolean(settings);
  useEffect(() => {
    if (!liveSlideId) return;
    const unsubStatus = LiveSyncService.onVideoStatus((data) => {
        if (performance.now() - lastInteractionRef.current < 1000) return;
        if (data.slideId && liveSlideId && data.slideId !== liveSlideId) {
            if (String(data.slideId).substring(0, 8) !== String(liveSlideId).substring(0, 8)) return;
        }
        setPlayState(prev => ({
            ...prev,
            isPlaying: data.isPlaying,
            currentTime: data.currentTime,
            duration: (data.duration && isFinite(data.duration) && data.duration > 0) ? data.duration : prev.duration
        }));
    });
    LiveSyncService.requestVideoStatus();
    return () => { unsubStatus?.(); };
  }, [hasSettings, liveSlideId]);

  const updateVideoSettings = usePresentationStore(s => s.updateVideoSettings);

  const handleSeek = useCallback((time: number) => {
    lastInteractionRef.current = performance.now();
    
    if (isAudioMode && audioStatus) {
        setAudioStatus(prev => prev ? { ...prev, currentTime: time } : null);
        audioService.seekTrack(audioStatus.scopeId, time);
        LiveSyncService.sendAudioCommand(audioStatus.scopeId, 'seek', time);
        return;
    }

    if (!liveSlideId || !settings) return;
    
    setPlayState(prev => {
      const duration = prev.duration || settings.trimEnd || 1;
      const clampedTime = Math.max(
        settings.trimStart || 0,
        Math.min(time, settings.trimEnd || duration)
      );
      
      LiveSyncService.sendVideoCommand(liveSlideId, 'seek', clampedTime);
      return { ...prev, currentTime: clampedTime, timestampAtPlay: performance.now() };
    });
  }, [liveSlideId, settings, isAudioMode, audioStatus]);

  const hasPlaylist = (liveSlideInfo?.type === 'timer' && !!(liveSlideInfo as ITimerSlide).playlist?.length) || 
                     (liveSlideInfo?.type === 'normal' && !!(liveSlideInfo as ICanvasSlide).timerSettings?.playlist?.length);
  const hasMedia = !!settings || isAudioMode || hasPlaylist || liveSlideInfo?.type === 'timer';
  const handlePlaylistNext = useCallback(() => { if (liveSlideId) LiveSyncService.sendPlaylistCommand(liveSlideId, 'next'); }, [liveSlideId]);
  const handlePlaylistPrev = useCallback(() => { if (liveSlideId) LiveSyncService.sendPlaylistCommand(liveSlideId, 'prev'); }, [liveSlideId]);

  const effectiveTrimStart = settings?.trimStart || 0;
  const effectiveTrimEnd = (isAudioMode ? audioStatus?.duration : (settings?.trimEnd && settings.trimEnd > 0 ? settings.trimEnd : (playState.duration || 0))) || 0;
  const effectiveDuration = Math.max(0, effectiveTrimEnd - effectiveTrimStart);
  const displayCurrentTime = hasMedia ? Math.max(0, (activePlayState.currentTime || 0) - effectiveTrimStart) : 0;

  const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

  const handleSpeedChange = (s: number) => {
    LiveSyncService.sendVideoCommand(liveSlideId, 'speed', s);
    if (presentationId) updateVideoSettings(liveSlideId, { speed: s }, presentationId);
    setShowSpeedMenu(false);
  };

  const handleMuteToggle = useCallback(() => {
    lastVolumeInteractionRef.current = performance.now();
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (liveSlideId) {
      LiveSyncService.sendVideoCommand(liveSlideId, 'mute', nextMuted);
      if (presentationId) updateVideoSettings(liveSlideId, { muted: nextMuted }, presentationId);
    }
    if (isAudioMode && audioStatus) {
      audioService.setTrackVolume(audioStatus.scopeId, nextMuted ? 0 : currentVolumeRef.current);
    }
  }, [liveSlideId, presentationId, isAudioMode, audioStatus, updateVideoSettings]);

  return (
    <div className="w-full flex h-12 bg-stone-900 border-t border-white/5 relative z-20 shrink-0 select-none">
      {/* Track Header (Aligned with main timeline tracks) */}
      <div className={cn(
        "w-20 shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-white/5 bg-stone-950 transition-colors",
        isAudioMode ? "text-amber-500/80" : "text-accent/80"
      )}>
        {isAudioMode ? <Music className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
        <span className="text-[9px] font-bold uppercase tracking-[0.05em] opacity-80">
          {isAudioMode ? t('audio', 'Audio') : t('live', 'Live')}
        </span>
      </div>

      <div className={cn(
        "flex-1 flex items-center gap-4 px-4 transition-all duration-500",
        hasMedia ? "text-stone-300 opacity-100" : "text-stone-600 opacity-40 grayscale pointer-events-none"
      )}>
        {/* Play/Pause Group */}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasPlaylist && (
            <button type="button" onClick={handlePlaylistPrev} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press" title={t('prev_track', 'Previous Track')}>
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          <button
            type="button"
            onClick={handleTogglePlayPause}
            className={cn("w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer apple-press", activePlayState.isPlaying ? "text-accent" : "text-stone-300 hover:text-white")}
            aria-label={activePlayState.isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
          >
            {activePlayState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
          {hasPlaylist && (
            <button type="button" onClick={handlePlaylistNext} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press" title={t('next_track', 'Next Track')}>
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>

        {/* Time display */}
        <div className="text-[11px] font-mono font-bold tabular-nums shrink-0 mt-0.5 min-w-[70px]">
          <span className="text-stone-100">{formatTime(displayCurrentTime)}</span>
          <span className="text-stone-600 mx-1">/</span>
          <span className="text-stone-400">{formatTime(effectiveDuration)}</span>
        </div>

        {/* Scrubber */}
        <div className="flex-1 h-8 flex items-center">
          <Slider
            mode="track"
            color={isAudioMode ? 'amber' : 'accent'}
            min={0}
            max={effectiveDuration || 1}
            step={0.01}
            value={displayCurrentTime}
            bufferedFraction={activePlayState.buffered / (isAudioMode ? (audioStatus?.duration || 1) : (playState.duration || 1))}
            onChange={(val) => {
              if (isAudioMode && audioStatus) {
                handleSeek(val);
              } else {
                handleSeek(effectiveTrimStart + val);
              }
            }}
          />
        </div>

        {/* Speed & Volume Tools (Hide speed for audio mode for now as it's less common) */}
        {!isAudioMode && (
          <div className="relative shrink-0 ml-2">
            <button
              type="button"
              ref={speedButtonRef}
              onClick={() => {
                const rect = speedButtonRef.current?.getBoundingClientRect();
                if (rect) setMenuPosition({ bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right });
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="h-8 px-2 flex items-center gap-1.5 rounded-xl hover:bg-white/10 transition-colors text-[11px] font-medium cursor-pointer apple-press"
            >
              <Gauge className="w-3.5 h-3.5 opacity-70" />
              {settings?.speed || 1}x
            </button>
            {showSpeedMenu && createPortal(
              <div 
                className="fixed bg-stone-900 border border-white/5 rounded-xl shadow-xl py-1 min-w-[100px] z-100 animate-in fade-in zoom-in-95"
                style={{ bottom: menuPosition.bottom, right: menuPosition.right }}
              >
                {SPEED_OPTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-[11px] font-medium transition-colors cursor-pointer block apple-press",
                      s === (settings?.speed || 1) ? "text-accent bg-accent/10" : "text-stone-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-1">
          <button
            type="button"
            onClick={handleMuteToggle}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-stone-300 hover:text-white apple-press"
            aria-label={isMuted || currentVolume === 0 ? t('unmute', 'Unmute') : t('mute', 'Mute')}
          >
            {isMuted || currentVolume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
          
          <div className="w-20 h-8 flex items-center" title={t('volume', 'Volume')}>
            <Slider
              mode="track"
              color={isAudioMode ? 'amber' : 'accent'}
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : currentVolume}
              onChange={(val) => {
                lastVolumeInteractionRef.current = performance.now();
                currentVolumeRef.current = val;
                setCurrentVolume(val);
                if (isMutedRef.current && val > 0) {
                  isMutedRef.current = false;
                  setIsMuted(false);
                  if (liveSlideId) LiveSyncService.sendVideoCommand(liveSlideId, 'mute', false);
                }
                if (liveSlideId) LiveSyncService.sendVideoCommand(liveSlideId, 'volume', val);
                if (isAudioMode && audioStatus) audioService.setTrackVolume(audioStatus.scopeId, val);
              }}
              onChangeEnd={(val) => {
                lastVolumeInteractionRef.current = performance.now();
                if (liveSlideId && presentationId) {
                  updateVideoSettings(liveSlideId, { volume: val, muted: val === 0 }, presentationId);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
