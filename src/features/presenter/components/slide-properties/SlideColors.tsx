import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { Palette } from 'lucide-react';

import { EmptyState } from '@/shared/ui';

export interface ISlideColorsProps {
    items: ICanvasItem[];
    onColorClick: (layer: IStyleLayer) => void;
    selectionStyles: IStyleLayer[];
    onSelectionStyleUpdate: (old: IStyleLayer, updates: Partial<IStyleLayer>) => void;
}

export const SlideColors: React.FC<ISlideColorsProps> = ({ items, onColorClick }) => {
    const { t } = useTranslation();
    // Collect all unique solid colors from all canvas items
    const allColors = useMemo(() => {
        const colorMap = new Map<string, IStyleLayer>();
        items.forEach(item => {
            const fills = item.type === 'text' ? (item.text?.textFills || []) : (item.fills || []);
            [...fills, ...(item.strokes || [])].forEach(layer => {
                if (layer.type === 'color' && layer.color && !colorMap.has(layer.color)) {
                    colorMap.set(layer.color, layer);
                }
            });
        });
        return Array.from(colorMap.values());
    }, [items]);

    if (allColors.length === 0) {
        return (
            <EmptyState
                icon={Palette}
                title={t('no_elements_on_slide')}
                borderStyle="none"
                size="sm"
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-3 bg-accent/40 rounded-full shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">{t('slide_colors')}</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 bg-black/20 p-3 rounded-2xl border border-white/5">
                {allColors.map((layer, idx) => (
                    <button
                        type="button"
                        key={layer.id || idx}
                        onClick={() => onColorClick(layer)}
                        className="group relative aspect-square rounded-xl border border-white/10 hover:border-white/30 hover:scale-110 active:scale-95 transition-all shadow-sm cursor-pointer apple-press"
                        style={{ backgroundColor: layer.color }}
                        title={layer.color}
                        aria-label={layer.color}
                    />
                ))}
            </div>
            <p className="text-[9px] text-stone-600 px-1 leading-relaxed">
                {t('click_color_hint')}
            </p>
        </div>
    );
};
