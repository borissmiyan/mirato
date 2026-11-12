import { db } from '@/core/db';
import { compressImageToWebP } from '@/core/utils/imageCompressor';
import { mediaCache } from '@/core/utils/mediaCache';
import { IpcService } from '@/core/services/ipcService';
import { ErrorLoggingService } from './errorLoggingService';
import { ISlide, ITemplate } from '@/core/types';

export interface OptimizationStats {
    videosDeleted: number;
    orphansDeleted: number;
    imagesCompressed: number;
    audiosMigrated: number;
    bytesSaved: number;
}

export type OptimizationProgressCallback = (step: string, current: number, total: number) => void;

/**
 * Service to clean up unused assets, remove legacy video blobs,
 * downscale/convert existing images to 2K WebP, and compact storage.
 */
export class StorageOptimizationService {
    /**
     * Helper to recursively extract all media IDs from style layers (fills, backgrounds, strokes).
     */
    private static extractFromLayers(layers: unknown[] | undefined, set: Set<string>): void {
        if (!Array.isArray(layers)) return;
        for (const rawLayer of layers) {
            if (!rawLayer || typeof rawLayer !== 'object') continue;
            const layer = rawLayer as {
                image?: { id?: string; url?: string };
                video?: { id?: string; url?: string };
            };
            if (layer.image?.id) set.add(layer.image.id);
            if (layer.video?.id) set.add(layer.video.id);
            // In case url was used as the ID/hash directly
            if (layer.image?.url && !layer.image.url.startsWith('data:') && !layer.image.url.startsWith('blob:') && !layer.image.url.startsWith('http')) {
                set.add(layer.image.url);
            }
            if (layer.video?.url && !layer.video.url.startsWith('data:') && !layer.video.url.startsWith('blob:') && !layer.video.url.startsWith('http')) {
                set.add(layer.video.url);
            }
        }
    }

    /**
     * Scans all presentations, templates, hymns, services, and logos
     * to collect every media ID that is actively referenced by content.
     */
    static async collectReferencedMediaIds(): Promise<Set<string>> {
        const referencedIds = new Set<string>();

        // 1. Presentation Slides
        const presentations = await db.presentationFiles.toArray();
        for (const pres of presentations) {
            if (!pres.slides) continue;
            for (const slide of pres.slides) {
                type SlideInspectable = Partial<ISlide> & {
                    backgroundOverride?: unknown[];
                    background?: unknown[];
                    content?: { canvasItems?: Array<{ mediaId?: string; image?: { id?: string }; video?: { id?: string }; fills?: unknown[]; strokes?: unknown[]; text?: { textFills?: unknown[] } }> };
                    canvasItems?: Array<{ mediaId?: string; image?: { id?: string }; video?: { id?: string }; fills?: unknown[]; strokes?: unknown[]; text?: { textFills?: unknown[] } }>;
                    items?: Array<{ mediaId?: string; image?: { id?: string }; video?: { id?: string }; fills?: unknown[]; strokes?: unknown[]; text?: { textFills?: unknown[] } }>;
                    videoSettings?: { mediaId?: string };
                    audio?: { mediaId?: string };
                    audioScopes?: Array<{ fileId?: string }>;
                };
                const s = slide as SlideInspectable;
                // Background layers (both backgroundOverride and background)
                this.extractFromLayers(s.backgroundOverride, referencedIds);
                this.extractFromLayers(s.background, referencedIds);

                // Canvas items
                const canvasItems = s.content?.canvasItems || s.canvasItems || s.items;
                if (Array.isArray(canvasItems)) {
                    for (const item of canvasItems) {
                        if (!item) continue;
                        if (item.mediaId) referencedIds.add(item.mediaId);
                        if (item.image?.id) referencedIds.add(item.image.id);
                        if (item.video?.id) referencedIds.add(item.video.id);

                        // Crucial: fills and strokes arrays (photos on slides are stored in fills!)
                        this.extractFromLayers(item.fills, referencedIds);
                        this.extractFromLayers(item.strokes, referencedIds);

                        // Rich text fills
                        if (item.text?.textFills) {
                            this.extractFromLayers(item.text.textFills, referencedIds);
                        }
                    }
                }

                // Video settings
                if (s.videoSettings?.mediaId) {
                    referencedIds.add(s.videoSettings.mediaId);
                }

                // Attached audio
                if (s.audio?.mediaId) {
                    referencedIds.add(s.audio.mediaId);
                }

                // Slide-level audio scopes
                if (Array.isArray(s.audioScopes)) {
                    for (const scope of s.audioScopes) {
                        if (scope?.fileId) referencedIds.add(scope.fileId);
                    }
                }
            }
        }

        // 2. Templates
        const templates = await db.templates.toArray();
        for (const tmpl of templates) {
            if (tmpl.background) {
                this.extractFromLayers(tmpl.background, referencedIds);
            }
            const tmplRecord = tmpl as (ITemplate & {
                items?: Array<{ fills?: unknown[]; strokes?: unknown[] }>;
                content?: { canvasItems?: Array<{ fills?: unknown[]; strokes?: unknown[] }> };
            });
            const tmplItems = tmplRecord.items || tmplRecord.content?.canvasItems;
            if (Array.isArray(tmplItems)) {
                for (const item of tmplItems) {
                    StorageOptimizationService.extractFromLayers(item.fills, referencedIds);
                    StorageOptimizationService.extractFromLayers(item.strokes, referencedIds);
                }
            }
        }

        // 3. Hymn Themes
        const themes = await db.hymnThemes.toArray();
        for (const theme of themes) {
            if (theme.background) {
                this.extractFromLayers(theme.background, referencedIds);
            }
        }

        // 4. Logos
        const logos = await db.logos.toArray();
        for (const logo of logos) {
            if (logo.id) referencedIds.add(logo.id);
        }

        // 5. Audio Scopes (Presentation background audio)
        const audioScopes = await db.audioScopes.toArray();
        for (const scope of audioScopes) {
            if (scope.fileId) referencedIds.add(scope.fileId);
        }

        return referencedIds;
    }

    /**
     * Executes the full database cleanup and optimization pipeline:
     * 1. Purges all video blobs from mediaPool and backgrounds.
     * 2. Cleans up unreferenced orphaned backgrounds.
     * 3. Compresses all remaining image blobs into 2K WebP with alpha channel preserved.
     */
    static async optimizeDatabase(
        onProgress?: OptimizationProgressCallback
    ): Promise<OptimizationStats> {
        let videosDeleted = 0;
        let orphansDeleted = 0;
        let imagesCompressed = 0;
        let bytesSaved = 0;

        onProgress?.('Scanning referenced media...', 0, 100);
        const referencedMediaIds = await this.collectReferencedMediaIds();

        // ─── 1. Purge all videos ──────────────────────────────────────────
        onProgress?.('Purging video assets...', 10, 100);

        // Videos in mediaPool
        const allMediaItems = await db.mediaPool.toArray();
        const videoMediaIds: string[] = [];
        for (const item of allMediaItems) {
            if (item.type === 'video' || (item.data && item.data.type && item.data.type.startsWith('video/'))) {
                videoMediaIds.push(item.id);
                if (item.data?.size) bytesSaved += item.data.size;
            }
        }

        if (videoMediaIds.length > 0) {
            await db.mediaPool.bulkDelete(videoMediaIds);
            videosDeleted += videoMediaIds.length;
        }

        // Videos in backgrounds
        const allBackgrounds = await db.backgrounds.toArray();
        const videoBgIds: string[] = [];
        for (const bg of allBackgrounds) {
            if (
                bg.mimeType?.startsWith('video/') ||
                (bg.data && bg.data.type && bg.data.type.startsWith('video/')) ||
                videoMediaIds.includes(bg.id)
            ) {
                videoBgIds.push(bg.id);
                if (bg.data?.size) bytesSaved += bg.data.size;
            }
        }

        if (videoBgIds.length > 0) {
            await db.backgrounds.bulkDelete(videoBgIds);
            videosDeleted += videoBgIds.length;
        }

        // ─── 2. Clean Orphaned Backgrounds ────────────────────────────────
        onProgress?.('Removing orphaned backgrounds...', 30, 100);

        const remainingBgs = await db.backgrounds.toArray();
        const orphanBgIds: string[] = [];
        for (const bg of remainingBgs) {
            // If this background is neither referenced in presentations/templates nor in mediaPool
            const inPool = allMediaItems.some(m => m.id === bg.id);
            if (!referencedMediaIds.has(bg.id) && !inPool) {
                orphanBgIds.push(bg.id);
                if (bg.data?.size) bytesSaved += bg.data.size;
            }
        }

        if (orphanBgIds.length > 0) {
            await db.backgrounds.bulkDelete(orphanBgIds);
            orphansDeleted += orphanBgIds.length;
        }

        // ─── 3. Compress remaining images to WebP 2K ───────────────────────
        onProgress?.('Compressing images to WebP 2K...', 50, 100);

        // A. Compress mediaPool images
        const remainingMedia = await db.mediaPool.where('type').equals('image').toArray();
        let processedCount = 0;
        const totalImages = remainingMedia.length + remainingBgs.length;

        for (const item of remainingMedia) {
            if (item.data && item.data instanceof Blob) {
                const origSize = item.data.size;
                const origType = item.data.type;
                
                // Only compress if not already small WebP
                if (origType !== 'image/webp' || origSize > 300 * 1024) {
                    try {
                        const webpBlob = await compressImageToWebP(item.data, {
                            maxWidth: 2560,
                            maxHeight: 1440,
                            quality: 0.88
                        });

                        if (webpBlob.size < origSize) {
                            bytesSaved += (origSize - webpBlob.size);
                            await db.mediaPool.update(item.id, {
                                data: webpBlob
                            });
                            imagesCompressed++;
                        }
                    } catch (e) {
                        console.warn(`[StorageOptimizer] Failed to compress media item ${item.id}:`, e);
                    }
                }
            }
            processedCount++;
            onProgress?.(`Compressing image ${processedCount}/${totalImages}...`, 50 + Math.round((processedCount / totalImages) * 45), 100);
        }

        // B. Compress backgrounds table images
        const currentBgs = await db.backgrounds.toArray();
        for (const bg of currentBgs) {
            if (bg.data && bg.data instanceof Blob) {
                const origSize = bg.data.size;
                const origType = bg.mimeType || bg.data.type;

                if (origType !== 'image/webp' || origSize > 300 * 1024) {
                    try {
                        const webpBlob = await compressImageToWebP(bg.data, {
                            maxWidth: 2560,
                            maxHeight: 1440,
                            quality: 0.88
                        });

                        if (webpBlob.size < origSize) {
                            bytesSaved += (origSize - webpBlob.size);
                            await db.backgrounds.update(bg.id, {
                                data: webpBlob,
                                mimeType: 'image/webp'
                            });
                            imagesCompressed++;
                        }
                    } catch (e) {
                        console.warn(`[StorageOptimizer] Failed to compress background ${bg.id}:`, e);
                    }
                }
            }
            processedCount++;
            onProgress?.(`Compressing image ${processedCount}/${totalImages}...`, 50 + Math.round((processedCount / totalImages) * 45), 100);
        }

        // ─── 4. Migrate Audio Blobs to Disk in Electron ────────────────────
        onProgress?.('Optimizing audio assets...', 95, 100);
        let audiosMigrated = 0;
        if (IpcService.isElectron()) {
            const audioItems = await db.mediaPool.where('type').equals('audio').toArray();
            for (const item of audioItems) {
                if (item.data && item.data instanceof Blob) {
                    try {
                        const buffer = await item.data.arrayBuffer();
                        const ext = item.name ? (item.name.split('.').pop() || 'mp3').toLowerCase() : 'mp3';
                        const savedPath = await IpcService.invoke<string>('media:save-audio-blob', {
                            hash: item.id,
                            ext,
                            buffer
                        });

                        if (savedPath) {
                            bytesSaved += item.data.size;
                            await db.mediaPool.update(item.id, {
                                path: savedPath,
                                data: undefined
                            });
                            audiosMigrated++;
                        }
                    } catch (e) {
                        console.warn(`[StorageOptimizer] Failed to migrate audio item ${item.id} to disk:`, e);
                    }
                }
            }
        }

        // ─── 5. Rotate Error Logs (30 days retention) ─────────────────────
        onProgress?.('Rotating system logs...', 98, 100);
        try {
            await ErrorLoggingService.clearOldLogs(30);
        } catch (logErr) {
            console.warn('[StorageOptimizer] Failed to rotate error logs:', logErr);
        }

        // Clear in-memory media blob URLs cache so new compressed blobs are loaded
        mediaCache.clear();

        onProgress?.('Complete!', 100, 100);

        return {
            videosDeleted,
            orphansDeleted,
            imagesCompressed,
            audiosMigrated,
            bytesSaved
        };
    }
}
