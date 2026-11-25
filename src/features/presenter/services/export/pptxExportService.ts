import JSZip from 'jszip';
import {
    FlattenedExportSlide,
    dataUrlToBytes,
    flattenPresentationSlides,
    renderBackgroundToPngDataUrl,
} from './presentationExportUtils';

// Standard 16:9 widescreen slide dimensions in EMU (13.333" x 7.5")
const SLIDE_W_EMU = 12192000;
const SLIDE_H_EMU = 6858000;

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function mapHorizontalAlign(align: string): string {
    if (align === 'left') return 'l';
    if (align === 'right') return 'r';
    if (align === 'justify') return 'just';
    return 'ctr';
}

function mapVerticalAlign(align: string): string {
    if (align === 'top') return 't';
    if (align === 'bottom') return 'b';
    return 'ctr';
}

function mapTransitionXml(transitionType?: string): string {
    if (!transitionType || transitionType === 'none') return '';
    switch (transitionType) {
        case 'fade':
            return '<p:transition spd="med"><p:fade/></p:transition>';
        case 'push':
        case 'slide':
            return '<p:transition spd="med"><p:push dir="l"/></p:transition>';
        case 'wipe':
            return '<p:transition spd="med"><p:wipe dir="l"/></p:transition>';
        case 'zoom':
            return '<p:transition spd="med"><p:zoom dir="in"/></p:transition>';
        case 'split':
            return '<p:transition spd="med"><p:split orient="horz" dir="out"/></p:transition>';
        default:
            return '<p:transition spd="med"><p:fade/></p:transition>';
    }
}

function buildSlideXml(
    slide: FlattenedExportSlide,
    bgRelId: string | null,
    imageRelIds: Map<number, string>
): string {
    const bgXml = bgRelId
        ? `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${bgRelId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`
        : `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${(slide.solidBgColor || '#000000').replace('#', '')}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;

    let shapeId = 2;
    const elementsXml: string[] = [];

    for (const sh of slide.shapes) {
        const x = Math.round((sh.x / 100) * SLIDE_W_EMU);
        const y = Math.round((sh.y / 100) * SLIDE_H_EMU);
        const cx = Math.max(10000, Math.round((sh.width / 100) * SLIDE_W_EMU));
        const cy = Math.max(10000, Math.round((sh.height / 100) * SLIDE_H_EMU));
        const rot = Math.round((sh.rotation || 0) * 60000);
        const prst = sh.shapeType === 'ellipse' ? 'ellipse' : (sh.shapeType === 'roundRect' ? 'roundRect' : 'rect');
        const fillXml = sh.fillColor
            ? `<a:solidFill><a:srgbClr val="${sh.fillColor.replace('#', '')}"/></a:solidFill>`
            : '<a:noFill/>';
        const lineXml = sh.strokeColor
            ? `<a:ln w="${Math.round((sh.strokeWidth || 2) * 12700)}"><a:solidFill><a:srgbClr val="${sh.strokeColor.replace('#', '')}"/></a:solidFill></a:ln>`
            : '<a:ln><a:noFill/></a:ln>';

        elementsXml.push(
            `<p:sp>` +
            `<p:nvSpPr><p:cNvPr id="${shapeId++}" name="Shape ${shapeId}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
            `<p:spPr><a:xfrm rot="${rot}"><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fillXml}${lineXml}</p:spPr>` +
            `</p:sp>`
        );
    }

    slide.images.forEach((img, idx) => {
        const relId = imageRelIds.get(idx);
        if (!relId) return;
        const x = Math.round((img.x / 100) * SLIDE_W_EMU);
        const y = Math.round((img.y / 100) * SLIDE_H_EMU);
        const cx = Math.max(10000, Math.round((img.width / 100) * SLIDE_W_EMU));
        const cy = Math.max(10000, Math.round((img.height / 100) * SLIDE_H_EMU));
        const rot = Math.round((img.rotation || 0) * 60000);

        elementsXml.push(
            `<p:pic>` +
            `<p:nvPicPr><p:cNvPr id="${shapeId++}" name="Picture ${idx + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
            `<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
            `<p:spPr><a:xfrm rot="${rot}"><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
            `</p:pic>`
        );
    });

    for (const tb of slide.textBlocks) {
        const x = Math.round((tb.x / 100) * SLIDE_W_EMU);
        const y = Math.round((tb.y / 100) * SLIDE_H_EMU);
        const cx = Math.max(10000, Math.round((tb.width / 100) * SLIDE_W_EMU));
        const cy = Math.max(10000, Math.round((tb.height / 100) * SLIDE_H_EMU));
        const rot = Math.round((tb.rotation || 0) * 60000);
        // Scale 1920x1080 logical px to PowerPoint points (1080px = 540pt => factor 0.5) * 100
        const fontSz = Math.max(800, Math.round(tb.fontSize * 50));
        const colorHex = tb.color.replace('#', '');
        const algn = mapHorizontalAlign(tb.alignHorizontal);
        const anchor = mapVerticalAlign(tb.alignVertical);
        const fontName = escapeXml(tb.fontFamily || 'Inter');
        const lnSpcPct = Math.round((tb.lineHeight || 1.25) * 100000);

        const paragraphsXml = tb.text.split(/\r?\n/).map(line => (
            `<a:p>` +
            `<a:pPr algn="${algn}"><a:lnSpc><a:spcPct val="${lnSpcPct}"/></a:lnSpc></a:pPr>` +
            `<a:r><a:rPr lang="ru-RU" sz="${fontSz}" b="${tb.bold ? 1 : 0}" i="${tb.italic ? 1 : 0}" dirty="0">` +
            `<a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>` +
            `<a:latin typeface="${fontName}"/><a:cs typeface="${fontName}"/>` +
            `</a:rPr><a:t>${escapeXml(line)}</a:t></a:r>` +
            `</a:p>`
        )).join('');

        elementsXml.push(
            `<p:sp>` +
            `<p:nvSpPr><p:cNvPr id="${shapeId++}" name="TextBox ${shapeId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
            `<p:spPr><a:xfrm rot="${rot}"><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
            `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>${paragraphsXml}</p:txBody>` +
            `</p:sp>`
        );
    }

    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
        `<p:cSld>${bgXml}<p:spTree>` +
        `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
        `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
        `${elementsXml.join('')}` +
        `</p:spTree></p:cSld>` +
        `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
        `${mapTransitionXml(slide.transitionType)}` +
        `</p:sld>`
    );
}

/**
 * Generates an editable 16:9 OOXML PowerPoint (.pptx) binary from a Mirato presentation.
 */
export const PptxExportService = {
    async exportBytes(presentationId: string): Promise<{ name: string; data: Uint8Array }> {
        const { presentation, slides } = await flattenPresentationSlides(presentationId);
        const zip = new JSZip();

        const slideOverrides: string[] = [];
        const slideIdList: string[] = [];
        const presRels: string[] = [
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
        ];

        let mediaCounter = 1;

        for (let i = 0; i < slides.length; i++) {
            const slideNum = i + 1;
            const slide = slides[i];
            const slideRels: string[] = [
                `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
            ];
            let nextRelNum = 2;

            let bgRelId: string | null = null;
            if (!slide.solidBgColor && slide.backgroundLayers.length > 0) {
                const bgDataUrl = await renderBackgroundToPngDataUrl(slide.backgroundLayers, 1920, 1080);
                if (bgDataUrl) {
                    const mediaName = `media${mediaCounter++}.png`;
                    zip.file(`ppt/media/${mediaName}`, dataUrlToBytes(bgDataUrl));
                    bgRelId = `rId${nextRelNum++}`;
                    slideRels.push(
                        `<Relationship Id="${bgRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
                    );
                }
            }

            const imageRelIds = new Map<number, string>();
            for (let imgIdx = 0; imgIdx < slide.images.length; imgIdx++) {
                const img = slide.images[imgIdx];
                const ext = img.mimeType.includes('jpeg') || img.mimeType.includes('jpg') ? 'jpg' : 'png';
                const mediaName = `media${mediaCounter++}.${ext}`;
                zip.file(`ppt/media/${mediaName}`, dataUrlToBytes(img.dataUrl));
                const relId = `rId${nextRelNum++}`;
                imageRelIds.set(imgIdx, relId);
                slideRels.push(
                    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
                );
            }

            zip.file(`ppt/slides/slide${slideNum}.xml`, buildSlideXml(slide, bgRelId, imageRelIds));
            zip.file(
                `ppt/slides/_rels/slide${slideNum}.xml.rels`,
                `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slideRels.join('')}</Relationships>`
            );

            const presRelId = `rId${slideNum + 1}`;
            presRels.push(
                `<Relationship Id="${presRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`
            );
            slideIdList.push(`<p:sldId id="${256 + i}" r:id="${presRelId}"/>`);
            slideOverrides.push(
                `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
            );
        }

        zip.file(
            '[Content_Types].xml',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
            `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
            `<Default Extension="xml" ContentType="application/xml"/>` +
            `<Default Extension="png" ContentType="image/png"/>` +
            `<Default Extension="jpg" ContentType="image/jpeg"/>` +
            `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
            `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
            `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
            `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
            `${slideOverrides.join('')}` +
            `</Types>`
        );

        zip.file(
            '_rels/.rels',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>` +
            `</Relationships>`
        );

        zip.file(
            'ppt/presentation.xml',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
            `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
            `<p:sldIdLst>${slideIdList.join('')}</p:sldIdLst>` +
            `<p:sldSz cx="${SLIDE_W_EMU}" cy="${SLIDE_H_EMU}" type="screen16x9"/>` +
            `<p:notesSz cx="6858000" cy="9144000"/>` +
            `</p:presentation>`
        );

        zip.file(
            'ppt/_rels/presentation.xml.rels',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join('')}</Relationships>`
        );

        zip.file(
            'ppt/slideMasters/slideMaster1.xml',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
            `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
            `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
            `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
            `</p:sldMaster>`
        );

        zip.file(
            'ppt/slideMasters/_rels/slideMaster1.xml.rels',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
            `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>` +
            `</Relationships>`
        );

        zip.file(
            'ppt/slideLayouts/slideLayout1.xml',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
            `<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
            `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
            `</p:sldLayout>`
        );

        zip.file(
            'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
            `</Relationships>`
        );

        zip.file(
            'ppt/theme/theme1.xml',
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Mirato">` +
            `<a:themeElements>` +
            `<a:clrScheme name="Mirato"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1C1917"/></a:dk2><a:lt2><a:srgbClr val="F5F5F4"/></a:lt2><a:accent1><a:srgbClr val="F59E0B"/></a:accent1><a:accent2><a:srgbClr val="D97706"/></a:accent2><a:accent3><a:srgbClr val="78716C"/></a:accent3><a:accent4><a:srgbClr val="57534E"/></a:accent4><a:accent5><a:srgbClr val="44403C"/></a:accent5><a:accent6><a:srgbClr val="292524"/></a:accent6><a:hlink><a:srgbClr val="F59E0B"/></a:hlink><a:folHlink><a:srgbClr val="D97706"/></a:folHlink></a:clrScheme>` +
            `<a:fontScheme name="Mirato"><a:majorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
            `<a:fmtScheme name="Mirato"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>` +
            `</a:themeElements></a:theme>`
        );

        const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
        return { name: presentation.name, data };
    },
};
