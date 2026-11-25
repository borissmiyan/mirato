import { db } from '@/core/db';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import type { ISlide, ICanvasSlide, IHymnSlide, IAudioScope } from '@/core/types';
import { getOrderedHymnSlides } from '@/features/hymns/services/hymnMigrationUtils';
import { buildHymnalAudioFileId } from '@/features/hymns/services/hymnalAudioCatalog';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

export interface AddHymnOptions {
    includeAudio?: boolean;
    audioStrategy?: 'auto' | 'manual' | 'delay';
    /** Audio track variant ('minus' = instrumental, 'plus' = with vocals). */
    audioVariant?: 'minus' | 'plus';
    /**
     * - 'nested-hymn': inserts a single master-presentation slide pointing directly to the hymnal library presentation
     *   with the selected themeId (zero duplicate presentations in service library, identical UX to nested presentations).
     * - 'reference': inserts flat read-only IHymnSlide refs.
     * - 'snapshot' (legacy default): creates a cloned presentation snapshot.
     */
    mode?: 'nested-hymn' | 'reference' | 'snapshot';
}

/**
 * Adds a hymn into the active presentation timeline.
 * - mode: 'reference' -> read-only IHymnSlide reference slides (respecting includeAudio, detach/copy on demand to edit).
 * - mode: 'snapshot' (default for legacy callers) -> nested snapshot presentation slide.
 */
export async function performAddHymnToActivePresentation(
    get: GetFn,
    _set: SetFn,
    hymnPresentationId: string,
    themeId: string = 'default',
    index?: number,
    options?: AddHymnOptions
): Promise<void> {
    const { activePresentationId, activePresentation, activeServiceId, selectedSlideIds } = get();
    if (!activePresentationId || !activePresentation) {
        toast.error(i18n.t('no_active_presentation', 'Please select or create a presentation first'));
        return;
    }

    const hymnPres = await db.presentationFiles.get(hymnPresentationId);
    if (!hymnPres) return;

    await get().takeSnapshot(activePresentationId);

    const includeAudio = options?.includeAudio ?? true;
    const currentSlides = activePresentation.slides || [];
    let targetIndex = index;
    if (targetIndex === undefined && selectedSlideIds.length > 0) {
        const lastSelectedIndex = currentSlides.findIndex(s => s.id === selectedSlideIds[selectedSlideIds.length - 1]);
        if (lastSelectedIndex !== -1) {
            targetIndex = lastSelectedIndex + 1;
        }
    }
    if (targetIndex === undefined || targetIndex < 0 || targetIndex > currentSlides.length) {
        targetIndex = currentSlides.length;
    }

    try {
        // Nested library hymn mode: 1-to-1 nested presentation UI, sourced directly from hymnal library with chosen theme
        if (options?.mode === 'nested-hymn') {
            const newSlide: ISlide & { masterPresentationId?: string; linkedPresentationId?: string; isExpanded?: boolean; lastSyncedAt?: string } = {
                id: crypto.randomUUID(),
                type: 'normal',
                order: 0,
                blockId: 'master-presentation',
                templateId: 'default',
                content: {
                    variables: {
                        title: hymnPres.name,
                        hymnThemeId: themeId || 'default',
                        hymnIncludeAudio: includeAudio ? 1 : 0,
                        hymnAudioStrategy: options?.audioStrategy ?? 'auto',
                        hymnAudioVariant: options?.audioVariant ?? 'minus',
                    }
                },
                masterPresentationId: hymnPresentationId,
                linkedPresentationId: hymnPresentationId,
                lastSyncedAt: hymnPres.updatedAt ? new Date(hymnPres.updatedAt).toISOString() : new Date().toISOString(),
                isExpanded: true,
            };

            const updatedSlides = [
                ...currentSlides.slice(0, targetIndex),
                newSlide,
                ...currentSlides.slice(targetIndex),
            ].map((slide, idx) => ({ ...slide, order: idx }));

            await get().updatePresentationSlides(activePresentationId, updatedSlides);
            get().setSelectedSlideIds([newSlide.id]);
            await get().setPreviewSlide(newSlide.id, activePresentationId);
            return;
        }

        // Read-only reference mode (flat IHymnSlide refs)
        if (options?.mode === 'reference') {
            const orderedSlides = getOrderedHymnSlides(hymnPres);
            if (orderedSlides.length === 0) return;

            const referenceSlides: IHymnSlide[] = orderedSlides.map((sourceSlide, idx) => ({
                id: crypto.randomUUID(),
                type: 'hymn',
                order: idx,
                blockId: 'default',
                templateId: '',
                hymnPresentationId,
                sourceSlideId: sourceSlide.id,
                themeId: themeId || 'default',
                includeAudio,
                audioStrategy: options?.audioStrategy ?? 'auto',
                audioVariant: options?.audioVariant ?? 'minus',
                duration: 0,
                transition: { type: 'none', duration: 0.5 },
            }));

            const updatedSlides = [
                ...currentSlides.slice(0, targetIndex),
                ...referenceSlides,
                ...currentSlides.slice(targetIndex),
            ].map((slide, idx) => ({ ...slide, order: idx }));

            await get().updatePresentationSlides(activePresentationId, updatedSlides);
            const firstNewId = referenceSlides[0].id;
            get().setSelectedSlideIds([firstNewId]);
            get().setPreviewSlide(firstNewId, activePresentationId);
            return;
        }

        // Legacy snapshot mode
        const { materializeTheme } = await import('@/features/hymns/services/hymnThemeMaterializer');
        const { DEFAULT_HYMN_THEME } = await import('@/features/hymns/services/hymnThemeConstants');

        let theme: IHymnTheme | null = null;
        if (themeId && themeId !== SOURCE_THEME_ID) {
            theme = themeId !== 'default'
                ? (await db.hymnThemes.get(themeId)) || null
                : (await db.hymnThemes.filter(t => !!t.isDefault).first()) || DEFAULT_HYMN_THEME;
        }

        const orderedSourceSlides = getOrderedHymnSlides(hymnPres);
        const slideIdMap = new Map<string, string>();
        const processedSlides = orderedSourceSlides.map((s, i) => {
            const newId = crypto.randomUUID();
            slideIdMap.set(s.id, newId);
            if (theme && s.type === 'normal') {
                const themed = materializeTheme(s as ICanvasSlide, theme, i);
                return {
                    ...s,
                    id: newId,
                    order: i,
                    backgroundOverride: themed.background,
                    content: {
                        ...(s as ICanvasSlide).content,
                        canvasItems: themed.canvasItems,
                        variables: (s as ICanvasSlide).content?.variables || {}
                    }
                };
            }
            return { ...s, id: newId, order: i };
        });

        const targetServiceId = activeServiceId || activePresentation.serviceId;
        const snapshotPresId = await get().createPresentation(hymnPres.name, {
            serviceId: targetServiceId,
            metadata: {
                ...hymnPres.metadata,
                isHymn: true,
                hymnalId: hymnPres.hymnalId,
                themeId
            }
        });
        await get().updatePresentationSlides(snapshotPresId, processedSlides);

        if (includeAudio) {
            const copiedCount = await copyHymnAudioScopes(hymnPres, hymnPresentationId, snapshotPresId, slideIdMap, processedSlides);
            // If no explicit DB audio scopes existed, attach the downloaded hymnal audio pack track
            if (copiedCount === 0 && hymnPres.hymnalId && typeof hymnPres.metadata?.hymnOrder === 'number' && processedSlides.length > 0) {
                const variant = options?.audioVariant === 'plus' ? 'plus' : 'minus';
                const packScope: IAudioScope = {
                    id: crypto.randomUUID(),
                    presentationId: snapshotPresId,
                    fileId: buildHymnalAudioFileId(hymnPres.hymnalId, hymnPres.metadata.hymnOrder, variant),
                    fileName: `${hymnPres.name} (${variant === 'plus' ? '+' : '-'}).ogg`,
                    startSlideId: processedSlides[0].id,
                    endSlideId: processedSlides[processedSlides.length - 1].id,
                    volume: 1,
                    loop: false,
                    strategy: options?.audioStrategy ?? 'auto',
                    audioVariant: variant,
                };
                await db.audioScopes.put(packScope);
                await db.presentationFiles.update(snapshotPresId, { audioScopes: [packScope] });
            }
        }

        const newSlide: ISlide & { masterPresentationId?: string; linkedPresentationId?: string; isExpanded?: boolean; lastSyncedAt?: string } = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: 0,
            blockId: 'master-presentation',
            templateId: 'default',
            content: { variables: {} },
            masterPresentationId: snapshotPresId,
            linkedPresentationId: hymnPresentationId,
            lastSyncedAt: hymnPres.updatedAt ? new Date(hymnPres.updatedAt).toISOString() : new Date().toISOString(),
            isExpanded: true
        };

        const updatedSlides = [
            ...currentSlides.slice(0, targetIndex),
            newSlide,
            ...currentSlides.slice(targetIndex)
        ].map((slide, idx) => ({ ...slide, order: idx }));

        await get().updatePresentationSlides(activePresentationId, updatedSlides);
        get().setSelectedSlideIds([newSlide.id]);
        get().setPreviewSlide(newSlide.id, activePresentationId);
    } catch (err) {
        console.error('[addHymnToActivePresentation] ERROR', err);
    }
}

async function copyHymnAudioScopes(
    hymnPres: { slides?: ISlide[]; audioScopes?: IAudioScope[] },
    hymnPresId: string,
    snapshotPresId: string,
    slideIdMap: Map<string, string>,
    processedSlides: ISlide[]
): Promise<number> {
    const sourceDbScopes = await db.audioScopes.where('presentationId').equals(hymnPresId).toArray();
    const sourceScopes = [...sourceDbScopes, ...(hymnPres.audioScopes || [])];

    for (const s of (hymnPres.slides || [])) {
        const cs = s as ISlide & { audioScopes?: IAudioScope[] };
        if (cs.audioScopes && Array.isArray(cs.audioScopes)) {
            sourceScopes.push(...cs.audioScopes);
        }
    }

    const createdScopes: IAudioScope[] = [];
    const seenScopeKeys = new Set<string>();
    for (const scope of sourceScopes) {
        const legacyScope = scope as IAudioScope & { path?: string; url?: string };
        const audioFileId = scope.fileId || legacyScope.path || legacyScope.url;
        if (!audioFileId) continue;

        const key = `${audioFileId}-${scope.startSlideId}-${scope.endSlideId}-${scope.isGlobal}`;
        if (seenScopeKeys.has(key)) continue;
        seenScopeKeys.add(key);

        const mappedStartId = slideIdMap.get(scope.startSlideId) || processedSlides[0]?.id;
        const mappedEndId = slideIdMap.get(scope.endSlideId) || processedSlides[processedSlides.length - 1]?.id;

        if (mappedStartId && mappedEndId) {
            const newScope: IAudioScope = {
                ...scope,
                id: crypto.randomUUID(),
                presentationId: snapshotPresId,
                fileId: audioFileId,
                startSlideId: scope.isGlobal ? processedSlides[0]?.id : mappedStartId,
                endSlideId: scope.isGlobal ? processedSlides[processedSlides.length - 1]?.id : mappedEndId
            };
            await db.audioScopes.put(newScope);
            createdScopes.push(newScope);
        }
    }

    if (createdScopes.length > 0) {
        await db.presentationFiles.update(snapshotPresId, { audioScopes: createdScopes });
    }
    return createdScopes.length;
}
