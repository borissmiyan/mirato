import { IShapePreset, ShapeType, ICanvasItem } from '@/core/types';
import { db } from '@/core/db';
import { FACTORY_SHAPE_PRESETS } from '../components/slide-editor/renderers/shapes/shapePresetsData';
import { getNormalizedShapePath } from '../components/slide-editor/renderers/shapeGeometry';

const SETTINGS_KEY = 'custom_shape_presets';

export async function getCustomPresets(): Promise<IShapePreset[]> {
  try {
    const entry = await db.settings.get(SETTINGS_KEY);
    if (!entry || !Array.isArray(entry.value)) return [];
    return entry.value as IShapePreset[];
  } catch (err) {
    console.error('Failed to load custom shape presets:', err);
    return [];
  }
}

export async function getAllShapePresets(filterShapeType?: ShapeType): Promise<IShapePreset[]> {
  const custom = await getCustomPresets();
  const all = [...FACTORY_SHAPE_PRESETS, ...custom];
  if (!filterShapeType) return all;

  // Unify triangle under polygon or exact match
  return all.filter((p) => {
    if (filterShapeType === 'triangle' && p.shapeType === 'polygon' && p.shapeData.polygonSides === 3) {
      return true;
    }
    if (filterShapeType === 'polygon' && (p.shapeType === 'polygon' || p.shapeType === 'triangle')) {
      return true;
    }
    return p.shapeType === filterShapeType;
  });
}

export async function saveCustomShapePreset(
  presetData: Omit<IShapePreset, 'id' | 'createdAt'>
): Promise<IShapePreset> {
  const custom = await getCustomPresets();
  const newPreset: IShapePreset = {
    ...presetData,
    id: `custom-shape-${crypto.randomUUID()}`,
    category: 'user',
    createdAt: Date.now(),
    previewPath: presetData.previewPath || getNormalizedShapePath(presetData.shapeType, presetData.shapeData),
  };

  const updated = [...custom, newPreset];
  await db.settings.put({ key: SETTINGS_KEY, value: updated });
  return newPreset;
}

export async function deleteCustomShapePreset(id: string): Promise<void> {
  const custom = await getCustomPresets();
  const updated = custom.filter((p) => p.id !== id);
  await db.settings.put({ key: SETTINGS_KEY, value: updated });
}

export function applyPresetToCanvasItem(
  target: ICanvasItem,
  preset: IShapePreset
): ICanvasItem {
  const next: ICanvasItem = {
    ...target,
    type: 'shape',
    shape: {
      shapeType: preset.shapeType,
      ...(preset.bakedFlags.geometry ? preset.shapeData : target.shape),
    },
  };

  if (preset.bakedFlags.fills && preset.fills) {
    next.fills = JSON.parse(JSON.stringify(preset.fills));
  }
  if (preset.bakedFlags.strokes && preset.strokes) {
    next.strokes = JSON.parse(JSON.stringify(preset.strokes));
    if (preset.borderWidth !== undefined) next.borderWidth = preset.borderWidth;
    if (preset.borderColor !== undefined) next.borderColor = preset.borderColor;
    if (preset.strokeAlign !== undefined) next.strokeAlign = preset.strokeAlign;
    if (preset.strokeJoin !== undefined) next.strokeJoin = preset.strokeJoin;
    if (preset.strokeDashArray !== undefined) next.strokeDashArray = preset.strokeDashArray;
  }
  if (preset.bakedFlags.effects && preset.effects) {
    next.effects = JSON.parse(JSON.stringify(preset.effects));
  }
  if (preset.bakedFlags.radii) {
    if (preset.borderRadius !== undefined) next.borderRadius = preset.borderRadius;
    if (preset.borderRadiusTL !== undefined) next.borderRadiusTL = preset.borderRadiusTL;
    if (preset.borderRadiusTR !== undefined) next.borderRadiusTR = preset.borderRadiusTR;
    if (preset.borderRadiusBR !== undefined) next.borderRadiusBR = preset.borderRadiusBR;
    if (preset.borderRadiusBL !== undefined) next.borderRadiusBL = preset.borderRadiusBL;
    if (preset.lockBorderRadius !== undefined) next.lockBorderRadius = preset.lockBorderRadius;
  }
  if (preset.bakedFlags.dimensions) {
    if (preset.width !== undefined) next.width = preset.width;
    if (preset.height !== undefined) next.height = preset.height;
    if (preset.rotation !== undefined) next.rotation = preset.rotation;
    if (preset.pivotX !== undefined) next.pivotX = preset.pivotX;
    if (preset.pivotY !== undefined) next.pivotY = preset.pivotY;
  }
  if (preset.bakedFlags.position) {
    if (preset.x !== undefined) next.x = preset.x;
    if (preset.y !== undefined) next.y = preset.y;
  }

  return next;
}

