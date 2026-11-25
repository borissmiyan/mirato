import { db } from '@/core/db';

/**
 * Returns true if the given presentation belongs to a built-in bundled hymnal
 * (which is strictly read-only for users). Custom imported hymnals return false.
 */
export async function isBuiltInHymnPresentation(presentationId: string | null | undefined): Promise<boolean> {
    if (!presentationId || !db.presentationFiles) return false;
    try {
        const pres = await db.presentationFiles.get(presentationId);
        if (!pres) return false;
        const isHymnPres = Boolean(pres.hymnalId || pres.metadata?.isHymnLibraryItem);
        if (!isHymnPres) return false;
        if (!pres.hymnalId) return true;
        if (!db.hymnals) return true;
        const hymnal = await db.hymnals.get(pres.hymnalId);
        return hymnal?.isBuiltIn !== false;
    } catch {
        return false;
    }
}
