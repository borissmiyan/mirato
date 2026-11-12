import React, { memo } from 'react';
import { ICanvasEffect } from '@/core/types';

interface NoiseEffectRendererProps {
    noise: ICanvasEffect;
    borderRadius: string;
    hasRadius: boolean;
    idPrefix: string;
}

/**
 * Performance-optimized SVG noise filter renderer.
 * Memoized to prevent heavy offscreen GPU filter recreations when parent properties change.
 */
export const NoiseEffectRenderer: React.FC<NoiseEffectRendererProps> = memo(({
    noise,
    borderRadius,
    hasRadius,
    idPrefix,
}) => {
    const filterId = `noise-${idPrefix}-${noise.id}`;
    const baseFreq = Math.max(0.1, (noise.noiseScale ?? 65) / 100);
    const softness = noise.noiseSoftness && noise.noiseSoftness > 0 ? (noise.noiseSoftness / 100) * 3 : null;

    return (
        <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay z-50"
            style={{
                opacity: (noise.blur ?? 20) / 100,
                borderRadius,
                overflow: hasRadius ? 'hidden' : 'visible',
                transform: 'translateZ(0)',
                willChange: 'opacity',
            }}
        >
            <svg className="w-full h-full contrast-125 opacity-75 pointer-events-none" aria-hidden="true">
                <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves="1" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                    {softness !== null && (
                        <feGaussianBlur stdDeviation={softness} />
                    )}
                </filter>
                <rect width="100%" height="100%" filter={`url(#${filterId})`} />
            </svg>
        </div>
    );
});

NoiseEffectRenderer.displayName = 'NoiseEffectRenderer';

