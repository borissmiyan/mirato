import { db } from '@/core/db';
import { IMediaItem, MediaType } from '@/core/types';
import { readLocalFileSafe, sha256 } from './mediaPackingUtils';
import { mediaCache } from '@/core/utils/mediaCache';
import { compressImageToWebP } from '@/core/utils/imageCompressor';
import { IpcService } from '@/core/services/ipcService';
import { fontInstallerService } from '@/core/services/fontInstallerService';

/**
 * Service to handle Importing and Persisting media (images, videos, audio) 
 * into IndexedDB as Blobs or local files on disk.
 */
export class MediaPersistenceService {
    /**
     * Imports a media file from a local filesystem path.
     * 1. Reads the file as a Blob via IPC.
     * 2. Checks if a media item with the same content (hash) already exists.
     * 3. Saves to mediaPool (audio/video/image) or backgrounds (image).
     */
    static async importMediaFromPath(
        path: string, 
        type: MediaType, 
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<string | null> {
        if (!path) return null;

        // 1. Read the file
        const blob = await readLocalFileSafe(path);
        if (!blob) return null;

        return this.importMediaBlob(blob, path, type, options);
    }

    /**
     * Imports a Blob/File object directly into the database.
     * Automatically compresses images to WebP (2K max resolution).
     * For videos in Electron, persists to local disk to keep IndexedDB light.
     */
    static async importMediaBlob(
        blob: Blob,
        sourcePath: string | null,
        type: MediaType,
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<string | null> {
        let processedBlob = blob;

        // Auto-compress images to 2K WebP with alpha transparency preservation
        if (type === 'image' && blob.type !== 'image/svg+xml') {
            try {
                processedBlob = await compressImageToWebP(blob, {
                    maxWidth: 3840,
                    maxHeight: 2160,
                    quality: 0.94
                });
            } catch (err) {
                console.warn('[MediaPersistenceService] Image compression fallback to original:', err);
            }
        }

        // 1. Hash the blob
        const hash = await sha256(processedBlob);
        const name = sourcePath ? (sourcePath.split(/[/\\]/).pop() || 'media') : 'Imported Media';

        let resolvedPath = sourcePath || hash;
        let blobToStore: Blob | undefined = processedBlob;

        // If it is a video and we are running in Electron, persist to disk instead of IndexedDB Blob
        if (type === 'video' && IpcService.isElectron()) {
            try {
                const ext = sourcePath ? (sourcePath.split('.').pop() || 'mp4') : 'mp4';
                const savedPath = await IpcService.invoke<string>('media:save-video-blob', {
                    hash,
                    ext,
                    buffer: await processedBlob.arrayBuffer()
                });
                if (savedPath) {
                    resolvedPath = savedPath;
                    blobToStore = undefined; // Keep IndexedDB free of large video Blobs
                }
            } catch (err) {
                console.warn('[MediaPersistenceService] Failed to persist video to disk, keeping blob in DB:', err);
            }
        }

        // If it is audio and we are running in Electron, compress/persist to disk instead of IndexedDB Blob
        if (type === 'audio' && IpcService.isElectron()) {
            try {
                const audioBuffer = await processedBlob.arrayBuffer();
                const cleanExt = sourcePath ? (sourcePath.split('.').pop() || 'mp3').toLowerCase() : 'mp3';

                let savedPath = await IpcService.invoke<string>('media:save-audio-blob', {
                    hash,
                    ext: cleanExt,
                    buffer: audioBuffer
                });

                // Attempt hardware AAC compression on macOS if original is heavy (wav, flac, aiff, etc.)
                if (savedPath && ['wav', 'aiff', 'flac', 'ogg'].includes(cleanExt)) {
                    try {
                        const compressResult = await IpcService.invoke<{ success: boolean; outputPath: string }>('media:compress-audio', {
                            inputPath: savedPath,
                            bitrate: '160000'
                        });
                        if (compressResult?.success && compressResult.outputPath) {
                            await IpcService.invoke('media:delete-audio-file', savedPath);
                            savedPath = compressResult.outputPath;
                        }
                    } catch (compErr) {
                        console.warn('[MediaPersistenceService] Audio compression fallback to original:', compErr);
                    }
                }

                if (savedPath) {
                    resolvedPath = savedPath;
                    blobToStore = undefined; // Keep IndexedDB free of large audio Blobs
                }
            } catch (err) {
                console.warn('[MediaPersistenceService] Failed to persist audio to disk, keeping blob in DB:', err);
            }
        }

        // 2. Check for existing item with this hash in mediaPool
        const existing = await db.mediaPool.get(hash);
        
        if (existing) {
            if (options.binId !== undefined && existing.binId !== options.binId) {
                await db.mediaPool.update(hash, { binId: options.binId });
            }
            if (existing.data || existing.path) {
                if (blobToStore) mediaCache.put(hash, blobToStore);
                return existing.id;
            }
        }

        const id = hash;

        // 3. Save to backgrounds table if requested (images only)
        if (options.forceBackground && type === 'image') {
            const existingBg = await db.backgrounds.get(id);
            if (!existingBg) {
                await db.backgrounds.add({
                    id,
                    name,
                    data: processedBlob,
                    mimeType: processedBlob.type
                });
            }
        }

        // 4. Save to mediaPool
        if (!existing) {
            if (sourcePath) {
                const legacyPlaceholders = await db.mediaPool
                    .where('path')
                    .equals(sourcePath)
                    .filter(m => !m.data && m.id !== id)
                    .toArray();
                
                if (legacyPlaceholders.length > 0) {
                    await Promise.all(legacyPlaceholders.map(lp => db.mediaPool.delete(lp.id)));
                }
            }

            await db.mediaPool.add({
                id,
                name,
                path: resolvedPath,
                type,
                data: blobToStore,
                binId: options.binId,
                createdAt: Date.now()
            });
        } else if (!existing.data && blobToStore) {
            await db.mediaPool.update(hash, {
                data: blobToStore,
                path: resolvedPath || existing.path,
                binId: options.binId ?? existing.binId
            });
        }

        if (blobToStore) {
            mediaCache.put(id, blobToStore);
        }

        if (type === 'font' && processedBlob) {
            const fontFam = name.replace(/\.[^/.]+$/, '');
            fontInstallerService.registerFontFace(fontFam, processedBlob).catch(() => {});
            fontInstallerService.installFontToSystem(name, processedBlob, fontFam).catch(() => {});
        }

        return id;
    }

    /**
     * Synchronously deletes an asset from both mediaPool and backgrounds tables.
     */
    static async deleteMedia(id: string): Promise<void> {
        const item = await db.mediaPool.get(id);
        await db.transaction('rw', [db.mediaPool, db.backgrounds], async () => {
            await db.mediaPool.delete(id);
            await db.backgrounds.delete(id);
        });
        mediaCache.delete(id);

        // If it was a video or audio stored on disk in userData/media/*, delete file
        if (item?.path && IpcService.isElectron()) {
            if (item.type === 'video') {
                try {
                    await IpcService.invoke('media:delete-video-file', item.path);
                } catch (err) {
                    console.warn('[MediaPersistenceService] Failed to remove video file from disk:', err);
                }
            } else if (item.type === 'audio') {
                try {
                    await IpcService.invoke('media:delete-audio-file', item.path);
                } catch (err) {
                    console.warn('[MediaPersistenceService] Failed to remove audio file from disk:', err);
                }
            }
        }
    }

    /**
     * Synchronously bulk-deletes assets from both mediaPool and backgrounds tables.
     */
    static async bulkDeleteMedia(ids: string[]): Promise<void> {
        const items = await db.mediaPool.bulkGet(ids);
        await db.transaction('rw', [db.mediaPool, db.backgrounds], async () => {
            await db.mediaPool.bulkDelete(ids);
            await db.backgrounds.bulkDelete(ids);
        });
        ids.forEach(id => mediaCache.delete(id));

        if (IpcService.isElectron()) {
            for (const item of items) {
                if (item?.path) {
                    if (item.type === 'video') {
                        try {
                            await IpcService.invoke('media:delete-video-file', item.path);
                        } catch (err) {
                            console.warn('[MediaPersistenceService] Failed to remove video file from disk:', err);
                        }
                    } else if (item.type === 'audio') {
                        try {
                            await IpcService.invoke('media:delete-audio-file', item.path);
                        } catch (err) {
                            console.warn('[MediaPersistenceService] Failed to remove audio file from disk:', err);
                        }
                    }
                }
            }
        }
    }

    /**
     * Imports a batch of media files efficiently.
     * Uses a concurrency limit to prevent overwhelming the browser/system.
     */
    static async importMediaBatch(
        items: { file?: File | Blob; path?: string; type: MediaType }[],
        options: { forceBackground?: boolean; binId?: string } = {}
    ): Promise<(string | null)[]> {
        const CONCURRENCY = 4;
        const results: (string | null)[] = Array(items.length).fill(null);
        const queue = items.map((item, index) => ({ item, index }));
        
        const workers = Array(Math.min(CONCURRENCY, items.length)).fill(null).map(async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) break;

                const { item, index } = task;
                try {
                    let id: string | null = null;
                    if (item.file) {
                        id = await this.importMediaBlob(item.file, item.path || null, item.type, options);
                    } else if (item.path) {
                        id = await this.importMediaFromPath(item.path, item.type, options);
                    }
                    results[index] = id;
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`[MediaPersistenceService] Batch item ${index} failed:`, errMsg);
                }
            }
        });

        await Promise.all(workers);
        
        return results;
    }

    /**
     * Ensures that a given IMediaItem has its binary data in the DB.
     * If data is missing but path is present, it attempts an import.
     */
    static async ensureMediaInDb(item: IMediaItem): Promise<string> {
        if (item.data) return item.id;

        // Check if it's already in DB by ID
        const dbItem = await db.mediaPool.get(item.id);
        if (dbItem?.data) return dbItem.id;

        // Try to import from path if it's a local file
        if (item.path && (item.path.startsWith('/') || item.path.includes(':\\') || item.path.startsWith('local-resource:'))) {
            const newId = await this.importMediaFromPath(item.path, item.type, { binId: item.binId });
            
            // If we've successfully imported and got a different ID (hash vs UUID), 
            // cleanup the placeholder UUID entry to prevent duplicates in the UI.
            if (newId && newId !== item.id) {
                try {
                    await db.mediaPool.delete(item.id);
                } catch (e) {
                    console.warn(`[MediaPersistenceService] Failed to cleanup placeholder: ${item.id}`, e);
                }
                return newId;
            }
            
            if (newId) return newId;
        }

        return item.id;
    }
}
