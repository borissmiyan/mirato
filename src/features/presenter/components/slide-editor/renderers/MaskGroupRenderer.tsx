import React from 'react';
import { ICanvasItem } from '@/core/types';
import { IMaskGroupData } from '@/core/utils/canvasMasks';
import { getShapePathData } from './shapeGeometry';
import { nodesToSVGPath } from './vectorGeometry';
import { getCanvasItemStyle } from '../utils/itemStyle';
import CanvasItemView from '../CanvasItemView';

interface MaskGroupRendererProps {
    maskGroups: Map<string, IMaskGroupData>;
    isPreview?: boolean;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

function getMaskItemPath(maskItem: ICanvasItem): string {
    if (maskItem.type === 'shape' && maskItem.shape?.shapeType) {
        const radii = maskItem.lockBorderRadius !== false
            ? {
                tl: maskItem.borderRadius || 0,
                tr: maskItem.borderRadius || 0,
                br: maskItem.borderRadius || 0,
                bl: maskItem.borderRadius || 0,
            }
            : {
                tl: maskItem.borderRadiusTL || 0,
                tr: maskItem.borderRadiusTR || 0,
                br: maskItem.borderRadiusBR || 0,
                bl: maskItem.borderRadiusBL || 0,
            };
        return getShapePathData(maskItem.shape.shapeType, radii);
    }

    if (maskItem.type === 'path' && maskItem.path?.nodes) {
        return nodesToSVGPath(maskItem.path.nodes, Boolean(maskItem.path.isClosed));
    }

    // Default rectangle
    return 'M 0,0 H 100 V 100 H 0 Z';
}

/**
 * Renders Figma-grade mask groups with SVG clip-paths in 1920x1080 logical coordinate space.
 */
export const MaskGroupRenderer: React.FC<MaskGroupRendererProps> = React.memo(({
    maskGroups,
    isPreview = false,
}) => {
    if (maskGroups.size === 0) return null;

    const groupEntries = Array.from(maskGroups.entries());

    return (
        <>
            {/* SVG clip-path definitions in 1920x1080 user space */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <defs>
                    {groupEntries.map(([groupId, { maskItem }]) => {
                        const pixelX = (maskItem.x / 100) * BASE_WIDTH;
                        const pixelY = (maskItem.y / 100) * BASE_HEIGHT;
                        const pixelW = (maskItem.width / 100) * BASE_WIDTH;
                        const pixelH = (maskItem.height / 100) * BASE_HEIGHT;
                        const pivotX = ((maskItem.pivotX ?? 50) / 100) * pixelW;
                        const pivotY = ((maskItem.pivotY ?? 50) / 100) * pixelH;
                        const pathD = getMaskItemPath(maskItem);

                        return (
                            <clipPath
                                key={`clip-${groupId}`}
                                id={`slide-mask-${maskItem.id}`}
                                clipPathUnits="userSpaceOnUse"
                            >
                                <g
                                    transform={`translate(${pixelX - pivotX}, ${pixelY - pivotY}) rotate(${maskItem.rotation || 0}, ${pivotX}, ${pivotY}) scale(${maskItem.scale || 1})`}
                                >
                                    <g transform={`scale(${pixelW / 100}, ${pixelH / 100})`}>
                                        <path d={pathD} />
                                    </g>
                                </g>
                            </clipPath>
                        );
                    })}
                </defs>
            </svg>

            {/* Masked Group Containers */}
            {groupEntries.map(([groupId, { maskItem, maskedItems }]) => {
                const clipId = `slide-mask-${maskItem.id}`;

                return (
                    <div
                        key={`mask-container-${groupId}`}
                        data-mask-group={groupId}
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
                        style={{
                            clipPath: `url(#${clipId})`,
                            WebkitClipPath: `url(#${clipId})`,
                        }}
                    >
                        {/* 1. Mask item background fill (if any) */}
                        <div
                            key={`mask-bg-${maskItem.id}`}
                            className="absolute overflow-hidden"
                            style={getCanvasItemStyle(maskItem, false, false, maskItem.zIndex)}
                        >
                            <CanvasItemView item={maskItem} isPreview={isPreview} />
                        </div>

                        {/* 2. Masked layers above the mask */}
                        {maskedItems.map(item => {
                            if (item.visible === false) return null;
                            const isAutoWidth = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                            const isAutoHeight = item.type === 'text' && item.text?.resizingMode === 'auto-height';

                            return (
                                <div
                                    key={`masked-${item.id}`}
                                    className="absolute overflow-hidden"
                                    style={getCanvasItemStyle(item, Boolean(isAutoWidth), Boolean(isAutoHeight), item.zIndex)}
                                >
                                    <CanvasItemView item={item} isPreview={isPreview} />
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </>
    );
});

MaskGroupRenderer.displayName = 'MaskGroupRenderer';
