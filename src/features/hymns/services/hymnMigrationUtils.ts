import { IPresentationFile, ISlide } from '@/core/types';

export function getOrderedHymnSlides(hymnPresentation: IPresentationFile): ISlide[] {
    return [...(hymnPresentation.slides || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Builds a map from `oldSlideId → newSlideId` using positional matching.
 *
 * Position is defined as the index in `getOrderedHymnSlides()` (sorted ascending by `order`).
 * This is the only stable cross-version mapping strategy available, since `.ektp` files
 * may be regenerated with new slide UUIDs when content is edited.
 *
 * Returns `undefined` for slide IDs whose position exceeds the length of the new
 * presentation's slides. The caller MUST handle `undefined` explicitly:
 *   - For `IHymnSlide.sourceSlideId`: detach the slide (verse was removed).
 *   - For `IAudioScope.startSlideId`/`endSlideId`: skip auto-migration of that scope.
 *
 * Known limitations (explicit and accepted by design):
 *   - If verses were reordered in the new `.ektp`, positions will shift and produce
 *     incorrect (but not undefined) mappings.
 *   - If an `oldSlideId` is not found in the old ordered list (data integrity issue),
 *     the map will not contain an entry for it → `Map.get()` returns `undefined`.
 *
 * @param oldPresentation - The presentation from the previous hymnal version.
 * @param newPresentation - The presentation from the updated hymnal version.
 * @returns A `Map<oldSlideId, newSlideId | undefined>` for every slide in `oldPresentation`.
 */
export function buildSlidePositionMap(
    oldPresentation: IPresentationFile,
    newPresentation: IPresentationFile,
): Map<string, string | undefined> {
    const oldSlides = getOrderedHymnSlides(oldPresentation);
    const newSlides = getOrderedHymnSlides(newPresentation);

    const result = new Map<string, string | undefined>();

    for (let i = 0; i < oldSlides.length; i++) {
        const oldSlide = oldSlides[i];
        const newSlide = newSlides[i]; // undefined if new presentation has fewer slides
        result.set(oldSlide.id, newSlide?.id);
    }

    return result;
}
