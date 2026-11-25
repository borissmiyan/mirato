import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Monitor, Music, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePresentationStore } from '../../store/presentationStore';
import { IVideoSlide, ISlide, ITimerSlide, ICanvasSlide } from '@/core/types/presentation';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { audioService } from '../../services/AudioService';
import { presentationService } from '@/core/services/presentationService';
import { Slider, Tooltip } from '@/shared/ui';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { LiveMediaSpeedVolumeControls } from './LiveMediaSpeedVolumeControls';

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
  const [playContextMenu, setPlayContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [currentVolume, setCurrentVolume] = useState(() => audioService.globalVolume);
  const [isMuted, setIsMuted] = useState(() => audioService.globalMuted);
  const [currentSpeed, setCurrentSpeed] = useState(() => audioService.globalPlaybackSpeed);
  const currentVolumeRef = useRef(audioService.globalVolume);
  const isMutedRef = useRef(audioService.globalMuted);
  const lastInteractionRef = useRef(0);
  const lastVolumeInteractionRef = useRef(0);
  const lastInitializedSlideIdRef = useRef<string | null>(null);
  const prevSlideIdRef = useRef<string | null>(null);

  // Polled playback state from the actual preview video element
  const [playState, setPlayState] = useState<{
    isPlaying: boolean; currentTime: number; duration: number; buffered: number; timestampAtPlay?: number;
  }>({ isPlaying: false, currentTime: 0, duration: 0, buffered: 0 });
  
  const [audioStatus, setAudioStatus] = useState<{
    scopeId: string; currentTime: number; duration: number; isPlaying: boolean; fileId: string; speed: number;
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
                    fileId: track.scope.fileId,
                    speed: track.scope.speed ?? 1,
                });
            }
        } else {
            setAudioStatus(null);
        }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const isAudioMode = !settings && !!audioStatus;
  const hasBothVideoAndAudio = Boolean(settings) && Boolean(audioStatus);
  const activePlayState = (isAudioMode && audioStatus) ? {
    isPlaying: audioStatus.isPlaying,
    currentTime: audioStatus.currentTime,
    duration: audioStatus.duration,
    buffered: 0
  } : playState;

  // ── Actions that control the projector virtually ───
  const handleTogglePlayPause = useCallback(() => {
    lastInteractionRef.current = performance.now();
    if (isAudioMode && audioStatus) {
      setAudioStatus(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
    } else if (settings) {
      setPlayState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }
    presentationService.toggleLiveMedia('auto');
  }, [isAudioMode, audioStatus, settings]);

  const handleTargetedMediaAction = useCallback((target: 'video' | 'audio' | 'all', forceAction?: 'play' | 'pause') => {
    lastInteractionRef.current = performance.now();
    if (target === 'video' || target === 'all') {
      setPlayState(prev => ({ ...prev, isPlaying: forceAction ? forceAction === 'play' : !prev.isPlaying }));
    }
    if ((target === 'audio' || target === 'all') && audioStatus) {
      setAudioStatus(prev => prev ? { ...prev, isPlaying: forceAction ? forceAction === 'play' : !prev.isPlaying } : null);
    }
    presentationService.toggleLiveMedia(target, forceAction);
    setPlayContextMenu(null);
  }, [audioStatus]);

  const handleLiveStep = useCallback((direction: 'prev' | 'next') => {
    if (!liveSlideId) return;
    if (direction === 'next') {
      presentationService.navigateNext('presentation', true, true).catch(console.error);
    } else {
      presentationService.navigatePrev('presentation', true, true).catch(console.error);
    }
  }, [liveSlideId]);

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

  // Re-apply the remembered global playback speed, volume & mute whenever a new live video slide starts
  useEffect(() => {
    if (!liveSlideId || !settings) return;
    LiveSyncService.sendVideoCommand(liveSlideId, 'speed', currentSpeed);
    LiveSyncService.sendVideoCommand(liveSlideId, 'volume', currentVolumeRef.current);
    LiveSyncService.sendVideoCommand(liveSlideId, 'mute', isMutedRef.current);
  }, [liveSlideId, hasSettings, currentSpeed, settings]);

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

  const handleSpeedChange = useCallback((s: number) => {
    setCurrentSpeed(s);
    audioService.setGlobalPlaybackSpeed(s);
    if (liveSlideId && settings) {
      LiveSyncService.sendVideoCommand(liveSlideId, 'speed', s);
    }
    if (audioStatus) {
      setAudioStatus(prev => prev ? { ...prev, speed: s } : null);
      LiveSyncService.sendAudioCommand(audioStatus.scopeId, 'speed', s);
    }
  }, [liveSlideId, settings, audioStatus]);

  const handleMuteToggle = useCallback(() => {
    lastVolumeInteractionRef.current = performance.now();
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    audioService.setGlobalMuted(nextMuted);
    if (liveSlideId && settings) {
      LiveSyncService.sendVideoCommand(liveSlideId, 'mute', nextMuted);
      if (presentationId) updateVideoSettings(liveSlideId, { muted: nextMuted }, presentationId);
    }
  }, [liveSlideId, settings, presentationId, updateVideoSettings]);

  const handleVolumeChange = useCallback((val: number) => {
    lastVolumeInteractionRef.current = performance.now();
    currentVolumeRef.current = val;
    setCurrentVolume(val);
    if (isMutedRef.current && val > 0) {
      isMutedRef.current = false;
      setIsMuted(false);
      audioService.setGlobalMuted(false);
      if (liveSlideId && settings) LiveSyncService.sendVideoCommand(liveSlideId, 'mute', false);
    }
    audioService.setGlobalVolume(val);
    if (liveSlideId && settings) LiveSyncService.sendVideoCommand(liveSlideId, 'volume', val);
  }, [liveSlideId, settings]);

  const handleVolumeChangeEnd = useCallback((val: number) => {
    lastVolumeInteractionRef.current = performance.now();
    if (liveSlideId && settings && presentationId) {
      updateVideoSettings(liveSlideId, { volume: val, muted: val === 0 }, presentationId);
    }
  }, [liveSlideId, settings, presentationId, updateVideoSettings]);

  return (
    <div className="w-full flex h-12 bg-stone-900 border-t border-white/5 relative z-20 shrink-0 select-none">
      {/* Track Header (Aligned with main timeline tracks) */}
      <div className={cn(
        "w-20 shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-white/5 bg-stone-950 transition-colors",
        isAudioMode ? "text-amber-500/80" : "text-accent/80"
      )}>
        {isAudioMode ? <Music className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
        <span className="text-[9px] font-bold uppercase tracking-[0.05em] opacity-80">
          {t('media', 'Media')}
        </span>
      </div>

      {/* Live-only Slide Navigation (works even while typing in preview editor) */}
      {liveSlideId && (
        <div className="flex items-center gap-0.5 px-1.5 border-r border-white/5 shrink-0">
          <Tooltip content={t('prev_live_slide', 'Previous Live Slide (Alt+←)')} position="top">
            <button
              type="button"
              onClick={() => handleLiveStep('prev')}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press"
              aria-label={t('prev_live_slide', 'Previous Live Slide')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('next_live_slide', 'Next Live Slide (Alt+→)')} position="top">
            <button
              type="button"
              onClick={() => handleLiveStep('next')}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press"
              aria-label={t('next_live_slide', 'Next Live Slide')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className={cn(
        "flex-1 flex items-center gap-4 px-4 transition-all duration-500",
        hasMedia ? "text-stone-300 opacity-100" : "text-stone-600 opacity-40 grayscale pointer-events-none"
      )}>
        {/* Play/Pause Group */}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasPlaylist && (
            <Tooltip content={t('prev_track', 'Previous Track')} position="top">
              <button type="button" onClick={handlePlaylistPrev} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press">
                <SkipBack className="w-3.5 h-3.5 fill-current" />
              </button>
            </Tooltip>
          )}
          <Tooltip
            content={hasBothVideoAndAudio ? t('play_context_hint', 'Right-click for Video / Audio / All') : (activePlayState.isPlaying ? t('pause', 'Pause') : t('play', 'Play'))}
            position="top"
          >
            <button
              type="button"
              onClick={handleTogglePlayPause}
              onContextMenu={(e) => {
                if (!hasBothVideoAndAudio) return;
                e.preventDefault();
                e.stopPropagation();
                setPlayContextMenu({ x: e.clientX, y: e.clientY });
              }}
              className={cn("w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors cursor-pointer apple-press", activePlayState.isPlaying ? "text-accent" : "text-stone-300 hover:text-white")}
              aria-label={activePlayState.isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
            >
              {activePlayState.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
            </button>
          </Tooltip>
          {hasPlaylist && (
            <Tooltip content={t('next_track', 'Next Track')} position="top">
              <button type="button" onClick={handlePlaylistNext} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer apple-press">
                <SkipForward className="w-3.5 h-3.5 fill-current" />
              </button>
            </Tooltip>
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
      </div>

      {/* Independent Global Speed & Volume Controls — always interactive even when idle */}
      <div className="flex items-center pr-3 shrink-0">
        <LiveMediaSpeedVolumeControls
          isAudioMode={isAudioMode}
          currentSpeed={currentSpeed}
          currentVolume={currentVolume}
          isMuted={isMuted}
          onSpeedChange={handleSpeedChange}
          onMuteToggle={handleMuteToggle}
          onVolumeChange={handleVolumeChange}
          onVolumeChangeEnd={handleVolumeChangeEnd}
        />
      </div>

      {/* Contextual Video / Audio / All Right-Click Menu */}
      {playContextMenu && hasBothVideoAndAudio && (() => {
        const isVideoPlaying = playState.isPlaying;
        const isAudioPlaying = Boolean(audioStatus?.isPlaying);
        const isAnyPlaying = isVideoPlaying || isAudioPlaying;
        return (
          <ContextMenu x={playContextMenu.x} y={playContextMenu.y} onClose={() => setPlayContextMenu(null)}>
            <ContextMenuItem
              icon={isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              label={isVideoPlaying ? t('pause_video', 'Pause Video') : t('resume_video', 'Resume Video')}
              onClick={() => handleTargetedMediaAction('video', isVideoPlaying ? 'pause' : 'play')}
            />
            <ContextMenuItem
              icon={isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              label={isAudioPlaying ? t('pause_audio', 'Pause Audio') : t('resume_audio', 'Resume Audio')}
              onClick={() => handleTargetedMediaAction('audio', isAudioPlaying ? 'pause' : 'play')}
            />
            <div className="h-px bg-white/5 my-1" />
            <ContextMenuItem
              icon={isAnyPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              label={isAnyPlaying ? t('pause_all', 'Pause All') : t('resume_all', 'Resume All')}
              onClick={() => handleTargetedMediaAction('all', isAnyPlaying ? 'pause' : 'play')}
            />
          </ContextMenu>
        );
      })()}
    </div>
  );
};
