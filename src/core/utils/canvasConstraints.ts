import { ICanvasItem, ICanvasConstraints } from '@/core/types';

export interface IBoxBounds {
  width: number;
  height: number;
}

/**
 * Calculates updated position and size of an element according to Figma-grade adaptive constraints
 * when its parent container or frame/group dimensions change.
 */
export function applyConstraints(
  item: ICanvasItem,
  oldBox: IBoxBounds,
  newBox: IBoxBounds
): Partial<ICanvasItem> {
  const constraints: ICanvasConstraints = item.constraints || {
    horizontal: 'left',
    vertical: 'top',
  };

  const deltaW = newBox.width - oldBox.width;
  const deltaH = newBox.height - oldBox.height;

  let newX = item.x;
  let newY = item.y;
  let newWidth = item.width;
  let newHeight = item.height;

  // ── Horizontal Constraints ───────────────────────────────────────
  switch (constraints.horizontal) {
    case 'right': {
      newX = item.x + deltaW;
      break;
    }
    case 'left-right': {
      // Stretch width while maintaining fixed left and right offsets
      newWidth = Math.max(1, item.width + deltaW);
      break;
    }
    case 'center': {
      // Maintain distance relative to container center
      newX = item.x + deltaW / 2;
      break;
    }
    case 'scale': {
      const scaleX = oldBox.width > 0 ? newBox.width / oldBox.width : 1;
      newX = item.x * scaleX;
      newWidth = Math.max(1, item.width * scaleX);
      break;
    }
    case 'left':
    default:
      // Left edge stays fixed, nothing changes
      break;
  }

  // ── Vertical Constraints ─────────────────────────────────────────
  switch (constraints.vertical) {
    case 'bottom': {
      newY = item.y + deltaH;
      break;
    }
    case 'top-bottom': {
      // Stretch height while maintaining fixed top and bottom offsets
      newHeight = Math.max(1, item.height + deltaH);
      break;
    }
    case 'center': {
      // Maintain distance relative to container center
      newY = item.y + deltaH / 2;
      break;
    }
    case 'scale': {
      const scaleY = oldBox.height > 0 ? newBox.height / oldBox.height : 1;
      newY = item.y * scaleY;
      newHeight = Math.max(1, item.height * scaleY);
      break;
    }
    case 'top':
    default:
      // Top edge stays fixed, nothing changes
      break;
  }

  return {
    x: Math.round(newX * 10) / 10,
    y: Math.round(newY * 10) / 10,
    width: Math.round(newWidth * 10) / 10,
    height: Math.round(newHeight * 10) / 10,
  };
}

