import { db } from '@/core/db';
import {
    ICanvasItem,
    ICanvasSlide,
    IHymnSlide,
    INestedSlide,
    IPresentationFile,
    ISlide,
    IStyleLayer,
    IVideoSlide,
} from '@/core/types';
import { BUILT_IN_HYMN_THEMES } from '@/features/hymns/services/hymnThemeConstants';
import {
    materializeHymnPresentation,
    materializeTheme,
    resolveHymnThemeFromList,
} from '@/features/hymns/services/hymnThemeMaterializer';
import { ensureLayers } from '@/core/utils/styleMigration';
import { resolveLayerImageDataUrl } from './presentationExportCanvas';

export {
    dataUrlToBytes,
    renderBackgroundToPngDataUrl,
    renderSlideToJpegBytes,
    saveExportedFile,
} from './presentationExportCanvas';

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

export function sanitizeFilename(name: string): string {
    return (name || 'presentation').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'presentation';
}

export function normalizeHexColor(color: string | undefined, fallback = '#FFFFFF'): string {
    if (!color) return fallback;
    const trimmed = color.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        const [, r, g, b] = trimmed;
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
        const hex = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
        return `#${hex(rgbMatch[1])}${hex(rgbMatch[2])}${hex(rgbMatch[3])}`.toUpperCase();
    }
    return fallback;
}

function resolveTextColor(item: ICanvasItem): string {
    const fills = item.text?.textFills;
    if (Array.isArray(fills)) {
        const firstColor = fills.find(f => f.visible !== false && f.type === 'color' && f.color);
        if (firstColor?.color) return normalizeHexColor(firstColor.color, '#FFFFFF');
    }
    return normalizeHexColor(item.text?.color, '#FFFFFF');
}

function toTopLeftBox(item: ICanvasItem): { x: number; y: number; width: number; height: number } {
    const width = Math.max(4, Math.min(100, item.width || 80));
    const height = Math.max(4, Math.min(100, item.height || 20));
    const pivotX = item.pivotX ?? 50;
    const pivotY = item.pivotY ?? 50;
    return {
        x: (item.x ?? 50) - (width * pivotX) / 100,
        y: (item.y ?? 50) - (height * pivotY) / 100,
        width,
        height,
    };
}

async function convertConcreteSlide(slide: ISlide): Promise<FlattenedExportSlide> {
    const bgLayers = ensureLayers(
        'backgroundOverride' in slide ? (slide as ICanvasSlide | IVideoSlide).backgroundOverride : undefined
    ).filter(l => l.visible !== false);

    let solidBgColor: string | undefined;
    if (bgLayers.length === 0) {
        solidBgColor = '#000000';
    } else if (bgLayers.length === 1 && bgLayers[0].type === 'color' && (bgLayers[0].opacity ?? 1) >= 0.99) {
        solidBgColor = normalizeHexColor(bgLayers[0].color, '#000000');
    }

    const textBlocks: ExportTextBlock[] = [];
    const shapes: ExportShapeBlock[] = [];
    const images: ExportImageBlock[] = [];

    if (slide.blockId === 'bible' && slide.type === 'normal') {
        const vars = (slide as ICanvasSlide).content?.variables || {};
        const verseText = String(vars.content || '');
        const secondText = String(vars.secondVerseText || '');
        const refTitle = String(vars.title || '');
        if (verseText) {
            textBlocks.push({
                text: secondText ? `${verseText}\n\n${secondText}` : verseText,
                x: 8,
                y: 14,
                width: 84,
                height: 66,
                rotation: 0,
                fontFamily: 'Lora',
                fontSize: secondText ? 44 : 56,
                color: '#FFFFFF',
                bold: false,
                italic: false,
                alignHorizontal: 'center',
                alignVertical: 'middle',
                lineHeight: 1.3,
            });
        }
        if (refTitle) {
            textBlocks.push({
                text: refTitle,
                x: 10,
                y: 82,
                width: 80,
                height: 10,
                rotation: 0,
                fontFamily: 'Inter',
                fontSize: 30,
                color: '#D6D3D1',
                bold: true,
                italic: false,
                alignHorizontal: 'center',
                alignVertical: 'middle',
                lineHeight: 1.2,
            });
        }
    } else if (slide.type === 'normal') {
        const cs = slide as ICanvasSlide;
        const canvasItems = [...(cs.content?.canvasItems || [])]
            .filter(ci => ci.visible !== false)
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const item of canvasItems) {
            const box = toTopLeftBox(item);
            if (item.type === 'text' && item.text?.content) {
                const rawText = item.text.content;
                const casedText = item.text.textCase === 'uppercase'
                    ? rawText.toUpperCase()
                    : item.text.textCase === 'lowercase'
                        ? rawText.toLowerCase()
                        : rawText;
                textBlocks.push({
                    text: casedText,
                    ...box,
                    rotation: item.rotation || 0,
                    fontFamily: item.text.fontFamily || 'Inter',
                    fontSize: item.text.fontSize || 48,
                    color: resolveTextColor(item),
                    bold: Boolean(item.text.isBold || Number(item.text.fontWeight) >= 600),
                    italic: Boolean(item.text.isItalic),
                    alignHorizontal: item.text.alignHorizontal || 'center',
                    alignVertical: item.text.alignVertical || 'middle',
                    lineHeight: Number(item.text.lineHeight) || 1.25,
                });
            } else if (item.type === 'shape') {
                const fillLayer = item.fills?.find(f => f.visible !== false && f.type === 'color' && f.color);
                const strokeLayer = item.strokes?.find(s => s.visible !== false && s.type === 'color' && s.color);
                const st = item.shape?.shapeType === 'circle' ? 'ellipse' : (item.borderRadius ? 'roundRect' : 'rect');
                shapes.push({
                    shapeType: st,
                    ...box,
                    rotation: item.rotation || 0,
                    fillColor: fillLayer?.color ? normalizeHexColor(fillLayer.color, '#FFFFFF') : undefined,
                    strokeColor: strokeLayer?.color ? normalizeHexColor(strokeLayer.color, '#FFFFFF') : undefined,
                    strokeWidth: strokeLayer ? 2 : undefined,
                    opacity: item.opacity ?? 1,
                });
            } else if (item.type === 'image') {
                const imgLayer = item.fills?.find(f => f.visible !== false && f.type === 'image');
                const resolved = await resolveLayerImageDataUrl(imgLayer?.image?.id, imgLayer?.image?.url);
                if (resolved) {
                    images.push({ ...resolved, ...box, rotation: item.rotation || 0 });
                }
            }
        }
    }

    const transitionType = 'transition' in slide ? (slide as ICanvasSlide).transition?.type : undefined;
    return { id: slide.id, solidBgColor, backgroundLayers: bgLayers, textBlocks, shapes, images, transitionType };
}

/**
 * Recursively flattens a presentation (expanding nested presentations and materializing library hymns)
 * into concrete export-ready slides.
 */
export async function flattenPresentationSlides(
    presentationId: string,
    visited: Set<string> = new Set()
): Promise<{ presentation: IPresentationFile; slides: FlattenedExportSlide[] }> {
    const presentation = await db.presentationFiles.get(presentationId);
    if (!presentation) throw new Error(`Presentation ${presentationId} not found`);

    const dbThemes = typeof db.hymnThemes?.toArray === 'function' ? await db.hymnThemes.toArray() : [];
    const themes = dbThemes.length > 0 ? dbThemes : BUILT_IN_HYMN_THEMES;
    visited.add(presentationId);

    const output: FlattenedExportSlide[] = [];

    for (const slide of presentation.slides || []) {
        if (slide.type === 'hymn') {
            const hs = slide as IHymnSlide;
            const hymnPres = await db.presentationFiles.get(hs.hymnPresentationId);
            const srcSlide = hymnPres?.slides.find(s => s.id === hs.sourceSlideId);
            if (srcSlide && srcSlide.type === 'normal') {
                const theme = resolveHymnThemeFromList(hs.themeId, themes);
                const mat = theme ? materializeTheme(srcSlide as ICanvasSlide, theme, hs.order) : null;
                const concrete: ICanvasSlide = mat
                    ? {
                        ...(srcSlide as ICanvasSlide),
                        backgroundOverride: mat.background,
                        content: { ...(srcSlide as ICanvasSlide).content, canvasItems: mat.canvasItems },
                    }
                    : (srcSlide as ICanvasSlide);
                output.push(await convertConcreteSlide(concrete));
            }
            continue;
        }

        const nestedPresId = slide.type === 'nested'
            ? (slide as INestedSlide).presentationId
            : (slide.type === 'normal' ? (slide as ICanvasSlide).masterPresentationId : undefined);

        if (nestedPresId && !visited.has(nestedPresId)) {
            const nestedPres = await db.presentationFiles.get(nestedPresId);
            if (nestedPres) {
                if (nestedPres.hymnalId || nestedPres.metadata?.isHymnLibraryItem) {
                    const themeId = slide.type === 'normal'
                        ? String((slide as ICanvasSlide).content?.variables?.hymnThemeId || 'default')
                        : 'default';
                    const materialized = materializeHymnPresentation(nestedPres, resolveHymnThemeFromList(themeId, themes));
                    for (const child of materialized.slides) {
                        output.push(await convertConcreteSlide(child));
                    }
                } else {
                    const subVisited = new Set(visited);
                    const { slides: subSlides } = await flattenPresentationSlides(nestedPresId, subVisited);
                    output.push(...subSlides);
                }
                continue;
            }
        }

        output.push(await convertConcreteSlide(slide));
    }

    return { presentation, slides: output };
}
