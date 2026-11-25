import { IHymnTheme, TextAnchor } from '@/core/types/hymn';
import { IStyleLayer } from '@/core/types/style';
import { ICanvasEffect, TextAlignHorizontal, TextAlignVertical } from '@/core/types/canvas';

interface PresetSpec {
    id: string;
    name: string;
    nameRu: string;
    baseCss: string;
    baseFrom: string;
    baseTo: string;
    baseAngle?: number;
    glowCss?: string;
    glowFrom?: string;
    glowTo?: string;
    fontFamily: string;
    fontSize?: number;
    color: string;
    lineHeight?: number;
    letterSpacing?: string;
    alignHorizontal?: TextAlignHorizontal;
    alignVertical?: TextAlignVertical;
    textAnchor?: TextAnchor;
    shadow?: 'soft' | 'crisp' | 'none';
}

const SOFT_SHADOW: ICanvasEffect[] = [
    { id: 'preset-soft-shadow', type: 'drop-shadow', visible: true, color: 'rgba(0, 0, 0, 0.55)', x: 0, y: 4, blur: 18 },
];

const CRISP_SHADOW: ICanvasEffect[] = [
    { id: 'preset-crisp-shadow', type: 'drop-shadow', visible: true, color: 'rgba(0, 0, 0, 0.85)', x: 0, y: 3, blur: 12 },
];

function buildPresetTheme(spec: PresetSpec): IHymnTheme {
    const layers: IStyleLayer[] = [];

    if (spec.glowCss) {
        layers.push({
            id: `${spec.id}-glow`,
            type: 'gradient',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            gradient: {
                type: spec.glowCss.startsWith('radial') ? 'radial' : 'linear',
                from: spec.glowFrom || 'transparent',
                to: spec.glowTo || 'transparent',
                angle: 0,
                cssGradient: spec.glowCss,
            },
        });
    }

    layers.push({
        id: `${spec.id}-base`,
        type: 'gradient',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        gradient: {
            type: spec.baseCss.startsWith('radial') ? 'radial' : 'linear',
            from: spec.baseFrom,
            to: spec.baseTo,
            angle: spec.baseAngle ?? 160,
            cssGradient: spec.baseCss,
        },
    });

    const textEffects = spec.shadow === 'none'
        ? undefined
        : spec.shadow === 'crisp'
            ? CRISP_SHADOW
            : SOFT_SHADOW;

    return {
        id: spec.id,
        name: spec.name,
        nameRu: spec.nameRu,
        isBuiltIn: true,
        isDefault: false,
        background: layers,
        textStyle: {
            fontFamily: spec.fontFamily,
            fontSize: spec.fontSize ?? 60,
            color: spec.color,
            alignHorizontal: spec.alignHorizontal ?? 'center',
            alignVertical: spec.alignVertical ?? 'middle',
            lineHeight: spec.lineHeight ?? 1.26,
            ...(spec.letterSpacing ? { letterSpacing: spec.letterSpacing } : {}),
            fontWeight: 'normal',
        },
        ...(textEffects ? { textEffects } : {}),
        textAnchor: spec.textAnchor ?? 'center',
        updatedAt: 2,
    };
}

/**
 * 20 additional curated built-in hymn themes crafted on multi-layer gradients and harmonious typography.
 * Dark themes use subtle background-tinted light ink; light themes use rich deep matching hues (espresso, burgundy, navy, umber).
 */
export const ADDITIONAL_HYMN_THEMES: IHymnTheme[] = [
    buildPresetTheme({
        id: 'builtin-dawn-amber',
        name: 'Amber Dawn',
        nameRu: 'Янтарный рассвет',
        baseCss: 'linear-gradient(170deg, #1b1214 0%, #2b1812 60%, #140b09 100%)',
        baseFrom: '#1b1214',
        baseTo: '#140b09',
        baseAngle: 170,
        glowCss: 'radial-gradient(ellipse 85% 55% at 50% 95%, rgba(251, 146, 60, 0.24) 0%, rgba(251, 146, 60, 0) 72%)',
        glowFrom: '#fb923c',
        fontFamily: 'Lora',
        fontSize: 62,
        color: '#FFEDD8',
    }),
    buildPresetTheme({
        id: 'builtin-aurora-teal',
        name: 'Northern Aurora',
        nameRu: 'Северное сияние',
        baseCss: 'linear-gradient(160deg, #071923 0%, #09212a 50%, #040d14 100%)',
        baseFrom: '#071923',
        baseTo: '#040d14',
        glowCss: 'radial-gradient(ellipse 80% 50% at 35% 15%, rgba(45, 212, 191, 0.20) 0%, rgba(45, 212, 191, 0) 70%)',
        glowFrom: '#2dd4bf',
        fontFamily: 'Raleway',
        fontSize: 60,
        color: '#DFFAF6',
        letterSpacing: '0.015em',
    }),
    buildPresetTheme({
        id: 'builtin-royal-purple',
        name: 'Royal Amethyst',
        nameRu: 'Королевский пурпур',
        baseCss: 'linear-gradient(150deg, #1f1135 0%, #120a21 58%, #080410 100%)',
        baseFrom: '#1f1135',
        baseTo: '#080410',
        baseAngle: 150,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 38%, rgba(167, 139, 250, 0.17) 0%, rgba(167, 139, 250, 0) 70%)',
        glowFrom: '#a78bfa',
        fontFamily: 'Playfair Display',
        fontSize: 62,
        color: '#EFE8FF',
    }),
    buildPresetTheme({
        id: 'builtin-terracotta-warm',
        name: 'Autumn Harvest',
        nameRu: 'Осенняя жатва',
        baseCss: 'linear-gradient(145deg, #2b1710 0%, #1c100b 55%, #0f0906 100%)',
        baseFrom: '#2b1710',
        baseTo: '#0f0906',
        baseAngle: 145,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 42%, rgba(234, 88, 12, 0.16) 0%, rgba(234, 88, 12, 0) 72%)',
        glowFrom: '#ea580c',
        fontFamily: 'Merriweather',
        fontSize: 56,
        color: '#FCE8D5',
        lineHeight: 1.32,
    }),
    buildPresetTheme({
        id: 'builtin-deep-ocean',
        name: 'Deep Ocean',
        nameRu: 'Океанская глубина',
        baseCss: 'linear-gradient(165deg, #082032 0%, #0b2c44 50%, #05111c 100%)',
        baseFrom: '#082032',
        baseTo: '#05111c',
        baseAngle: 165,
        glowCss: 'radial-gradient(ellipse 75% 60% at 50% 35%, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0) 70%)',
        glowFrom: '#38bdf8',
        fontFamily: 'PT Serif',
        fontSize: 62,
        color: '#E0F4FF',
    }),
    buildPresetTheme({
        id: 'builtin-starlight-indigo',
        name: 'Starlight Indigo',
        nameRu: 'Звёздная ночь',
        baseCss: 'linear-gradient(155deg, #131638 0%, #0b0e24 55%, #050712 100%)',
        baseFrom: '#131638',
        baseTo: '#050712',
        baseAngle: 155,
        glowCss: 'radial-gradient(ellipse 70% 60% at 50% 25%, rgba(129, 140, 248, 0.18) 0%, rgba(129, 140, 248, 0) 70%)',
        glowFrom: '#818cf8',
        fontFamily: 'Cormorant Garamond',
        fontSize: 68,
        color: '#E5E9FF',
        lineHeight: 1.22,
    }),
    buildPresetTheme({
        id: 'builtin-bronze-sanctuary',
        name: 'Bronze Sanctuary',
        nameRu: 'Бронзовый зал',
        baseCss: 'linear-gradient(150deg, #241b12 0%, #15100a 55%, #0a0704 100%)',
        baseFrom: '#241b12',
        baseTo: '#0a0704',
        baseAngle: 150,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 45%, rgba(217, 119, 6, 0.16) 0%, rgba(217, 119, 6, 0) 72%)',
        glowFrom: '#d97706',
        fontFamily: 'Trajan Pro',
        fontSize: 58,
        color: '#F9E4B7',
        letterSpacing: '0.03em',
    }),
    buildPresetTheme({
        id: 'builtin-forest-moss',
        name: 'Forest Moss',
        nameRu: 'Лесной мох',
        baseCss: 'linear-gradient(155deg, #142113 0%, #0d160c 55%, #060b06 100%)',
        baseFrom: '#142113',
        baseTo: '#060b06',
        baseAngle: 155,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 42%, rgba(132, 204, 22, 0.12) 0%, rgba(132, 204, 22, 0) 70%)',
        glowFrom: '#84cc16',
        fontFamily: 'Alice',
        fontSize: 64,
        color: '#ECF7DF',
    }),
    buildPresetTheme({
        id: 'builtin-soft-lavender',
        name: 'Evening Lavender',
        nameRu: 'Вечерняя лаванда',
        baseCss: 'linear-gradient(150deg, #25172b 0%, #160e1a 55%, #0a070d 100%)',
        baseFrom: '#25172b',
        baseTo: '#0a070d',
        baseAngle: 150,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 38%, rgba(216, 180, 254, 0.15) 0%, rgba(216, 180, 254, 0) 70%)',
        glowFrom: '#d8b4fe',
        fontFamily: 'Crimson Pro',
        fontSize: 68,
        color: '#F4E8FA',
        lineHeight: 1.22,
    }),
    buildPresetTheme({
        id: 'builtin-christmas-pine',
        name: 'Christmas Pine',
        nameRu: 'Рождественская ель',
        baseCss: 'linear-gradient(160deg, #0b2419 0%, #071710 55%, #040c08 100%)',
        baseFrom: '#0b2419',
        baseTo: '#040c08',
        glowCss: 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(250, 204, 21, 0.15) 0%, rgba(250, 204, 21, 0) 70%)',
        glowFrom: '#facc15',
        fontFamily: 'Playfair Display',
        fontSize: 62,
        color: '#FDF3C4',
    }),
    buildPresetTheme({
        id: 'builtin-easter-dawn',
        name: 'Easter Morning',
        nameRu: 'Пасхальное утро',
        baseCss: 'linear-gradient(160deg, #FFFBF0 0%, #F7EDD6 60%, #EFE0BE 100%)',
        baseFrom: '#FFFBF0',
        baseTo: '#EFE0BE',
        glowCss: 'radial-gradient(ellipse 85% 85% at 50% 50%, rgba(180, 130, 60, 0) 55%, rgba(180, 130, 60, 0.14) 100%)',
        glowFrom: 'transparent',
        glowTo: '#b4823c',
        fontFamily: 'Cormorant Garamond',
        fontSize: 68,
        color: '#4A3518',
        lineHeight: 1.22,
        shadow: 'none',
    }),
    buildPresetTheme({
        id: 'builtin-clean-minimal',
        name: 'Clean Minimal',
        nameRu: 'Чистый минимализм',
        baseCss: 'linear-gradient(135deg, #1a1a1f 0%, #111114 55%, #09090b 100%)',
        baseFrom: '#1a1a1f',
        baseTo: '#09090b',
        baseAngle: 135,
        fontFamily: 'Inter',
        fontSize: 58,
        color: '#F2F2F5',
        alignHorizontal: 'left',
        textAnchor: 'center-left',
        lineHeight: 1.3,
    }),
    buildPresetTheme({
        id: 'builtin-nordic-light',
        name: 'Nordic Light',
        nameRu: 'Скандинавский свет',
        baseCss: 'linear-gradient(155deg, #F8FAFC 0%, #EEF2F6 60%, #E2E8F0 100%)',
        baseFrom: '#F8FAFC',
        baseTo: '#E2E8F0',
        baseAngle: 155,
        fontFamily: 'Montserrat',
        fontSize: 56,
        color: '#1E324B',
        alignHorizontal: 'left',
        textAnchor: 'center-left',
        lineHeight: 1.3,
        shadow: 'none',
    }),
    buildPresetTheme({
        id: 'builtin-rose-dusk',
        name: 'Rose Dusk',
        nameRu: 'Розовый закат',
        baseCss: 'linear-gradient(150deg, #2d141d 0%, #1b0c12 55%, #0e0609 100%)',
        baseFrom: '#2d141d',
        baseTo: '#0e0609',
        baseAngle: 150,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 40%, rgba(251, 113, 133, 0.16) 0%, rgba(251, 113, 133, 0) 70%)',
        glowFrom: '#fb7185',
        fontFamily: 'Lora',
        fontSize: 62,
        color: '#FFE4EA',
    }),
    buildPresetTheme({
        id: 'builtin-slate-editorial',
        name: 'Editorial Top',
        nameRu: 'Редакторский верх',
        baseCss: 'linear-gradient(145deg, #1b222c 0%, #11161d 55%, #090c10 100%)',
        baseFrom: '#1b222c',
        baseTo: '#090c10',
        baseAngle: 145,
        glowCss: 'radial-gradient(ellipse 70% 55% at 15% 15%, rgba(148, 163, 184, 0.15) 0%, rgba(148, 163, 184, 0) 68%)',
        glowFrom: '#94a3b8',
        fontFamily: 'PT Sans',
        fontSize: 56,
        color: '#E6EDF5',
        alignHorizontal: 'left',
        alignVertical: 'top',
        textAnchor: 'top-left',
        lineHeight: 1.28,
    }),
    buildPresetTheme({
        id: 'builtin-golden-honey',
        name: 'Golden Honey',
        nameRu: 'Тёплый мёд',
        baseCss: 'linear-gradient(155deg, #291d0c 0%, #1a1207 55%, #0d0904 100%)',
        baseFrom: '#291d0c',
        baseTo: '#0d0904',
        baseAngle: 155,
        glowCss: 'radial-gradient(ellipse 75% 65% at 50% 45%, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0) 72%)',
        glowFrom: '#f59e0b',
        fontFamily: 'Merriweather',
        fontSize: 56,
        color: '#FEF0C7',
        lineHeight: 1.32,
    }),
    buildPresetTheme({
        id: 'builtin-silver-moon',
        name: 'Silver Moon',
        nameRu: 'Лунное серебро',
        baseCss: 'linear-gradient(160deg, #1f242d 0%, #14181f 55%, #0b0d11 100%)',
        baseFrom: '#1f242d',
        baseTo: '#0b0d11',
        glowCss: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(226, 232, 240, 0.14) 0%, rgba(226, 232, 240, 0) 68%)',
        glowFrom: '#e2e8f0',
        fontFamily: 'Raleway',
        fontSize: 60,
        color: '#E6EBF2',
        letterSpacing: '0.02em',
    }),
    buildPresetTheme({
        id: 'builtin-communion-wine',
        name: 'Communion',
        nameRu: 'Вечеря',
        baseCss: 'linear-gradient(155deg, #2c0d14 0%, #19070b 55%, #0b0305 100%)',
        baseFrom: '#2c0d14',
        baseTo: '#0b0305',
        baseAngle: 155,
        glowCss: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(225, 29, 72, 0.15) 0%, rgba(225, 29, 72, 0) 72%)',
        glowFrom: '#e11d48',
        fontFamily: 'Cormorant Garamond',
        fontSize: 66,
        color: '#FCE2E8',
        lineHeight: 1.24,
    }),
    buildPresetTheme({
        id: 'builtin-blush-burgundy',
        name: 'Blush Burgundy',
        nameRu: 'Пудра и бургунди',
        baseCss: 'linear-gradient(155deg, #FDF2F4 0%, #F7E4E8 58%, #EFD5DC 100%)',
        baseFrom: '#FDF2F4',
        baseTo: '#EFD5DC',
        baseAngle: 155,
        glowCss: 'radial-gradient(ellipse 85% 85% at 50% 50%, rgba(136, 19, 55, 0) 55%, rgba(136, 19, 55, 0.09) 100%)',
        glowFrom: 'transparent',
        glowTo: '#881337',
        fontFamily: 'Playfair Display',
        fontSize: 60,
        color: '#5C1629',
        lineHeight: 1.28,
        shadow: 'none',
    }),
    buildPresetTheme({
        id: 'builtin-lower-third-serif',
        name: 'Lower Third Classic',
        nameRu: 'Нижняя треть — Классика',
        baseCss: 'linear-gradient(180deg, #171310 0%, #0b0907 100%)',
        baseFrom: '#171310',
        baseTo: '#0b0907',
        baseAngle: 180,
        glowCss: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 46%, rgba(0, 0, 0, 0.78) 100%)',
        glowFrom: 'transparent',
        glowTo: '#000000',
        fontFamily: 'Lora',
        fontSize: 54,
        color: '#F5ECDC',
        alignVertical: 'bottom',
        textAnchor: 'bottom-center',
        lineHeight: 1.26,
        shadow: 'crisp',
    }),
];
