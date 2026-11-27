import { db } from './index';
import type { IPresentationFile } from '../types';

/**
 * Loads ONLY user (non-hymnal-library) presentations using indexed primaryKeys subtraction.
 * Avoids deserializing 5,000+ bundled hymn JSON blobs (~100 MB) from `db.presentationFiles`.
 * Gracefully falls back to `toArray()` in minimal unit-test Dexie mocks.
 */
export async function getUserPresentations(): Promise<IPresentationFile[]> {
    if (
        typeof db.presentationFiles.where === 'function' &&
        typeof db.presentationFiles.toCollection === 'function' &&
        typeof db.presentationFiles.bulkGet === 'function'
    ) {
        const [allKeys, hymnKeys] = await Promise.all([
            db.presentationFiles.toCollection().primaryKeys(),
            db.presentationFiles.where('hymnalId').notEqual('').primaryKeys(),
        ]);
        const hymnKeySet = new Set(hymnKeys);
        const userKeys = allKeys.filter((k) => !hymnKeySet.has(k));
        if (userKeys.length === 0) return [];
        const rows = await db.presentationFiles.bulkGet(userKeys);
        return rows.filter(
            (p): p is IPresentationFile => Boolean(p && !p.metadata?.isHymnLibraryItem)
        );
    }
    const all = await db.presentationFiles.toArray();
    return all.filter((p) => !p.metadata?.isHymnLibraryItem);
}
