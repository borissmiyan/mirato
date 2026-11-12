import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';

/**
 * Service to capture a video frame as a thumbnail image (WebP/JPEG data URL or Blob).
 */
export class VideoThumbnailService {
  /**
   * Captures a frame from a video URL or file at the specified timestamp (default: 1 second).
   */
  static async captureVideoThumbnail(
    sourceUrlOrBlob: string | Blob,
    timeInSeconds: number = 1
  ): Promise<string | null> {
    return new Promise((resolve) => {
      let url = '';
      let isObjectUrl = false;

      if (typeof sourceUrlOrBlob === 'string') {
        url = getLocalResourceUrl(sourceUrlOrBlob) || sourceUrlOrBlob;
      } else if (sourceUrlOrBlob instanceof Blob) {
        url = URL.createObjectURL(sourceUrlOrBlob);
        isObjectUrl = true;
      }

      if (!url) {
        resolve(null);
        return;
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';

      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = '';
        if (isObjectUrl) {
          URL.revokeObjectURL(url);
        }
      };

      // Safety timeout after 4 seconds
      timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 4000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(timeInSeconds, Math.max(0, (video.duration || 1) - 0.1));
      };

      video.onseeked = () => {
        try {
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(width, 1280);
          canvas.height = Math.round((canvas.width / width) * height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          cleanup();
          resolve(dataUrl);
        } catch (err) {
          console.warn('[VideoThumbnailService] Failed to draw canvas frame:', err);
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(null);
      };

      video.src = url;
    });
  }
}
