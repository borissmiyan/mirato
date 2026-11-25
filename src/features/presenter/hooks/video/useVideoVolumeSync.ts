import React, { useContext, useEffect, useRef } from 'react';
import { IVideoSettings } from '@/core/types';

/** Context indicating that a slide is currently exiting (fading out on slide switch). */
export const SlideExitingContext = React.createContext(false);

interface VideoVolumeSyncOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  settings: IVideoSettings;
  controlOnly: boolean;
  isPreloading?: boolean;
  isMuted?: boolean;
  isPreview: boolean;
  isEffectivelyLive: boolean;
  isLive: boolean;
  slideId: string;
  videoUrl?: string | null;
}

const DEFAULT_EXIT_FADE_DURATION = 0.4;

/**
 * Synchronizes video volume, mute state, smooth 60fps fades (in/out),
 * and smooth audio fade-out when transitioning away to the next slide.
 */
export function useVideoVolumeSync({
  videoRef,
  settings,
  controlOnly,
  isPreloading,
  isMuted,
  isPreview,
  isEffectivelyLive,
  videoUrl,
}: VideoVolumeSyncOptions): void {
  const isExiting = useContext(SlideExitingContext);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Smooth 60fps fade-in / fade-out during active playback
  useEffect(() => {
    if (controlOnly || isExiting) return;
    const video = videoRef.current;
    if (!video) return;

    const shouldMute = settings.muted || isPreloading || isMuted || (isPreview && isEffectivelyLive);

    const computeAndApplyVolume = () => {
      if (shouldMute) {
        video.volume = 0;
        video.muted = true;
        return;
      }

      const fadeInDuration = settings.fadeInSeconds || 0;
      const fadeOutDuration = settings.fadeOutSeconds || 0;
      const trimStart = settings.trimStart || 0;
      const trimEnd = settings.trimEnd || video.duration || 0;
      const currentTime = video.currentTime;
      let fadeMultiplier = 1.0;

      if (fadeInDuration > 0 && currentTime < trimStart + fadeInDuration) {
        fadeMultiplier = Math.max(0, Math.min(1, (currentTime - trimStart) / fadeInDuration));
      } else if (fadeOutDuration > 0 && trimEnd > 0 && currentTime > trimEnd - fadeOutDuration) {
        fadeMultiplier = Math.max(0, Math.min(1, (trimEnd - currentTime) / fadeOutDuration));
      }

      const targetVolume = Math.max(0, Math.min(1, settings.volume * fadeMultiplier));
      if (Math.abs(video.volume - targetVolume) > 0.002) {
        video.volume = targetVolume;
      }
    };

    video.playbackRate = settings.speed;
    video.loop = false;
    video.muted = shouldMute;
    computeAndApplyVolume();

    const hasFades = Boolean(settings.fadeInSeconds || settings.fadeOutSeconds);
    if (!hasFades || shouldMute) return;

    let rafId: number | null = null;
    const tick = () => {
      computeAndApplyVolume();
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    const startLoop = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    video.addEventListener('play', startLoop);
    video.addEventListener('seeked', computeAndApplyVolume);
    if (!video.paused && !video.ended) {
      startLoop();
    }

    return () => {
      video.removeEventListener('play', startLoop);
      video.removeEventListener('seeked', computeAndApplyVolume);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    settings.speed, settings.volume, settings.loop, settings.muted,
    settings.fadeInSeconds, settings.fadeOutSeconds, settings.trimStart,
    settings.trimEnd, isPreloading, isMuted, isPreview, isEffectivelyLive,
    controlOnly, videoRef, videoUrl, isExiting,
  ]);

  // Smooth 60fps audio fade-out when the slide is exiting to the next slide
  useEffect(() => {
    if (controlOnly || !isExiting) return;
    const video = videoRef.current;
    if (!video || video.paused || video.ended || video.muted) return;

    const startVol = video.volume;
    if (startVol <= 0.001) {
      video.pause();
      return;
    }

    const fadeOutSec = Math.max(0.05, settingsRef.current.fadeOutSeconds || DEFAULT_EXIT_FADE_DURATION);
    const fadeOutMs = fadeOutSec * 1000;
    const startTime = performance.now();
    let rafId: number | null = null;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / fadeOutMs);
      // Equal-power / quadratic ease-out curve for natural audio decay
      const multiplier = (1 - progress) * (1 - progress);
      try {
        video.volume = Math.max(0, startVol * multiplier);
      } catch {
        rafId = null;
        return;
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = null;
        try {
          video.pause();
        } catch {
          // noop
        }
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isExiting, controlOnly, videoRef]);
}
