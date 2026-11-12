import React, { useState, useEffect, useMemo } from 'react';
import { IStyleLayer, BackgroundSettings, IBackgroundEntry } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { ensureLayers } from '@/core/utils/styleMigration';
import { mediaCache } from '@/core/utils/mediaCache';
import { isOpaqueNormalLayer } from '@/core/utils/blendEngine';

interface SlideBackgroundProps {
    background: IStyleLayer[] | BackgroundSettings | undefined;
    className?: string;
    showOverlay?: boolean; // Legacy overlay support
    isPreview?: boolean;
}

export const SlideBackground: React.FC<SlideBackgroundProps> = ({ background, className, showOverlay = false, isPreview = false }) => {
    const layers = ensureLayers(background);
    const visibleLayers = layers;

    return (
        <div 
            className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}
            style={{ isolation: 'isolate' }}
        >
            {visibleLayers.map((layer, index) => (
                <LayerRenderer
                    key={layer.id || index}
                    layer={layer}
                    zIndex={(visibleLayers.length - index) * 10}
                    isPreview={isPreview}
                />
            ))}
            {showOverlay && <div className="absolute inset-0 bg-black/40 z-50" />}
        </div>
    );
};

import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import { canvasResolutionAtom } from '@/core/store/uiAtoms';

const LayerRenderer: React.FC<{ layer: IStyleLayer; zIndex: number; isPreview?: boolean }> = ({ layer, zIndex, isPreview = false }) => {
    const [dbUrl, setDbUrl] = useState<string | null>(null);
    const canvasResolution = useAtomValue(canvasResolutionAtom);
    
    const mediaId = layer.type === 'image' ? layer.image?.id : layer.video?.id;
    const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;

    const isRemote = !window.electron?.ipcRenderer;

    // Use live query to reactively wait for the media to appear in DB
    const bgEntry = useLiveQuery(
        async () => {
            if (isRemote || !isFromDb || !mediaId) return null;
            return (await db.backgrounds.get(mediaId)) || (await db.mediaPool.get(mediaId));
        },
        [mediaId, isFromDb, isRemote]
    );

    const hasBgEntry = !!bgEntry;
    useEffect(() => {
        let isMounted = true;
        const updateUrl = async () => {
            if (isFromDb && mediaId) {
                // getBackgroundUrl will fetch from DB and put in cache if missing
                const url = await mediaCache.getBackgroundUrl(mediaId, {
                    resolution: isPreview ? canvasResolution : 'full',
                    isProjector: !isPreview,
                    mediaType: layer.type === 'video' ? 'video' : (layer.type === 'image' ? 'image' : undefined),
                });
                if (isMounted) setDbUrl(url);
            } else {
                if (isMounted) setDbUrl(null);
            }
        };

        updateUrl();
        return () => {
            isMounted = false;
        };
    }, [mediaId, isFromDb, hasBgEntry, isPreview, canvasResolution]);

    if (layer.visible === false) return null;

    const adjustments = layer.adjustments || {
        brightness: 100, contrast: 100, exposure: 0,
        saturation: 100, vibrance: 0, hue: 0, blur: 0
    };

    // Calculate filter string
    // Exposure maps to a combination of brightness and contrast
    const brightness = (adjustments.brightness ?? 100) * (1 + ((adjustments.exposure ?? 0) / 100));
    const contrast = (adjustments.contrast ?? 100) * (1 + (Math.abs(adjustments.exposure ?? 0) / 200));

    const filterString = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        `saturate(${(adjustments.saturation ?? 100) + (adjustments.vibrance ?? 0) * 0.5}%)`,
        `hue-rotate(${adjustments.hue ?? 0}deg)`,
        `blur(${adjustments.blur ?? 0}px)`,
    ].join(' ');

    const wrapperScale = (adjustments.blur || 0) > 0 ? 1 + ((adjustments.blur || 0) * 2.5) / 1000 : 1;

    const wrapperStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex,
        opacity: layer.opacity,
        mixBlendMode: layer.blendMode as React.CSSProperties['mixBlendMode'],
    };

    const contentStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        filter: filterString,
        transform: `scale(${wrapperScale})`,
        transformOrigin: 'center center',
    };

    const renderLayerContent = () => {
        const isFromDb = layer.type === 'image' ? layer.image?.isFromDb : layer.video?.isFromDb;
        const persistentUrl = (layer.type === 'image' ? layer.image?.url : layer.video?.url) || '';
        
        // If the media is from DB, we ONLY want to use the dbUrl (blob created from the DB blob).
        // On the Remote Controller (browser), dbUrl will be null because the local DB is empty.
        // We fallback to the persistentUrl if it's already been proxied (doesn't start with blob:)
        const isRemote = !window.electron?.ipcRenderer;
        
        // Helper to check if a string is a valid URL and not just a raw hash ID
        const isValidUrl = (url: string) => {
            if (!url) return false;
            return url.startsWith('http://') || 
                   url.startsWith('https://') || 
                   url.startsWith('blob:') || 
                   url.startsWith('data:') || 
                   url.startsWith('file:') ||
                   url.startsWith('local-resource:');
        };

        let displayUrl: string | null = null;
        if (isRemote && persistentUrl && isValidUrl(persistentUrl)) {
            displayUrl = persistentUrl;
        } else if (dbUrl) {
            displayUrl = dbUrl;
        } else if (persistentUrl && isValidUrl(persistentUrl) && !persistentUrl.startsWith('blob:')) {
            displayUrl = persistentUrl;
        } else if (isRemote && mediaId) {
            const port = 3211;
            const host = window.location.hostname ? `${window.location.protocol}//${window.location.hostname}:${port}` : `http://127.0.0.1:${port}`;
            displayUrl = `${host}/media/${mediaId}`;
        }
        
        switch (layer.type) {
            case 'color':
                return <div className="w-full h-full" style={{ backgroundColor: layer.color }} />;
            case 'gradient':
                return (
                    <div
                        className="w-full h-full"
                        style={{
                            background: layer.gradient?.cssGradient || `linear-gradient(${layer.gradient?.angle}deg, ${layer.gradient?.from}, ${layer.gradient?.to})`
                        }}
                    />
                );
            case 'image':
                if (!displayUrl) return null;
                const crop = layer.image?.crop;

                const handleImageError = () => {
                    console.warn('[SlideBackground] Image failed to render, recovering fresh blob from DB:', displayUrl);
                    if (mediaId && isFromDb) {
                        mediaCache.delete(`${mediaId}_proxy`);
                        mediaCache.delete(mediaId);
                        db.backgrounds.get(mediaId).then(entry => {
                            if (entry?.data) {
                                const directUrl = mediaCache.put(mediaId, entry.data);
                                setDbUrl(directUrl);
                            }
                        }).catch(() => {});
                    }
                };
                
                if (crop) {
                    return (
                        <div className="absolute inset-0 overflow-hidden">
                            <img
                                src={displayUrl}
                                onError={handleImageError}
                                className="absolute max-w-none max-h-none transition-all duration-500 object-cover min-w-full min-h-full"
                                style={{
                                    top: `-${(crop.y / crop.height) * 100}%`,
                                    left: `-${(crop.x / crop.width) * 100}%`,
                                    width: `${(100 / crop.width) * 100}%`,
                                    height: `${(100 / crop.height) * 100}%`,
                                    transform: `scale(${layer.media?.scale || 1})`,
                                    transformOrigin: 'center center'
                                }}
                                alt=""
                            />
                        </div>
                    );
                }

                return (
                    <img
                        src={displayUrl}
                        onError={handleImageError}
                        className={cn(
                            "w-full h-full transition-all duration-500",
                            layer.media?.framing === 'fit' ? "object-contain" : (layer.media?.framing === 'stretch' ? "object-fill" : "object-cover")
                        )}
                        style={{
                            transform: `scale(${layer.media?.scale || 1})`
                        }}
                        alt=""
                    />
                );
            case 'video':
                if (layer.video?.source === 'youtube') {
                    return (
                        <div className="absolute inset-0 overflow-hidden">
                            {!isPreview ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${layer.video?.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${layer.video?.id}&rel=0&showinfo=0`}
                                    className="w-[300%] h-[300%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                    allow="autoplay; encrypted-media"
                                    style={{
                                        transform: `translate(-50%, -50%) scale(${layer.media?.scale || 1})`
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                                    <span className="text-xs text-white/40 font-mono">YouTube</span>
                                </div>
                            )}
                        </div>
                    );
                }
                if (!displayUrl) return null;
                return (
                    <video
                        src={displayUrl}
                        autoPlay={!isPreview}
                        playsInline
                        preload={isPreview ? "metadata" : "auto"}
                        muted={isPreview ? true : (layer.video?.isMuted ?? layer.media?.isMuted)}
                        loop={!isPreview && (layer.video?.isLooping ?? layer.media?.isLooping)}
                        className={cn(
                            "w-full h-full transition-all duration-500",
                            layer.media?.framing === 'fit' ? "object-contain" : (layer.media?.framing === 'stretch' ? "object-fill" : "object-cover")
                        )}
                        style={{
                            transform: `scale(${layer.media?.scale || 1})`
                        }}
                        ref={(el) => {
                            if (el && layer.media?.speed && !isPreview) {
                                el.playbackRate = layer.media.speed;
                            }
                        }}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div style={wrapperStyle}>
            <div style={contentStyle}>
                {renderLayerContent()}
            </div>
            {/* Per-layer Vignette Overlay */}
            {layer.adjustments?.dimmingOpacity !== undefined && layer.adjustments.dimmingOpacity > 0 && (
                <div
                    className="absolute inset-0"
                    style={{
                        background: `radial-gradient(
                            ${layer.adjustments.vignetteRadiusX ?? 50}% ${layer.adjustments.vignetteRadiusY ?? 50}% at 50% 50%, 
                            transparent 0%, 
                            transparent ${Math.max(0, 100 - (layer.adjustments.vignetteBlur ?? 50))}%,
                            ${layer.adjustments.dimmingColor || '#000'} 100%
                        )`,
                        opacity: layer.adjustments.dimmingOpacity
                    }}
                />
            )}

            {/* Case 'noise' Layer rendering */}
            {layer.type === 'noise' && (
                <div 
                    className="absolute inset-0 opacity-20 contrast-150 brightness-150 pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                        backgroundSize: '200px 200px',
                        backgroundRepeat: 'repeat',
                    }}
                />
            )}
            
            {/* Per-layer Noise Overlay */}
            {layer.adjustments?.noise !== undefined && layer.adjustments.noise > 0 && (() => {
                const scale = Math.max(0.1, (layer.adjustments.noiseScale ?? 65) / 100);
                const soft = layer.adjustments.noiseSoftness ? (layer.adjustments.noiseSoftness / 100) * 3 : 0;
                
                // Construct a static optimized SVG with embedded values, URL-escaped for data URI usage.
                const svgString = `<svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${scale}" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/>${soft > 0 ? `<feGaussianBlur stdDeviation="${soft}"/>` : ''}</filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
                const encodedSvg = encodeURIComponent(svgString);

                return (
                    <div 
                        className="absolute inset-0 pointer-events-none mix-blend-overlay z-50"
                        style={{ 
                            opacity: layer.adjustments.noise / 100,
                            backgroundImage: `url("data:image/svg+xml,${encodedSvg}")`,
                            backgroundSize: '250px 250px',
                            backgroundRepeat: 'repeat',
                        }}
                    />
                );
            })()}
        </div>
    );
};
