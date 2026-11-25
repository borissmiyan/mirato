import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import { IStyleLayer } from '@/core/types/style';
import { ICanvasEffect } from '@/core/types/canvas';
import { ADDITIONAL_HYMN_THEMES } from './hymnThemePresets';

export { SOURCE_THEME_ID };

export const DEFAULT_HYMN_THEME_ID = 'builtin-default';

const SOFT_DARK_SHADOW: ICanvasEffect[] = [
    {
        id: 'hymn-soft-shadow',
        type: 'drop-shadow',
        visible: true,
        color: 'rgba(0, 0, 0, 0.55)',
        x: 0,
        y: 4,
        blur: 18,
    }
];

const CRISP_SUBTITLE_SHADOW: ICanvasEffect[] = [
    {
        id: 'hymn-crisp-shadow',
        type: 'drop-shadow',
        visible: true,
        color: 'rgba(0, 0, 0, 0.85)',
        x: 0,
        y: 3,
        blur: 12,
    }
];

const makeGradientLayer = (id: string, cssGradient: string, from: string, to: string, angle = 160, opacity = 1): IStyleLayer => ({
    id,
    type: 'gradient',
    visible: true,
    opacity,
    blendMode: 'normal',
    gradient: {
        type: cssGradient.startsWith('radial') ? 'radial' : 'linear',
        from,
        to,
        angle,
        cssGradient,
    }
});

/**
 * Canonical default theme (preserved untouched).
 */
export const DEFAULT_HYMN_THEME: IHymnTheme = {
    id: DEFAULT_HYMN_THEME_ID,
    name: 'Default',
    nameRu: 'По умолчанию',
    isBuiltIn: true,
    isDefault: true,
    background: [
        { type: 'color', color: '#000000', id: 'bg-1', visible: true, opacity: 1, blendMode: 'normal' } as IStyleLayer
    ],
    textStyle: {
        fontFamily: 'Trajan Pro',
        fontSize: 60,
        color: '#FFFFFF',
        alignHorizontal: 'center',
        alignVertical: 'middle',
        lineHeight: 1.2,
        fontWeight: 'normal'
    },
    updatedAt: Date.now()
};

/**
 * Curated built-in hymn themes crafted on top of multi-layer gradients & refined typography.
 * Note: In SlideBackground, index 0 renders on TOP of subsequent layers.
 */
export const BUILT_IN_HYMN_THEMES: IHymnTheme[] = [
    DEFAULT_HYMN_THEME,
    {
        id: 'builtin-warm-classic',
        name: 'Warm Classic',
        nameRu: 'Тёплая классика',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'warm-glow',
                'radial-gradient(ellipse 80% 70% at 50% 42%, rgba(217, 155, 67, 0.16) 0%, rgba(217, 155, 67, 0) 72%)',
                '#d99b43',
                'transparent',
                0,
                1
            ),
            makeGradientLayer(
                'warm-base',
                'linear-gradient(155deg, #1d1712 0%, #120e0b 55%, #0a0806 100%)',
                '#1d1712',
                '#0a0806',
                155,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'Lora',
            fontSize: 62,
            color: '#F7EFE2',
            alignHorizontal: 'center',
            alignVertical: 'middle',
            lineHeight: 1.28,
            fontWeight: 'normal',
        },
        textEffects: SOFT_DARK_SHADOW,
        textAnchor: 'center',
        updatedAt: 2,
    },
    {
        id: 'builtin-midnight-sky',
        name: 'Midnight Sky',
        nameRu: 'Ночное небо',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'midnight-glow',
                'radial-gradient(ellipse 75% 65% at 50% 30%, rgba(96, 165, 250, 0.17) 0%, rgba(96, 165, 250, 0) 70%)',
                '#60a5fa',
                'transparent',
                0,
                1
            ),
            makeGradientLayer(
                'midnight-base',
                'linear-gradient(160deg, #0e1d3a 0%, #091224 55%, #050912 100%)',
                '#0e1d3a',
                '#050912',
                160,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'Playfair Display',
            fontSize: 62,
            color: '#E4EEFF',
            alignHorizontal: 'center',
            alignVertical: 'middle',
            lineHeight: 1.26,
            fontWeight: 'normal',
        },
        textEffects: SOFT_DARK_SHADOW,
        textAnchor: 'center',
        updatedAt: 2,
    },
    {
        id: 'builtin-solemn-gold',
        name: 'Solemn Gold',
        nameRu: 'Торжество',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'solemn-glow',
                'radial-gradient(ellipse 72% 62% at 50% 45%, rgba(245, 198, 108, 0.15) 0%, rgba(245, 198, 108, 0) 72%)',
                '#f5c66c',
                'transparent',
                0,
                1
            ),
            makeGradientLayer(
                'solemn-base',
                'linear-gradient(145deg, #281017 0%, #16090d 55%, #0b0406 100%)',
                '#281017',
                '#0b0406',
                145,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'Trajan Pro',
            fontSize: 58,
            color: '#F5DFB0',
            alignHorizontal: 'center',
            alignVertical: 'middle',
            lineHeight: 1.25,
            letterSpacing: '0.03em',
            fontWeight: 'normal',
        },
        textEffects: SOFT_DARK_SHADOW,
        textAnchor: 'center',
        updatedAt: 2,
    },
    {
        id: 'builtin-modern-worship',
        name: 'Modern Worship',
        nameRu: 'Современный',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'modern-glow',
                'radial-gradient(ellipse 70% 75% at 18% 35%, rgba(148, 163, 184, 0.16) 0%, rgba(148, 163, 184, 0) 68%)',
                '#94a3b8',
                'transparent',
                0,
                1
            ),
            makeGradientLayer(
                'modern-base',
                'linear-gradient(135deg, #161b24 0%, #0e1117 55%, #08090d 100%)',
                '#161b24',
                '#08090d',
                135,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'Montserrat',
            fontSize: 58,
            color: '#E8EDF5',
            alignHorizontal: 'left',
            alignVertical: 'middle',
            lineHeight: 1.28,
            letterSpacing: '0.01em',
            fontWeight: 'normal',
        },
        textEffects: SOFT_DARK_SHADOW,
        textAnchor: 'center-left',
        updatedAt: 2,
    },
    {
        id: 'builtin-emerald-peace',
        name: 'Emerald Peace',
        nameRu: 'Изумруд',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'emerald-glow',
                'radial-gradient(ellipse 75% 65% at 50% 40%, rgba(52, 211, 153, 0.13) 0%, rgba(52, 211, 153, 0) 70%)',
                '#34d399',
                'transparent',
                0,
                1
            ),
            makeGradientLayer(
                'emerald-base',
                'linear-gradient(150deg, #0c2620 0%, #081815 55%, #040d0b 100%)',
                '#0c2620',
                '#040d0b',
                150,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'Cormorant Garamond',
            fontSize: 68,
            color: '#E4F7F0',
            alignHorizontal: 'center',
            alignVertical: 'middle',
            lineHeight: 1.22,
            fontWeight: 'normal',
        },
        textEffects: SOFT_DARK_SHADOW,
        textAnchor: 'center',
        updatedAt: 2,
    },
    {
        id: 'builtin-light-parchment',
        name: 'Light Parchment',
        nameRu: 'Светлый пергамент',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'parchment-vignette',
                'radial-gradient(ellipse 85% 85% at 50% 50%, rgba(120, 96, 68, 0) 55%, rgba(120, 96, 68, 0.14) 100%)',
                'transparent',
                '#786044',
                0,
                1
            ),
            makeGradientLayer(
                'parchment-base',
                'linear-gradient(160deg, #F8F3E9 0%, #EFE8D9 60%, #E7DEC9 100%)',
                '#F8F3E9',
                '#E7DEC9',
                160,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'PT Serif',
            fontSize: 60,
            color: '#3B2A1E',
            alignHorizontal: 'center',
            alignVertical: 'middle',
            lineHeight: 1.28,
            fontWeight: 'normal',
        },
        textAnchor: 'center',
        updatedAt: 2,
    },
    {
        id: 'builtin-lower-third',
        name: 'Lower Third',
        nameRu: 'Нижняя треть',
        isBuiltIn: true,
        isDefault: false,
        background: [
            makeGradientLayer(
                'lower-scrim',
                'linear-gradient(180deg, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0.78) 100%)',
                'transparent',
                '#000000',
                180,
                1
            ),
            makeGradientLayer(
                'lower-base',
                'linear-gradient(180deg, #12141a 0%, #090a0d 100%)',
                '#12141a',
                '#090a0d',
                180,
                1
            ),
        ],
        textStyle: {
            fontFamily: 'PT Sans',
            fontSize: 52,
            color: '#EEF1F6',
            alignHorizontal: 'center',
            alignVertical: 'bottom',
            lineHeight: 1.25,
            fontWeight: 'normal',
        },
        textEffects: CRISP_SUBTITLE_SHADOW,
        textAnchor: 'bottom-center',
        updatedAt: 2,
    },
    ...ADDITIONAL_HYMN_THEMES,
];

/**
 * Extracts a compact CSS background string from an IHymnTheme for dropdown swatches.
 */
export function getHymnThemeSwatchBackground(theme: Partial<Pick<IHymnTheme, 'background'>>): string {
    const layers = theme.background || [];
    const baseLayer = layers[layers.length - 1];
    if (!baseLayer) return '#000000';
    if (baseLayer.type === 'gradient') {
        return baseLayer.gradient?.cssGradient
            || `linear-gradient(${baseLayer.gradient?.angle ?? 135}deg, ${baseLayer.gradient?.from ?? '#000'}, ${baseLayer.gradient?.to ?? '#000'})`;
    }
    if (baseLayer.type === 'color' && baseLayer.color) {
        return baseLayer.color;
    }
    return '#1c1917';
}
