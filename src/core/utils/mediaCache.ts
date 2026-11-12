import { db } from '../db';

export interface MediaUrlOptions {
    resolution?: 'full' | 'half' | 'quarter';
    isProjector?: boolean;
    mediaType?: 'video' | 'image' | 'audio';
}

/**
 * Global LRU cache for media ObjectURLs to avoid redundant blob loads 
 * and URL creations while preventing memory leaks.
 */
class MediaCache {
    private static readonly MAX_ENTRIES = 120;
    private urlCache = new Map<string, { url: string; count: number }>();
    private mediaTypeCache = new Map<string, 'video' | 'image' | 'audio'>();
    private generatingProxies = new Set<string>();

    /**
     * Gets or creates an ObjectURL for a given media ID from the backgrounds or mediaPool table.
     * Optionally serves or lazily generates a 540p video proxy for non-projector preview modes.
     */
    async getBackgroundUrl(mediaId: string | undefined, options?: MediaUrlOptions): Promise<string | null> {
        if (!mediaId) return null;

        const explicitType = options?.mediaType;
        const cachedType = this.mediaTypeCache.get(mediaId);
        const resolvedType = explicitType || cachedType;

        // CRITICAL: Proxies are strictly and exclusively for heavy video files to reduce decoding load.
        // Never allow, generate, or serve a video proxy for static images!
        const isImage = resolvedType === 'image';
        const hasCachedProxy = this.urlCache.has(`${mediaId}_proxy`);
        const isVideo = resolvedType === 'video' || (!isImage && hasCachedProxy);
        const isResolutionReduced = options?.resolution === 'half' || options?.resolution === 'quarter';
        const isProxyAllowed = !isImage && (isVideo || hasCachedProxy) && !options?.isProjector && isResolutionReduced;
        const proxyKey = `${mediaId}_proxy`;

        if (isProxyAllowed) {
            const cachedProxy = this.urlCache.get(proxyKey);
            if (cachedProxy) {
                cachedProxy.count++;
                this.urlCache.delete(proxyKey);
                this.urlCache.set(proxyKey, cachedProxy);
                return cachedProxy.url;
            }
        }
        
        const cached = this.urlCache.get(mediaId);
        if (cached) {
            cached.count++;
            // Refresh LRU order (move to MRU)
            this.urlCache.delete(mediaId);
            this.urlCache.set(mediaId, cached);

            if (isProxyAllowed && isVideo && !this.generatingProxies.has(mediaId)) {
                this.triggerProxyGeneration(mediaId);
            }

            return cached.url;
        }

        // REMOTE PROXY SUPPORT: If we are on a remote controller (mobile/browser),
        // route to the desktop media proxy.
        const isRemote = !window.electron?.ipcRenderer;
        if (isRemote) {
            const mediaProxyHost = `${window.location.protocol}//${window.location.hostname}:3211`;
            return `${mediaProxyHost}/media/${mediaId}`;
        }

        try {
            let entry: { data?: Blob; path?: string } | undefined = await db.backgrounds.get(mediaId);
            
            // Fallback: If not in backgrounds, check mediaPool
            if (!entry) {
                entry = await db.mediaPool.get(mediaId);
            }

            if (!entry) {
                // When running on receiver display, media may reside on the transmitter device.
                // Fetch via local media proxy which requests it over WebSocket from the transmitter.
                if (window.electron?.ipcRenderer?.remote?.getInfo) {
                    try {
                        const info = await window.electron.ipcRenderer.remote.getInfo();
                        if (info?.success) {
                            const port = info.port || 3211;
                            const host = window.location.hostname ? `${window.location.protocol}//${window.location.hostname}:${port}` : `http://127.0.0.1:${port}`;
                            const res = await fetch(`${host}/media/${mediaId}`);
                            if (res.ok) {
                                const blob = await res.blob();
                                if (blob && blob.size > 0) {
                                    try {
                                        await db.backgrounds.put({ 
                                            id: mediaId, 
                                            name: mediaId, 
                                            data: blob, 
                                            mimeType: blob.type || 'image/jpeg' 
                                        });
                                    } catch {}
                                    return this.put(mediaId, blob);
                                }
                            }
                        }
                    } catch {
                        // Silently fall through if proxy unreachable
                    }
                }
                return null;
            }

            type MediaEntry = { data?: Blob; path?: string; type?: string; mimeType?: string };
            const mEntry = entry as MediaEntry;
            const detectedIsVideo = mEntry.type === 'video' ||
                (mEntry.data && mEntry.data.type?.startsWith('video/')) ||
                (mEntry.mimeType && mEntry.mimeType.startsWith('video/')) ||
                (mEntry.path && /\.(mp4|mov|webm|mkv|m4v)$/i.test(mEntry.path));

            const detectedType: 'video' | 'image' = detectedIsVideo ? 'video' : 'image';
            this.mediaTypeCache.set(mediaId, detectedType);

            if (detectedIsVideo && !options?.isProjector && (options?.resolution === 'half' || options?.resolution === 'quarter')) {
                this.triggerProxyGeneration(mediaId);
            }

            if (entry.data) {
                return this.put(mediaId, entry.data);
            }

            if (entry.path) {
                if (window.electron?.ipcRenderer) {
                    return `local-resource://${encodeURI(entry.path)}`;
                }
                return entry.path;
            }

            return null;
        } catch (error) {
            console.error(`[MediaCache] Failed to load background ${mediaId}:`, error);
            return null;
        }
    }

    /**
     * Lazily triggers background proxy generation for a heavyweight video.
     */
    private async triggerProxyGeneration(mediaId: string): Promise<void> {
        if (this.generatingProxies.has(mediaId)) return;
        if (this.mediaTypeCache.get(mediaId) === 'image') return; // Strict guard: Never proxy images
        this.generatingProxies.add(mediaId);

        try {
            const { ffmpegService } = await import('../services/ffmpegService');
            const proxyBlob = await ffmpegService.generateProxyById(mediaId);
            if (proxyBlob) {
                this.put(`${mediaId}_proxy`, proxyBlob);
            }
        } catch (err) {
            console.warn(`[MediaCache] Background proxy generation failed for ${mediaId}:`, err);
        } finally {
            this.generatingProxies.delete(mediaId);
        }
    }

    /**
     * Injects a blob into the cache with LRU eviction.
     */
    put(mediaId: string, blob: Blob): string {
        if (blob?.type) {
            if (blob.type.startsWith('video/')) {
                this.mediaTypeCache.set(mediaId, 'video');
                if (mediaId.endsWith('_proxy')) {
                    const baseId = mediaId.slice(0, -'_proxy'.length);
                    if (this.mediaTypeCache.get(baseId) !== 'image') {
                        this.mediaTypeCache.set(baseId, 'video');
                    }
                }
            } else if (blob.type.startsWith('image/')) {
                this.mediaTypeCache.set(mediaId, 'image');
            } else if (blob.type.startsWith('audio/')) {
                this.mediaTypeCache.set(mediaId, 'audio');
            }
        }

        const existing = this.urlCache.get(mediaId);
        
        if (existing) {
            this.urlCache.delete(mediaId);
            this.urlCache.set(mediaId, existing);
            return existing.url;
        }

        // LRU Eviction when exceeding MAX_ENTRIES
        if (this.urlCache.size >= MediaCache.MAX_ENTRIES) {
            this.evictOldest();
        }

        const url = URL.createObjectURL(blob);
        this.urlCache.set(mediaId, { url, count: 1 });
        return url;
    }

    /**
     * Evicts the oldest item in the cache to free memory.
     */
    private evictOldest(): void {
        const firstKey = this.urlCache.keys().next().value;
        if (firstKey) {
            const entry = this.urlCache.get(firstKey);
            if (entry) {
                URL.revokeObjectURL(entry.url);
            }
            this.urlCache.delete(firstKey);
        }
    }

    /**
     * Notifies the cache that a component is done with a URL.
     */
    release(mediaId: string) {
        const cached = this.urlCache.get(mediaId);
        if (cached && cached.count > 0) {
            cached.count--;
        }
    }

    delete(mediaId: string) {
        const cached = this.urlCache.get(mediaId);
        if (cached) {
            URL.revokeObjectURL(cached.url);
            this.urlCache.delete(mediaId);
        }
        this.mediaTypeCache.delete(mediaId);
    }

    /**
     * Clear all cached URLs. Revokes all ObjectURLs to free browser heap.
     */
    clear() {
        this.urlCache.forEach(item => URL.revokeObjectURL(item.url));
        this.urlCache.clear();
        this.mediaTypeCache.clear();
        this.generatingProxies.clear();
    }
}

export const mediaCache = new MediaCache();
