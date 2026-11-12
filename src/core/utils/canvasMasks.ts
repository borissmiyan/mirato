import { ICanvasItem } from '@/core/types';

export interface IMaskGroupData {
    maskItem: ICanvasItem;
    maskedItems: ICanvasItem[];
}

export interface IPartitionedItems {
    regularItems: ICanvasItem[];
    maskGroups: Map<string, IMaskGroupData>;
}

/**
 * Assigns a shared groupId to target items.
 */
export function groupCanvasItems(
    items: ICanvasItem[],
    targetIds: string[],
    newGroupId: string = crypto.randomUUID()
): ICanvasItem[] {
    return items.map(it => targetIds.includes(it.id) ? { ...it, groupId: newGroupId } : it);
}

/**
 * Ungroups target items by removing their groupId and clearing isMask.
 */
export function ungroupCanvasItems(
    items: ICanvasItem[],
    targetIds: string[]
): ICanvasItem[] {
    return items.map(it => {
        if (targetIds.includes(it.id)) {
            const copy = { ...it };
            delete copy.groupId;
            delete copy.isMask;
            return copy;
        }
        return it;
    });
}

/**
 * Toggles mask status on a target item.
 * If turning on and item has no group, it automatically groups the item
 * with the adjacent layer directly above it (Figma behavior).
 */
export function toggleCanvasMask(
    items: ICanvasItem[],
    targetId: string
): ICanvasItem[] {
    const target = items.find(i => i.id === targetId);
    if (!target) return items;

    const willBeMask = !target.isMask;

    if (!willBeMask) {
        // Toggle mask off
        return items.map(it => it.id === targetId ? { ...it, isMask: false } : it);
    }

    // Toggle mask on
    if (target.groupId) {
        return items.map(it => it.id === targetId ? { ...it, isMask: true } : it);
    }

    // Target has no group: group with adjacent item above in zIndex
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    const targetIndex = sorted.findIndex(i => i.id === targetId);
    const itemAbove = targetIndex !== -1 && targetIndex < sorted.length - 1
        ? sorted[targetIndex + 1]
        : null;

    const newGroupId = crypto.randomUUID();

    return items.map(it => {
        if (it.id === targetId) {
            return { ...it, groupId: newGroupId, isMask: true };
        }
        if (itemAbove && it.id === itemAbove.id) {
            return { ...it, groupId: newGroupId };
        }
        return it;
    });
}

/**
 * Partitions items into regular unmasked items and mask groups.
 * A mask group contains the lowest zIndex mask item and all items with
 * the same groupId that have higher zIndex.
 */
export function partitionMaskedItems(items: ICanvasItem[]): IPartitionedItems {
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
    const maskGroups = new Map<string, IMaskGroupData>();

    // 1. Identify active mask items for each group
    const activeMasksByGroup = new Map<string, ICanvasItem>();
    sorted.forEach(item => {
        if (item.groupId && item.isMask && !activeMasksByGroup.has(item.groupId)) {
            activeMasksByGroup.set(item.groupId, item);
        }
    });

    // 2. Partition items
    const regularItems: ICanvasItem[] = [];
    const groupedItemsByGroup = new Map<string, ICanvasItem[]>();

    sorted.forEach(item => {
        const maskForGroup = item.groupId ? activeMasksByGroup.get(item.groupId) : undefined;
        if (maskForGroup && item.zIndex > maskForGroup.zIndex) {
            const list = groupedItemsByGroup.get(item.groupId!) || [];
            list.push(item);
            groupedItemsByGroup.set(item.groupId!, list);
        } else if (maskForGroup && item.id === maskForGroup.id) {
            // It is the mask itself
            // Group record will be initialized
        } else {
            regularItems.push(item);
        }
    });

    activeMasksByGroup.forEach((maskItem, groupId) => {
        const maskedItems = groupedItemsByGroup.get(groupId) || [];
        maskGroups.set(groupId, { maskItem, maskedItems });
    });

    return { regularItems, maskGroups };
}
