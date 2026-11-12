import { ITemplateSlide } from '@/core/types';

export interface ITemplateNav {
    id: string;
    type: 'root' | 'all' | 'blocks' | 'template' | 'block';
    name?: string;
    nameRu?: string;
}

export type LibraryContextMenuItem = {
    id?: string;
    name?: string;
    nameRu?: string;
    templateId?: string;
    mediaIds?: string[];
    slide?: ITemplateSlide;
    isSystem?: boolean;
    type?: string;
};

export interface LibraryContextMenuData {
    x: number;
    y: number;
    item: LibraryContextMenuItem;
    type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation';
}

