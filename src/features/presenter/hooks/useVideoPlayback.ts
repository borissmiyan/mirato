import { useState, useRef, useCallback, useEffect } from 'react';
import { IVideoSettings } from '@/core/types';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { usePresentationStore } from '../store/presentationStore';
import { useVideoVolumeSync } from './video/useVideoVolumeSync';
import { useVideoStateSync, IVideoPlaybackState } from './video/useVideoStateSync';

export type { IVideoPlaybackState };

export interface IVideoPlaybackActions {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

export interface UseVideoPlaybackOptions {
  settings: IVideoSettings;
  isPreview: boolean;
  isLive: boolean;
  isPreloading?: boolean;
  slideId: string;
  controlOnly?: boolean;
  isRemote?: boolean;
  isMuted?: boolean;
}

/**
 * Custom hook to manage video playback state across preview and projector.
 * Handles trim boundaries, delay strategy, and projector synchronization.
 */
export const useVideoPlayback = ({
  settings,
  isPreview,
  isLive,
  isPreloading,
  slideId,
  controlOnly = false,
  isRemote = false,
  isMuted = false,
}: UseVideoPlaybackOptions): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  state: IVideoPlaybackState;
  actions: IVideoPlaybackActions;
} => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const liveSlideId = usePresentationStore(s => s.liveSlideId);
  const isEffectivelyLive = isLive || (Boolean(liveSlideId) && liveSlideId === slideId);

  const [state, setState] = useState<IVideoPlaybackState>({
    isPlaying: false,
    currentTime: settings.trimStart || 0,
    duration: 0,
    buffered: 0,
  });

  useVideoVolumeSync({
    videoRef,
    settings,
    controlOnly,
    isPreloading,
    isMuted,
    isPreview,
    isEffectivelyLive,
    isLive,
    slideId
  });

  useVideoStateSync({
    videoRef,
    settings,
    controlOnly,
    isPreview,
    isLive,
    slideId,
    setState
  });

  // Auto-play strategy when live
  useEffect(() => {
    if (controlOnly || isRemote) return;
    const video = videoRef.current;
    if (!video || !isLive || isPreloading) return;

    const startPlayback = () => {
      const trimStart = settings.trimStart || 0;
      if (Math.abs(video.currentTime - trimStart) > 0.2) {
        video.currentTime = trimStart;
      }

      video.play().catch(() => {});

      if (isPreview) {
        LiveSyncService.sendVideoCommand(slideId, 'play', video.currentTime);
      }
    };

    const initialTrimStart = settings.trimStart || 0;
    if (video.readyState >= 1) {
      if (Math.abs(video.currentTime - initialTrimStart) > 0.2) {
        video.currentTime = initialTrimStart;
      }
    }

    if (settings.strategy === 'auto') {
      if (video.readyState >= 2) startPlayback();
      else video.addEventListener('canplay', startPlayback, { once: true });
    } else if (settings.strategy === 'delay') {
      const delayMs = (settings.delaySeconds || 1) * 1000;
      delayTimerRef.current = setTimeout(() => {
        if (video.readyState >= 2) startPlayback();
        else video.addEventListener('canplay', startPlayback, { once: true });
      }, delayMs);
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      video.removeEventListener('canplay', startPlayback);
    };
  }, [isLive, isPreview, isRemote, settings.strategy, settings.delaySeconds, settings.trimStart, slideId, settings.mediaId, isPreloading, controlOnly]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'play', video.currentTime);
    }
  }, [isPreview, isEffectivelyLive, slideId]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'pause', video.currentTime);
    }
  }, [isPreview, isEffectivelyLive, slideId]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else pause();
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clampedTime = Math.max(
      settings.trimStart || 0,
      Math.min(time, settings.trimEnd || video.duration)
    );
    video.currentTime = clampedTime;
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'seek', clampedTime);
    }
  }, [settings.trimStart, settings.trimEnd, isPreview, isEffectivelyLive, slideId]);

  const setSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'speed', speed);
    }
  }, [isPreview, isEffectivelyLive, slideId]);

  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'volume', volume);
    }
  }, [isPreview, isEffectivelyLive, slideId]);

  const setMuted = useCallback((muted: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (isPreview && isEffectivelyLive) {
      LiveSyncService.sendVideoCommand(slideId, 'mute', muted);
    }
  }, [isPreview, isEffectivelyLive, slideId]);

  return {
    videoRef,
    state,
    actions: { play, pause, togglePlayPause, seek, setSpeed, setVolume, setMuted },
  };
};
