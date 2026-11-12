import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThumbnailService } from './ThumbnailService';
import { ICanvasSlide, IVideoSlide } from '@/core/types';

describe('ThumbnailService', () => {
    beforeEach(() => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            fillText: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            drawImage: vi.fn(),
            clearRect: vi.fn(),
        } as unknown as CanvasRenderingContext2D);

        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
            callback(new Blob(['mock-thumb'], { type: 'image/webp' }));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should define generate thumbnail helpers', () => {
        expect(ThumbnailService.generate).toBeDefined();
        expect(ThumbnailService.generateForSlide).toBeDefined();
    });

    it('should generate a thumbnail blob for a canvas slide', async () => {
        const mockSlide: ICanvasSlide = {
            id: 'slide-1',
            type: 'normal',
            order: 0,
            blockId: 'block-1',
            templateId: 'tpl-1',
            content: {
                variables: { title: 'Test Title' },
                canvasItems: []
            }
        };

        const blob = await ThumbnailService.generateForSlide(mockSlide, 128, 72);
        expect(blob).toBeDefined();
        expect(blob).toBeInstanceOf(Blob);
    });

    it('should generate a thumbnail blob for a video slide', async () => {
        const mockVideoSlide: IVideoSlide = {
            id: 'slide-2',
            type: 'video',
            order: 1,
            blockId: 'block-1',
            templateId: 'tpl-1',
            videoSettings: {
                mediaId: 'video-1',
                scaling: 'cover',
                strategy: 'auto',
                speed: 1,
                volume: 1,
                loop: true,
                muted: false
            }
        };

        const blob = await ThumbnailService.generateForSlide(mockVideoSlide, 128, 72);
        expect(blob).toBeDefined();
        expect(blob).toBeInstanceOf(Blob);
    });
});
