import React from 'react';
import { ICanvasItem } from '@/core/types';

export function getCanvasItemStyle(
  item: ICanvasItem,
  isAutoW: boolean,
  isAutoH: boolean,
  zIndex: number
): React.CSSProperties {
  return {
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: isAutoW ? 'max-content' : `${item.width}%`,
    height: (isAutoW || isAutoH) ? 'max-content' : `${item.height}%`,
    zIndex,
    transform: `translate(-${item.pivotX ?? 50}%, -${item.pivotY ?? 50}%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`,
    transformOrigin: `${item.pivotX ?? 50}% ${item.pivotY ?? 50}%`,
    ['--item-border-radius' as any]: `${item.borderRadius ?? 0}px`,
  };
}

