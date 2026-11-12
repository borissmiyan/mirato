/**
 * Video utility functions for extracting poster frames and managing video media.
 */

/**
 * Extracts a frame from a video URL as a compact JPEG data URL.
 * @param videoUrl - The source URL or blob URL of the video.
 * @param time - The timestamp in seconds from which to capture the frame (defaults to 0.5s).
 * @param maxWidth - The maximum width of the output image thumbnail.
 */
export async function extractPosterFrame(
    videoUrl: string,
    time: number = 0.5,
    maxWidth: number = 640
): Promise<string | undefined> {
    if (!videoUrl) return undefined;
    if (typeof document === 'undefined') return undefined;

    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';

        let isResolved = false;
        const done = (result?: string) => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timer);
            video.removeAttribute('src');
            try {
                video.load();
            } catch (_) {}
            resolve(result);
        };

        const captureFrame = (): string | undefined => {
            try {
                let w = video.videoWidth || 640;
                let h = video.videoHeight || 360;
                if (w > maxWidth) {
                    h = Math.round(h * (maxWidth / w));
                    w = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, w, h);
                    return canvas.toDataURL('image/jpeg', 0.8);
                }
            } catch {
                // Ignore canvas errors
            }
            return undefined;
        };

        const timer = setTimeout(() => {
            if (video.readyState >= 2) {
                done(captureFrame());
            } else {
                done(undefined);
            }
        }, 5000);

        video.addEventListener('loadedmetadata', () => {
            const duration = (isFinite(video.duration) && video.duration > 0) ? video.duration : 1;
            const seekTime = Math.min(time, Math.max(0.05, duration - 0.1));
            video.currentTime = seekTime;
        }, { once: true });

        video.addEventListener('seeked', () => {
            done(captureFrame());
        }, { once: true });

        video.addEventListener('error', () => {
            done(undefined);
        }, { once: true });

        video.src = videoUrl;
    });
}
