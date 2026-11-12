import React from 'react';
import { ICanvasItem } from '@/core/types';

interface ShapeRendererProps {
  item: ICanvasItem;
  idPrefix: string;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = () => {
  return null;
};

// --- SVG Rounded Rect Helper ---

export const RoundedRect: React.FC<{
  x: number | string,
  y: number | string,
  width: number | string,
  height: number | string,
  radii: { tl: number, tr: number, br: number, bl: number },
  className?: string,
  fill?: string,
  stroke?: string,
  strokeWidth?: number | string,
  strokeLinejoin?: 'round' | 'bevel' | 'miter',
  strokeLinecap?: 'butt' | 'round' | 'square',
  strokeDasharray?: string,
}> = ({ x, y, width, height, radii, ...props }) => {
  const rx = typeof x === 'number' ? x : 0;
  const ry = typeof y === 'number' ? y : 0;
  const rw = typeof width === 'number' ? width : 100;
  const rh = typeof height === 'number' ? height : 100;

  const { tl, tr, br, bl } = {
    tl: Math.max(0, radii.tl),
    tr: Math.max(0, radii.tr),
    br: Math.max(0, radii.br),
    bl: Math.max(0, radii.bl),
  };

  if (tl === tr && tr === br && br === bl) {
    return <rect x={x} y={y} width={width} height={height} rx={tl} {...props} />;
  }
  const path = `
    M ${rx + tl},${ry}
    h ${rw - tl - tr}
    a ${tr},${tr} 0 0 1 ${tr},${tr}
    v ${rh - tr - br}
    a ${br},${br} 0 0 1 -${br},${br}
    h -${rw - br - bl}
    a ${bl},${bl} 0 0 1 -${bl},-${bl}
    v -${rh - bl - tl}
    a ${tl},${tl} 0 0 1 ${tl},-${tl}
    z
  `;

  return <path d={path} strokeLinejoin={props.strokeLinejoin} strokeLinecap={props.strokeLinecap} strokeDasharray={props.strokeDasharray} {...props} />;
};
