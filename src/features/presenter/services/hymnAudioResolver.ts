import { db } from '@/core/db';
import { IHymnSlide, IAudioScope } from '@/core/types';
import { getOrderedHymnSlides } from '@/features/hymns/services/hymnMigrationUtils';

export interface ResolvedHymnAudio {
    scopes: IAudioScope[];
    sourceIndex: number;
}

/**
 * Resolves which AudioScopes from the source hymn presentation are active
 * for a specific IHymnSlide. Uses slide indices within the ordered source presentation
 * slides to determine boundary containment.
 */
export async function resolveHymnAudioScopes(hymnSlide: IHymnSlide): Promise<ResolvedHymnAudio | null> {
    const hymnPresentation = await db.presentationFiles.get(hymnSlide.hymnPresentationId);
    if (!hymnPresentation) return null;

    const orderedSlides = getOrderedHymnSlides(hymnPresentation);
    const slideIndexMap = new Map<string, number>();
    orderedSlides.forEach((s, i) => slideIndexMap.set(s.id, i));

    const sourceIndex = slideIndexMap.get(hymnSlide.sourceSlideId);
    if (sourceIndex === undefined) return null; // Orphaned ref: source slide deleted from hymn

    const allScopes = await db.audioScopes
        .where('presentationId')
        .equals(hymnSlide.hymnPresentationId)
        .toArray();

    const activeScopes = allScopes.filter((scope) => {
        if (scope.isGlobal) return true;

        const startIdx = slideIndexMap.get(scope.startSlideId);
        const endIdx = slideIndexMap.get(scope.endSlideId);
        if (startIdx === undefined || endIdx === undefined) return false;

        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        return sourceIndex >= lo && sourceIndex <= hi;
    });

    // Prioritize range-specific scopes over global hymnal scopes
    activeScopes.sort((a, b) => {
        if (a.isGlobal && !b.isGlobal) return 1;
        if (!a.isGlobal && b.isGlobal) return -1;
        return 0;
    });

    return { scopes: activeScopes, sourceIndex };
}
