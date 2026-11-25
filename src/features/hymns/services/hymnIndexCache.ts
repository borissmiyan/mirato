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

type Listener = () => void;

let cachedEntries: IndexedHymnEntry[] | null = null;
let inFlightPromise: Promise<IndexedHymnEntry[]> | null = null;
let cacheVersion = 0;
const listeners = new Set<Listener>();

const notifyListeners = () => {
    for (const listener of listeners) {
        listener();
    }
};

/**
 * Invalidates the in-memory hymn index so the next read rebuilds from Dexie.
 * Call after hymnal sync, import, or removal.
 */
export function invalidateHymnIndexCache(): void {
    cacheVersion += 1;
    cachedEntries = null;
    inFlightPromise = null;
    notifyListeners();
}

/**
 * Streams all hymn records from IndexedDB one-by-one via cursor (low peak RAM for 2-4 GB PCs),
 * extracting only lightweight metadata & searchable lyric strings (~2-3 MB total for 5,293 hymns
 * instead of ~80 MB of full slide objects).
 */
export function ensureHymnIndexLoaded(): Promise<IndexedHymnEntry[]> {
    if (cachedEntries) {
        return Promise.resolve(cachedEntries);
    }
    if (inFlightPromise) {
        return inFlightPromise;
    }

    const startVersion = cacheVersion;
    inFlightPromise = (async () => {
        const entries: IndexedHymnEntry[] = [];
        try {
            const query = typeof db.presentationFiles.where === 'function'
                ? db.presentationFiles.where('hymnalId').notEqual('')
                : null;

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
            inFlightPromise = null;
            notifyListeners();
        }
        return entries;
    })();

    return inFlightPromise;
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
        if (enabled && !cachedEntries) {
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
