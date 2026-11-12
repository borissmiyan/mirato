import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenCaptureService } from './ScreenCaptureService';

describe('ScreenCaptureService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('queries desktop sources via electron bridge if available', async () => {
        const mockSources = [
            { id: 'screen:0', name: 'Entire Screen', thumbnail: 'data:image/png;base64,123' },
            { id: 'window:1', name: 'Excel Sheet', thumbnail: 'data:image/png;base64,456' }
        ];

        (window as any).electron = {
            ipcRenderer: {
                getDesktopSources: vi.fn().mockResolvedValue(mockSources)
            }
        };

        const sources = await ScreenCaptureService.getSources();
        expect(sources).toHaveLength(2);
        expect(sources[0].name).toBe('Entire Screen');
        expect(sources[1].name).toBe('Excel Sheet');
    });

    it('returns empty array when electron bridge is not available', async () => {
        delete (window as any).electron;
        const sources = await ScreenCaptureService.getSources();
        expect(sources).toEqual([]);
    });

    it('stops all tracks when stopStream is called', () => {
        const mockStopVideo = vi.fn();
        const mockStopAudio = vi.fn();

        const mockStream = {
            getTracks: vi.fn().mockReturnValue([
                { stop: mockStopVideo, kind: 'video' },
                { stop: mockStopAudio, kind: 'audio' }
            ])
        } as unknown as MediaStream;

        ScreenCaptureService.stopStream(mockStream);
        expect(mockStopVideo).toHaveBeenCalledTimes(1);
        expect(mockStopAudio).toHaveBeenCalledTimes(1);
    });

    it('handles null or undefined stream gracefully in stopStream', () => {
        expect(() => ScreenCaptureService.stopStream(null)).not.toThrow();
        expect(() => ScreenCaptureService.stopStream(undefined)).not.toThrow();
    });

    it('deduplicates concurrent in-flight getSources requests', async () => {
        const mockFn = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 50)));
        (window as any).electron = {
            ipcRenderer: {
                getDesktopSources: mockFn
            }
        };

        const [res1, res2] = await Promise.all([
            ScreenCaptureService.getSources(),
            ScreenCaptureService.getSources()
        ]);

        expect(res1).toEqual([]);
        expect(res2).toEqual([]);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});
