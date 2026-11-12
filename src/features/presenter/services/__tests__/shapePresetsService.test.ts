import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllShapePresets,
  saveCustomShapePreset,
  deleteCustomShapePreset,
  applyPresetToCanvasItem,
} from '../shapePresetsService';
import { db } from '@/core/db';
import { ICanvasItem, IShapePreset } from '@/core/types';

vi.mock('@/core/db', () => {
  let settingsStore: Record<string, any> = {};
  return {
    db: {
      settings: {
        get: vi.fn(async (key: string) => (settingsStore[key] ? { key, value: settingsStore[key] } : undefined)),
        put: vi.fn(async ({ key, value }: { key: string; value: any }) => {
          settingsStore[key] = value;
        }),
        delete: vi.fn(async (key: string) => {
          delete settingsStore[key];
        }),
      },
    },
  };
});

describe('shapePresetsService', () => {
  beforeEach(async () => {
    await db.settings.delete('custom_shape_presets');
  });

  it('loads factory shape presets', async () => {
    const presets = await getAllShapePresets();
    expect(presets.length).toBeGreaterThan(5);
    const starPresets = await getAllShapePresets('star');
    expect(starPresets.every((p) => p.shapeType === 'star')).toBe(true);
  });

  it('saves and retrieves a custom shape preset in Dexie', async () => {
    const saved = await saveCustomShapePreset({
      name: 'My Custom 7P Star',
      shapeType: 'star',
      category: 'user',
      shapeData: { starPoints: 7, starRatio: 0.35 },
      bakedFlags: {
        geometry: true,
        radii: true,
        fills: false,
        strokes: false,
        effects: false,
        dimensions: false,
        position: false,
      },
    });

    expect(saved.id).toBeDefined();
    const all = await getAllShapePresets('star');
    const found = all.find((p) => p.id === saved.id);
    expect(found).toBeDefined();
    expect(found?.shapeData.starPoints).toBe(7);

    // Delete custom preset
    await deleteCustomShapePreset(saved.id);
    const afterDelete = await getAllShapePresets('star');
    expect(afterDelete.find((p) => p.id === saved.id)).toBeUndefined();
  });

  it('applies preset selectively according to bakedFlags', () => {
    const initialItem: ICanvasItem = {
      id: 'item-1',
      type: 'shape',
      shape: { shapeType: 'rect' },
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      fills: [{ id: 'f1', type: 'color', color: '#ff0000', opacity: 1, blendMode: 'normal', visible: true }],
      strokes: [],
    };

    const preset: IShapePreset = {
      id: 'p-1',
      name: 'Custom',
      shapeType: 'star',
      category: 'user',
      shapeData: { starPoints: 6 },
      bakedFlags: {
        geometry: true,
        radii: false,
        fills: false, // Do NOT overwrite fills!
        strokes: false,
        effects: false,
        dimensions: true, // Overwrite dimensions
        position: false, // Keep original position
      },
      width: 55,
      height: 55,
      x: 99,
      y: 99,
    };

    const result = applyPresetToCanvasItem(initialItem, preset);
    expect(result.shape?.shapeType).toBe('star');
    expect(result.shape?.starPoints).toBe(6);
    // Position preserved
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    // Dimensions updated
    expect(result.width).toBe(55);
    expect(result.height).toBe(55);
    // Fills preserved because fills flag is false
    expect(result.fills[0].color).toBe('#ff0000');
  });
});
