import type { ICanvasSlide } from '@/core/types';
import { getAttr, resolveBorder, BASE_HEIGHT } from './pptxXmlUtils';
import { getInheritedShape } from './pptxShapeInheritance';
import { resolveRel, PptxMediaEntry } from './pptxMediaExtractor';

export interface PptxProcessingContext {
    slideWidth: number;
    slideHeight: number;
    slideHeightPt: number;
    themeColors: Record<string, string>;
    themeMajorFont: string;
    themeMinorFont: string;
    slideRelationships: Record<string, string>;
    layoutDoc: Document | null;
    masterDoc: Document | null;
    layoutRels: Record<string, string>;
    masterRels: Record<string, string>;
    mediaMap: Map<string, PptxMediaEntry>;
}

/**
 * Converts a PowerPoint picture element into an image canvas item.
 */
export async function processPic(
    pic: Element,
    index: number,
    slide: ICanvasSlide,
    ctx: PptxProcessingContext
): Promise<void> {
    const blip = pic.getElementsByTagNameNS('*', 'blip')[0];
    const media = resolveRel(getAttr(blip, 'embed'), ctx.slideRelationships, ctx.layoutRels, ctx.masterRels, ctx.mediaMap);
    if (!media) return;

    const nvPr = pic.getElementsByTagNameNS('*', 'nvPr')[0];
    const ph = nvPr?.getElementsByTagNameNS('*', 'ph')[0];
    const phType = ph?.getAttribute('type');
    const phIdx = ph?.getAttribute('idx');

    const spPr = pic.getElementsByTagNameNS('*', 'spPr')[0];
    let xfrm = spPr?.getElementsByTagNameNS('*', 'xfrm')[0];

    if ((!xfrm || !xfrm.getElementsByTagNameNS('*', 'off')[0] || !xfrm.getElementsByTagNameNS('*', 'ext')[0]) && ph) {
        const layoutSp = getInheritedShape(phType, phIdx, ctx.layoutDoc);
        if (layoutSp) {
            const lSpPr = layoutSp.getElementsByTagNameNS('*', 'spPr')[0];
            const lXfrm = lSpPr?.getElementsByTagNameNS('*', 'xfrm')[0];
            if (lXfrm && lXfrm.getElementsByTagNameNS('*', 'off')[0] && lXfrm.getElementsByTagNameNS('*', 'ext')[0]) {
                xfrm = lXfrm;
            }
        }
        if (!xfrm) {
            const masterSp = getInheritedShape(phType, phIdx, ctx.masterDoc);
            if (masterSp) {
                const mSpPr = masterSp.getElementsByTagNameNS('*', 'spPr')[0];
                const mXfrm = mSpPr?.getElementsByTagNameNS('*', 'xfrm')[0];
                if (mXfrm && mXfrm.getElementsByTagNameNS('*', 'off')[0] && mXfrm.getElementsByTagNameNS('*', 'ext')[0]) {
                    xfrm = mXfrm;
                }
            }
        }
    }

    const off = xfrm?.getElementsByTagNameNS('*', 'off')[0];
    const ext = xfrm?.getElementsByTagNameNS('*', 'ext')[0];
    if (!off || !ext) return;

    const x = (parseInt(off.getAttribute('x') || '0') / ctx.slideWidth) * 100;
    const y = (parseInt(off.getAttribute('y') || '0') / ctx.slideHeight) * 100;
    const w = (parseInt(ext.getAttribute('cx') || '0') / ctx.slideWidth) * 100;
    const h = (parseInt(ext.getAttribute('cy') || '0') / ctx.slideHeight) * 100;
    const rot = parseInt(xfrm?.getAttribute('rot') || '0');

    let border: { borderColor: string; borderWidth: number } | null = null;
    const spPrs = [spPr];
    if (ph) {
        const layoutSp = getInheritedShape(phType, phIdx, ctx.layoutDoc);
        if (layoutSp) spPrs.push(layoutSp.getElementsByTagNameNS('*', 'spPr')[0]);
        const masterSp = getInheritedShape(phType, phIdx, ctx.masterDoc);
        if (masterSp) spPrs.push(masterSp.getElementsByTagNameNS('*', 'spPr')[0]);
    }
    for (const pr of spPrs) {
        if (pr) {
            border = resolveBorder(pr, ctx.slideHeight, BASE_HEIGHT, ctx.themeColors);
            if (border) break;
        }
    }

    slide.content.canvasItems = slide.content.canvasItems || [];
    slide.content.canvasItems.push({
        id: crypto.randomUUID(),
        type: 'image',
        x: x + w / 2, y: y + h / 2,
        width: w, height: h,
        rotation: rot / 60000,
        zIndex: index,
        pivotX: 50, pivotY: 50,
        locked: false, visible: true,
        image: { id: media.id, isFromDb: true },
        fills: [
            {
                id: crypto.randomUUID(),
                type: 'image',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                image: {
                    url: media.id,
                    source: 'local',
                    id: media.id,
                    isFromDb: true
                }
            }
        ],
        strokes: [],
        ...(border ? { borderColor: border.borderColor, borderWidth: border.borderWidth } : {})
    });
}

