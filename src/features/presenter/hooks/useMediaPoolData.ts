import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { IMediaItem, MediaType, IMediaBin, MediaColorTag } from '@/core/types';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { IpcService } from '@/core/services/ipcService';

export type MediaSortOrder = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'type';

export interface UseMediaPoolDataReturn {
  bins: IMediaBin[];
  allBins: IMediaBin[];
  binPath: IMediaBin[];
  mediaItems: IMediaItem[];
  visibleItems: IMediaItem[];
  activeBin: IMediaBin | null;
  mediaTimes: Record<string, { current: number; duration: number }>;
  setMediaTimes: React.Dispatch<React.SetStateAction<Record<string, { current: number; duration: number }>>>;
}

/**
 * Hook to manage media pool data: bins, media items, nested folders, tag filtering, and duration preloading.
 */
export function useMediaPoolData(
  filter: MediaType | 'all',
  activeBinId: string | null,
  searchQuery: string = '',
  sortBy: MediaSortOrder = 'date-desc',
  tagFilter: MediaColorTag | 'all' = 'all'
): UseMediaPoolDataReturn {
  const [mediaTimes, setMediaTimes] = useState<Record<string, { current: number; duration: number }>>({});
  const mediaTimesRef = useRef(mediaTimes);
  mediaTimesRef.current = mediaTimes;

  const rawBins = useLiveQuery(() => db.mediaBins.orderBy('createdAt').toArray(), []);
  const allBins = useMemo(() => rawBins || [], [rawBins]);
  
  // Sub-bins: show root bins if activeBinId is null, or children of activeBinId
  const bins = useMemo(() => {
    if (activeBinId) {
      return allBins.filter(b => b.parentId === activeBinId);
    }
    return allBins.filter(b => !b.parentId);
  }, [allBins, activeBinId]);

  const activeBin = useMemo(() => {
    return activeBinId ? (allBins.find(b => b.id === activeBinId) ?? null) : null;
  }, [allBins, activeBinId]);

  // Compute full breadcrumb path from root to current bin
  const binPath = useMemo(() => {
    if (!activeBin) return [];
    const path: IMediaBin[] = [];
    let cur: IMediaBin | null = activeBin;
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      path.unshift(cur);
      const pid = cur.parentId;
      cur = pid ? (allBins.find(b => b.id === pid) ?? null) : null;
    }
    return path;
  }, [activeBin, allBins]);

  const mediaItems = useLiveQuery(
    async () => {
      const collection = filter === 'all'
        ? db.mediaPool.orderBy('createdAt').reverse()
        : db.mediaPool.where('type').equals(filter).reverse();
      
      const items = await collection.toArray();
      // Drop raw binary blobs from the in-memory array to save V8 heap and prevent memory bloat
      return items.map(({ data, ...item }) => item as IMediaItem);
    },
    [filter]
  ) || [];

  const rawVisible = activeBinId
    ? mediaItems.filter(i => i.binId === activeBinId)
    : mediaItems.filter(i => !i.binId);

  const visibleItems = useMemo(() => {
    let items = rawVisible;

    if (tagFilter !== 'all') {
      items = items.filter(i => i.colorTag === tagFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'date-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'name-asc':
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        case 'name-desc':
          return b.name.localeCompare(a.name, undefined, { numeric: true });
        case 'type':
          return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });
  }, [rawVisible, searchQuery, sortBy, tagFilter]);

  // File integrity check: Verify that local files still exist on disk (debounced and guarded)
  useEffect(() => {
    if (!IpcService.isElectron()) return;

    // Only check real filesystem paths (not hashes or blobs)
    const itemsToCheck = visibleItems.filter(i => 
      !i.data && 
      i.path && 
      (i.path.startsWith('/') || i.path.includes(':\\') || i.path.startsWith('local-resource:'))
    );

    if (itemsToCheck.length === 0) return;

    const checkTimer = setTimeout(async () => {
      for (const item of itemsToCheck) {
        try {
          const stats = await IpcService.invoke('get-file-stats', item.path);
          const isMissing = !stats;
          if (item.isMissing !== isMissing) {
            await db.mediaPool.update(item.id, { isMissing });
          }
        } catch {
          if (!item.isMissing) {
            await db.mediaPool.update(item.id, { isMissing: true });
          }
        }
      }
    }, 500);

    return () => clearTimeout(checkTimer);
  }, [visibleItems, activeBinId]);

  // Preload audio durations for audio items without stored duration using lightweight metadata loading (no PCM decode)
  useEffect(() => {
    const audioOnly = visibleItems.filter(i => 
      i.type === 'audio' && 
      !i.duration && 
      !mediaTimesRef.current[i.id] && 
      !i.isMissing &&
      i.path
    );

    if (audioOnly.length === 0) return;

    let isCancelled = false;

    for (const item of audioOnly) {
      const url = getLocalResourceUrl(item.path);
      if (!url) continue;

      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        audio.src = '';
        audio.load();
      };

      const onLoaded = () => {
        const dur = audio.duration;
        cleanup();
        if (isCancelled || !isFinite(dur) || dur <= 0) return;

        setMediaTimes(prev => ({
          ...prev,
          [item.id]: prev[item.id] ?? { current: 0, duration: dur }
        }));

        // Persist to IndexedDB so it never needs to be probed or loaded again
        db.mediaPool.update(item.id, { duration: Math.round(dur) }).catch(() => {});
      };

      const onError = () => {
        cleanup();
      };

      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
      audio.src = url;
    }

    return () => {
      isCancelled = true;
    };
  }, [visibleItems]);

  return {
    bins,
    allBins,
    binPath,
    mediaItems,
    visibleItems,
    activeBin,
    mediaTimes,
    setMediaTimes
  };
}
