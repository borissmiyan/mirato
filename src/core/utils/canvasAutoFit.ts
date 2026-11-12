import { ICanvasItem } from '@/core/types';

/**
 * Calculates auto-fit (hug contents) and aspect-ratio restorations for canvas items.
 * Triggered on double clicking handles in Figma-style slide editing.
 */
export function calculateAutoFit(
    pos: string,
    item: ICanvasItem,
    scrollWidth: number,
    scrollHeight: number,
    containerWidth: number,
    containerHeight: number
): Partial<ICanvasItem> | null {
    if (item.locked || containerWidth <= 0 || containerHeight <= 0) {
        return null;
    }

    if (item.type === 'text') {
        const isHorizontal = pos === 'middle-left' || pos === 'middle-right';
        const isVertical = pos === 'top-center' || pos === 'bottom-center';

        if (isHorizontal) {
            const contentW = Math.max(5, Math.min(100, Math.ceil((scrollWidth / containerWidth) * 100)));
            return {
                width: contentW,
                text: item.text ? {
                    ...item.text,
                    resizingMode: item.text.resizingMode === 'auto-width' ? 'fixed' : 'auto-width',
                } : undefined,
            };
        }

        if (isVertical) {
            const contentH = Math.max(5, Math.min(100, Math.ceil((scrollHeight / containerHeight) * 100)));
            return {
                height: contentH,
                text: item.text ? {
                    ...item.text,
                    resizingMode: item.text.resizingMode === 'auto-height' ? 'fixed' : 'auto-height',
                } : undefined,
            };
        }

        // Corner handles: hug both dimensions
        const contentW = Math.max(5, Math.min(100, Math.ceil((scrollWidth / containerWidth) * 100)));
        const contentH = Math.max(5, Math.min(100, Math.ceil((scrollHeight / containerHeight) * 100)));
        return {
            width: contentW,
            height: contentH,
        };
    }

    if (item.type === 'image' || item.type === 'video') {
        // Restore standard 16:9 proportional aspect ratio based on current width
        const targetHeight = Math.max(5, Math.min(100, Math.round(item.width * (9 / 16) * 10) / 10));
        return {
            height: targetHeight,
        };
    }

    return null;
}

