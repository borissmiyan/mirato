import { db } from '@/core/db';
import { IHymnSlide, IAudioScope, HymnalAudioVariant } from '@/core/types';
import { getOrderedHymnSlides } from '@/features/hymns/services/hymnMigrationUtils';

import {
    buildHymnalAudioFileId,
    rewriteHymnalAudioFileIdVariant,
} from '@/features/hymns/services/hymnalAudioCatalog';

export interface ResolvedHymnAudio {
    scopes: IAudioScope[];
    sourceIndex: number;
}

/**
 * Resolves which AudioScopes from the source hymn presentation are active
 * for a specific IHymnSlide. Uses slide indices within the ordered source presentation
 * slides to determine boundary containment, and applies the chosen audioVariant ('minus' | 'plus').
 */
export async function resolveHymnAudioScopes(hymnSlide: IHymnSlide): Promise<ResolvedHymnAudio | null> {
    // Respect explicit opt-out chosen in HymnPickerModal ("without backing track")
    if (hymnSlide.includeAudio === false) return null;

    const hymnPresentation = await db.presentationFiles.get(hymnSlide.hymnPresentationId);
    if (!hymnPresentation) return null;

    const orderedSlides = getOrderedHymnSlides(hymnPresentation);
    const slideIndexMap = new Map<string, number>();
    orderedSlides.forEach((s, i) => slideIndexMap.set(s.id, i));

    const sourceIndex = slideIndexMap.get(hymnSlide.sourceSlideId);
    if (sourceIndex === undefined) return null; // Orphaned ref: source slide deleted from hymn

    const dbScopes = await db.audioScopes
        .where('presentationId')
        .equals(hymnSlide.hymnPresentationId)
        .toArray();
    const allScopes = dbScopes.length > 0 ? dbScopes : (hymnPresentation.audioScopes || []);

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

    const variant: HymnalAudioVariant = hymnSlide.audioVariant === 'plus' ? 'plus' : 'minus';

    // If the hymn .mrtp is text-only (no pre-baked audioScopes), synthesize a virtual scope
    // pointing to `hymnal-audio://<hymnalId>/[plus/]<num>.ogg` so downloaded packs work automatically.
    let baseScopes = activeScopes;
    if (
        baseScopes.length === 0
        && hymnPresentation.hymnalId
        && typeof hymnPresentation.metadata?.hymnOrder === 'number'
        && orderedSlides.length > 0
    ) {
        const num = hymnPresentation.metadata.hymnOrder;
        const fileId = buildHymnalAudioFileId(hymnPresentation.hymnalId, num, variant);
        baseScopes = [{
            id: `hymn-virtual-audio:${hymnPresentation.id}:${variant}`,
            presentationId: hymnPresentation.id,
            startSlideId: orderedSlides[0].id,
            endSlideId: orderedSlides[orderedSlides.length - 1].id,
            fileId,
            fileName: `${hymnPresentation.name} (${variant === 'plus' ? '+' : '-'}).ogg`,
            volume: 1,
            loop: false,
            isGlobal: false,
            isMuted: false,
            strategy: hymnSlide.audioStrategy ?? 'auto',
            audioVariant: variant,
            crossfadeSettings: { fadeInDuration: 0.5, fadeOutDuration: 1.5 },
        }];
    }

    const effectiveScopes = baseScopes.map(scope => {
        const nextFileId = hymnSlide.audioVariant
            ? rewriteHymnalAudioFileIdVariant(scope.fileId, variant)
            : scope.fileId;
        return {
            ...scope,
            fileId: nextFileId,
            audioVariant: hymnSlide.audioVariant ?? scope.audioVariant ?? 'minus',
            strategy: hymnSlide.audioStrategy ?? scope.strategy,
        };
    });

    return { scopes: effectiveScopes, sourceIndex };
}
