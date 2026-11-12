import JSZip from 'jszip';
import type { ICanvasSlide } from '@/core/types';
import { getAttr, resolveColor } from './pptxXmlUtils';
import { PptxMediaEntry } from './pptxMediaExtractor';

/**
 * Resolves slide background override from slide, layout, or master definitions.
 */
export function resolveBackground(
    slide: ICanvasSlide,
    slideDoc: Document,
    layoutDoc: Document | null,
    masterDoc: Document | null,
    slideRelationships: Record<string, string>,
    layoutRels: Record<string, string>,
    masterRels: Record<string, string>,
    mediaMap: Map<string, PptxMediaEntry>,
    zip: JSZip,
    themeColors: Record<string, string>
): boolean {
    const bgs = [
        { bg: slideDoc.getElementsByTagNameNS('*', 'bg')[0], rels: slideRelationships },
        { bg: layoutDoc?.getElementsByTagNameNS('*', 'bg')[0], rels: layoutRels },
        { bg: masterDoc?.getElementsByTagNameNS('*', 'bg')[0], rels: masterRels }
    ].filter(item => item.bg);

    for (const { bg, rels } of bgs) {
        if (!bg) continue;

        const blipFill = bg.getElementsByTagNameNS('*', 'bgPicProps')[0] || bg.getElementsByTagNameNS('*', 'blipFill')[0];
        const blip = blipFill?.getElementsByTagNameNS('*', 'blip')[0];
        const rId = getAttr(blip, 'embed');
        if (rId) {
            const target = rels[rId];
            if (target) {
                const mediaPath = target.startsWith('..') ? `ppt/${target.substring(3)}` : `ppt/${target}`;
                const mediaFile = zip.file(mediaPath) || zip.file(`ppt/media/${target.split('/').pop()}`);

                if (mediaFile) {
                    const media = mediaMap.get(mediaPath) || mediaMap.get(`ppt/media/${target.split('/').pop()}`);
                    if (media) {
                        slide.content.canvasItems = slide.content.canvasItems || [];
                        slide.content.canvasItems.unshift({
                            id: crypto.randomUUID(),
                            type: 'image',
                            x: 50, y: 50,
                            width: 100, height: 100,
                            rotation: 0,
                            zIndex: 0,
                            pivotX: 50, pivotY: 50,
                            locked: true,
                            visible: true,
                            image: { id: media.id, isFromDb: true },
                            fills: [],
                            strokes: []
                        });
                        return true;
                    }
                }
            }
        }

        const bgPr = bg.getElementsByTagNameNS('*', 'bgPr')[0];
        const color = resolveColor(bgPr || bg, themeColors);
        if (color) {
            slide.backgroundOverride = [{
                id: crypto.randomUUID(),
                type: 'color',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                color,
            }];
            return true;
        }
    }
    return false;
}

