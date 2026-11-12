import { ICanvasSlide, ICanvasItem, IStyleLayer } from '@/core/types';
import { IHymnTheme } from '@/core/types/hymn';
import { SOURCE_THEME_ID, DEFAULT_HYMN_THEME } from './hymnThemeConstants';
import { CanvasService } from '@/features/presenter/services/CanvasService';

/**
 * Materializes visual properties (background, text style, font-weight, textAnchor)
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

    const bg = theme.background || DEFAULT_HYMN_THEME.background;

    // First slide is ALWAYS bold, other slides are regular
    const isFirstSlide = slideOrder !== undefined ? slideOrder === 0 : (sourceSlide.order === 0 || sourceSlide.order === undefined);
    const resolvedFontWeight = isFirstSlide ? '700' : '400';

    const items = (sourceSlide.content?.canvasItems || []).map(item => {
        if (item.type === 'text') {
            let updatedItem: ICanvasItem = {
                ...item,
                text: {
                    ...item.text,
                    fontFamily: theme.textStyle.fontFamily,
                    fontSize: theme.textStyle.fontSize,
                    color: theme.textStyle.color,
                    alignHorizontal: theme.textStyle.alignHorizontal,
                    alignVertical: theme.textStyle.alignVertical,
                    lineHeight: theme.textStyle.lineHeight,
                    fontWeight: resolvedFontWeight,
                    isBold: isFirstSlide
                }
            };

            if (theme.textAnchor) {
                const anchorUpdates = CanvasService.getAnchorPositionUpdates(updatedItem, theme.textAnchor);
                updatedItem = { ...updatedItem, ...anchorUpdates };
            }

            return updatedItem;
        }
        return item;
    });

    return { background: bg, canvasItems: items };
}

