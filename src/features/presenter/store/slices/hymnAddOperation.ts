import { db } from '@/core/db';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import type { ISlide, ICanvasSlide, IAudioScope } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

/**
 * Adds a hymn presentation as a nested snapshot into the active presentation.
 */
export async function performAddHymnToActivePresentation(
    get: GetFn,
    set: SetFn,
    hymnPresentationId: string,
    themeId: string = 'default',
    index?: number
): Promise<void> {
    const { activePresentationId, activePresentation, activeServiceId, selectedSlideIds } = get();
    if (!activePresentationId || !activePresentation) {
        toast.error(i18n.t('no_active_presentation', 'Please select or create a presentation first'));
        return;
    }

    const hymnPres = await db.presentationFiles.get(hymnPresentationId);
    if (!hymnPres) return;

    await get().takeSnapshot(activePresentationId);

    try {
        const { materializeTheme } = await import('@/features/hymns/services/hymnThemeMaterializer');
        const { DEFAULT_HYMN_THEME } = await import('@/features/hymns/services/hymnThemeConstants');

        let theme: IHymnTheme | null = null;
        if (themeId && themeId !== SOURCE_THEME_ID) {
            theme = themeId !== 'default'
                ? (await db.hymnThemes.get(themeId)) || null
                : (await db.hymnThemes.filter(t => !!t.isDefault).first()) || DEFAULT_HYMN_THEME;
        }

        const slideIdMap = new Map<string, string>();
        const processedSlides = (hymnPres.slides || []).map((s, i) => {
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

        await copyHymnAudioScopes(hymnPres, hymnPresentationId, snapshotPresId, slideIdMap, processedSlides);

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
): Promise<void> {
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
}

