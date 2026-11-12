export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/**
 * Retrieves attribute value in an XML namespace-agnostic manner.
 */
export function getAttr(el: Element | null | undefined, attrName: string): string | null {
    if (!el) return null;
    const namespaces = [
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'http://schemas.openxmlformats.org/drawingml/2006/main',
        'http://schemas.openxmlformats.org/presentationml/2006/main'
    ];
    for (const ns of namespaces) {
        const val = el.getAttributeNS(ns, attrName);
        if (val !== null && val !== '') return val;
    }
    return el.getAttribute(attrName) ||
        el.getAttribute(`r:${attrName}`) ||
        el.getAttribute(`p:${attrName}`) ||
        el.getAttribute(`a:${attrName}`);
}

/**
 * Resolves color from DrawingML solidFill elements against document theme colors.
 */
export function resolveColor(element: Element | undefined | null, themeColors: Record<string, string>): string | null {
    if (!element) return null;
    const solidFill = element.getElementsByTagNameNS('*', 'solidFill')[0];
    if (!solidFill) return null;

    const srgbClr = solidFill.getElementsByTagNameNS('*', 'srgbClr')[0];
    const schemeClr = solidFill.getElementsByTagNameNS('*', 'schemeClr')[0];

    if (srgbClr) {
        const val = srgbClr.getAttribute('val');
        return val ? `#${val}` : null;
    } else if (schemeClr) {
        const val = schemeClr.getAttribute('val');
        if (!val) return null;
        if (themeColors[val]) return themeColors[val];
        const fallbacks: Record<string, string> = {
            'bg1': '#ffffff', 'lt1': '#ffffff', 'lt2': '#ffffff',
            'tx1': '#000000', 'dk1': '#000000', 'dk2': '#000000',
            'accent1': '#4472c4', 'accent2': '#ed7d31'
        };
        return fallbacks[val] || null;
    }
    return null;
}

/**
 * Resolves fontRef style color defined on shape level.
 */
export function resolveShapeStyleColor(sp: Element, themeColors: Record<string, string>): string | null {
    const style = sp.getElementsByTagNameNS('*', 'style')[0];
    if (!style) return null;
    const fontRef = style.getElementsByTagNameNS('*', 'fontRef')[0];
    return fontRef ? resolveColor(fontRef, themeColors) : null;
}

/**
 * Extracts border outline stroke styling from spPr line elements.
 */
export function resolveBorder(
    spPrEl: Element | null | undefined,
    slideHeight: number,
    baseHeight: number,
    themeColors: Record<string, string>
): { borderColor: string; borderWidth: number } | null {
    if (!spPrEl) return null;
    const ln = spPrEl.getElementsByTagNameNS('*', 'ln')[0];
    if (!ln) return null;
    const wAttr = ln.getAttribute('w');
    const borderWidth = wAttr ? Math.max(1, Math.round((parseInt(wAttr) / slideHeight) * baseHeight)) : 0;
    if (borderWidth === 0) return null;
    const borderColor = resolveColor(ln, themeColors);
    if (!borderColor) return null;
    return { borderColor, borderWidth };
}

export interface ParsedFormatting {
    rBold: boolean;
    rItalic: boolean;
    rUnderline: boolean;
    rStrike: boolean;
    rColor: string | null;
    rSize: number | null;
    rFont: string | null;
}

/**
 * Resolves hierarchical font styling and formatting flags from runs and paragraph defaults.
 */
export function parseFormatting(
    rPr: Element | null,
    defRPr: Element | null,
    endParaRPr: Element | null,
    inheritedSps: Element[],
    themeMajorFont: string,
    themeMinorFont: string,
    themeColors: Record<string, string>
): ParsedFormatting {
    let rBold = false;
    let rItalic = false;
    let rUnderline = false;
    let rStrike = false;
    let rColor: string | null = null;
    let rSize: number | null = null;
    let rFont: string | null = null;

    const checkEl = (el: Element | null | undefined) => {
        if (!el) return;
        const b = el.getAttribute('b');
        if (b === '1' || b === 'true') rBold = true;
        else if (b === '0' || b === 'false') rBold = false;

        const i = el.getAttribute('i');
        if (i === '1' || i === 'true') rItalic = true;
        else if (i === '0' || i === 'false') rItalic = false;

        const u = el.getAttribute('u');
        if (u && u !== 'none') rUnderline = true;
        else if (u === 'none') rUnderline = false;

        const strike = el.getAttribute('strike');
        if (strike && strike !== 'noStrike') rStrike = true;
        else if (strike === 'noStrike') rStrike = false;

        const sz = el.getAttribute('sz');
        if (sz && !rSize) rSize = parseInt(sz) / 100;

        const latin = el.getElementsByTagNameNS('*', 'latin')[0];
        const typeface = latin?.getAttribute('typeface');
        if (typeface && !rFont) {
            if (typeface.startsWith('+mj')) {
                rFont = themeMajorFont;
            } else if (typeface.startsWith('+mn')) {
                rFont = themeMinorFont;
            } else {
                rFont = typeface;
            }
        }

        if (!rColor) {
            rColor = resolveColor(el, themeColors);
        }
    };

    checkEl(rPr);
    checkEl(endParaRPr);
    checkEl(defRPr);

    for (const sp of inheritedSps) {
        const inheritedTxBody = sp.getElementsByTagNameNS('*', 'txBody')[0];
        if (inheritedTxBody) {
            const bodyPara = inheritedTxBody.getElementsByTagNameNS('*', 'p')[0];
            const bodyDefRPr = bodyPara?.getElementsByTagNameNS('*', 'pPr')[0]?.getElementsByTagNameNS('*', 'defRPr')[0];
            checkEl(bodyDefRPr);

            const bodyRPr = bodyPara?.getElementsByTagNameNS('*', 'rPr')[0];
            checkEl(bodyRPr);
        }
        if (!rColor) {
            rColor = resolveShapeStyleColor(sp, themeColors);
        }
    }

    return { rBold, rItalic, rUnderline, rStrike, rColor, rSize, rFont };
}

