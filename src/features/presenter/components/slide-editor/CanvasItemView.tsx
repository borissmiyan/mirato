import React, { useRef, useId, memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectedCanvasItemIdsAtom, fontPreviewFamilyAtom, fontPreviewWeightAtom } from '@/core/store/uiAtoms';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { ensureLayers, ensureEffects } from '@/core/utils/styleMigration';
import { getEffectsStyle } from '@/core/utils/effectUtils';
import { SlideBackground } from '../display/SlideBackground';
import { useTextFit } from '../../hooks/useTextFit';
import { resolveFontFamily } from '@/core/utils/fontResolver';
import { Z_INDEX } from '@/core/constants/zIndex';

import InlineTextEditor from './InlineTextEditor';
import { TextRenderer } from './renderers/TextRenderer';
import { ShapeRenderer } from './renderers/ShapeRenderer';
import { PathRenderer } from './renderers/PathRenderer';
import { StrokeRenderer } from './renderers/StrokeRenderer';
import { EffectRenderer } from './renderers/EffectRenderer';
import { NoiseEffectRenderer } from './renderers/NoiseEffectRenderer';
import { getShapePathData, getNormalizedShapePath } from './renderers/shapeGeometry';
import { nodesToSVGPath, nodesToNormalizedSVGPath } from './renderers/vectorGeometry';

interface CanvasItemViewProps {
    item: ICanvasItem;
    isPreview?: boolean;
    isEditing?: boolean;
    onSave?: (id: string, content: string) => void;
    onInput?: (id: string, content: string) => void;
    onCancel?: () => void;
}

/**
 * Renders a single canvas item based on its type.
 * Optimized with React.memo and modular sub-renderers.
 */
const CanvasItemView: React.FC<CanvasItemViewProps> = ({
    item,
    isPreview = false,
    isEditing = false,
    onSave = () => { },
    onInput = () => { },
    onCancel = () => { }
}) => {
    const rawIdPrefix = useId();
    const idPrefix = useMemo(() => rawIdPrefix.replace(/:/g, ''), [rawIdPrefix]);

    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // Preview font handling
    const selectedIds = useAtomValue(selectedCanvasItemIdsAtom);
    const previewFontFamily = useAtomValue(fontPreviewFamilyAtom);
    const previewFontWeight = useAtomValue(fontPreviewWeightAtom);
    const isSelected = selectedIds.includes(item.id);
    const rawFontFamily = (isSelected && previewFontFamily) ? previewFontFamily : (item.text?.fontFamily || 'Inter');

    const resolvedFont = useMemo(() => resolveFontFamily(rawFontFamily), [rawFontFamily]);
    const activeFontFamily = resolvedFont.cssFontStack;
    const activeFontWeight = (isSelected && previewFontWeight) 
        ? previewFontWeight 
        : (item.text?.fontWeight || resolvedFont.inferredWeight || '400');

    const textData = item.type === 'text' ? item.text : undefined;
    const isText = Boolean(textData);
    const isStroke = item.type === 'stroke';
    const isPath = item.type === 'path';
    const isSquircle = item.type === 'shape' && item.shape?.shapeType === 'rect' && Boolean(item.shape?.cornerSmoothing && item.shape.cornerSmoothing > 0);
    const isNonRectShape = item.type === 'shape' && Boolean(item.shape?.shapeType && item.shape.shapeType !== 'rect');
    const isClippedShape = isNonRectShape || isSquircle || (isPath && Boolean(item.path?.isClosed));
    const clipId = `clip-${idPrefix}-${item.id}`;

    const normalizedClipPathD = useMemo(() => {
        if (!isClippedShape) return '';
        if (item.type === 'shape' && item.shape) {
            return getNormalizedShapePath(item.shape.shapeType, item.shape);
        }
        if (item.type === 'path' && item.path) {
            return nodesToNormalizedSVGPath(item.path.nodes, Boolean(item.path.isClosed));
        }
        return '';
    }, [isClippedShape, item.type, item.shape, item.path]);
    const isAutoHeightText = Boolean(textData && textData.resizingMode === 'auto-height');
    const isFlowText = Boolean(textData && (textData.resizingMode === 'auto-width' || isAutoHeightText));

    const fittedFontSize = useTextFit({
        containerRef,
        textRef,
        resizingMode: textData ? textData.resizingMode || 'auto-height' : 'fixed',
        originalFontSize: textData ? textData.fontSize : 16,
        content: textData ? textData.content : '',
        fontFamily: activeFontFamily,
    });

    const renderContent = () => {
        switch (item.type) {
            case 'text':
                return (
                    <div className={cn("relative overflow-visible", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')}>
                        <TextRenderer
                            item={item}
                            containerRef={containerRef}
                            textRef={textRef}
                            fittedFontSize={fittedFontSize}
                            activeFontFamily={activeFontFamily}
                            activeFontWeight={activeFontWeight}
                            isEditing={isEditing}
                            idPrefix={idPrefix}
                        />
                        {isEditing && (
                            <div className="absolute inset-0" style={{ zIndex: Z_INDEX.CANVAS_EDITOR_OVERLAY }}>
                                <InlineTextEditor
                                    item={item}
                                    fittedFontSize={fittedFontSize}
                                    activeFontFamily={activeFontFamily}
                                    activeFontWeight={activeFontWeight}
                                    onSave={onSave}
                                    onInput={onInput}
                                    onCancel={onCancel}
                                />
                            </div>
                        )}
                    </div>
                );

            case 'image':
            case 'video':
            case 'shape':
                return <ShapeRenderer item={item} idPrefix={idPrefix} />;

            case 'path':
                return <PathRenderer item={item} idPrefix={idPrefix} />;

            case 'stroke':
                if (!item.stroke) return null;
                const strokeColor = item.stroke.color || '#ffffff';
                const strokeWidth = item.borderWidth ?? item.stroke.width ?? 1;
                return (
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <marker id={`arrow-end-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <path d="M 0 0 L 6 3 L 0 6 z" fill={strokeColor} />
                            </marker>
                            <marker id={`arrow-start-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
                                <path d="M 6 0 L 0 3 L 6 6 z" fill={strokeColor} />
                            </marker>
                            <marker id={`circle-end-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                                <circle cx="3" cy="3" r="3" fill={strokeColor} />
                            </marker>
                            <marker id={`circle-start-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                                <circle cx="3" cy="3" r="3" fill={strokeColor} />
                            </marker>
                            <marker id={`triangle-end-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <polygon points="0,0 6,3 0,6" fill={strokeColor} />
                            </marker>
                            <marker id={`triangle-start-${idPrefix}-${item.id}`} markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
                                <polygon points="6,0 0,3 6,6" fill={strokeColor} />
                            </marker>
                        </defs>
                        <line
                            x1="0" y1="50"
                            x2={item.stroke.x2} y2={item.stroke.y2 === 0 ? 50 : item.stroke.y2}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={item.stroke.dashArray}
                            markerStart={item.stroke.startCap && item.stroke.startCap !== 'none' ? `url(#${item.stroke.startCap}-start-${idPrefix}-${item.id})` : undefined}
                            markerEnd={item.stroke.endCap && item.stroke.endCap !== 'none' ? `url(#${item.stroke.endCap}-end-${idPrefix}-${item.id})` : undefined}
                        />
                    </svg>
                );

            case 'effect':
                if (!item.effect) return null;
                return <EffectRenderer effect={item.effect} />;

            default:
                return null;
        }
    };

    const align = item.strokeAlign || 'center';
    const borderWidth = item.borderWidth || 0;
    
    // Fallback: If fills is empty but it's a media item with legacy data, synthesize a layer
    const fills = useMemo(() => {
        const itemFills = item.fills || [];
        const layers = ensureLayers(itemFills);
        if (layers.length > 0) return layers;
        
        // Comprehensive legacy fallback
        if (item.type === 'text' && item.text?.color) {
            return [{
                id: `legacy-text-color-${item.id}`,
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color: item.text.color
            } as IStyleLayer];
        }
        if (item.type === 'image' && item.image) {
            return [{
                id: `legacy-img-${item.id}`,
                type: 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                image: item.image
            } as IStyleLayer];
        }
        if (item.type === 'video' && item.video) {
            return [{
                id: `legacy-vid-${item.id}`,
                type: 'video',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                video: item.video
            } as IStyleLayer];
        }
        return layers;
    }, [item]);

    const strokes = ensureLayers(item.strokes);

    const getBorderRadius = () => {
        if (item.lockBorderRadius !== false) {
            return `var(--item-border-radius, ${item.borderRadius ? `${item.borderRadius}px` : '0px'})`;
        }
        return `${item.borderRadiusTL ?? 0}px ${item.borderRadiusTR ?? 0}px ${item.borderRadiusBR ?? 0}px ${item.borderRadiusBL ?? 0}px`;
    };

    const effects = useMemo(() => ensureEffects(item), [item]);
    const { filter, backdropFilter, boxShadow } = useMemo(() => getEffectsStyle(effects), [effects]);

    const hasAnyRadius = () => {
        if (item.lockBorderRadius !== false) return (item.borderRadius || 0) > 0;
        return (item.borderRadiusTL || 0) > 0 || (item.borderRadiusTR || 0) > 0 ||
            (item.borderRadiusBR || 0) > 0 || (item.borderRadiusBL || 0) > 0;
    };

    if (item.visible === false) return null;

    return (
        <div
            className={cn("overflow-visible", isFlowText ? (isAutoHeightText ? 'w-full relative' : 'relative') : 'w-full h-full relative')}
            style={{ opacity: item.opacity ?? 1 }}
        >
            {/* Filtered Container: Receives drop-shadows and blurs, but isolating noise above it */}
            <div 
                className={cn(isFlowText ? 'overflow-visible' : 'absolute inset-0 w-full h-full overflow-visible')}
                style={{ filter: item.type === 'text' ? undefined : filter }}
            >
                {/* 1. Stroke Layer (If Outside) */}
                {borderWidth > 0 && align === 'outside' && item.type !== 'text' && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: Z_INDEX.CANVAS_ITEM_STROKE }}>
                        <StrokeRenderer item={item} strokes={strokes} align="outside" idPrefix={idPrefix} />
                    </div>
                )}

            {/* 2. Main Element Container (Fill + Content) */}
            <div
                data-corner-radius
                className={cn(isFlowText ? 'relative' : 'absolute inset-0')}
                style={{
                    zIndex: Z_INDEX.CANVAS_ITEM,
                    borderRadius: isClippedShape || isStroke ? undefined : getBorderRadius(),
                    boxShadow: isClippedShape || isStroke ? undefined : boxShadow,
                    backdropFilter: backdropFilter,
                    WebkitBackdropFilter: backdropFilter,
                    isolation: 'isolate',
                    overflow: 'visible',
                }}
            >
                {/* SVG Clip Definition for Clipped Shapes in objectBoundingBox [0, 1] unit space */}
                {isClippedShape && normalizedClipPathD && (
                    <svg
                        className="absolute inset-0 w-0 h-0 pointer-events-none"
                        aria-hidden="true"
                    >
                        <defs>
                            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                                <path d={normalizedClipPathD} />
                            </clipPath>
                        </defs>
                    </svg>
                )}

                {/* Fill Layer Stack (Disabled for text, stroke, and open path elements to match Figma behavior) */}
                {fills.length > 0 && !isText && !isStroke && !(isPath && !item.path?.isClosed) && (
                    <div
                        data-corner-radius
                        className="absolute inset-0"
                        style={{
                            zIndex: Z_INDEX.CANVAS_BACKGROUND,
                            borderRadius: isClippedShape ? undefined : getBorderRadius(),
                            clipPath: isClippedShape ? `url(#${clipId})` : undefined,
                            WebkitClipPath: isClippedShape ? `url(#${clipId})` : undefined,
                            overflow: 'hidden',
                        }}
                    >
                        <SlideBackground background={fills} showOverlay={false} isPreview={isPreview} />
                    </div>
                )}

                {/* Content Layer */}
                <div 
                    className={cn("relative overflow-visible", isFlowText ? (isAutoHeightText ? 'w-full' : '') : 'w-full h-full')} 
                    style={{ 
                        zIndex: Z_INDEX.CANVAS_ITEM,
                        filter: item.type === 'text' ? filter : undefined
                    }}
                >
                    {renderContent()}
                </div>

                {/* 3. Stroke Layer Stack (If Inside or Center) */}
                {borderWidth > 0 && item.type !== 'text' && (align === 'inside' || align === 'center') && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: Z_INDEX.CANVAS_ITEM_STROKE }}>
                        <StrokeRenderer item={item} strokes={strokes} align={align} idPrefix={idPrefix} />
                    </div>
                )}
            </div>
            </div>

            {/* 4. Noise Effects (Unblurred!) */}
            {effects.filter((e) => e.type === 'noise' && e.visible).map((noise) => (
                <NoiseEffectRenderer
                    key={noise.id}
                    noise={noise}
                    borderRadius={getBorderRadius()}
                    hasRadius={hasAnyRadius()}
                    idPrefix={idPrefix}
                />
            ))}
        </div>
    );
};

export default memo(CanvasItemView);
