import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mediaCache } from './mediaCache';
import { db } from '../db';

describe('MediaCache', () => {
    beforeEach(() => {
        mediaCache.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        mediaCache.clear();
    });

    it('returns null when mediaId is undefined', async () => {
        const url = await mediaCache.getBackgroundUrl(undefined);
        expect(url).toBeNull();
    });

    it('returns cached url on second call without db query', async () => {
        const testBlob = new Blob(['mock video content'], { type: 'video/mp4' });
        const spy = vi.spyOn(db.backgrounds, 'get').mockResolvedValue({
            id: 'bg-1',
            name: 'bg-1.mp4',
            data: testBlob,
            mimeType: 'video/mp4'
        } as any);

        const url1 = await mediaCache.getBackgroundUrl('bg-1');
        expect(url1).toBeTruthy();
        expect(spy).toHaveBeenCalledTimes(1);

        // Second call should return cached without db.backgrounds.get being called again
        spy.mockClear();
        const url2 = await mediaCache.getBackgroundUrl('bg-1');
        expect(url2).toBe(url1);
        expect(spy).not.toHaveBeenCalled();
    });

    it('prefers proxy when isProxyAllowed and proxy is cached', async () => {
        const masterBlob = new Blob(['master video'], { type: 'video/mp4' });
        const proxyBlob = new Blob(['proxy video 540p'], { type: 'video/mp4' });

        mediaCache.put('video-1', masterBlob);
        mediaCache.put('video-1_proxy', proxyBlob);

        const proxyUrl = await mediaCache.getBackgroundUrl('video-1', {
            resolution: 'half',
            isProjector: false
        });
        const masterUrl = await mediaCache.getBackgroundUrl('video-1', {
            resolution: 'full',
            isProjector: true
        });

        expect(proxyUrl).toBeTruthy();
        expect(masterUrl).toBeTruthy();
        expect(proxyUrl).not.toBe(masterUrl);
    });

    it('serves master url when isProjector is true even if resolution is half', async () => {
        const masterBlob = new Blob(['master video'], { type: 'video/mp4' });
        const proxyBlob = new Blob(['proxy video 540p'], { type: 'video/mp4' });

        const masterUrl = mediaCache.put('video-2', masterBlob);
        mediaCache.put('video-2_proxy', proxyBlob);

        const url = await mediaCache.getBackgroundUrl('video-2', {
            resolution: 'half',
            isProjector: true
        });

        expect(url).toBe(masterUrl);
    });

    it('never serves proxy for images even if resolution is half and isProjector is false', async () => {
        const imageBlob = new Blob(['mock image data'], { type: 'image/jpeg' });
        const proxyBlob = new Blob(['unwanted proxy video'], { type: 'video/mp4' });

        const imageUrl = mediaCache.put('img-1', imageBlob);
        mediaCache.put('img-1_proxy', proxyBlob);

        const url = await mediaCache.getBackgroundUrl('img-1', {
            resolution: 'half',
            isProjector: false,
            mediaType: 'image'
        });

        // Must strictly return the image url, NEVER the proxy
        expect(url).toBe(imageUrl);
    });
});
