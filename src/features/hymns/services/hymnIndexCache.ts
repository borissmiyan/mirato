import { useEffect, useState } from 'react';
import { db } from '@/core/db';
import { ICanvasSlide } from '@/core/types';

export interface IndexedHymnEntry {
    id: string;
    presentationId: string;
    hymnalId: string;
    number: string;
    order: number;
    title: string;
    titleLower: string;
    verseCount: number;
    rawTexts: string[];
    lowerTexts: string[];
}

interface PersistedHymnIndexSnapshot {
    count: number;
    entries: IndexedHymnEntry[];
}

const HYMN_INDEX_SNAPSHOT_KEY = 'hymn_index_snapshot_v1';

type Listener = () => void;

let cachedEntries: IndexedHymnEntry[] | null = null;
let inFlightPromise: Promise<IndexedHymnEntry[]> | null = null;
let cacheVersion = 0;
let isCacheStale = false;
const listeners = new Set<Listener>();

const notifyListeners = () => {
    for (const listener of listeners) {
        listener();
    }
};

/**
 * Invalidates the in-memory hymn index using stale-while-revalidate:
 * keeps existing `cachedEntries` visible to the UI (preventing a 3-5s blank list
 * in HymnPickerModal / HymnsBrowser) while triggering a seamless background rebuild
 * and refreshing the persisted IndexedDB snapshot.
 */
export function invalidateHymnIndexCache(): void {
    cacheVersion += 1;
    inFlightPromise = null;
    isCacheStale = true;
    if (listeners.size > 0) {
        void ensureHymnIndexLoaded(true);
    }
}

/**
 * Loads the lightweight hymn search index (~2-3 MB total for 5,293 hymns).
 * Fast path (~20 ms): reads the persisted single-record snapshot from `db.settings`
 * when its count matches the indexed hymn count in `db.presentationFiles`.
 * Slow path (first install / after hymnal update): streams via IndexedDB cursor and
 * persists the snapshot for instant subsequent launches.
 */
export function ensureHymnIndexLoaded(forceRefresh = false): Promise<IndexedHymnEntry[]> {
    if (cachedEntries && !isCacheStale && !forceRefresh) {
        return Promise.resolve(cachedEntries);
    }
    if (inFlightPromise && !forceRefresh) {
        return inFlightPromise;
    }

    const startVersion = cacheVersion;
    const promise = (async () => {
        const whereClause = typeof db.presentationFiles.where === 'function'
            ? db.presentationFiles.where('hymnalId')
            : null;
        const query = whereClause && typeof whereClause.notEqual === 'function'
            ? whereClause.notEqual('')
            : null;

        // Fast path: hydrate from single persisted snapshot record if hymn count matches
        if (
            !forceRefresh &&
            query &&
            typeof query.count === 'function' &&
            typeof db.settings?.get === 'function'
        ) {
            try {
                const [currentCount, setting] = await Promise.all([
                    query.count(),
                    db.settings.get(HYMN_INDEX_SNAPSHOT_KEY),
                ]);
                const snapshot = setting?.value as PersistedHymnIndexSnapshot | undefined;
                if (
                    snapshot &&
                    Array.isArray(snapshot.entries) &&
                    snapshot.count === currentCount &&
                    snapshot.entries.length === currentCount
                ) {
                    if (cacheVersion === startVersion) {
                        cachedEntries = snapshot.entries;
                        isCacheStale = false;
                        inFlightPromise = null;
                        notifyListeners();
                    }
                    return snapshot.entries;
                }
            } catch {
                // Fall through to full cursor rebuild if snapshot read fails
            }
        }

        const entries: IndexedHymnEntry[] = [];
        try {
            const processPres = (p: {
                id: string;
                name: string;
                hymnalId?: string;
                slides?: Array<{ type?: string; content?: { canvasItems?: Array<{ type?: string; text?: { content?: string } }> } }>;
                metadata?: { hymnOrder?: number; hymnTitle?: string };
            }) => {
                if (!p.hymnalId) return;
                const match = p.name.match(/^(\d+)\s*[—–-]\s*(.+)$/);
                const number = match ? match[1] : String(p.metadata?.hymnOrder ?? '');
                const title = match ? match[2] : (p.metadata?.hymnTitle ?? p.name);
                const rawTexts: string[] = [];
                const lowerTexts: string[] = [];
                if (p.slides) {
                    for (const slide of p.slides) {
                        const content = slide.type === 'normal' ? (slide as ICanvasSlide).content : undefined;
                        if (content?.canvasItems) {
                            for (const item of content.canvasItems) {
                                if (item.type === 'text' && item.text?.content) {
                                    rawTexts.push(item.text.content);
                                    lowerTexts.push(item.text.content.toLowerCase());
                                }
                            }
                        }
                    }
                }
                entries.push({
                    id: p.id,
                    presentationId: p.id,
                    hymnalId: p.hymnalId,
                    number,
                    order: p.metadata?.hymnOrder ?? 9999,
                    title,
                    titleLower: title.toLowerCase(),
                    verseCount: p.slides?.length ?? 0,
                    rawTexts,
                    lowerTexts,
                });
            };

            if (query && typeof query.each === 'function') {
                await query.each(processPres);
            } else {
                const all = await db.presentationFiles.toArray();
                for (const p of all) processPres(p);
            }
        } catch (err) {
            console.warn('[hymnIndexCache] Failed to build hymn index:', err);
        }

        if (cacheVersion === startVersion) {
            cachedEntries = entries;
            isCacheStale = false;
            inFlightPromise = null;
            notifyListeners();

            // Persist lightweight snapshot for instant (~20 ms) hydration on next launch
            if (entries.length > 0 && typeof db.settings?.put === 'function') {
                const snapshot: PersistedHymnIndexSnapshot = { count: entries.length, entries };
                db.settings.put({ key: HYMN_INDEX_SNAPSHOT_KEY, value: snapshot }).catch(() => { });
            }
        }
        return entries;
    })();
    inFlightPromise = promise;
    return promise;
}

/**
 * React hook providing instant access to the cached lightweight hymn index.
 * Returns `{ entries, isLoading }` with < 1ms reads once warmed.
 */
export function useHymnIndex(enabled = true): { entries: IndexedHymnEntry[]; isLoading: boolean } {
    const [, setTick] = useState(0);

    useEffect(() => {
        const listener = () => setTick((t) => t + 1);
        listeners.add(listener);
        if (enabled && (!cachedEntries || isCacheStale)) {
            void ensureHymnIndexLoaded();
        }
        return () => {
            listeners.delete(listener);
        };
    }, [enabled]);

    if (!enabled) {
        return { entries: [], isLoading: false };
    }

    return {
        entries: cachedEntries ?? [],
        isLoading: cachedEntries === null,
    };
}
