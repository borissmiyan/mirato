import type { ICanvasSlide, IStyleLayer } from '@/core/types';
import { resolveColor, resolveShapeStyleColor, resolveBorder, parseFormatting, BASE_HEIGHT } from './pptxXmlUtils';
import { getInheritedShape } from './pptxShapeInheritance';
import { processPic, PptxProcessingContext } from './pptxPictureProcessor';

/**
 * Converts a PowerPoint shape (text box or filled vector rectangle) into canvas items.
 */
export async function processShape(
    sp: Element,
    index: number,
    slide: ICanvasSlide,
    ctx: PptxProcessingContext
): Promise<void> {
    const blipFill = sp.getElementsByTagNameNS('*', 'blipFill')[0];
    if (blipFill) {
        await processPic(sp, index, slide, ctx);
        return;
    }

    const nvPr = sp.getElementsByTagNameNS('*', 'nvPr')[0];
    const ph = nvPr?.getElementsByTagNameNS('*', 'ph')[0];
    const phType = ph?.getAttribute('type');
    const phIdx = ph?.getAttribute('idx');

    const spPr = sp.getElementsByTagNameNS('*', 'spPr')[0];
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

    const inheritedSps: Element[] = [];
    if (ph) {
        const layoutSp = getInheritedShape(phType, phIdx, ctx.layoutDoc);
        if (layoutSp) inheritedSps.push(layoutSp);
        const masterSp = getInheritedShape(phType, phIdx, ctx.masterDoc);
        if (masterSp) inheritedSps.push(masterSp);
    }

    const off = xfrm?.getElementsByTagNameNS('*', 'off')[0];
    const ext = xfrm?.getElementsByTagNameNS('*', 'ext')[0];
    if (!off || !ext) return;

    const x = (parseInt(off.getAttribute('x') || '0') / ctx.slideWidth) * 100;
    const y = (parseInt(off.getAttribute('y') || '0') / ctx.slideHeight) * 100;
    const w = (parseInt(ext.getAttribute('cx') || '0') / ctx.slideWidth) * 100;
    const h = (parseInt(ext.getAttribute('cy') || '0') / ctx.slideHeight) * 100;
    const rot = parseInt(xfrm?.getAttribute('rot') || '0');

    const txBody = sp.getElementsByTagNameNS('*', 'txBody')[0];
    if (!txBody) return;

    const paragraphs = Array.from(txBody.getElementsByTagNameNS('*', 'p'));
    let fullText = '';
    let fontFamily = 'Inter';
    let ptSize = 18;
    let textColor: string | null = null;
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrikethrough = false;
    let hasParsedFormatting = false;

    // Vertical Anchor
    const bodyPr = txBody.getElementsByTagNameNS('*', 'bodyPr')[0];
    let anchor = bodyPr?.getAttribute('anchor');
    if (!anchor) {
        for (const isp of inheritedSps) {
            const ispTxBody = isp.getElementsByTagNameNS('*', 'txBody')[0];
            const ispBodyPr = ispTxBody?.getElementsByTagNameNS('*', 'bodyPr')[0];
            anchor = ispBodyPr?.getAttribute('anchor');
            if (anchor) break;
        }
    }
    let alignVertical: 'top' | 'middle' | 'bottom' = 'middle';
    if (anchor === 't') alignVertical = 'top';
    if (anchor === 'b') alignVertical = 'bottom';

    // Horizontal Alignment
    let firstAlgn = paragraphs[0]?.getElementsByTagNameNS('*', 'pPr')[0]?.getAttribute('algn');
    if (!firstAlgn) {
        for (const isp of inheritedSps) {
            const ispTxBody = isp.getElementsByTagNameNS('*', 'txBody')[0];
            const ispPara = ispTxBody?.getElementsByTagNameNS('*', 'p')[0];
            firstAlgn = ispPara?.getElementsByTagNameNS('*', 'pPr')[0]?.getAttribute('algn');
            if (firstAlgn) break;
        }
    }
    let alignHorizontal: 'left' | 'center' | 'right' | 'justify' = 'left';
    if (firstAlgn === 'ctr') alignHorizontal = 'center';
    if (firstAlgn === 'l') alignHorizontal = 'left';
    if (firstAlgn === 'r') alignHorizontal = 'right';
    if (firstAlgn === 'just') alignHorizontal = 'justify';

    const lines: string[] = [];
    for (const para of paragraphs) {
        let line = '';
        const runs = Array.from(para.childNodes);
        for (const node of runs) {
            const el = node as Element;
            if (el.localName === 'r') {
                const t = el.getElementsByTagNameNS('*', 't')[0]?.textContent || '';
                line += t;

                if (t.trim() && !hasParsedFormatting) {
                    const rPr = el.getElementsByTagNameNS('*', 'rPr')[0];
                    const defRPr = para.getElementsByTagNameNS('*', 'pPr')[0]?.getElementsByTagNameNS('*', 'defRPr')[0];
                    const endParaRPr = para.getElementsByTagNameNS('*', 'endParaRPr')[0];

                    const fmt = parseFormatting(rPr, defRPr, endParaRPr, inheritedSps, ctx.themeMajorFont, ctx.themeMinorFont, ctx.themeColors);
                    isBold = fmt.rBold;
                    isItalic = fmt.rItalic;
                    isUnderline = fmt.rUnderline;
                    isStrikethrough = fmt.rStrike;
                    if (fmt.rColor) textColor = fmt.rColor;
                    if (fmt.rSize) ptSize = fmt.rSize;
                    if (fmt.rFont) fontFamily = fmt.rFont;

                    hasParsedFormatting = true;

                    if (!textColor) {
                        textColor = resolveShapeStyleColor(sp, ctx.themeColors);
                        for (const isp of inheritedSps) {
                            if (!textColor) textColor = resolveShapeStyleColor(isp, ctx.themeColors);
                        }
                    }
                }
            } else if (el.localName === 'br') {
                line += '\n';
            }
        }
        if (line.trim() || line === '') lines.push(line);
    }
    fullText = lines.join('\n');

    if (!hasParsedFormatting && paragraphs.length > 0) {
        const firstPara = paragraphs[0];
        const defRPr = firstPara?.getElementsByTagNameNS('*', 'pPr')[0]?.getElementsByTagNameNS('*', 'defRPr')[0];
        const endParaRPr = firstPara?.getElementsByTagNameNS('*', 'endParaRPr')[0];
        const fmt = parseFormatting(null, defRPr, endParaRPr, inheritedSps, ctx.themeMajorFont, ctx.themeMinorFont, ctx.themeColors);
        isBold = fmt.rBold;
        isItalic = fmt.rItalic;
        isUnderline = fmt.rUnderline;
        isStrikethrough = fmt.rStrike;
        if (fmt.rColor) textColor = fmt.rColor;
        if (fmt.rSize) ptSize = fmt.rSize;
        if (fmt.rFont) fontFamily = fmt.rFont;
    }

    if (!fullText.trim()) return;

    const scaledFontSize = Math.round(ptSize * (BASE_HEIGHT / ctx.slideHeightPt));
    if (!textColor) textColor = ctx.themeColors['tx1'] || ctx.themeColors['dk1'] || '#000000';

    slide.content.canvasItems = slide.content.canvasItems || [];

    const spPrFill = resolveColor(spPr, ctx.themeColors);
    const fills: IStyleLayer[] = [];
    if (spPrFill) {
        fills.push({ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: spPrFill });
    }

    let border: { borderColor: string; borderWidth: number } | null = null;
    const spPrs = [spPr];
    for (const isp of inheritedSps) {
        spPrs.push(isp.getElementsByTagNameNS('*', 'spPr')[0]);
    }
    for (const pr of spPrs) {
        if (pr) {
            border = resolveBorder(pr, ctx.slideHeight, BASE_HEIGHT, ctx.themeColors);
            if (border) break;
        }
    }

    slide.content.canvasItems.push({
        id: crypto.randomUUID(),
        type: 'text',
        x: x + w / 2, y: y + h / 2,
        width: w, height: h,
        rotation: rot / 60000,
        zIndex: index,
        pivotX: 50, pivotY: 50,
        locked: false, visible: true,
        fills, strokes: [],
        ...(border ? { borderColor: border.borderColor, borderWidth: border.borderWidth } : {}),
        text: {
            content: fullText,
            fontFamily, fontWeight: isBold ? 'bold' : 'normal',
            fontSize: scaledFontSize || 32,
            color: textColor,
            textFills: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: textColor }],
            resizingMode: 'fixed',
            alignHorizontal, alignVertical,
            isBold,
            isItalic,
            isUnderline,
            isStrikethrough
        }
    });
}

