import { ICanvasItem, IAutoLayoutConfig } from '@/core/types';

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

interface PaddingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function resolvePadding(config: IAutoLayoutConfig): PaddingBox {
  const p = config.padding ?? 0;
  return {
    top: config.paddingTop ?? p,
    right: config.paddingRight ?? p,
    bottom: config.paddingBottom ?? p,
    left: config.paddingLeft ?? p,
  };
}

/**
 * Computes Figma-grade Auto Layout for container items and their child elements.
 * Supports horizontal/vertical flow, wrap, 4-side padding, space-between, and absolute positioning bypass.
 */
export function computeAutoLayout(
  container: ICanvasItem,
  children: ICanvasItem[]
): { container: ICanvasItem; children: ICanvasItem[] } {
  const config = container.autoLayout;
  if (!config || !config.enabled || children.length === 0) {
    return { container, children };
  }

  // Preserve items with isAbsoluteInLayout (Figma absolute position inside frame/group)
  const layoutChildren = children.filter(c => !c.isAbsoluteInLayout);
  const absoluteChildren = children.filter(c => !!c.isAbsoluteInLayout);

  if (layoutChildren.length === 0) {
    return { container, children };
  }

  const {
    direction,
    align = 'start',
    counterAlign,
    hugContents = false,
    wrap = false,
    isSpaceBetween = false,
  } = config;
  const effectiveCounterAlign = counterAlign || align;

  const pad = resolvePadding(config);
  let gap = config.gap ?? 0;

  const cPivotX = container.pivotX ?? 50;
  const cPivotY = container.pivotY ?? 50;
  const cWidthPx = (container.width / 100) * BASE_WIDTH;
  const cHeightPx = (container.height / 100) * BASE_HEIGHT;

  const cLeftPx = (container.x / 100) * BASE_WIDTH - (cPivotX / 100) * cWidthPx;
  const cTopPx = (container.y / 100) * BASE_HEIGHT - (cPivotY / 100) * cHeightPx;

  // Respect primary axis order
  const sorted = [...layoutChildren].sort((a, b) =>
    direction === 'horizontal' ? a.x - b.x : a.y - b.y
  );

  const updatedChildren: ICanvasItem[] = [];

  if (direction === 'horizontal') {
    if (isSpaceBetween && sorted.length > 1 && !wrap) {
      const sumW = sorted.reduce((acc, c) => acc + (c.width / 100) * BASE_WIDTH, 0);
      const avail = cWidthPx - pad.left - pad.right - sumW;
      gap = Math.max(0, avail / (sorted.length - 1));
    }

    let curX = pad.left;
    let curY = pad.top;
    let rowMaxH = 0;
    let maxContentW = 0;

    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const childW = (child.width / 100) * BASE_WIDTH;
      const childH = (child.height / 100) * BASE_HEIGHT;

      // Wrapping logic
      if (wrap && i > 0 && curX + childW > cWidthPx - pad.right) {
        curX = pad.left;
        curY += rowMaxH + gap;
        rowMaxH = 0;
      }

      rowMaxH = Math.max(rowMaxH, childH);
      maxContentW = Math.max(maxContentW, curX + childW);

      const chPivotX = child.pivotX ?? 50;
      const chPivotY = child.pivotY ?? 50;

      let childTopPx = cTopPx + curY;
      if (effectiveCounterAlign === 'center') {
        const availableRowH = wrap ? rowMaxH : (cHeightPx - pad.top - pad.bottom);
        childTopPx = cTopPx + curY + (availableRowH - childH) / 2;
      } else if (effectiveCounterAlign === 'end') {
        const availableRowH = wrap ? rowMaxH : (cHeightPx - pad.top - pad.bottom);
        childTopPx = cTopPx + curY + availableRowH - childH;
      }

      const childLeftPx = cLeftPx + curX;
      const childAnchorXPx = childLeftPx + (chPivotX / 100) * childW;
      const childAnchorYPx = childTopPx + (chPivotY / 100) * childH;

      updatedChildren.push({
        ...child,
        x: Math.round((childAnchorXPx / BASE_WIDTH) * 1000) / 10,
        y: Math.round((childAnchorYPx / BASE_HEIGHT) * 1000) / 10,
      });

      curX += childW + gap;
    }

    const totalWidthPx = maxContentW + pad.right;
    const totalHeightPx = curY + rowMaxH + pad.bottom;

    const finalContainer: ICanvasItem = {
      ...container,
      width: hugContents ? Math.round((totalWidthPx / BASE_WIDTH) * 1000) / 10 : container.width,
      height: hugContents ? Math.round((totalHeightPx / BASE_HEIGHT) * 1000) / 10 : container.height,
    };

    return { container: finalContainer, children: [...updatedChildren, ...absoluteChildren] };
  }

  // Vertical layout
  if (isSpaceBetween && sorted.length > 1 && !wrap) {
    const sumH = sorted.reduce((acc, c) => acc + (c.height / 100) * BASE_HEIGHT, 0);
    const avail = cHeightPx - pad.top - pad.bottom - sumH;
    gap = Math.max(0, avail / (sorted.length - 1));
  }

  let curX = pad.left;
  let curY = pad.top;
  let colMaxW = 0;
  let maxContentH = 0;

  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i];
    const childW = (child.width / 100) * BASE_WIDTH;
    const childH = (child.height / 100) * BASE_HEIGHT;

    // Wrapping logic in vertical mode (wrap into new columns)
    if (wrap && i > 0 && curY + childH > cHeightPx - pad.bottom) {
      curY = pad.top;
      curX += colMaxW + gap;
      colMaxW = 0;
    }

    colMaxW = Math.max(colMaxW, childW);
    maxContentH = Math.max(maxContentH, curY + childH);

    const chPivotX = child.pivotX ?? 50;
    const chPivotY = child.pivotY ?? 50;

    let childLeftPx = cLeftPx + curX;
    if (effectiveCounterAlign === 'center') {
      const availableColW = wrap ? colMaxW : (cWidthPx - pad.left - pad.right);
      childLeftPx = cLeftPx + curX + (availableColW - childW) / 2;
    } else if (effectiveCounterAlign === 'end') {
      const availableColW = wrap ? colMaxW : (cWidthPx - pad.left - pad.right);
      childLeftPx = cLeftPx + curX + availableColW - childW;
    }

    const childTopPx = cTopPx + curY;
    const childAnchorXPx = childLeftPx + (chPivotX / 100) * childW;
    const childAnchorYPx = childTopPx + (chPivotY / 100) * childH;

    updatedChildren.push({
      ...child,
      x: Math.round((childAnchorXPx / BASE_WIDTH) * 1000) / 10,
      y: Math.round((childAnchorYPx / BASE_HEIGHT) * 1000) / 10,
    });

    curY += childH + gap;
  }

  const totalWidthPx = curX + colMaxW + pad.right;
  const totalHeightPx = maxContentH + pad.bottom;

  const finalContainer: ICanvasItem = {
    ...container,
    width: hugContents ? Math.round((totalWidthPx / BASE_WIDTH) * 1000) / 10 : container.width,
    height: hugContents ? Math.round((totalHeightPx / BASE_HEIGHT) * 1000) / 10 : container.height,
  };

  return { container: finalContainer, children: [...updatedChildren, ...absoluteChildren] };
}

