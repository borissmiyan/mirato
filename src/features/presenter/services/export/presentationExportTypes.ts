import type { IStyleLayer } from '@/core/types';

export interface ExportTextBlock {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    alignHorizontal: 'left' | 'center' | 'right' | 'justify';
    alignVertical: 'top' | 'middle' | 'bottom';
    lineHeight: number;
}

export interface ExportShapeBlock {
    shapeType: 'rect' | 'roundRect' | 'ellipse';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity: number;
}

export interface ExportImageBlock {
    dataUrl: string;
    mimeType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

export interface FlattenedExportSlide {
    id: string;
    solidBgColor?: string;
    backgroundLayers: IStyleLayer[];
    textBlocks: ExportTextBlock[];
    shapes: ExportShapeBlock[];
    images: ExportImageBlock[];
    transitionType?: string;
}
