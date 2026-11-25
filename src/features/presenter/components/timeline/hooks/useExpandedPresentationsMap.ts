import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { ISlide, ICanvasSlide, INestedSlide, IPresentationFile } from '@/core/types';
import { BUILT_IN_HYMN_THEMES } from '@/features/hymns/services/hymnThemeConstants';
import { materializeHymnPresentation, resolveHymnThemeFromList } from '@/features/hymns/services/hymnThemeMaterializer';

/**
 * Resolves a nested presentation from the expanded map, preferring the per-slide key
 * (isolating hymn themes when the same hymn appears multiple times) with masterPresId fallback.
 */
export function getNestedPresentationFromMap(
    presentationsMap: Map<string, IPresentationFile>,
    parentSlideId: string | null | undefined,
    masterPresId: string | null | undefined
): IPresentationFile | null {
    if (parentSlideId) {
        const bySlide = presentationsMap.get(parentSlideId);
        if (bySlide) return bySlide;
    }
    if (masterPresId) {
        return presentationsMap.get(masterPresId) || null;
    }
    return null;
}

/**
 * Loads expanded nested presentations (and library hymns) for the active timeline,
 * materializing each library hymn instance on the fly using the hymnThemeId stored
 * on its own parent slide (never leaking themes across sibling hymn blocks).
 */
export function useExpandedPresentationsMap(
    slides: ISlide[],
    navigationParentSlideId: string | null
): Map<string, IPresentationFile> {
    const expandedPresentationIds = useMemo(() => {
        return Array.from(new Set(
            slides
                .filter(s => s.isExpanded || s.id === navigationParentSlideId)
                .map(s => {
                    const canvasSlide = s.type === 'normal' ? s as ICanvasSlide : null;
                    const nestedSlide = s.type === 'nested' ? s as INestedSlide : null;
                    return canvasSlide?.masterPresentationId || nestedSlide?.presentationId;
                })
                .filter(Boolean) as string[]
        ));
    }, [slides, navigationParentSlideId]);

    const liveExpandedPresentations = useLiveQuery(
        (): Promise<IPresentationFile[]> =>
            expandedPresentationIds.length > 0
                ? db.presentationFiles.where('id').anyOf(expandedPresentationIds).toArray()
                : Promise.resolve([]),
        [expandedPresentationIds]
    );
    const expandedPresentations = useMemo<IPresentationFile[]>(
        () => liveExpandedPresentations || [],
        [liveExpandedPresentations]
    );

    const hasExpandedHymn = useMemo(
        () => expandedPresentations.some(p => Boolean(p.hymnalId || p.metadata?.isHymnLibraryItem)),
        [expandedPresentations]
    );

    const liveHymnThemes = useLiveQuery(
        () => (hasExpandedHymn && typeof db.hymnThemes?.toArray === 'function' ? db.hymnThemes.toArray() : Promise.resolve([])),
        [hasExpandedHymn]
    );

    return useMemo<Map<string, IPresentationFile>>(() => {
        // Use built-in themes synchronously before Dexie resolves so projector/timeline never flash black default theme
        const themes = (liveHymnThemes && liveHymnThemes.length > 0) ? liveHymnThemes : BUILT_IN_HYMN_THEMES;
        const byPresId = new Map(expandedPresentations.map(p => [p.id, p]));
        const result = new Map<string, IPresentationFile>();

        for (const s of slides) {
            const canvasSlide = s.type === 'normal' ? s as ICanvasSlide : null;
            const nestedSlide = s.type === 'nested' ? s as INestedSlide : null;
            const targetId = canvasSlide?.masterPresentationId || nestedSlide?.presentationId;
            if (!targetId) continue;

            const rawPres = byPresId.get(targetId);
            if (!rawPres) continue;

            if (rawPres.hymnalId || rawPres.metadata?.isHymnLibraryItem) {
                const rawThemeId = canvasSlide?.content?.variables?.hymnThemeId;
                const themeId = typeof rawThemeId === 'string' ? rawThemeId : (rawPres.metadata?.themeId as string | undefined);
                const resolvedTheme = resolveHymnThemeFromList(themeId, themes);
                const materialized = materializeHymnPresentation(rawPres, resolvedTheme);
                // Key per parent slide ID so each hymn instance on the timeline keeps its own isolated theme
                result.set(s.id, materialized);
                if (!result.has(rawPres.id)) {
                    result.set(rawPres.id, materialized);
                }
            } else {
                result.set(s.id, rawPres);
                result.set(rawPres.id, rawPres);
            }
        }

        // Preserve any remaining expanded presentations for direct lookup by presentation ID
        for (const p of expandedPresentations) {
            if (!result.has(p.id)) {
                result.set(p.id, p);
            }
        }

        return result;
    }, [expandedPresentations, liveHymnThemes, slides]);
}
