import React from 'react';
import { ICanvasItem } from '@/core/types';
import { IBooleanGroupData } from '@/core/utils/canvasBooleanGroups';
import { getNormalizedShapePath } from './shapeGeometry';
import { nodesToNormalizedSVGPath } from './vectorGeometry';
import { getCanvasItemStyle } from '../utils/itemStyle';
import CanvasItemView from '../CanvasItemView';

interface BooleanGroupRendererProps {
  booleanGroups: Map<string, IBooleanGroupData>;
  isPreview?: boolean;
}

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

function getItemNormalizedPath(item: ICanvasItem): string {
  if (item.type === 'shape' && item.shape?.shapeType) {
    return getNormalizedShapePath(item.shape.shapeType, item.shape);
  }
  if (item.type === 'path' && item.path?.nodes) {
    return nodesToNormalizedSVGPath(item.path.nodes, Boolean(item.path.isClosed));
  }
  return 'M 0,0 H 1 V 1 H 0 Z';
}

function renderMaskShape(item: ICanvasItem, fillColor: string) {
  const pixelX = (item.x / 100) * BASE_WIDTH;
  const pixelY = (item.y / 100) * BASE_HEIGHT;
  const pixelW = (item.width / 100) * BASE_WIDTH;
  const pixelH = (item.height / 100) * BASE_HEIGHT;
  const pivotX = ((item.pivotX ?? 50) / 100) * pixelW;
  const pivotY = ((item.pivotY ?? 50) / 100) * pixelH;
  const pathD = getItemNormalizedPath(item);

  return (
    <g
      key={item.id}
      transform={`translate(${pixelX - pivotX}, ${pixelY - pivotY}) rotate(${item.rotation || 0}, ${pivotX}, ${pivotY}) scale(${item.scale || 1})`}
    >
      <g transform={`scale(${pixelW}, ${pixelH})`}>
        <path d={pathD} fill={fillColor} />
      </g>
    </g>
  );
}

/**
 * Non-destructive Boolean Group Renderer.
 * Preserves child objects live on the canvas while dynamically applying SVG composite cuts.
 */
export const BooleanGroupRenderer: React.FC<BooleanGroupRendererProps> = React.memo(({
  booleanGroups,
  isPreview = false,
}) => {
  if (booleanGroups.size === 0) return null;

  const groupEntries = Array.from(booleanGroups.entries());

  return (
    <>
      {/* SVG Mask Definitions in 1920x1080 Logical Slide Space */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {groupEntries.map(([groupId, { operation, baseItem, operatorItems }]) => {
            const maskId = `boolean-mask-${groupId}`;

            if (operation === 'subtract') {
              return (
                <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={BASE_WIDTH} height={BASE_HEIGHT}>
                  {/* Base shape in White (visible) */}
                  {renderMaskShape(baseItem, '#ffffff')}
                  {/* Operator shapes in Black (cut out / subtracted!) */}
                  {operatorItems.map(op => renderMaskShape(op, '#000000'))}
                </mask>
              );
            }

            if (operation === 'intersect') {
              return (
                <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={BASE_WIDTH} height={BASE_HEIGHT}>
                  <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="#000000" />
                  {/* Operator in White: only overlapping area is visible */}
                  {operatorItems.map(op => renderMaskShape(op, '#ffffff'))}
                </mask>
              );
            }

            if (operation === 'exclude') {
              return (
                <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={BASE_WIDTH} height={BASE_HEIGHT}>
                  {renderMaskShape(baseItem, '#ffffff')}
                  {operatorItems.map(op => (
                    <g key={op.id} style={{ mixBlendMode: 'difference' }}>
                      {renderMaskShape(op, '#ffffff')}
                    </g>
                  ))}
                </mask>
              );
            }

            // Union operation
            return (
              <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={BASE_WIDTH} height={BASE_HEIGHT}>
                {renderMaskShape(baseItem, '#ffffff')}
                {operatorItems.map(op => renderMaskShape(op, '#ffffff'))}
              </mask>
            );
          })}
        </defs>
      </svg>

      {/* Visual Rendered Composite Containers */}
      {groupEntries.map(([groupId, { operation, baseItem, operatorItems }]) => {
        const maskId = `boolean-mask-${groupId}`;

        return (
          <div
            key={`boolean-container-${groupId}`}
            data-boolean-group={groupId}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            style={{
              mask: `url(#${maskId})`,
              WebkitMask: `url(#${maskId})`,
            }}
          >
            {/* Base Item Canvas View */}
            <div
              className="absolute pointer-events-auto"
              style={getCanvasItemStyle(baseItem, false, false, baseItem.zIndex)}
            >
              <CanvasItemView item={baseItem} isPreview={isPreview} />
            </div>

            {/* In Union, render operator items fills as well */}
            {operation === 'union' && operatorItems.map(op => (
              <div
                key={op.id}
                className="absolute pointer-events-auto"
                style={getCanvasItemStyle(op, false, false, op.zIndex)}
              >
                <CanvasItemView item={op} isPreview={isPreview} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
});

BooleanGroupRenderer.displayName = 'BooleanGroupRenderer';
