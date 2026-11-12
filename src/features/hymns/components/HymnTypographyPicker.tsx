import React from 'react';
import { useHymnThemeEditorStore } from '../store/useHymnThemeEditorStore';
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const fontFamilies = [
    { name: 'Inter' },
    { name: 'Roboto' },
    { name: 'Open Sans' },
    { name: 'Lora' },
    { name: 'Merriweather' },
    { name: 'Arial' },
    { name: 'Georgia' }
];

import { Slider } from '@/shared/ui';

export const HymnTypographyPicker: React.FC = () => {
    const { t } = useTranslation();
    const draftTheme = useHymnThemeEditorStore(s => s.draftTheme);
    const updateTextStyle = useHymnThemeEditorStore(s => s.updateTextStyle);

    if (!draftTheme) return null;

    const style = draftTheme.textStyle;

    return (
        <div className="space-y-6">
            {/* Font Family */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    <Type className="w-4 h-4" />
                    {t('typography.fontFamily', 'Font Family')}
                </label>
                <select
                    value={style.fontFamily}
                    onChange={(e) => updateTextStyle({ fontFamily: e.target.value })}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl text-sm text-white px-3 py-2 outline-none focus:border-stone-600"
                >
                    {fontFamilies.map(font => (
                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                            {font.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Font Size & Line Height */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <label className="text-xs font-medium text-stone-400">
                        {t('typography.size', 'Size')}
                    </label>
                    <Slider
                        min={10}
                        max={200}
                        step={1}
                        value={style.fontSize}
                        onChange={(val) => updateTextStyle({ fontSize: val })}
                        unit="px"
                        mode="block"
                    />
                </div>
                <div className="space-y-3">
                    <label className="text-xs font-medium text-stone-400">
                        {t('typography.lineHeight', 'Line Height')}
                    </label>
                    <Slider
                        min={0.5}
                        max={2.5}
                        step={0.1}
                        value={Number(style.lineHeight) || 1.2}
                        onChange={(val) => updateTextStyle({ lineHeight: parseFloat(val.toFixed(1)) })}
                        mode="block"
                    />
                </div>
            </div>

            {/* Color & Alignment */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <label className="text-xs font-medium text-stone-400">
                        {t('typography.color', 'Color')}
                    </label>
                    <div className="relative group">
                        <div className="absolute opacity-0 w-0 h-0 overflow-hidden">
                            <input
                                type="color"
                                value={style.color || '#ffffff'}
                                onChange={(e) => updateTextStyle({ color: e.target.value })}
                                id="color-picker"
                            />
                        </div>
                        <label
                            htmlFor="color-picker"
                            className="flex items-center w-full justify-start gap-2 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-white hover:border-stone-600 cursor-pointer"
                        >
                            <div
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: style.color || '#FFFFFF' }}
                            />
                            <span className="truncate">{style.color || '#FFFFFF'}</span>
                        </label>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-medium text-stone-400">
                        {t('typography.alignment', 'Alignment')}
                    </label>
                    <div className="flex items-center bg-stone-900 p-1 rounded-xl border border-stone-800">
                        {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                            <button
                                key={align}
                                type="button"
                                onClick={() => updateTextStyle({ alignHorizontal: align })}
                                className={`flex-1 flex items-center justify-center h-8 rounded-sm transition-colors apple-press cursor-pointer ${style.alignHorizontal === align ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-300 hover:bg-stone-800/50'
                                    }`}
                            >
                                {align === 'left' && <AlignLeft className="w-4 h-4" />}
                                {align === 'center' && <AlignCenter className="w-4 h-4" />}
                                {align === 'right' && <AlignRight className="w-4 h-4" />}
                                {align === 'justify' && <AlignJustify className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
