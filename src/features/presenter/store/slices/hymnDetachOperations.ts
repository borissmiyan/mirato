import { db } from '@/core/db';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import type { ICanvasSlide, IHymnSlide } from '@/core/types';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';
import { resolveEffectiveThemeId } from '@/features/hymns/services/hymnThemeResolver';
import { resolveHymnAudioScopes } from '@/features/presenter/services/hymnAudioResolver';
import { PresentationState } from '../types';

type GetFn = () => PresentationState;
type SetFn = (partial: Partial<PresentationState> | ((state: PresentationState) => Partial<PresentationState>)) => void;

interface DetachHymnResult {
    requiresAudioConfirmation: boolean;
}

/**
 * Detaches a linked hymn slide turning it into a standalone editable canvas slide.
 */
export async function performDetachHymnSlide(
    get: GetFn,
    set: SetFn,
    presentationId: string,
    slideId: string,
    skipAudioConfirmation = false
): Promise<DetachHymnResult> {
    const pres = await db.presentationFiles.get(presentationId);
    if (!pres) return { requiresAudioConfirmation: false };

    const slides = pres.slides || [];
    const slideIndex = slides.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return { requiresAudioConfirmation: false };

    const hymnSlide = slides[slideIndex] as IHymnSlide;
    if (hymnSlide.type !== 'hymn') return { requiresAudioConfirmation: false };

    const sourceHymnPres = await db.presentationFiles.get(hymnSlide.hymnPresentationId);
    if (!sourceHymnPres) return { requiresAudioConfirmation: false };

    const sourceSlide = sourceHymnPres.slides.find(s => s.id === hymnSlide.sourceSlideId) as ICanvasSlide;
    if (!sourceSlide) return { requiresAudioConfirmation: false };

    const resolvedAudio = await resolveHymnAudioScopes(hymnSlide);
    const hasMultiSlideOrGlobalAudio = resolvedAudio && resolvedAudio.scopes.some(scope => 
        scope.isGlobal || scope.startSlideId !== scope.endSlideId
    );

    if (hasMultiSlideOrGlobalAudio && !skipAudioConfirmation) {
        return { requiresAudioConfirmation: true };
    }

    await get().takeSnapshot(presentationId);

    const hymnal = sourceHymnPres.serviceId ? await db.hymnals.get(sourceHymnPres.serviceId) : undefined;
    const effectiveThemeId = await resolveEffectiveThemeId(hymnal, hymnSlide.themeId);
    
    let theme = effectiveThemeId !== SOURCE_THEME_ID ? await db.hymnThemes.get(effectiveThemeId) : undefined;
    if (!theme && effectiveThemeId !== SOURCE_THEME_ID) {
        theme = await db.hymnThemes.filter(t => !!t.isDefault).first();
    }
    
    const { materializeTheme } = await import('@/features/hymns/services/hymnThemeMaterializer');
    const effectiveTheme: IHymnTheme = theme || { id: SOURCE_THEME_ID, name: 'Source', background: [], textStyle: {} };
    const materialized = materializeTheme(sourceSlide, effectiveTheme, hymnSlide.order);

    const detachedSlide: ICanvasSlide = {
        id: hymnSlide.id,
        type: 'normal',
        order: hymnSlide.order,
        blockId: hymnSlide.blockId,
        backgroundOverride: materialized.background,
        templateId: 'blank',
        content: {
            canvasItems: materialized.canvasItems,
            variables: {}
        }
    };

    if (resolvedAudio && resolvedAudio.scopes.length > 0) {
        const singleSlideScope = resolvedAudio.scopes.find(s => !s.isGlobal && s.startSlideId === s.endSlideId);
        if (singleSlideScope) {
            await db.audioScopes.put({
                ...singleSlideScope,
                id: crypto.randomUUID(),
                presentationId,
                startSlideId: hymnSlide.id,
                endSlideId: hymnSlide.id
            });
        }
    }

    const updatedSlides = [...slides];
    updatedSlides[slideIndex] = detachedSlide;

    await get().updatePresentationSlides(presentationId, updatedSlides);
    toast.success(i18n.t('hymn_slide_detached', 'Hymn slide detached'));

    return { requiresAudioConfirmation: false };
}

/**
 * Updates the theme applied to a hymn slide.
 */
export async function performUpdateHymnSlideTheme(
    get: GetFn,
    set: SetFn,
    presentationId: string,
    slideId: string,
    newThemeId: string
): Promise<void> {
    const pres = await db.presentationFiles.get(presentationId);
    if (!pres) return;

    const slides = pres.slides || [];
    const slideIndex = slides.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return;

    const slide = slides[slideIndex];
    if (slide.type !== 'hymn') return;

    await get().takeSnapshot(presentationId);

    const updatedSlides = [...slides];
    updatedSlides[slideIndex] = {
        ...slide,
        themeId: newThemeId
    };

    await get().updatePresentationSlides(presentationId, updatedSlides);
}

