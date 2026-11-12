import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { editingCanvasItemIdAtom, textCommandAtom } from '@/core/store/uiAtoms';
import {
  Eye, Plus, Move, Layers, Palette,
  Link2, Unlink, Target, Sun, BoxSelect,
  MoveHorizontal, MoveVertical, Blend
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem, IStyleLayer, LineCapType } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { toggleCanvasMask } from '@/core/utils/canvasMasks';
import { ScrubbableInput } from './ScrubbableInput';
import { InlineBackgroundPicker } from './InlineBackgroundPicker';
import { AlignmentTools, PropertySection } from './PropertySection';
import { calculateDistribution } from '@/core/utils/canvasDistribution';
import { CornerTL, CornerTR, CornerBL, CornerBR } from './helpers';
import { RotationDial } from '@/features/presenter/components/slide-editor/RotationDial';
import { TypographySection } from './TypographySection';
import { ItemEffectsSection } from './ItemEffectsSection';
import { ShapeAdvancedSection } from './ShapeAdvancedSection';
import { AutoLayoutSection } from './AutoLayoutSection';
import { ConstraintsSection } from './ConstraintsSection';
import { Button } from '@/shared/ui/Button';
import { CanvasService } from '@/features/presenter/services/CanvasService';

interface IItemPropertiesProps {
  selectedIds: string[];
  canvasItems: ICanvasItem[];
  updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
  onBatchUpdate: (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => void;
  isPreview: boolean;
  t: (key: string, fallback?: string) => string;
}

const ItemPropertiesComponent: React.FC<IItemPropertiesProps> = ({
  selectedIds,
  canvasItems,
  updateCanvasItems,
  onBatchUpdate,
  isPreview,
  t,
}) => {
  const [editingId] = useAtom(editingCanvasItemIdAtom);
  const setTextCommand = useSetAtom(textCommandAtom);

  const lastSelectedId = selectedIds[selectedIds.length - 1];
  const baseItem = React.useMemo(() => 
    canvasItems.find(i => i.id === lastSelectedId), 
    [canvasItems, lastSelectedId]
  );

  // Safe fallback if item is deleted but selection hasn't updated yet
  if (!baseItem) return null;

  const getSelectionValue = <T,>(getter: (item: ICanvasItem) => T): T | 'mixed' => 
    CanvasService.getSelectionState(selectedIds, canvasItems, getter);

  const handleAlign = async (type: string) => {
    if (type === 'distribute-h' || type === 'distribute-v') {
      const selectedItems = canvasItems.filter(i => selectedIds.includes(i.id));
      const distUpdates = calculateDistribution(selectedItems, type === 'distribute-h' ? 'horizontal' : 'vertical');
      if (distUpdates.length > 0) onBatchUpdate(distUpdates);
      return;
    }
    const u = CanvasService.getAlignmentUpdates(type);
    if (Object.keys(u).length > 0) updateCanvasItems(selectedIds, u);
  };

  const handleDimensionChange = async (dim: 'width' | 'height', newVal: number) => {
    const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
    selectedIds.forEach(id => {
      const item = canvasItems.find(i => i.id === id);
      if (!item) return;
      updates.push({ id, updates: CanvasService.calculateDimensionScale(item, dim, newVal) });
    });
    if (updates.length > 0) onBatchUpdate(updates);
  };

  const handlePivotChange = async (newPX?: number, newPY?: number) => {
    const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
    selectedIds.forEach(id => {
      const item = canvasItems.find(i => i.id === id);
      if (!item) return;
      updates.push({ id, updates: CanvasService.calculatePivotTransformation(item, newPX, newPY) });
    });
    if (updates.length > 0) onBatchUpdate(updates);
  };

  const handleRadiusChange = async (key: 'borderRadius' | 'borderRadiusTL' | 'borderRadiusTR' | 'borderRadiusBL' | 'borderRadiusBR', value: number) => {
    const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [];
    selectedIds.forEach(id => {
      const item = canvasItems.find(i => i.id === id);
      if (!item) return;
      updates.push({ id, updates: CanvasService.calculateRadiusUpdates(item, key, value) });
    });
    if (updates.length > 0) onBatchUpdate(updates);
  };

  return (
    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
      {/* ═══ Layout Section ═══ */}
      <PropertySection
        title={t('layout')}
        icon={Move}
        extra={baseItem && (
          <button
            type="button"
            onClick={() => {
              const updated = toggleCanvasMask(canvasItems, baseItem.id);
              const updates = updated
                .filter(u => selectedIds.includes(u.id) || (baseItem.groupId && u.groupId === baseItem.groupId))
                .map(u => ({ id: u.id, updates: { isMask: u.isMask, groupId: u.groupId } }));
              if (updates.length > 0) onBatchUpdate(updates);
            }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all border cursor-pointer apple-press",
              baseItem.isMask
                ? "bg-accent/20 border-accent/40 text-accent shadow-sm"
                : "bg-white/5 border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10"
            )}
            title={baseItem.isMask ? t('unmask', 'Отменить маску') : t('use_as_mask', 'Использовать как маску')}
          >
            <Blend className="w-3 h-3" />
            <span>{baseItem.isMask ? t('unmask', 'Снять маску') : t('mask', 'Маска')}</span>
          </button>
        )}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput label="X" name="X" value={getSelectionValue(i => i.x)} onChange={(v: number) => updateCanvasItems(selectedIds, { x: v })} />
                <ScrubbableInput label="Y" name="Y" value={getSelectionValue(i => i.y)} onChange={(v: number) => updateCanvasItems(selectedIds, { y: v })} />
              </div>
              <div className="grid grid-cols-[1fr_36px_1fr] gap-2 items-center">
                <ScrubbableInput label="W" name="W" value={getSelectionValue(i => i.width)} onChange={(v: number) => handleDimensionChange('width', v)} />
                <button
                  type="button"
                  onClick={() => updateCanvasItems(selectedIds, { lockAspectRatio: !baseItem.lockAspectRatio })}
                  className={cn(
                    "h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer apple-press border",
                    baseItem.lockAspectRatio
                      ? "text-accent bg-accent/15 border-accent/30 shadow-sm shadow-accent/10"
                      : "text-stone-500 hover:text-stone-300 hover:bg-white/5 border-white/5"
                  )}
                  title={t('lock_aspect_ratio', 'Lock Aspect Ratio')}
                >
                  {baseItem.lockAspectRatio ? <Link2 className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
                </button>
                <ScrubbableInput label="H" name="H" value={getSelectionValue(i => i.height)} onChange={(v: number) => handleDimensionChange('height', v)} />
              </div>
            </div>
            <RotationDial label={t('angle')} value={getSelectionValue(i => i.rotation || 0)} onChange={(v: number) => updateCanvasItems(selectedIds, { rotation: v })} />
          </div>
          <div className="flex flex-col gap-2 p-2.5 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-0.5">
              <Target className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{t('pivot_point')}</span>
            </div>
            <div className="flex gap-4 items-center">
              <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-2 rounded-xl border border-white/10 w-fit">
                {[{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 50 }, { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 100 }].map((p, i) => {
                  const pv = getSelectionValue(item => ({ x: item.pivotX ?? 50, y: item.pivotY ?? 50 }));
                  const isActive = pv !== 'mixed' && Math.abs(pv.x - p.x) < 0.1 && Math.abs(pv.y - p.y) < 0.1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePivotChange(p.x, p.y)}
                      className={cn(
                        "w-4 h-4 transition-all duration-200 cursor-pointer border rounded-md apple-press",
                        isActive
                          ? "bg-accent border-accent/40 shadow-[0_0_8px_var(--color-accent-glow)] scale-110"
                          : "bg-stone-800 border-white/5 hover:border-white/20 hover:bg-stone-700/50"
                      )}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <ScrubbableInput label={<MoveHorizontal className="w-3.5 h-3.5 text-stone-400" />} name="PX" value={getSelectionValue(item => item.pivotX ?? 50) as number | 'mixed'} onChange={(v: number) => handlePivotChange(v, undefined)} formatter={(v) => `${Math.round(v as number)}% `} />
                <ScrubbableInput label={<MoveVertical className="w-3.5 h-3.5 text-stone-400" />} name="PY" value={getSelectionValue(item => item.pivotY ?? 50) as number | 'mixed'} onChange={(v: number) => handlePivotChange(undefined, v)} formatter={(v) => `${Math.round(v as number)}% `} />
              </div>
            </div>
          </div>
          <AlignmentTools onAlign={handleAlign} canDistribute={selectedIds.length >= 3} />
        </div>
      </PropertySection>

      {/* ═══ Auto Layout Section ═══ */}
      {baseItem && (
        <AutoLayoutSection
          baseItem={baseItem}
          canvasItems={canvasItems}
          onBatchUpdate={onBatchUpdate}
        />
      )}

      {/* ═══ Adaptive Constraints Section ═══ */}
      {baseItem && (
        <ConstraintsSection
          baseItem={baseItem}
          onChange={(patch) => updateCanvasItems(selectedIds, patch)}
        />
      )}

      {/* ═══ Appearance Section ═══ */}
      <PropertySection title={t('appearance')} icon={Eye} defaultOpen={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ScrubbableInput label={<Sun className="w-3.5 h-3.5" />} name="Opacity" value={getSelectionValue(i => i.opacity ?? 1)} onChange={(v: number) => updateCanvasItems(selectedIds, { opacity: v })} step={0.05} min={0} max={1} formatter={(v) => Math.round(v * 100) / 100} />
            <div className="flex items-center gap-1.5 min-w-0">
              <ScrubbableInput label={<BoxSelect className="w-3.5 h-3.5" />} name="Radius" value={getSelectionValue(i => i.borderRadius ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadius', v)} min={0} />
              <button
                type="button"
                onClick={() => updateCanvasItems(selectedIds, { lockBorderRadius: baseItem.lockBorderRadius === false })}
                className={cn(
                  "h-9 w-9 shrink-0 flex items-center justify-center rounded-xl transition-all cursor-pointer apple-press border",
                  baseItem.lockBorderRadius !== false
                    ? "text-accent bg-accent/15 border-accent/30 shadow-sm shadow-accent/10"
                    : "text-stone-500 hover:text-stone-300 hover:bg-white/5 border-white/5"
                )}
                title={baseItem.lockBorderRadius === false ? t('link') : t('unlink')}
              >
                {baseItem.lockBorderRadius !== false ? <Link2 className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {baseItem.lockBorderRadius === false && (
            <div className="grid grid-cols-4 gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
              <ScrubbableInput label={<CornerTL />} name="RadiusTL" value={getSelectionValue(i => i.borderRadiusTL ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusTL', v)} min={0} />
              <ScrubbableInput label={<CornerTR />} name="RadiusTR" value={getSelectionValue(i => i.borderRadiusTR ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusTR', v)} min={0} />
              <ScrubbableInput label={<CornerBL />} name="RadiusBL" value={getSelectionValue(i => i.borderRadiusBL ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusBL', v)} min={0} />
              <ScrubbableInput label={<CornerBR />} name="RadiusBR" value={getSelectionValue(i => i.borderRadiusBR ?? 0)} onChange={(v: number) => handleRadiusChange('borderRadiusBR', v)} min={0} />
            </div>
          )}
          {baseItem.shape?.shapeType === 'rect' && (
            <div className="grid grid-cols-2 gap-2">
              <ScrubbableInput
                label="Smooth"
                name="Smoothing"
                value={Math.round((baseItem.shape.cornerSmoothing ?? 0) * 100)}
                onChange={(v: number) => updateCanvasItems(selectedIds, {
                  shape: { ...baseItem.shape!, cornerSmoothing: Math.min(1, Math.max(0, v / 100)) }
                })}
                min={0}
                max={100}
                suffix="%"
              />
              <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 select-none">
                <Layers className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{baseItem.zIndex + 1}</span>
              </div>
            </div>
          )}
          {baseItem.shape?.shapeType !== 'rect' && (
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 select-none">
                <Layers className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{baseItem.zIndex + 1}</span>
              </div>
            </div>
          )}
        </div>
      </PropertySection>

      {/* ═══ Shape Advanced Geometry & Presets Section ═══ */}
      <ShapeAdvancedSection
        baseItem={baseItem}
        selectedIds={selectedIds}
        updateCanvasItems={updateCanvasItems}
        t={t}
      />

      {/* ═══ Effects Section (modular subcomponent) ═══ */}
      <ItemEffectsSection
        baseItem={baseItem}
        selectedIds={selectedIds}
        updateCanvasItems={updateCanvasItems}
        t={t}
      />

      {/* ═══ Style Section ═══ */}
      <PropertySection title={t('style')} icon={Palette}>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('fill_label')}</span>
              <Button
                variant="ghost"
                size="xs"
                square
                onClick={() => {
                  const newLayer: IStyleLayer = {
                    id: crypto.randomUUID(),
                    type: 'color',
                    visible: true,
                    opacity: 1,
                    blendMode: 'normal',
                    color: '#0c0a09',
                    adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
                  };
                  selectedIds.forEach(id => {
                    const item = canvasItems.find(i => i.id === id);
                    if (!item) return;
                    const currentFills = ensureLayers(
                      item.type === 'text' ? item.text?.textFills : item.fills,
                      item.type === 'text' ? item.text?.color : undefined
                    );
                    if (item.type === 'text') {
                      updateCanvasItems([id], {
                        text: {
                          ...item.text!,
                          textFills: [newLayer, ...currentFills],
                          color: item.text?.color || '#ffffff'
                        }
                      });
                    } else {
                      updateCanvasItems([id], { fills: [newLayer, ...currentFills] });
                    }
                  });
                }}
                onMouseDown={(e) => e.preventDefault()}
                title={t('add_fill', 'Add Fill')}
              >
                <Plus className="w-3.5 h-3.5 text-stone-400" />
              </Button>
            </div>
            <div className="space-y-3">
              {getSelectionValue(i => i.type) === 'text' ? (
                <InlineBackgroundPicker
                  value={baseItem.text?.textFills || []}
                  onChange={(v) => {
                    if (v && v.length === 0) {
                      updateCanvasItems(selectedIds, { text: { ...baseItem.text!, textFills: [], color: '#ffffff' } });
                      return;
                    }
                    if (editingId && selectedIds.includes(editingId) && v?.[0]?.type === 'color') {
                      setTextCommand({ command: 'foreColor', value: v[0].color, timestamp: Date.now() });
                    }
                    updateCanvasItems(selectedIds, {
                      text: {
                        ...baseItem.text!,
                        textFills: v || [],
                        color: v?.[0]?.type === 'color' ? v[0].color : baseItem.text?.color || '#ffffff'
                      }
                    });
                  }}
                />
              ) : (
                <InlineBackgroundPicker
                  value={baseItem.fills}
                  onChange={(v) => updateCanvasItems(selectedIds, { fills: v || [] })}
                  onRemove={() => updateCanvasItems(selectedIds, { fills: [] })}
                />
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{t('stroke_label')}</span>
              <Button
                variant="ghost"
                size="xs"
                square
                onClick={() => {
                  const newLayer: IStyleLayer = {
                    id: crypto.randomUUID(),
                    type: 'color',
                    visible: true,
                    opacity: 1,
                    blendMode: 'normal',
                    color: '#ffffff',
                    width: baseItem.borderWidth || 2,
                    adjustments: { brightness: 100, contrast: 100, exposure: 0, saturation: 100, vibrance: 0, hue: 0, blur: 0 }
                  };
                  selectedIds.forEach(id => {
                    const item = canvasItems.find(i => i.id === id);
                    if (!item) return;
                    if (item.type === 'text') {
                      const currentStrokes = ensureLayers(item.text?.textStrokes);
                      updateCanvasItems([id], { text: { ...item.text!, textStrokes: [newLayer, ...currentStrokes] } });
                    } else {
                      const currentStrokes = ensureLayers(item.strokes);
                      updateCanvasItems([id], { strokes: [newLayer, ...currentStrokes], borderWidth: item.borderWidth || 2 });
                    }
                  });
                }}
                onMouseDown={(e) => e.preventDefault()}
                title={t('add_stroke', 'Add Stroke')}
              >
                <Plus className="w-3.5 h-3.5 text-stone-400" />
              </Button>
            </div>
            
            {/* Row 1: Layers */}
            <div className="w-full">
              {baseItem.type === 'text' ? (
                <InlineBackgroundPicker 
                  value={baseItem.text?.textStrokes || []} 
                  onChange={(v) => updateCanvasItems(selectedIds, { text: { ...baseItem.text!, textStrokes: v || [] } })} 
                  onRemove={() => updateCanvasItems(selectedIds, { borderWidth: 0, text: { ...baseItem.text!, textStrokes: [] } })} 
                />
              ) : (
                <InlineBackgroundPicker 
                  value={baseItem.strokes} 
                  onChange={(v) => updateCanvasItems(selectedIds, { strokes: v || [] })} 
                  onRemove={() => updateCanvasItems(selectedIds, { borderWidth: 0, strokes: [] })} 
                />
              )}
            </div>

            <div className="h-px bg-white/5 mx-[-12px]" />

            <div className="space-y-2">
              {/* Width Row */}
              <div className="flex flex-col gap-1 w-1/2">
                <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest px-1">{t('stroke_width')}</span>
                <ScrubbableInput 
                  label="W" 
                  name="BorderWidth" 
                  value={getSelectionValue(i => i.borderWidth ?? i.stroke?.width ?? 0)} 
                  onChange={(v: number) => {
                    updateCanvasItems(selectedIds, {
                      borderWidth: v,
                      ...(baseItem.type === 'stroke' && baseItem.stroke ? { stroke: { ...baseItem.stroke, width: v } } : {})
                    });
                  }} 
                  min={0} 
                  className="h-8"
                />
              </div>

              {/* Line Arrowheads (for stroke items) */}
              {baseItem.type === 'stroke' && (
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest px-1">{t('line_start_cap', 'Начало')}</span>
                    <select
                      className="w-full h-7 px-1.5 text-xs bg-stone-900 border border-white/10 rounded-md text-stone-200 focus:outline-none focus:border-accent"
                      value={baseItem.stroke?.startCap || 'none'}
                      onChange={(e) => {
                        const val = e.target.value as LineCapType;
                        updateCanvasItems(selectedIds, { stroke: { ...baseItem.stroke!, startCap: val } });
                      }}
                    >
                      <option value="none">{t('line_cap_none', 'Нет')}</option>
                      <option value="arrow">{t('line_cap_arrow', 'Стрелка')}</option>
                      <option value="triangle">{t('line_cap_triangle', 'Треугольник')}</option>
                      <option value="circle">{t('line_cap_circle', 'Круг')}</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-stone-600 uppercase tracking-widest px-1">{t('line_end_cap', 'Конец')}</span>
                    <select
                      className="w-full h-7 px-1.5 text-xs bg-stone-900 border border-white/10 rounded-md text-stone-200 focus:outline-none focus:border-accent"
                      value={baseItem.stroke?.endCap || 'none'}
                      onChange={(e) => {
                        const val = e.target.value as LineCapType;
                        updateCanvasItems(selectedIds, { stroke: { ...baseItem.stroke!, endCap: val } });
                      }}
                    >
                      <option value="none">{t('line_cap_none', 'Нет')}</option>
                      <option value="arrow">{t('line_cap_arrow', 'Стрелка')}</option>
                      <option value="triangle">{t('line_cap_triangle', 'Треугольник')}</option>
                      <option value="circle">{t('line_cap_circle', 'Круг')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </PropertySection>

      {/* ═══ Typography Section (text items only) ═══ */}
      {getSelectionValue(i => i.type) === 'text' && (
        <TypographySection
          selectedIds={selectedIds}
          canvasItems={canvasItems}
          updateCanvasItems={updateCanvasItems}
          onBatchUpdate={onBatchUpdate}
          isPreview={isPreview}
          t={t}
        />
      )}
    </div>
  );
};

export const ItemProperties = React.memo(ItemPropertiesComponent);
