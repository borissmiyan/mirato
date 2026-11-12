/**
 * Utility for compressing images to WebP with 2K maximum bounding box,
 * preserving transparency (alpha channel) for overlays and logos.
 */

export interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

const DEFAULT_MAX_WIDTH = 3840; // 4K UHD max width
const DEFAULT_MAX_HEIGHT = 2160; // 4K UHD max height
const DEFAULT_QUALITY = 0.94;

/**
 * Compresses an image Blob/File to WebP format.
 * Automatically downscales if dimensions exceed maxWidth/maxHeight.
 * Preserves alpha channel (transparency).
 * Returns the original blob if it's already SVG or an error occurs.
 */
export async function compressImageToWebP(
    blob: Blob,
    options: CompressOptions = {}
): Promise<Blob> {
    // If not an image, or is SVG, don't touch it
    if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') {
        return blob;
    }

    const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
    const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
    const quality = options.quality ?? DEFAULT_QUALITY;

    // Skip compression in test/Node environments without real canvas rendering
    if (import.meta.env?.MODE === 'test') {
        return blob;
    }

    try {
        let bitmap: ImageBitmap | null = null;

        if (typeof createImageBitmap === 'function') {
            try {
                bitmap = await createImageBitmap(blob);
            } catch {
                bitmap = null;
            }
        }

        let origWidth: number;
        let origHeight: number;
        let imageElement: HTMLImageElement | null = null;

        if (bitmap) {
            origWidth = bitmap.width;
            origHeight = bitmap.height;
        } else if (typeof Image !== 'undefined') {
            // Fallback for environments without createImageBitmap with a strict 1s timeout
            imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Image load timeout')), 1000);
                const img = new Image();
                const url = URL.createObjectURL(blob);
                img.onload = () => {
                    clearTimeout(timer);
                    URL.revokeObjectURL(url);
                    resolve(img);
                };
                img.onerror = (e) => {
                    clearTimeout(timer);
                    URL.revokeObjectURL(url);
                    reject(e);
                };
                img.src = url;
            });
            origWidth = imageElement.naturalWidth || imageElement.width;
            origHeight = imageElement.naturalHeight || imageElement.height;
        } else {
            return blob;
        }

        if (!origWidth || !origHeight) {
            return blob;
        }

        // Calculate proportional scale
        let targetWidth = origWidth;
        let targetHeight = origHeight;

        if (targetWidth > maxWidth || targetHeight > maxHeight) {
            const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
            targetWidth = Math.round(targetWidth * ratio);
            targetHeight = Math.round(targetHeight * ratio);
        }

        // If it's already WebP and doesn't need downscaling, return original if small enough
        if (blob.type === 'image/webp' && targetWidth === origWidth && targetHeight === origHeight && blob.size < 500 * 1024) {
            if (bitmap) bitmap.close();
            return blob;
        }

        // Use OffscreenCanvas if available, otherwise DOM canvas
        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(targetWidth, targetHeight);
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) {
                if (bitmap) bitmap.close();
                return blob;
            }

            // High-quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (bitmap) {
                ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
                bitmap.close();
            } else if (imageElement) {
                ctx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
            }

            const webpBlob = await canvas.convertToBlob({
                type: 'image/webp',
                quality
            });

            // Return compressed blob only if valid and reasonably sized
            if (webpBlob && webpBlob.size > 0) {
                return webpBlob;
            }
        } else if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) {
                if (bitmap) bitmap.close();
                return blob;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (bitmap) {
                ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
                bitmap.close();
            } else if (imageElement) {
                ctx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
            }

            const webpBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/webp', quality);
            });

            if (webpBlob && webpBlob.size > 0) {
                return webpBlob;
            }
        }

        if (bitmap) bitmap.close();
        return blob;
    } catch (err) {
        console.warn('[imageCompressor] Failed to compress image to WebP, falling back to original:', err);
        return blob;
    }
}
