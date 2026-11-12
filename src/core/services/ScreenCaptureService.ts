export interface DesktopCaptureSource {
    id: string;
    name: string;
    thumbnail: string;
    appIcon?: string | null;
}

export class ScreenCaptureService {
    private static inFlightSourcesPromise: Promise<DesktopCaptureSource[]> | null = null;

    /**
     * Retrieves available screens and windows from Electron desktopCapturer.
     * Deduplicates concurrent in-flight requests to avoid DesktopMediaListCaptureThread crashes.
     */
    static async getSources(): Promise<DesktopCaptureSource[]> {
        if (ScreenCaptureService.inFlightSourcesPromise) {
            return ScreenCaptureService.inFlightSourcesPromise;
        }

        const fetchSources = async (): Promise<DesktopCaptureSource[]> => {
            try {
                if (window.electron?.ipcRenderer?.getDesktopSources) {
                    return await window.electron.ipcRenderer.getDesktopSources({
                        types: ['window', 'screen'],
                        thumbnailSize: { width: 320, height: 180 },
                        fetchWindowIcons: false
                    });
                }
                return [];
            } catch (error) {
                console.error('[ScreenCaptureService] Failed to retrieve sources:', error);
                return [];
            }
        };

        const task = fetchSources().finally(() => {
            ScreenCaptureService.inFlightSourcesPromise = null;
        });

        ScreenCaptureService.inFlightSourcesPromise = task;
        return task;
    }

    /**
     * Acquires a MediaStream for the specified sourceId, or opens the native system picker.
     */
    static async startCapture(sourceId?: string): Promise<MediaStream> {
        // If Electron source ID is specified
        const mediaDevices = navigator.mediaDevices as MediaDevices & { getUserMedia?: (constraints: unknown) => Promise<MediaStream> };
        if (sourceId && mediaDevices.getUserMedia) {
            try {
                // First try capturing with desktop stereo audio
                const stream = await mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop'
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                            minWidth: 1280,
                            maxWidth: 3840,
                            minHeight: 720,
                            maxHeight: 2160,
                            maxFrameRate: 60
                        }
                    }
                });
                return stream;
            } catch {
                try {
                    // Fallback to video-only if audio capture is not permitted by the OS/window
                    const stream = await mediaDevices.getUserMedia({
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: sourceId,
                                minWidth: 1280,
                                maxWidth: 3840,
                                minHeight: 720,
                                maxHeight: 2160,
                                maxFrameRate: 60
                            }
                        }
                    });
                    return stream;
                } catch (err) {
                    console.warn('[ScreenCaptureService] getUserMedia failed for sourceId, falling back to getDisplayMedia:', err);
                }
            }
        }

        // Web / Standard Display Media Fallback
        if (navigator.mediaDevices?.getDisplayMedia) {
            return await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 60, max: 60 },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            });
        }

        throw new Error('Screen capture is not supported in this environment');
    }

    /**
     * Safely stops all media tracks in a MediaStream to prevent resource leaks.
     */
    static stopStream(stream?: MediaStream | null): void {
        if (!stream) return;
        try {
            const tracks = stream.getTracks();
            for (const track of tracks) {
                track.stop();
            }
        } catch (err) {
            console.error('[ScreenCaptureService] Error stopping stream tracks:', err);
        }
    }
}
