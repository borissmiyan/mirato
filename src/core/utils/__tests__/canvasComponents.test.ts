import { describe, it, expect } from 'vitest';
import {
  createMasterComponent,
  createInstanceFromMaster,
  syncMasterToInstances,
  detachInstance,
} from '../canvasComponents';
import { ICanvasItem } from '@/core/types';

describe('canvasComponents', () => {
  const sampleItem: ICanvasItem = {
    id: 'item-master-1',
    type: 'shape',
    name: 'Primary Button',
    x: 10,
    y: 10,
    width: 20,
    height: 10,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    fills: [{ id: 'f1', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#9333ea' }],
    strokes: [],
  };

  it('marks an item as a master component with isMasterComponent: true', () => {
    const master = createMasterComponent(sampleItem);
    expect(master.isMasterComponent).toBe(true);
    expect(master.id).toBe(sampleItem.id);
  });

  it('creates an instance linked to master via masterComponentId', () => {
    const master = createMasterComponent(sampleItem);
    const instance = createInstanceFromMaster(master, { x: 35, y: 10 });
    expect(instance.masterComponentId).toBe(master.id);
    expect(instance.isMasterComponent).toBeUndefined();
    expect(instance.x).toBe(35);
    expect(instance.fills[0].color).toBe('#9333ea');
  });

  it('syncs non-overridden properties from master to instances', () => {
    const master = createMasterComponent(sampleItem);
    const instance = createInstanceFromMaster(master, { x: 35, y: 10 });

    const updatedMaster: ICanvasItem = {
      ...master,
      width: 25,
      fills: [{ id: 'f2', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#10b981' }],
    };

    const synced = syncMasterToInstances(updatedMaster, [instance]);
    expect(synced[0].width).toBe(25);
    expect(synced[0].fills[0].color).toBe('#10b981');
    // Instance's unique position is preserved
    expect(synced[0].x).toBe(35);
  });

  it('preserves component overrides when syncing', () => {
    const master = createMasterComponent(sampleItem);
    const instance = createInstanceFromMaster(master, { x: 35, y: 10 });
    // User specifically customized fill color on this instance
    instance.componentOverrides = {
      fills: [{ id: 'f-custom', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#ef4444' }],
    };

    const updatedMaster: ICanvasItem = {
      ...master,
      width: 30,
      fills: [{ id: 'f3', type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: '#3b82f6' }],
    };

    const synced = syncMasterToInstances(updatedMaster, [instance]);
    expect(synced[0].width).toBe(30);
    // Custom fill override is kept!
    expect(synced[0].fills[0].color).toBe('#ef4444');
  });

  it('detaches an instance converting it to an independent element', () => {
    const master = createMasterComponent(sampleItem);
    const instance = createInstanceFromMaster(master, { x: 35, y: 10 });
    const detached = detachInstance(instance);

    expect(detached.masterComponentId).toBeUndefined();
    expect(detached.componentOverrides).toBeUndefined();
  });
});

