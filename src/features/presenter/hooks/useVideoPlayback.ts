import { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { IVideoSettings } from '@/core/types';
import { usePresentationStore } from '../store/presentationStore';
import { useVideoVolumeSync, SlideExitingContext } from './video/useVideoVolumeSync';
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
  videoUrl?: string | null;
  controlOnly?: boolean;
  isRemote?: boolean;
  isMuted?: boolean;
}

/**
 * Custom hook to manage video playback state across preview and projector.
 * Preview playback is strictly local and never dispatches commands to the projector.
 * Handles trim boundaries, delay strategy, and projector auto-play.
 */
export const useVideoPlayback = ({
  settings,
  isPreview,
  isLive,
  isPreloading,
  slideId,
  videoUrl,
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
  const isExiting = useContext(SlideExitingContext);

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
    slideId,
    videoUrl,
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

  // Auto-play strategy when live on projector (never auto-play while exiting/fading out)
  useEffect(() => {
    if (controlOnly || isRemote || isPreview || isExiting) return;
    const video = videoRef.current;
    if (!video || !isLive || isPreloading) return;

    const startPlayback = () => {
      const trimStart = settings.trimStart || 0;
      if (Math.abs(video.currentTime - trimStart) > 0.2) {
        video.currentTime = trimStart;
      }

      video.play().catch(() => {});
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
  }, [isLive, isPreview, isRemote, isExiting, settings.strategy, settings.delaySeconds, settings.trimStart, slideId, settings.mediaId, videoUrl, isPreloading, controlOnly]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  }, []);

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
  }, [settings.trimStart, settings.trimEnd]);

  const setSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, []);

  const setVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, []);

  return {
    videoRef,
    state,
    actions: { play, pause, togglePlayPause, seek, setSpeed, setVolume, setMuted },
  };
};
