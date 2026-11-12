import { describe, it, expect } from 'vitest';
import {
  groupAsBooleanOperation,
  ungroupBooleanOperation,
  partitionBooleanGroups,
  flattenBooleanGroup
} from '../canvasBooleanGroups';
import { ICanvasItem } from '@/core/types';

describe('canvasBooleanGroups', () => {
  const item1: ICanvasItem = {
    id: 'base-1',
    type: 'shape',
    x: 10, y: 10, width: 30, height: 30,
    rotation: 0,
    zIndex: 1, locked: false, visible: true,
    fills: [], strokes: [],
    shape: { shapeType: 'rect' },
  };

  const item2: ICanvasItem = {
    id: 'op-1',
    type: 'shape',
    x: 20, y: 20, width: 20, height: 20,
    rotation: 0,
    zIndex: 2, locked: false, visible: true,
    fills: [], strokes: [],
    shape: { shapeType: 'circle' },
  };

  it('groups items non-destructively into a boolean group', () => {
    const items = [item1, item2];
    const grouped = groupAsBooleanOperation(items, ['base-1', 'op-1'], 'subtract', 'bool-grp-1');

    const gBase = grouped.find(i => i.id === 'base-1');
    const gOp = grouped.find(i => i.id === 'op-1');

    expect(gBase?.groupId).toBe('bool-grp-1');
    expect(gBase?.booleanOperation).toBe('subtract');
    expect(gBase?.booleanRole).toBe('base');

    expect(gOp?.groupId).toBe('bool-grp-1');
    expect(gOp?.booleanOperation).toBe('subtract');
    expect(gOp?.booleanRole).toBe('operator');
  });

  it('partitions boolean groups and regular items', () => {
    const grouped = groupAsBooleanOperation([item1, item2], ['base-1', 'op-1'], 'subtract', 'bool-grp-1');
    const other: ICanvasItem = {
      id: 'other-1',
      type: 'text',
      x: 0, y: 0, width: 10, height: 10,
      rotation: 0,
      zIndex: 5, locked: false, visible: true,
      fills: [], strokes: [],
    };

    const { regularItems, booleanGroups } = partitionBooleanGroups([...grouped, other]);
    expect(regularItems).toHaveLength(1);
    expect(regularItems[0].id).toBe('other-1');
    expect(booleanGroups.has('bool-grp-1')).toBe(true);

    const grp = booleanGroups.get('bool-grp-1');
    expect(grp?.operation).toBe('subtract');
    expect(grp?.baseItem.id).toBe('base-1');
    expect(grp?.operatorItems).toHaveLength(1);
  });

  it('ungroups a boolean group back to regular layers', () => {
    const grouped = groupAsBooleanOperation([item1, item2], ['base-1', 'op-1'], 'union', 'bool-grp-1');
    const ungrouped = ungroupBooleanOperation(grouped, 'bool-grp-1');

    expect(ungrouped[0].groupId).toBeUndefined();
    expect(ungrouped[0].booleanOperation).toBeUndefined();
    expect(ungrouped[1].groupId).toBeUndefined();
  });

  it('flattens a boolean group into a single path item', () => {
    const grouped = groupAsBooleanOperation([item1, item2], ['base-1', 'op-1'], 'subtract', 'bool-grp-1');
    const { booleanGroups } = partitionBooleanGroups(grouped);
    const grp = booleanGroups.get('bool-grp-1')!;

    const flattened = flattenBooleanGroup(grp);
    expect(flattened.type).toBe('path');
    expect(flattened.path?.nodes.length).toBeGreaterThan(4);
    expect(flattened.path?.fillRule).toBe('evenodd');
    expect(flattened.groupId).toBeUndefined();
  });
});
