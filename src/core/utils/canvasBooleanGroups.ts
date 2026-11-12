import { ICanvasItem, IVectorNode } from '@/core/types';
import { shapeItemToVectorNodes } from '@/features/presenter/components/slide-editor/renderers/vectorGeometry';

export type IBooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude';

export interface IBooleanGroupData {
  groupId: string;
  operation: IBooleanOperation;
  baseItem: ICanvasItem;
  operatorItems: ICanvasItem[];
  allItems: ICanvasItem[];
}

export interface IPartitionedBooleanItems {
  regularItems: ICanvasItem[];
  booleanGroups: Map<string, IBooleanGroupData>;
}

/**
 * Groups target items into a non-destructive Boolean Group.
 * Lowest z-index item becomes the base; higher z-index items become operators.
 */
export function groupAsBooleanOperation(
  items: ICanvasItem[],
  targetIds: string[],
  operation: IBooleanOperation,
  newGroupId: string = crypto.randomUUID()
): ICanvasItem[] {
  if (targetIds.length < 2) return items;

  const targetItems = items.filter(it => targetIds.includes(it.id));
  if (targetItems.length < 2) return items;

  // Sort ascending by zIndex to determine base vs operators
  const sortedTargets = [...targetItems].sort((a, b) => a.zIndex - b.zIndex);
  const baseItem = sortedTargets[0];
  const operatorIds = new Set(sortedTargets.slice(1).map(it => it.id));

  return items.map(it => {
    if (it.id === baseItem.id) {
      return {
        ...it,
        groupId: newGroupId,
        booleanOperation: operation,
        booleanRole: 'base',
      };
    }
    if (operatorIds.has(it.id)) {
      return {
        ...it,
        groupId: newGroupId,
        booleanOperation: operation,
        booleanRole: 'operator',
      };
    }
    return it;
  });
}

/**
 * Ungroups a Boolean Group back into individual independent layers.
 */
export function ungroupBooleanOperation(
  items: ICanvasItem[],
  targetGroupId: string
): ICanvasItem[] {
  return items.map(it => {
    if (it.groupId === targetGroupId) {
      const copy = { ...it };
      delete copy.groupId;
      delete copy.booleanOperation;
      delete copy.booleanRole;
      return copy;
    }
    return it;
  });
}

/**
 * Partitions items into regular canvas items and non-destructive Boolean groups.
 */
export function partitionBooleanGroups(items: ICanvasItem[]): IPartitionedBooleanItems {
  const booleanGroups = new Map<string, IBooleanGroupData>();
  const booleanGroupItemIds = new Set<string>();

  // 1. Group items by groupId if they carry booleanOperation
  const itemsByGroup = new Map<string, ICanvasItem[]>();
  for (const item of items) {
    if (item.groupId && item.booleanOperation) {
      const list = itemsByGroup.get(item.groupId) || [];
      list.push(item);
      itemsByGroup.set(item.groupId, list);
    }
  }

  // 2. Build valid IBooleanGroupData
  itemsByGroup.forEach((groupItems, groupId) => {
    if (groupItems.length < 2) return; // Needs at least 2 items to form a boolean cut

    const sorted = [...groupItems].sort((a, b) => a.zIndex - b.zIndex);
    const baseItem = sorted.find(i => i.booleanRole === 'base') || sorted[0];
    const operatorItems = sorted.filter(i => i.id !== baseItem.id);
    const operation = baseItem.booleanOperation || sorted[0].booleanOperation || 'subtract';

    booleanGroups.set(groupId, {
      groupId,
      operation,
      baseItem,
      operatorItems,
      allItems: sorted,
    });

    sorted.forEach(i => booleanGroupItemIds.add(i.id));
  });

  // 3. Regular items are those not part of an active boolean group
  const regularItems = items.filter(it => !booleanGroupItemIds.has(it.id));

  return { regularItems, booleanGroups };
}

/**
 * Flattens a live Boolean group destructively into a single permanent vector path item.
 */
export function flattenBooleanGroup(booleanGroup: IBooleanGroupData): ICanvasItem {
  const { baseItem, operatorItems, operation } = booleanGroup;

  // Convert base item into vector nodes
  const baseVector = shapeItemToVectorNodes(baseItem);

  // Convert operator items into vector nodes and transform into base item relative percentage space
  const allNodes: IVectorNode[] = [...baseVector.nodes];

  for (const op of operatorItems) {
    const opVector = shapeItemToVectorNodes(op);
    // Project operator's relative position onto base item's coordinate box
    const relX = ((op.x - baseItem.x) / (baseItem.width || 1)) * 100;
    const relY = ((op.y - baseItem.y) / (baseItem.height || 1)) * 100;
    const scaleX = (op.width / (baseItem.width || 1));
    const scaleY = (op.height / (baseItem.height || 1));

    const transformedNodes: IVectorNode[] = opVector.nodes.map(n => ({
      ...n,
      id: crypto.randomUUID(),
      x: Math.round((relX + n.x * scaleX) * 10) / 10,
      y: Math.round((relY + n.y * scaleY) * 10) / 10,
      handleIn: n.handleIn ? {
        x: Math.round((relX + n.handleIn.x * scaleX) * 10) / 10,
        y: Math.round((relY + n.handleIn.y * scaleY) * 10) / 10,
      } : undefined,
      handleOut: n.handleOut ? {
        x: Math.round((relX + n.handleOut.x * scaleX) * 10) / 10,
        y: Math.round((relY + n.handleOut.y * scaleY) * 10) / 10,
      } : undefined,
    }));

    allNodes.push(...transformedNodes);
  }

  const flattened: ICanvasItem = {
    ...baseItem,
    id: crypto.randomUUID(),
    type: 'path',
    path: {
      nodes: allNodes,
      isClosed: true,
      fillRule: operation === 'exclude' || operation === 'subtract' ? 'evenodd' : 'nonzero',
    },
    // Clear boolean group metadata
    groupId: undefined,
    booleanOperation: undefined,
    booleanRole: undefined,
  };

  return flattened;
}

