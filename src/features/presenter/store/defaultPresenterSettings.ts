import { PresenterSettings } from '@/core/types';

export const DEFAULT_SETTINGS: PresenterSettings = {
    background: [
        {
            id: 'default-bg',
            type: 'gradient',
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            gradient: {
                from: '#1c1917', // stone-900
                to: '#0c0a09', // stone-950
                angle: 135
            },
            adjustments: {
                brightness: 100,
                contrast: 100,
                exposure: 0,
                saturation: 100,
                vibrance: 0,
                hue: 0,
                blur: 0,
                dimmingColor: '#000000',
                dimmingOpacity: 0
            },
            media: {
                speed: 1,
                isLooping: true,
                framing: 'fill',
                scale: 1
            }
        }
    ],
    font: {
        family: 'serif',
        weight: '400',
        size: 56, // 3.5rem * 16
        color: '#f5f5f4', // stone-100
        shadow: false,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        showSuperscript: true
    },
    reference: {
        style: 'classic',
        position: 'bottom',
        opacity: 0.9,
        scale: 0.4,
        fontSize: 19, // ~1.2rem * 16
        color: '#f5f5f4', // stone-100
        fontFamily: 'sans'
    },
    translationLabel: {
        enabled: true,
        color: '#f5f5f4', // stone-100
        opacity: 0.3,
        fontSize: 13, // ~0.8rem * 16
        fontFamily: 'sans'
    },
    display: {
        autoDefine: true,
        cornerRadius: 0,
        referenceGap: 16,
        translationGap: 32,
        verseGap: 24,
        padding: {
            top: 48,
            bottom: 48,
            left: 64,
            right: 64
        }
    },
    logo: {
        activeLogoId: null,
        customLogos: [],
        customGroups: [],
        logoGroups: []
    },
    stage: {
        enabled: false,
        layout: [
            { id: 'current', visible: true, x: 0, y: 0, w: 8, h: 8 },
            { id: 'next', visible: true, x: 8, y: 0, w: 4, h: 4 },
            { id: 'prev', visible: true, x: 8, y: 4, w: 4, h: 4 },
            { id: 'sound', visible: true, x: 0, y: 8, w: 12, h: 2 }
        ],
        gap: 24,
        cornerRadius: 24,
        showRemoteQr: false
    },
    audio: {
        defaultFadeDuration: 1.0
    },
    overrides: {
        blackout: {
            background: [{
                id: 'blackout-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#000000',
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        },
        whiteout: {
            background: [{
                id: 'whiteout-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#ffffff',
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        },
        logo: {
            background: [{
                id: 'logo-bg',
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: '#0c0a09', // stone-950
                adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
            }]
        }
    }
};

