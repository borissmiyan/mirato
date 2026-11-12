import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { db } from '../db';
import { IpcService } from './ipcService';

class FFmpegService {
    private ffmpeg: FFmpeg | null = null;
    private isLoaded = false;
    private loadPromise: Promise<void> | null = null;
    public isSupported = true; // Assume true, fallback handled gently if SAB fails

    async load() {
        if (this.isLoaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                this.ffmpeg = new FFmpeg();
                
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                this.isLoaded = true;
            } catch (error) {
                console.error('[FFmpegService] Failed to load FFmpeg.wasm:', error);
                this.isSupported = false;
                throw error;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Lossless trim of a media file via stream copy.
     */
    async trimMedia(blob: Blob, start: number, end: number, extension = 'mp4'): Promise<Blob> {
        await this.load();
        if (!this.ffmpeg) throw new Error("FFmpeg not loaded.");

        const inputName = `input.${extension}`;
        const outputName = `output.${extension}`;

        // Write file
        await this.ffmpeg.writeFile(inputName, await fetchFile(blob));

        // Execute trim command (stream copy)
        // -ss start
        // -to end
        // -c copy
        await this.ffmpeg.exec([
            '-i', inputName,
            '-ss', String(start),
            '-to', String(end),
            '-c', 'copy',
            outputName
        ]);

        // Read resulting file
        const data = await this.ffmpeg.readFile(outputName);
        
        // Clean up memory
        await this.ffmpeg.deleteFile(inputName);
        await this.ffmpeg.deleteFile(outputName);

        const mimeType = blob.type || `video/${extension}`;
        return new Blob([data as Uint8Array], { type: mimeType });
    }

    /**
     * Trims a media item from the database or local disk and returns a new Blob
     */
    async trimMediaById(mediaId: string, start: number, end: number): Promise<Blob | null> {
        type TrimMediaEntry = { type?: string; data?: Blob; path?: string; name?: string };
        let entry: TrimMediaEntry | undefined = (await db.backgrounds.get(mediaId)) as TrimMediaEntry | undefined;
        if (!entry) {
            entry = (await db.mediaPool.get(mediaId)) as TrimMediaEntry | undefined;
        }

        if (!entry) return null;

        const isAudio = entry.type === 'audio' || (entry.data && entry.data.type?.startsWith('audio/'));

        // Native Electron Hardware Trimming (Offline, instant 0.1s stream copy)
        if (IpcService.isElectron() && entry.path) {
            try {
                const res = await IpcService.invoke<{ success: boolean; buffer: ArrayBuffer; outputPath: string }>('media:trim', {
                    inputPath: entry.path,
                    start,
                    end,
                    type: isAudio ? 'audio' : 'video'
                });

                if (res?.success && res.buffer) {
                    const mimeType = isAudio ? 'audio/mp4' : 'video/mp4';
                    return new Blob([res.buffer], { type: mimeType });
                }
            } catch (nativeErr) {
                console.warn('[FFmpegService] Native trim failed, falling back to wasm:', nativeErr);
            }
        }

        if (!entry.data) return null;

        const blob = entry.data as Blob;
        // Basic detection of extension
        const extMatch = entry.name ? entry.name.match(/\.([a-z0-9]+)$/i) : null;
        let ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
        
        // Ensure webm goes to webm, etc
        if (blob.type.includes('webm')) ext = 'webm';
        else if (blob.type.includes('mp3')) ext = 'mp3';
        else if (blob.type.includes('wav')) ext = 'wav';

        return this.trimMedia(blob, start, end, ext);
    }

    /**
     * Transcodes a video blob to a lightweight 540p proxy (~1.2 Mbps, ultrafast preset).
     */
    async generateProxy(blob: Blob, extension = 'mp4'): Promise<Blob> {
        await this.load();
        if (!this.ffmpeg) throw new Error("FFmpeg not loaded.");

        const inputName = `proxy_in.${extension}`;
        const outputName = `proxy_out.mp4`;

        await this.ffmpeg.writeFile(inputName, await fetchFile(blob));

        // -vf scale=-2:540 (aspect ratio preserved, height 540, even width)
        // -c:v libx264 -preset ultrafast -b:v 1200k
        // -c:a copy
        await this.ffmpeg.exec([
            '-i', inputName,
            '-vf', 'scale=-2:540',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-b:v', '1200k',
            '-c:a', 'copy',
            outputName
        ]);

        const data = await this.ffmpeg.readFile(outputName);

        await this.ffmpeg.deleteFile(inputName);
        await this.ffmpeg.deleteFile(outputName);

        return new Blob([data as Uint8Array], { type: 'video/mp4' });
    }

    /**
     * Generates a 540p proxy for a media item from the database or disk.
     */
    async generateProxyById(mediaId: string): Promise<Blob | null> {
        type MediaEntry = { type?: string; data?: Blob; path?: string; name?: string };
        let entry: MediaEntry | undefined = (await db.backgrounds.get(mediaId)) as MediaEntry | undefined;
        if (!entry) {
            entry = (await db.mediaPool.get(mediaId)) as MediaEntry | undefined;
        }

        if (!entry) return null;

        const isVideo = entry.type === 'video' ||
            (entry.data && entry.data.type?.startsWith('video/')) ||
            (entry.path && /\.(mp4|mov|webm|mkv|m4v)$/i.test(entry.path));

        if (!isVideo) {
            return null; // Strict guard: Never transcode non-video media into an MP4 proxy
        }

        // Native Electron Hardware Transcode if available
        if (IpcService.isElectron() && entry.path) {
            try {
                const res = await IpcService.invoke<{ success: boolean; buffer: ArrayBuffer }>('media:proxy', {
                    inputPath: entry.path
                });
                if (res?.success && res.buffer) {
                    return new Blob([res.buffer], { type: 'video/mp4' });
                }
            } catch {
                // Fall back to WASM
            }
        }

        if (!entry.data) return null;

        const blob = entry.data as Blob;
        const extMatch = entry.name ? entry.name.match(/\.([a-z0-9]+)$/i) : null;
        let ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
        if (blob.type.includes('webm')) ext = 'webm';

        return this.generateProxy(blob, ext);
    }
}

export const ffmpegService = new FFmpegService();
