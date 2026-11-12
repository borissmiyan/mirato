import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import { packSlideThumbnails, unpackSlideThumbnails, blobToDataUrl } from './ektpThumbnailHelpers';
import { ICanvasSlide } from '@/core/types';
import { ThumbnailService } from './ThumbnailService';

describe('ektpThumbnailHelpers', () => {
    beforeEach(() => {
        vi.spyOn(ThumbnailService, 'generateForSlide').mockResolvedValue(
            new Blob(['mock-thumb-data'], { type: 'image/webp' })
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('blobToDataUrl converts Blob to data URL string', async () => {
        const blob = new Blob(['hello world'], { type: 'text/plain' });
        const dataUrl = await blobToDataUrl(blob);
        expect(dataUrl).toContain('data:text/plain;base64,');
    });

    it('packSlideThumbnails adds thumbnails to the zip', async () => {
        const zip = new JSZip();
        const slides: ICanvasSlide[] = [
            {
                id: 's-1',
                type: 'normal',
                order: 0,
                blockId: 'b-1',
                templateId: 't-1',
                content: { variables: {} }
            },
            {
                id: 's-2',
                type: 'normal',
                order: 1,
                blockId: 'b-1',
                templateId: 't-1',
                content: { variables: {} }
            }
        ];

        await packSlideThumbnails(zip, slides);

        expect(zip.file('thumbnails/s-1.webp')).not.toBeNull();
        expect(zip.file('thumbnails/s-2.webp')).not.toBeNull();
    });

    it('unpackSlideThumbnails extracts thumbnails from zip into slide.thumbnailUrl', async () => {
        const zip = new JSZip();
        zip.file('thumbnails/s-1.webp', new Blob(['fake-webp-bytes'], { type: 'image/webp' }));

        const slides: ICanvasSlide[] = [
            {
                id: 's-1',
                type: 'normal',
                order: 0,
                blockId: 'b-1',
                templateId: 't-1',
                content: { variables: {} }
            }
        ];

        await unpackSlideThumbnails(zip, slides);

        expect(slides[0].thumbnailUrl).toBeDefined();
        expect(slides[0].thumbnailUrl).toContain('data:image/webp;base64,');
    });
});

