import { CollisionDetection, closestCorners } from '@dnd-kit/core';

/**
 * Extracts horizontal translation (tx) from computed CSS transform matrix.
 * Handles DOMMatrixReadOnly, 2D matrix(a, b, c, d, tx, ty), and 3D matrix3d(...) formats.
 */
export function getHorizontalTransform(node: HTMLElement): number {
    if (typeof window === 'undefined') return 0;
    const style = window.getComputedStyle(node).transform;
    if (!style || style === 'none') return 0;

    try {
        if (typeof DOMMatrixReadOnly !== 'undefined') {
            const matrix = new DOMMatrixReadOnly(style);
            return isNaN(matrix.m41) ? 0 : matrix.m41;
        }
    } catch {
        // Fallback to regex string parsing if DOMMatrixReadOnly throws on older engines
    }

    if (style.startsWith('matrix(')) {
        const parts = style.slice(7, -1).split(',');
        if (parts.length >= 6) {
            const tx = parseFloat(parts[4]);
            return isNaN(tx) ? 0 : tx;
        }
    }

    if (style.startsWith('matrix3d(')) {
        const parts = style.slice(9, -1).split(',');
        if (parts.length >= 16) {
            const tx = parseFloat(parts[12]);
            return isNaN(tx) ? 0 : tx;
        }
    }

    return 0;
}

/**
 * Apple-grade horizontal collision detection strategy with hysteresis stabilization.
 * 
 * Key architectural improvements:
 * 1. Transform-immune layout coordinates: Subtracts any transient CSS transforms
 *    (applied by useSortable to shift neighbor items) from live getBoundingClientRect().
 *    This ensures that when a slide shifts out of the way, its collision boundaries do NOT
 *    shift with it, preventing feedback loops where the ghost drop placeholder fails to follow.
 * 2. Directional Hysteresis Buffer (24px): Requires the dragging pointer to push past the midpoint by
 *    a 24px threshold before swapping slides. Once swapped, returning requires pulling back by -24px.
 *    This 48px deadband completely eliminates high-frequency flip-flop oscillation.
 */
export const horizontalCollisionDetection: CollisionDetection = (args) => {
    const { active, droppableContainers, pointerCoordinates } = args;

    // Fall back to closestCorners for non-sorting actions (dragging a new item onto the timeline)
    if (active.id === 'presentation-item-drag') {
        return closestCorners(args);
    }

    if (!pointerCoordinates) return [];
    const pointerX = pointerCoordinates.x;

    // Filter to slide containers only (exclude background droppable zone and library drag handles)
    const slideContainers = droppableContainers.filter(
        (container) =>
            !container.disabled &&
            container.id !== 'timeline-droppable' &&
            container.id !== 'presentation-item-drag'
    );

    if (slideContainers.length === 0) return [];

    // Map containers to their true layout screen bounds (subtracting any transient CSS transforms)
    const items = slideContainers
        .map((container) => {
            const node = container.node.current;
            if (!node) {
                const rect = container.rect.current;
                if (!rect) return null;
                return {
                    id: container.id,
                    container,
                    rect,
                    centerX: rect.left + rect.width / 2,
                };
            }

            const domRect = node.getBoundingClientRect();
            if (domRect.width === 0) return null;

            // Measure true layout position: node.offsetLeft is by CSS spec
            // completely immune to CSS transforms (FLIP animations) relative to its offsetParent.
            const parent = node.offsetParent as HTMLElement | null;
            let untransformedLeft: number;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                untransformedLeft = parentRect.left + node.offsetLeft;
            } else {
                const tx = getHorizontalTransform(node);
                untransformedLeft = domRect.left - tx;
            }
            const centerX = untransformedLeft + domRect.width / 2;

            return {
                id: container.id,
                container,
                rect: {
                    left: untransformedLeft,
                    right: untransformedLeft + domRect.width,
                    top: domRect.top,
                    bottom: domRect.bottom,
                    width: domRect.width,
                    height: domRect.height,
                },
                centerX,
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) return [];

    // Order items visually by true layout position (left to right)
    items.sort((a, b) => a.rect.left - b.rect.left);

    const activeIdStr = String(active.id);
    const activeItemIndex = items.findIndex((it) => it.id === activeIdStr);

    // Hysteresis deadband in pixels: avoids oscillation when pointer is near boundary
    const HYSTERESIS_PX = 24;

    const collisions = items.map((item, index) => {
        let distance: number;

        if (activeItemIndex === -1 || item.id === activeIdStr) {
            // Standard center distance if active is not in list or evaluating active item itself
            distance = Math.abs(pointerX - item.centerX);
        } else {
            const activeItem = items[activeItemIndex];
            const midpointX = (activeItem.centerX + item.centerX) / 2;

            if (index > activeItemIndex) {
                // Candidate is to the right of active: must cross midpoint + hysteresis
                if (pointerX < midpointX + HYSTERESIS_PX) {
                    // Not far enough right: heavily penalize distance to keep active in current place
                    distance = 10000 + Math.abs(pointerX - item.centerX);
                } else {
                    distance = Math.abs(pointerX - item.centerX);
                }
            } else {
                // Candidate is to the left of active: must cross midpoint - hysteresis
                if (pointerX > midpointX - HYSTERESIS_PX) {
                    // Not far enough left: heavily penalize distance to keep active in current place
                    distance = 10000 + Math.abs(pointerX - item.centerX);
                } else {
                    distance = Math.abs(pointerX - item.centerX);
                }
            }
        }

        return {
            id: item.id,
            data: {
                droppableContainer: item.container,
                value: distance,
            },
        };
    });

    // Sort by distance (closest valid target first)
    collisions.sort((a, b) => a.data.value - b.data.value);

    return collisions;
};
