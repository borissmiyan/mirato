import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { IHymnSlide, ICanvasSlide, ICanvasItem } from '@/core/types';
import { SOURCE_THEME_ID } from '@/core/types/hymn';
import { hymnLibraryService } from '@/features/hymns/services/hymnLibraryService';
import { DEFAULT_HYMN_THEME } from '@/features/hymns/services/hymnThemeService';
import { SlideBackground } from './SlideBackground';
import CanvasItemView from '../slide-editor/CanvasItemView';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';

export interface HymnSlideRendererProps {
    slide: IHymnSlide;
    isEditing?: boolean;
    scale?: number;
    parentWidth?: number;
    parentHeight?: number;
    className?: string;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

/**
 * Renders a hymn slide dynamically by fetching its source presentation
 * and applying the active IHymnTheme.
 * Renders in a fixed 1920x1080 logical coordinate system and scales via CSS.
 */
export const HymnSlideRenderer: React.FC<HymnSlideRendererProps> = ({
    slide,
    isEditing,
    scale = 1,
    className
}) => {
    const { t } = useTranslation();

    // 1. Live query for the theme (if not SOURCE)
    const theme = useLiveQuery(async () => {
        if (!slide.themeId || slide.themeId === SOURCE_THEME_ID) return undefined;
        if (slide.themeId === 'default') {
            const dbDefault = await db.hymnThemes.filter(th => !!th.isDefault).first();
            return dbDefault || DEFAULT_HYMN_THEME;
        }
        return db.hymnThemes.get(slide.themeId);
    }, [slide.themeId]);

    // 2. Live query for the source presentation
    const sourcePresentation = useLiveQuery(() => {
        return db.presentationFiles.get(slide.hymnPresentationId);
    }, [slide.hymnPresentationId]);

    // 3. Resolve the materialization
    const materialized = useMemo(() => {
        if (!sourcePresentation) return null;
        const sourceSlide = (sourcePresentation.slides || []).find(s => s.id === slide.sourceSlideId) as ICanvasSlide;
        if (!sourceSlide) return null;

        // If theme is explicitly "source", create a dummy source theme
        if (slide.themeId === SOURCE_THEME_ID) {
            return hymnLibraryService.materializeTheme(sourceSlide, { ...DEFAULT_HYMN_THEME, id: SOURCE_THEME_ID }, slide.order);
        }

        const activeTheme = theme || DEFAULT_HYMN_THEME;
        return hymnLibraryService.materializeTheme(sourceSlide, activeTheme, slide.order);
    }, [sourcePresentation, slide.sourceSlideId, theme, slide.themeId, slide.order]);

    if (!materialized) {
        return (
            <div 
                className="relative overflow-hidden origin-top-left flex flex-col items-center justify-center bg-stone-900 text-stone-400 gap-4 p-8 text-center"
                style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    transform: `scale(${scale})`
                }}
            >
                <AlertCircle className="w-16 h-16 text-red-500/50 mb-4" />
                <h3 className="text-2xl font-bold text-white relative z-10">
                    {t('hymn_not_available', 'Hymn Not Available')}
                </h3>
            </div>
        );
    }

    return (
        <div
            className={cn('relative overflow-hidden origin-top-left select-none', className)}
            style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                transform: `scale(${scale})`
            }}
        >
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <SlideBackground background={materialized.background} />
            </div>

            {/* Canvas Items Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
                {materialized.canvasItems.filter(ci => ci.visible !== false).map((item: ICanvasItem) => {
                    const isAutoWidth = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                    const isAutoHeight = item.type === 'text' && item.text?.resizingMode === 'auto-height';

                    return (
                        <div
                            key={item.id}
                            className="absolute overflow-visible"
                            style={{
                                left: `${item.x}%`,
                                top: `${item.y}%`,
                                width: isAutoWidth ? 'max-content' : `${item.width}%`,
                                height: (isAutoWidth || isAutoHeight) ? 'max-content' : `${item.height}%`,
                                zIndex: item.zIndex,
                                transform: `translate(-${item.pivotX ?? 50}%, -${item.pivotY ?? 50}%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`,
                                transformOrigin: `${item.pivotX ?? 50}% ${item.pivotY ?? 50}%`,
                            }}
                        >
                            <CanvasItemView item={item} isPreview={true} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(HymnSlideRenderer);

