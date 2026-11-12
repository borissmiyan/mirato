import { ICanvasItem, IVectorNode } from '@/core/types';

/**
 * Resolves visual dimensions (0-100%) of a canvas item.
 * For shapes, images, videos, and fixed text, dimensions are explicit percentages from the model.
 * For text with auto-height or auto-width, measures actual rendered DOM height/width
 * relative to the logical canvas container (1920x1080).
 */
export function resolveVisualDimensions(item: ICanvasItem): { width: number; height: number } {
  let width = item.width;
  let height = item.height;

  if (item.type === 'text') {
    const isAutoWidth = item.text?.resizingMode === 'auto-width';
    const isAutoHeight = item.text?.resizingMode === 'auto-height' || !item.text?.resizingMode;

    if (isAutoWidth || isAutoHeight) {
      const itemEl = document.getElementById(`item-${item.id}`);
      if (itemEl) {
        const containerEl = (itemEl.offsetParent as HTMLElement | null)
          || itemEl.parentElement
          || document.getElementById('slide-canvas-container');

        const containerW = (containerEl && containerEl.clientWidth > 0)
          ? containerEl.clientWidth
          : (containerEl && containerEl.offsetWidth > 0 ? containerEl.offsetWidth : 1920);

        const containerH = (containerEl && containerEl.clientHeight > 0)
          ? containerEl.clientHeight
          : (containerEl && containerEl.offsetHeight > 0 ? containerEl.offsetHeight : 1080);

        if (isAutoWidth && itemEl.offsetWidth > 0 && containerW > 0) {
          width = (itemEl.offsetWidth / containerW) * 100;
        }
        if (isAutoHeight && itemEl.offsetHeight > 0 && containerH > 0) {
          height = (itemEl.offsetHeight / containerH) * 100;
        }
      }
    }
  }

  return { width, height };
}

/**
 * Clones target canvas items during Alt-drag move operation with auto-incremented zIndex.
 */
export function cloneItemsForAltDrag(
  originalTargetIds: string[],
  currentItems: ICanvasItem[]
): { clones: ICanvasItem[]; nextItems: ICanvasItem[] } {
  const clones = originalTargetIds.map((id) => {
    const orig = currentItems.find((i) => i.id === id);
    if (!orig) return null;
    const clone = structuredClone(orig);
    clone.id = crypto.randomUUID();
    clone.zIndex = currentItems.length + 1;
    return clone;
  }).filter((c): c is ICanvasItem => c !== null);

  const nextItems = clones.length > 0 ? [...currentItems, ...clones] : currentItems;
  return { clones, nextItems };
}

/**
 * Calculates deformed vector nodes for Cmd-drag corner interaction,
 * properly un-rotating screen deltas into item local coordinate space.
 */
export function calculateCornerDeformation(
  initialPathNodes: IVectorNode[],
  corner: string,
  deltaXPx: number,
  deltaYPx: number,
  itemW: number,
  itemH: number,
  rotation: number = 0
): IVectorNode[] | null {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localDxPx = deltaXPx * cos + deltaYPx * sin;
  const localDyPx = -deltaXPx * sin + deltaYPx * cos;
  const localDxPct = (localDxPx / (itemW || 1)) * 100;
  const localDyPct = (localDyPx / (itemH || 1)) * 100;

  const cornerIdx = corner === 'top-left' ? 0
    : corner === 'top-right' ? 1
    : corner === 'bottom-right' ? 2
    : corner === 'bottom-left' ? 3 : -1;

  if (cornerIdx === -1 || cornerIdx >= initialPathNodes.length) return null;

  return initialPathNodes.map((n, idx) => {
    if (idx !== cornerIdx) return n;
    return {
      ...n,
      x: Math.round((n.x + localDxPct) * 10) / 10,
      y: Math.round((n.y + localDyPct) * 10) / 10,
    };
  });
}

