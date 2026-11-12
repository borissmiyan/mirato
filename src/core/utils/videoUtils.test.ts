import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractPosterFrame } from './videoUtils';

describe('videoUtils', () => {
    describe('extractPosterFrame', () => {
        it('returns undefined when videoUrl is empty', async () => {
            const result = await extractPosterFrame('');
            expect(result).toBeUndefined();
        });

        it('returns undefined if video loading encounters an error', async () => {
            const mockVideo = {
                crossOrigin: '',
                muted: false,
                preload: '',
                src: '',
                addEventListener: vi.fn((event: string, callback: (...args: any[]) => void) => {
                    if (event === 'error') {
                        setTimeout(callback, 10);
                    }
                }),
                removeAttribute: vi.fn(),
                load: vi.fn()
            };

            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'video') return mockVideo as any;
                return document.createElement(tagName);
            });

            const result = await extractPosterFrame('invalid-video-url');
            expect(result).toBeUndefined();

            createElementSpy.mockRestore();
        });

        it('extracts data URL when video seeks and canvas captures frame', async () => {
            const mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue({
                    drawImage: vi.fn(),
                }),
                toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockposterdata')
            };

            const mockVideo = {
                crossOrigin: '',
                muted: false,
                preload: '',
                src: '',
                videoWidth: 1920,
                videoHeight: 1080,
                duration: 60,
                currentTime: 0,
                addEventListener: vi.fn((event: string, callback: (...args: any[]) => void) => {
                    if (event === 'loadedmetadata') {
                        setTimeout(() => {
                            callback();
                        }, 5);
                    }
                    if (event === 'seeked') {
                        setTimeout(() => {
                            callback();
                        }, 10);
                    }
                }),
                removeAttribute: vi.fn(),
                load: vi.fn()
            };

            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
                if (tagName === 'video') return mockVideo as any;
                if (tagName === 'canvas') return mockCanvas as any;
                return document.createElement(tagName);
            });

            const result = await extractPosterFrame('http://example.com/sample.mp4', 0.5, 640);
            expect(result).toBe('data:image/jpeg;base64,mockposterdata');
            expect(mockCanvas.width).toBe(640);
            expect(mockCanvas.height).toBe(360);

            createElementSpy.mockRestore();
        });
    });
});
