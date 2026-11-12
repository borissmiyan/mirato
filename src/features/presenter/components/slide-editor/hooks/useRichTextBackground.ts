import React, { useEffect, useState } from 'react';
import { IStyleLayer } from '@/core/types/style';
import { mediaCache } from '@/core/utils/mediaCache';

/**
 * Hook to compile multiple rich background layers (color, images) into a single
 * WebKit-clipped text background CSS style object.
 */
export function useRichTextBackground(fills: IStyleLayer[]): React.CSSProperties | null {
    const [dynamicCSS, setDynamicCSS] = useState<React.CSSProperties | null>(null);

    useEffect(() => {
        let active = true;

        const compileBackgroundStyles = async () => {
            const hasRichMedia = fills.some(f => f.type !== 'color');
            if (!hasRichMedia) {
                if (active) setDynamicCSS(null);
                return;
            }

            const bgImages: string[] = [];
            const bgBlendModes: string[] = [];
            const bgSizes: string[] = [];
            const bgPositions: string[] = [];

            for (const layer of fills) {
                if (layer.visible === false) continue;

                const opacity = layer.opacity ?? 1;
                const blendMode = layer.blendMode || 'normal';

                if (layer.type === 'color' && layer.color) {
                    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
                    const baseHex = layer.color.length === 9 ? layer.color.substring(0, 7) : layer.color.padEnd(7, '0');
                    const finalOutputColor = baseHex + alphaHex;

                    bgImages.push(`linear-gradient(${finalOutputColor}, ${finalOutputColor})`);
                    bgBlendModes.push(blendMode);
                    bgSizes.push('100% 100%');
                    bgPositions.push('left top');
                } else if (layer.type === 'image' && layer.image) {
                    const resolvedUrl = layer.image.url;
                    const isRemote = !window.electron?.ipcRenderer;
                    let dbUrl: string | null = null;

                    if (!isRemote && layer.image.isFromDb && layer.image.id) {
                        try {
                            const cachedUrl = await mediaCache.getBackgroundUrl(layer.image.id);
                            if (cachedUrl) dbUrl = cachedUrl;
                        } catch (e) {
                            console.error('Failed caching text background layer', e);
                        }
                    }

                    const displayUrl = (isRemote && resolvedUrl && !resolvedUrl.startsWith('blob:'))
                        ? resolvedUrl
                        : (dbUrl || (resolvedUrl && !resolvedUrl.startsWith('blob:') ? resolvedUrl : null));

                    if (displayUrl && String(displayUrl).toLowerCase() !== 'null') {
                        let imgToken = `url("${displayUrl}")`;
                        if (opacity < 1) {
                            imgToken = `cross-fade(transparent ${(1 - opacity) * 100}%, url("${displayUrl}") ${opacity * 100}%)`;
                        }
                        bgImages.push(imgToken);
                        bgBlendModes.push(blendMode);
                        bgSizes.push('cover');
                        bgPositions.push('center center');
                    }
                }
            }

            if (!active) return;

            if (bgImages.length > 0) {
                setDynamicCSS({
                    backgroundImage: bgImages.join(', '),
                    backgroundBlendMode: bgBlendModes.join(', '),
                    backgroundSize: bgSizes.join(', '),
                    backgroundPosition: bgPositions.join(', '),
                    backgroundRepeat: 'no-repeat',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                });
            } else {
                setDynamicCSS(null);
            }
        };

        compileBackgroundStyles();
        return () => {
            active = false;
        };
    }, [fills]);

    return dynamicCSS;
}

