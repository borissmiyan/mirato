import type JSZip from 'jszip';
import { ISlide } from '@/core/types';
import { ThumbnailService } from './ThumbnailService';

/**
 * Converts a Blob to a base64 Data URL for persistent storage in IndexedDB.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Packs lightweight WebP thumbnails for every slide into the .ektp archive.
 * Stored at thumbnails/<slideId>.webp with STORE compression for instant access.
 */
export async function packSlideThumbnails(zip: JSZip, slides: ISlide[]): Promise<void> {
    if (!slides || slides.length === 0) return;

    const thumbnailFolder = zip.folder('thumbnails');
    if (!thumbnailFolder) return;

    for (const slide of slides) {
        try {
            const blob = await ThumbnailService.generateForSlide(slide, 256, 144);
            if (blob) {
                thumbnailFolder.file(`${slide.id}.webp`, blob, { compression: 'STORE' });
            }
        } catch (err) {
            console.warn(`[ektpThumbnailHelpers] Failed to generate thumbnail for slide ${slide.id}:`, err);
        }
    }
}

/**
 * Unpacks pre-baked slide thumbnails from the .ektp archive into persistent base64 data URLs.
 * Enables instant timeline rendering (<50ms) without DOM re-computation.
 */
export async function unpackSlideThumbnails(zip: JSZip, slides: ISlide[]): Promise<void> {
    if (!slides || slides.length === 0) return;

    await Promise.all(
        slides.map(async (slide) => {
            try {
                const thumbFile = zip.file(`thumbnails/${slide.id}.webp`);
                if (thumbFile) {
                    const rawBlob = await thumbFile.async('blob');
                    if (rawBlob && rawBlob.size > 0) {
                        const webpBlob = new Blob([rawBlob], { type: 'image/webp' });
                        slide.thumbnailUrl = await blobToDataUrl(webpBlob);
                    }
                }
            } catch (err) {
                console.warn(`[ektpThumbnailHelpers] Failed to unpack thumbnail for slide ${slide.id}:`, err);
            }
        })
    );
}
