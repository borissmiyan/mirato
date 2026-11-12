import { useState, useEffect } from 'react';
import { IMediaItem } from '../types';
import { mediaCache } from '../utils/mediaCache';

/**
 * Robustly constructs a local-resource URL for a given path.
 * Handles absolute paths and ensures dummy 'localhost' host to avoid host-parsing traps.
 */
export const getLocalResourceUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('blob:') || path.startsWith('http') || path.startsWith('local-resource:')) return path;
    
    // Normalize slashes
    const cleanPath = path.replace(/\\/g, '/');
    const absolutePath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    
    // Encode parts but keep slashes
    const encodedPath = absolutePath.split('/').map(part => encodeURIComponent(part)).join('/');
    
    return `local-resource://localhost${encodedPath}`;
};

function computeInstantUrl(itemThumbnail?: string | null, itemPath?: string | null): string | null {
    if (itemThumbnail && (itemThumbnail.startsWith('http') || itemThumbnail.startsWith('data:') || itemThumbnail.startsWith('blob:') || itemThumbnail.startsWith('local-resource:'))) {
        return itemThumbnail;
    }
    if (itemPath && (itemPath.startsWith('/') || itemPath.includes(':\\') || itemPath.startsWith('local-resource:') || itemPath.startsWith('http'))) {
        return getLocalResourceUrl(itemPath);
    }
    return null;
}

/**
 * Hook to resolve a display URL for an IMediaItem with zero-copy priority:
 * 1. Pre-generated thumbnailUrl (instant)
 * 2. Static path on disk (wrapped in local-resource:// - streaming directly from disk without copying into RAM)
 * 3. LRU-cached ObjectURL from mediaCache (only if data blob exists exclusively in IndexedDB)
 */
export function useMediaUrl(item: IMediaItem | null | undefined) {
    const itemId = item?.id;
    const itemPath = item?.path;
    const itemThumbnail = item?.thumbnailUrl;

    const [url, setUrl] = useState<string | null>(() => computeInstantUrl(itemThumbnail, itemPath));

    useEffect(() => {
        let isCancelled = false;

        const instantUrl = computeInstantUrl(itemThumbnail, itemPath);
        if (instantUrl) {
            setUrl(instantUrl);
            return;
        }

        if (!itemId) {
            setUrl(null);
            return;
        }

        // Fallback: Resolve via mediaCache LRU pool
        mediaCache.getBackgroundUrl(itemId).then((resolved) => {
            if (!isCancelled) {
                setUrl(resolved);
            }
        }).catch((err) => {
            console.warn('useMediaUrl: Failed to resolve from cache:', err);
            if (!isCancelled) setUrl(null);
        });

        return () => {
            isCancelled = true;
            if (itemId) {
                mediaCache.release(itemId);
            }
        };
    }, [itemId, itemPath, itemThumbnail]);

    return url;
}
