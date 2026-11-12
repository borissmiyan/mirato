import { useEffect, useRef } from 'react';
import { IVideoSettings } from '@/core/types';
import { LiveSyncService } from '@/core/services/liveSyncService';

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
}

const UNMOUNT_FADE_DURATION = 0.4;

/**
 * Synchronizes video volume, mute state, fades (in/out), and handles unmount volume ramp-down.
 */
export function useVideoVolumeSync({
  videoRef,
  settings,
  controlOnly,
  isPreloading,
  isMuted,
  isPreview,
  isEffectivelyLive,
  isLive,
  slideId
}: VideoVolumeSyncOptions): void {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;
    if (!video) return;

    const shouldMute = settings.muted || isPreloading || isMuted || (isPreview && isEffectivelyLive);

    const updateVolume = () => {
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
        fadeMultiplier = Math.max(0, (currentTime - trimStart) / fadeInDuration);
      } else if (fadeOutDuration > 0 && trimEnd > 0 && currentTime > trimEnd - fadeOutDuration) {
        fadeMultiplier = Math.max(0, (trimEnd - currentTime) / fadeOutDuration);
      }

      const targetVolume = settings.volume * fadeMultiplier;
      if (Math.abs(video.volume - targetVolume) > 0.001) {
        video.volume = targetVolume;
      }
    };

    video.playbackRate = settings.speed;
    video.loop = false;
    video.muted = shouldMute;
    updateVolume();

    if (settings.fadeInSeconds || settings.fadeOutSeconds) {
      video.addEventListener('timeupdate', updateVolume);
      return () => video.removeEventListener('timeupdate', updateVolume);
    }
  }, [
    settings.speed, settings.volume, settings.loop, settings.muted,
    settings.fadeInSeconds, settings.fadeOutSeconds, settings.trimStart,
    settings.trimEnd, isPreloading, isMuted, isPreview, isEffectivelyLive, controlOnly, videoRef
  ]);

  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;

    return () => {
      if (!video || video.paused || video.ended) return;
      const s = settingsRef.current;
      if (s.muted || s.volume === 0) return;

      const startVol = video.volume;
      if (startVol <= 0.001) return;

      const steps = 10;
      const stepMs = (UNMOUNT_FADE_DURATION * 1000) / steps;
      let step = 0;

      const fadeInterval = setInterval(() => {
        step++;
        const t = step / steps;
        const multiplier = 1 - t * t;
        try {
          video.volume = Math.max(0, startVol * multiplier);
        } catch {
          clearInterval(fadeInterval);
          return;
        }
        if (step >= steps) {
          clearInterval(fadeInterval);
          try {
            video.pause();
          } catch {
            // noop
          }
        }
      }, stepMs);

      if (isPreview && isLive) {
        LiveSyncService.sendVideoCommand(slideId, 'pause', video.currentTime);
      }
    };
  }, [slideId, settings.mediaId, controlOnly, isPreview, isLive, videoRef]);
}
