import { useEffect } from 'react';
import { IVideoSettings } from '@/core/types';
import { LiveSyncService } from '@/core/services/liveSyncService';

export interface IVideoPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
}

interface VideoStateSyncOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  settings: IVideoSettings;
  controlOnly: boolean;
  isPreview: boolean;
  isLive: boolean;
  slideId: string;
  setState: React.Dispatch<React.SetStateAction<IVideoPlaybackState>>;
}

/**
 * Handles HTML5 Video element event subscriptions, boundary trimming, and state updates.
 */
export function useVideoStateSync({
  videoRef,
  settings,
  controlOnly,
  isPreview,
  isLive,
  slideId,
  setState
}: VideoStateSyncOptions): void {
  useEffect(() => {
    if (controlOnly) return;
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const trimStart = settings.trimStart || 0;
      const trimEnd = settings.trimEnd || video.duration;

      if (video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }

      setState(prev => ({
        ...prev,
        duration: trimEnd,
        currentTime: video.currentTime,
      }));
    };

    const syncState = () => {
      const currentTime = video.currentTime;
      const trimStart = settings.trimStart || 0;
      const videoDuration = video.duration || 0;
      const trimEnd = settings.trimEnd || videoDuration || 0;

      if (trimStart > 0 && (currentTime < trimStart - 0.15 || (currentTime < 0.1 && trimStart > 0.5))) {
        video.currentTime = trimStart;
        return;
      }

      if (trimEnd > 0 && currentTime >= trimEnd - 0.05 && currentTime > trimStart) {
        if (settings.loop) {
          video.currentTime = trimStart;
          video.play().catch(() => {});
          if (isPreview && isLive) {
            LiveSyncService.sendVideoCommand(slideId, 'seek', trimStart);
            LiveSyncService.sendVideoCommand(slideId, 'play', trimStart);
          }
        } else {
          video.pause();
          video.currentTime = trimEnd;
          if (isPreview && isLive) {
            LiveSyncService.sendVideoCommand(slideId, 'pause', trimEnd);
          }
        }
      }

      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        isPlaying: !video.paused && !video.ended,
        duration: settings.trimEnd || videoDuration || prev.duration,
        buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
      }));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', syncState);
    video.addEventListener('play', syncState);
    video.addEventListener('pause', syncState);
    video.addEventListener('playing', syncState);
    video.addEventListener('waiting', syncState);
    video.addEventListener('seeking', syncState);
    video.addEventListener('seeked', syncState);
    video.addEventListener('ratechange', syncState);

    if (video.readyState >= 1) handleLoadedMetadata();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', syncState);
      video.removeEventListener('play', syncState);
      video.removeEventListener('pause', syncState);
      video.removeEventListener('playing', syncState);
      video.removeEventListener('waiting', syncState);
      video.removeEventListener('seeking', syncState);
      video.removeEventListener('seeked', syncState);
      video.removeEventListener('ratechange', syncState);
    };
  }, [settings.trimStart, settings.trimEnd, settings.loop, settings.mediaId, videoRef, controlOnly, isPreview, isLive, slideId, setState]);
}

