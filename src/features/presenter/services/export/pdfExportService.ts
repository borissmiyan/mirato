import { flattenPresentationSlides, renderSlideToJpegBytes } from './presentationExportUtils';

// Landscape 16:9 PDF page dimensions in points (960 x 540 pt)
const PAGE_W_PT = 960;
const PAGE_H_PT = 540;
const IMG_W = 1920;
const IMG_H = 1080;

const encoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

/**
 * Zero-dependency PDF 1.4 writer embedding each 16:9 slide as a crisp DCTDecode JPEG image
 * so all bundled fonts, multi-layer hymn gradients, and Cyrillic/Unicode text render 1:1.
 */
export const PdfExportService = {
    async exportBytes(presentationId: string): Promise<{ name: string; data: Uint8Array }> {
        const { presentation, slides } = await flattenPresentationSlides(presentationId);
        const pageImages: Uint8Array[] = [];

        for (const slide of slides) {
            pageImages.push(await renderSlideToJpegBytes(slide, IMG_W, IMG_H));
        }

        // Object layout:
        // 1: Catalog
        // 2: Pages
        // For each page i (0..N-1):
        //   pageObjId    = 3 + i * 3
        //   imgObjId     = 4 + i * 3
        //   contentObjId = 5 + i * 3
        const objects: Uint8Array[] = [];
        const pageObjIds: number[] = [];

        for (let i = 0; i < pageImages.length; i++) {
            pageObjIds.push(3 + i * 3);
        }

        // Obj 1: Catalog
        objects.push(encoder.encode(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`));

        // Obj 2: Pages
        const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
        objects.push(
            encoder.encode(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj\n`)
        );

        for (let i = 0; i < pageImages.length; i++) {
            const pageObjId = 3 + i * 3;
            const imgObjId = 4 + i * 3;
            const contentObjId = 5 + i * 3;
            const imgBytes = pageImages[i];

            // Page object
            objects.push(
                encoder.encode(
                    `${pageObjId} 0 obj\n` +
                    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W_PT} ${PAGE_H_PT}] ` +
                    `/Resources << /XObject << /Im0 ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\n` +
                    `endobj\n`
                )
            );

            // Image XObject
            objects.push(
                concatBytes([
                    encoder.encode(
                        `${imgObjId} 0 obj\n` +
                        `<< /Type /XObject /Subtype /Image /Width ${IMG_W} /Height ${IMG_H} ` +
                        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\n` +
                        `stream\n`
                    ),
                    imgBytes,
                    encoder.encode(`\nendstream\nendobj\n`),
                ])
            );

            // Page content stream drawing full-bleed 16:9 image
            const streamText = `q\n${PAGE_W_PT} 0 0 ${PAGE_H_PT} 0 0 cm\n/Im0 Do\nQ\n`;
            const streamBytes = encoder.encode(streamText);
            objects.push(
                concatBytes([
                    encoder.encode(`${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
                    streamBytes,
                    encoder.encode(`endstream\nendobj\n`),
                ])
            );
        }

        const header = encoder.encode(`%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`);
        const offsets: number[] = [];
        let cursor = header.length;

        for (const obj of objects) {
            offsets.push(cursor);
            cursor += obj.length;
        }

        const xrefStart = cursor;
        const xrefLines: string[] = [
            `xref\n0 ${objects.length + 1}\n`,
            `0000000000 65535 f \n`,
            ...offsets.map(off => `${String(off).padStart(10, '0')} 00000 n \n`),
        ];
        const trailer =
            `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
            `startxref\n${xrefStart}\n%%EOF\n`;

        const pdfBytes = concatBytes([
            header,
            ...objects,
            encoder.encode(xrefLines.join('') + trailer),
        ]);

        return { name: presentation.name, data: pdfBytes };
    },
};
