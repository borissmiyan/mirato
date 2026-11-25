import JSZip from 'jszip';
import {
    dataUrlToBytes,
    flattenPresentationSlides,
    renderBackgroundToPngDataUrl,
} from './presentationExportUtils';

// Standard 16:9 OpenDocument Presentation dimensions in cm (28cm x 15.75cm)
const PAGE_W_CM = 28;
const PAGE_H_CM = 15.75;

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function cm(pct: number, total: number): string {
    return `${((pct / 100) * total).toFixed(3)}cm`;
}

function mapOdpAlign(align: string): string {
    if (align === 'left') return 'start';
    if (align === 'right') return 'end';
    if (align === 'justify') return 'justify';
    return 'center';
}

function mapOdpVAlign(align: string): string {
    if (align === 'top') return 'top';
    if (align === 'bottom') return 'bottom';
    return 'middle';
}

/**
 * Generates an editable 16:9 OpenDocument Presentation (.odp) binary compatible with
 * LibreOffice Impress, Keynote, and PowerPoint.
 */
export const OdpExportService = {
    async exportBytes(presentationId: string): Promise<{ name: string; data: Uint8Array }> {
        const { presentation, slides } = await flattenPresentationSlides(presentationId);
        const zip = new JSZip();

        // ODF spec requires `mimetype` as the very first, uncompressed entry
        zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation', { compression: 'STORE' });

        const manifestEntries: string[] = [
            `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.presentation"/>`,
            `<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>`,
            `<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>`,
        ];

        const autoStyles: string[] = [];
        const pagesXml: string[] = [];
        let picCounter = 1;
        let styleCounter = 1;

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            const pageStyleName = `dp${i + 1}`;
            const framesXml: string[] = [];

            if (slide.solidBgColor) {
                autoStyles.push(
                    `<style:style style:name="${pageStyleName}" style:family="drawing-page">` +
                    `<style:drawing-page-properties draw:fill="solid" draw:fill-color="${slide.solidBgColor}"/>` +
                    `</style:style>`
                );
            } else {
                autoStyles.push(
                    `<style:style style:name="${pageStyleName}" style:family="drawing-page">` +
                    `<style:drawing-page-properties draw:fill="solid" draw:fill-color="#000000"/>` +
                    `</style:style>`
                );
                if (slide.backgroundLayers.length > 0) {
                    const bgDataUrl = await renderBackgroundToPngDataUrl(slide.backgroundLayers, 1920, 1080);
                    if (bgDataUrl) {
                        const picPath = `Pictures/pic${picCounter++}.png`;
                        zip.file(picPath, dataUrlToBytes(bgDataUrl), { compression: 'STORE' });
                        manifestEntries.push(`<manifest:file-entry manifest:full-path="${picPath}" manifest:media-type="image/png"/>`);
                        framesXml.push(
                            `<draw:frame draw:layer="layout" svg:x="0cm" svg:y="0cm" svg:width="${PAGE_W_CM}cm" svg:height="${PAGE_H_CM}cm">` +
                            `<draw:image xlink:href="${picPath}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
                            `</draw:frame>`
                        );
                    }
                }
            }

            for (const sh of slide.shapes) {
                const grName = `gr${styleCounter++}`;
                const fillAttr = sh.fillColor ? `draw:fill="solid" draw:fill-color="${sh.fillColor}"` : `draw:fill="none"`;
                const strokeAttr = sh.strokeColor ? `draw:stroke="solid" svg:stroke-color="${sh.strokeColor}" svg:stroke-width="0.06cm"` : `draw:stroke="none"`;
                autoStyles.push(
                    `<style:style style:name="${grName}" style:family="graphic">` +
                    `<style:graphic-properties ${fillAttr} ${strokeAttr}/>` +
                    `</style:style>`
                );
                const geom = sh.shapeType === 'ellipse' ? 'ellipse' : 'rectangle';
                framesXml.push(
                    `<draw:custom-shape draw:style-name="${grName}" draw:layer="layout" svg:x="${cm(sh.x, PAGE_W_CM)}" svg:y="${cm(sh.y, PAGE_H_CM)}" svg:width="${cm(sh.width, PAGE_W_CM)}" svg:height="${cm(sh.height, PAGE_H_CM)}">` +
                    `<draw:enhanced-geometry draw:type="${geom}"/>` +
                    `</draw:custom-shape>`
                );
            }

            for (const img of slide.images) {
                const ext = img.mimeType.includes('jpeg') || img.mimeType.includes('jpg') ? 'jpg' : 'png';
                const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
                const picPath = `Pictures/pic${picCounter++}.${ext}`;
                zip.file(picPath, dataUrlToBytes(img.dataUrl), { compression: 'STORE' });
                manifestEntries.push(`<manifest:file-entry manifest:full-path="${picPath}" manifest:media-type="${mime}"/>`);
                framesXml.push(
                    `<draw:frame draw:layer="layout" svg:x="${cm(img.x, PAGE_W_CM)}" svg:y="${cm(img.y, PAGE_H_CM)}" svg:width="${cm(img.width, PAGE_W_CM)}" svg:height="${cm(img.height, PAGE_H_CM)}">` +
                    `<draw:image xlink:href="${picPath}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
                    `</draw:frame>`
                );
            }

            for (const tb of slide.textBlocks) {
                const grName = `gr${styleCounter++}`;
                const pName = `P${styleCounter++}`;
                const tName = `T${styleCounter++}`;
                // 1080 logical px = 540pt => fontPt = fontSize * 0.5
                const fontPt = Math.max(8, Math.round(tb.fontSize * 0.5));
                const linePct = Math.round((tb.lineHeight || 1.25) * 100);

                autoStyles.push(
                    `<style:style style:name="${grName}" style:family="graphic">` +
                    `<style:graphic-properties draw:stroke="none" draw:fill="none" draw:textarea-vertical-align="${mapOdpVAlign(tb.alignVertical)}"/>` +
                    `</style:style>`,
                    `<style:style style:name="${pName}" style:family="paragraph">` +
                    `<style:paragraph-properties fo:text-align="${mapOdpAlign(tb.alignHorizontal)}" fo:line-height="${linePct}%"/>` +
                    `</style:style>`,
                    `<style:style style:name="${tName}" style:family="text">` +
                    `<style:text-properties fo:font-family="${escapeXml(tb.fontFamily || 'Inter')}" fo:font-size="${fontPt}pt" fo:color="${tb.color}" fo:font-weight="${tb.bold ? 'bold' : 'normal'}" fo:font-style="${tb.italic ? 'italic' : 'normal'}"/>` +
                    `</style:style>`
                );

                const paragraphs = tb.text.split(/\r?\n/).map(line => (
                    `<text:p text:style-name="${pName}"><text:span text:style-name="${tName}">${escapeXml(line)}</text:span></text:p>`
                )).join('');

                framesXml.push(
                    `<draw:frame draw:style-name="${grName}" draw:layer="layout" svg:x="${cm(tb.x, PAGE_W_CM)}" svg:y="${cm(tb.y, PAGE_H_CM)}" svg:width="${cm(tb.width, PAGE_W_CM)}" svg:height="${cm(tb.height, PAGE_H_CM)}">` +
                    `<draw:text-box>${paragraphs}</draw:text-box>` +
                    `</draw:frame>`
                );
            }

            pagesXml.push(
                `<draw:page draw:name="Slide${i + 1}" draw:style-name="${pageStyleName}" draw:master-page-name="Default">` +
                `${framesXml.join('')}` +
                `</draw:page>`
            );
        }

        const stylesXml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" office:version="1.2">` +
            `<office:automatic-styles>` +
            `<style:page-layout style:name="PM1"><style:page-layout-properties fo:page-width="${PAGE_W_CM}cm" fo:page-height="${PAGE_H_CM}cm" style:print-orientation="landscape"/></style:page-layout>` +
            `</office:automatic-styles>` +
            `<office:master-styles><style:master-page style:name="Default" style:page-layout-name="PM1"/></office:master-styles>` +
            `</office:document-styles>`;

        const contentXml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.2">` +
            `<office:automatic-styles>${autoStyles.join('')}</office:automatic-styles>` +
            `<office:body><office:presentation>${pagesXml.join('')}</office:presentation></office:body>` +
            `</office:document-content>`;

        const manifestXml =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
            `${manifestEntries.join('')}` +
            `</manifest:manifest>`;

        zip.file('styles.xml', stylesXml);
        zip.file('content.xml', contentXml);
        zip.file('META-INF/manifest.xml', manifestXml);

        const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
        return { name: presentation.name, data };
    },
};
