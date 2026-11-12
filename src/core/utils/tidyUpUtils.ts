import { ICanvasItem } from '@/core/types';

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

export interface ISelectionSpacingInfo {
  direction: 'row' | 'column' | 'grid';
  isUniform: boolean;
  averageGapPx: number;
  gapsPx: number[];
  sortedItems: ICanvasItem[];
}

/**
 * Detects whether selected items form a row, column, or grid, and analyzes gaps between them.
 */
export function analyzeSelectionSpacing(items: ICanvasItem[]): ISelectionSpacingInfo {
  if (items.length < 2) {
    return {
      direction: 'row',
      isUniform: false,
      averageGapPx: 0,
      gapsPx: [],
      sortedItems: items,
    };
  }

  // Calculate bounding box spans in pixels
  const itemPixels = items.map((it) => {
    const w = (it.width / 100) * BASE_WIDTH;
    const h = (it.height / 100) * BASE_HEIGHT;
    const pX = it.pivotX ?? 50;
    const pY = it.pivotY ?? 50;
    const left = (it.x / 100) * BASE_WIDTH - (pX / 100) * w;
    const top = (it.y / 100) * BASE_HEIGHT - (pY / 100) * h;
    return { item: it, left, top, right: left + w, bottom: top + h, width: w, height: h };
  });

  const minX = Math.min(...itemPixels.map((p) => p.left));
  const maxX = Math.max(...itemPixels.map((p) => p.right));
  const minY = Math.min(...itemPixels.map((p) => p.top));
  const maxY = Math.max(...itemPixels.map((p) => p.bottom));

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const direction: 'row' | 'column' | 'grid' =
    spanX >= spanY * 1.5 ? 'row' : spanY >= spanX * 1.5 ? 'column' : 'grid';

  const sorted = [...itemPixels].sort((a, b) =>
    direction === 'row' ? a.left - b.left : a.top - b.top
  );

  const gapsPx: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr && next) {
      const gap = direction === 'row' ? next.left - curr.right : next.top - curr.bottom;
      gapsPx.push(Math.round(gap * 10) / 10);
    }
  }

  const averageGapPx =
    gapsPx.length > 0 ? gapsPx.reduce((a, b) => a + b, 0) / gapsPx.length : 0;

  // Gaps are uniform if all are within 4px of the average
  const isUniform =
    gapsPx.length > 0 && gapsPx.every((g) => Math.abs(g - averageGapPx) <= 4.0);

  return {
    direction,
    isUniform,
    averageGapPx: Math.round(averageGapPx * 10) / 10,
    gapsPx,
    sortedItems: sorted.map((s) => s.item),
  };
}

/**
 * Tidies up messy selections into an evenly spaced row, column, or grid.
 */
export function tidyUpItems(items: ICanvasItem[], forcedGapPx?: number): ICanvasItem[] {
  if (items.length < 2) return items;

  const info = analyzeSelectionSpacing(items);
  const gapPx = forcedGapPx ?? (info.averageGapPx > 5 ? info.averageGapPx : 24);

  if (info.direction === 'row') {
    let curLeft = (info.sortedItems[0].x / 100) * BASE_WIDTH -
      ((info.sortedItems[0].pivotX ?? 50) / 100) * ((info.sortedItems[0].width / 100) * BASE_WIDTH);

    return info.sortedItems.map((item) => {
      const w = (item.width / 100) * BASE_WIDTH;
      const pX = item.pivotX ?? 50;
      const newX = curLeft + (pX / 100) * w;
      curLeft += w + gapPx;
      return {
        ...item,
        x: Math.round((newX / BASE_WIDTH) * 1000) / 10,
      };
    });
  }

  if (info.direction === 'column') {
    let curTop = (info.sortedItems[0].y / 100) * BASE_HEIGHT -
      ((info.sortedItems[0].pivotY ?? 50) / 100) * ((info.sortedItems[0].height / 100) * BASE_HEIGHT);

    return info.sortedItems.map((item) => {
      const h = (item.height / 100) * BASE_HEIGHT;
      const pY = item.pivotY ?? 50;
      const newY = curTop + (pY / 100) * h;
      curTop += h + gapPx;
      return {
        ...item,
        y: Math.round((newY / BASE_HEIGHT) * 1000) / 10,
      };
    });
  }

  // Grid layout
  const cols = Math.ceil(Math.sqrt(items.length));
  const startLeft = (info.sortedItems[0].x / 100) * BASE_WIDTH;
  const startTop = (info.sortedItems[0].y / 100) * BASE_HEIGHT;
  const maxW = Math.max(...items.map((i) => (i.width / 100) * BASE_WIDTH));
  const maxH = Math.max(...items.map((i) => (i.height / 100) * BASE_HEIGHT));

  return info.sortedItems.map((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const newXPx = startLeft + col * (maxW + gapPx);
    const newYPx = startTop + row * (maxH + gapPx);
    return {
      ...item,
      x: Math.round((newXPx / BASE_WIDTH) * 1000) / 10,
      y: Math.round((newYPx / BASE_HEIGHT) * 1000) / 10,
    };
  });
}

/**
 * Adjusts uniform gap between items along their primary axis.
 */
export function adjustUniformGap(
  items: ICanvasItem[],
  direction: 'row' | 'column',
  newGapPx: number
): ICanvasItem[] {
  return tidyUpItems(items, Math.max(0, newGapPx));
}

/**
 * Swaps positions of two items in the ordered selection.
 */
export function swapItemPositions(
  itemA: ICanvasItem,
  itemB: ICanvasItem
): { updatedA: ICanvasItem; updatedB: ICanvasItem } {
  return {
    updatedA: { ...itemA, x: itemB.x, y: itemB.y },
    updatedB: { ...itemB, x: itemA.x, y: itemA.y },
  };
}

