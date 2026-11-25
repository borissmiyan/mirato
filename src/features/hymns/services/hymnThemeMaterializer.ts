import { ICanvasSlide, ICanvasItem, IStyleLayer, IPresentationFile } from '@/core/types';
import { IHymnTheme, TextAnchor } from '@/core/types/hymn';
import { SOURCE_THEME_ID, DEFAULT_HYMN_THEME } from './hymnThemeConstants';
import { getOrderedHymnSlides } from './hymnMigrationUtils';

/**
 * Computes safe-zone percentage coordinates (0..100) and CSS pivot percentages (0 | 50 | 100)
 * for 9-point text anchoring on the 1920x1080 logical canvas.
 */
function resolveAnchorGeometry(anchor: TextAnchor): Partial<ICanvasItem> {
    const isLeft = anchor.endsWith('left');
    const isRight = anchor.endsWith('right');
    const isTop = anchor.startsWith('top');
    const isBottom = anchor.startsWith('bottom');

    return {
        x: isLeft ? 8 : isRight ? 92 : 50,
        y: isTop ? 12 : isBottom ? 88 : 50,
        pivotX: isLeft ? 0 : isRight ? 100 : 50,
        pivotY: isTop ? 0 : isBottom ? 100 : 50,
        width: isLeft || isRight ? 84 : 86,
    };
}

/**
 * Materializes visual properties (background, text style, typography effects, font-weight, textAnchor)
 * onto slide elements based on an IHymnTheme.
 *
 * Rule: First slide of a hymn is ALWAYS bold ('700'), while subsequent
 * slides are regular ('400') across all custom and default themes.
 */
export function materializeTheme(
    sourceSlide: ICanvasSlide,
    theme: IHymnTheme,
    slideOrder?: number
): {
    background: IStyleLayer[];
    canvasItems: ICanvasItem[];
} {
    // If the theme is "Source", we do not override anything.
    if (theme.id === SOURCE_THEME_ID) {
        return {
            background: sourceSlide.backgroundOverride || [],
            canvasItems: sourceSlide.content?.canvasItems || []
        };
    }

    const bg = (theme.background && theme.background.length > 0) ? theme.background : DEFAULT_HYMN_THEME.background;

    // First slide is ALWAYS bold, other slides are regular
    const isFirstSlide = slideOrder !== undefined ? slideOrder === 0 : (sourceSlide.order === 0 || sourceSlide.order === undefined);
    const resolvedFontWeight = isFirstSlide ? '700' : '400';

    const ts = theme.textStyle || {};
    const resolvedColor = ts.color;
    const themeTextFills: IStyleLayer[] | undefined = resolvedColor
        ? [{
            id: 'hymn-theme-text-fill',
            type: 'color',
            color: resolvedColor,
            visible: true,
            opacity: 1,
            blendMode: 'normal',
        }]
        : undefined;

    const items = (sourceSlide.content?.canvasItems || []).map(item => {
        if (item.type === 'text') {
            let updatedItem: ICanvasItem = {
                ...item,
                text: {
                    ...item.text,
                    fontFamily: ts.fontFamily,
                    fontSize: ts.fontSize,
                    color: resolvedColor,
                    ...(themeTextFills ? { textFills: themeTextFills } : {}),
                    alignHorizontal: ts.alignHorizontal,
                    alignVertical: ts.alignVertical,
                    lineHeight: ts.lineHeight,
                    letterSpacing: ts.letterSpacing,
                    textCase: ts.textCase,
                    isItalic: ts.isItalic ?? false,
                    fontWeight: resolvedFontWeight,
                    isBold: isFirstSlide
                },
                ...(theme.textEffects ? { effects: theme.textEffects } : {}),
            };

            if (theme.textAnchor) {
                updatedItem = { ...updatedItem, ...resolveAnchorGeometry(theme.textAnchor) };
            }

            return updatedItem;
        }
        return item;
    });

    return { background: bg, canvasItems: items };
}

/**
 * Resolves an IHymnTheme from an explicit themeId and available DB themes.
 * Returns null only when themeId is SOURCE_THEME_ID (keep original .ektp styling).
 */
export function resolveHymnThemeFromList(
    themeId: string | undefined,
    themes: IHymnTheme[]
): IHymnTheme | null {
    if (themeId === SOURCE_THEME_ID) return null;
    if (!themeId || themeId === 'default') {
        return themes.find(t => !!t.isDefault) || DEFAULT_HYMN_THEME;
    }
    return themes.find(t => t.id === themeId) || themes.find(t => !!t.isDefault) || DEFAULT_HYMN_THEME;
}

/**
 * Materializes all ordered slides of a library hymn presentation with the given theme,
 * producing a virtual IPresentationFile ready for nested timeline, preview, and projector rendering
 * without creating any duplicate presentation in the service library.
 */
export function materializeHymnPresentation(
    hymnPres: IPresentationFile,
    theme: IHymnTheme | null
): IPresentationFile {
    const ordered = getOrderedHymnSlides(hymnPres);
    const slides = ordered.map((s, idx) => {
        if (theme && s.type === 'normal') {
            const themed = materializeTheme(s as ICanvasSlide, theme, idx);
            return {
                ...s,
                order: idx,
                backgroundOverride: themed.background,
                content: {
                    ...(s as ICanvasSlide).content,
                    canvasItems: themed.canvasItems,
                    variables: (s as ICanvasSlide).content?.variables || {},
                },
            };
        }
        return { ...s, order: idx };
    });

    return {
        ...hymnPres,
        slides,
    };
}
