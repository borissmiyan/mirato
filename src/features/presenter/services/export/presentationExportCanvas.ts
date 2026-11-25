import { IStyleLayer } from '@/core/types';
import { getMediaBlob } from '../mediaPackingUtils';
import { ipcService } from '@/core/services/ipcService';
import type { FlattenedExportSlide } from './presentationExportUtils';

export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export async function resolveLayerImageDataUrl(
    mediaId?: string,
    fallbackUrl?: string
): Promise<{ dataUrl: string; mimeType: string } | null> {
    if (mediaId) {
        const entry = await getMediaBlob(mediaId);
        if (entry?.blob) {
            const dataUrl = await blobToDataUrl(entry.blob);
            return { dataUrl, mimeType: entry.blob.type || 'image/png' };
        }
    }
    if (fallbackUrl && fallbackUrl.startsWith('data:image/')) {
        const mimeMatch = fallbackUrl.match(/^data:(image\/[^;]+);/);
        return { dataUrl: fallbackUrl, mimeType: mimeMatch?.[1] || 'image/png' };
    }
    return null;
}

function extractGradientStops(css: string, fallbackFrom: string, fallbackTo: string): Array<{ color: string; pos: number }> {
    const colorStopRegex = /(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|transparent)\s*(\d+(?:\.\d+)?)%?/g;
    const matches: Array<{ color: string; pos: number | null }> = [];
    let m: RegExpExecArray | null;
    while ((m = colorStopRegex.exec(css)) !== null) {
        matches.push({
            color: m[1] === 'transparent' ? 'rgba(0,0,0,0)' : m[1],
            pos: m[2] !== undefined ? Math.max(0, Math.min(1, Number(m[2]) / 100)) : null,
        });
    }
    if (matches.length < 2) {
        return [
            { color: fallbackFrom === 'transparent' ? 'rgba(0,0,0,0)' : fallbackFrom, pos: 0 },
            { color: fallbackTo === 'transparent' ? 'rgba(0,0,0,0)' : fallbackTo, pos: 1 },
        ];
    }
    return matches.map((entry, idx) => ({
        color: entry.color,
        pos: entry.pos !== null ? entry.pos : idx / (matches.length - 1),
    }));
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
    const imgRatio = img.width / Math.max(1, img.height);
    const boxRatio = w / Math.max(1, h);
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgRatio > boxRatio) {
        sw = img.height * boxRatio;
        sx = (img.width - sw) / 2;
    } else {
        sh = img.width / boxRatio;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function drawBackgroundOnCanvas(ctx: CanvasRenderingContext2D, layers: IStyleLayer[], width: number, height: number): Promise<void> {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (layer.visible === false) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;

        if (layer.type === 'color' && layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(0, 0, width, height);
        } else if (layer.type === 'gradient' && layer.gradient) {
            const css = layer.gradient.cssGradient || '';
            if (layer.gradient.type === 'radial' || css.startsWith('radial-gradient')) {
                const stops = extractGradientStops(css, layer.gradient.from || '#ffffff', layer.gradient.to || 'transparent');
                const grad = ctx.createRadialGradient(width * 0.5, height * 0.44, 0, width * 0.5, height * 0.44, Math.max(width, height) * 0.55);
                stops.forEach(s => grad.addColorStop(s.pos, s.color));
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
            } else {
                const angleMatch = css.match(/(\d+(?:\.\d+)?)deg/);
                const angleDeg = angleMatch ? Number(angleMatch[1]) : (layer.gradient.angle ?? 160);
                const rad = ((angleDeg - 90) * Math.PI) / 180;
                const cx = width / 2;
                const cy = height / 2;
                const len = Math.hypot(width, height) / 2;
                const grad = ctx.createLinearGradient(
                    cx - Math.cos(rad) * len,
                    cy - Math.sin(rad) * len,
                    cx + Math.cos(rad) * len,
                    cy + Math.sin(rad) * len
                );
                const stops = extractGradientStops(css, layer.gradient.from || '#000000', layer.gradient.to || '#111111');
                stops.forEach(s => grad.addColorStop(s.pos, s.color));
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
            }
        } else if (layer.type === 'image') {
            const resolved = await resolveLayerImageDataUrl(layer.image?.id, layer.image?.url);
            if (resolved) {
                const img = await loadImage(resolved.dataUrl);
                if (img) drawCoverImage(ctx, img, 0, 0, width, height);
            }
        }

        ctx.restore();
    }
}

export async function renderBackgroundToPngDataUrl(layers: IStyleLayer[], width = 1920, height = 1080): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    await drawBackgroundOnCanvas(ctx, layers, width, height);
    return canvas.toDataURL('image/png');
}

export async function renderSlideToJpegBytes(slide: FlattenedExportSlide, width = 1920, height = 1080): Promise<Uint8Array> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    await drawBackgroundOnCanvas(ctx, slide.backgroundLayers, width, height);

    for (const shape of slide.shapes) {
        ctx.save();
        ctx.globalAlpha = shape.opacity;
        const px = (shape.x / 100) * width;
        const py = (shape.y / 100) * height;
        const pw = (shape.width / 100) * width;
        const ph = (shape.height / 100) * height;
        if (shape.shapeType === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
            if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fill(); }
            if (shape.strokeColor) { ctx.strokeStyle = shape.strokeColor; ctx.lineWidth = shape.strokeWidth || 2; ctx.stroke(); }
        } else {
            if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fillRect(px, py, pw, ph); }
            if (shape.strokeColor) { ctx.strokeStyle = shape.strokeColor; ctx.lineWidth = shape.strokeWidth || 2; ctx.strokeRect(px, py, pw, ph); }
        }
        ctx.restore();
    }

    for (const imgBlock of slide.images) {
        const img = await loadImage(imgBlock.dataUrl);
        if (!img) continue;
        const px = (imgBlock.x / 100) * width;
        const py = (imgBlock.y / 100) * height;
        const pw = (imgBlock.width / 100) * width;
        const ph = (imgBlock.height / 100) * height;
        ctx.drawImage(img, px, py, pw, ph);
    }

    for (const tb of slide.textBlocks) {
        ctx.save();
        const px = (tb.x / 100) * width;
        const py = (tb.y / 100) * height;
        const pw = (tb.width / 100) * width;
        const ph = (tb.height / 100) * height;
        const fontSize = tb.fontSize * (width / 1920);
        const lineHeightPx = fontSize * (tb.lineHeight || 1.25);

        ctx.font = `${tb.italic ? 'italic ' : ''}${tb.bold ? '700 ' : '400 '}${fontSize}px "${tb.fontFamily}", sans-serif`;
        ctx.fillStyle = tb.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = tb.alignHorizontal === 'left' ? 'left' : tb.alignHorizontal === 'right' ? 'right' : 'center';

        const wrappedLines: string[] = [];
        for (const para of tb.text.split(/\r?\n/)) {
            const words = para.split(' ');
            let current = '';
            for (const word of words) {
                const candidate = current ? `${current} ${word}` : word;
                if (ctx.measureText(candidate).width > pw && current) {
                    wrappedLines.push(current);
                    current = word;
                } else {
                    current = candidate;
                }
            }
            wrappedLines.push(current);
        }

        const totalTextHeight = wrappedLines.length * lineHeightPx;
        let startY = py;
        if (tb.alignVertical === 'middle') startY = py + (ph - totalTextHeight) / 2;
        else if (tb.alignVertical === 'bottom') startY = py + ph - totalTextHeight;

        const textX = tb.alignHorizontal === 'left' ? px : tb.alignHorizontal === 'right' ? px + pw : px + pw / 2;
        wrappedLines.forEach((line, idx) => {
            ctx.fillText(line, textX, startY + idx * lineHeightPx);
        });
        ctx.restore();
    }

    return dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92));
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function saveExportedFile(
    data: Uint8Array,
    filename: string,
    filterName: string,
    extension: string,
    mimeType: string
): Promise<boolean> {
    if (ipcService.isElectron()) {
        const saved = await ipcService.invoke<boolean>('export:save-file', {
            filename,
            data,
            title: filterName,
            filters: [{ name: filterName, extensions: [extension] }],
        });
        return Boolean(saved);
    }

    const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
    } finally {
        URL.revokeObjectURL(url);
    }
}
