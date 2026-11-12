import React, { useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  Shapes, Star, Circle, Square, Diamond, Triangle,
  ChevronRight, Save, Library, Waypoints
} from 'lucide-react';
import { ICanvasItem, ShapeType } from '@/core/types';
import { vectorEditingItemIdAtom } from '@/core/store/uiAtoms';
import { cn } from '@/core/utils/cn';
import { PropertySection } from './PropertySection';
import { ScrubbableInput } from './ScrubbableInput';
import { ShapePresetsModal } from '../slide-editor/modals/ShapePresetsModal';
import { ShapePresetBakeModal } from '../slide-editor/modals/ShapePresetBakeModal';
import { applyPresetToCanvasItem } from '../../services/shapePresetsService';
import { shapeItemToVectorNodes } from '../slide-editor/renderers/vectorGeometry';

interface ShapeAdvancedSectionProps {
  baseItem: ICanvasItem;
  selectedIds: string[];
  updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
  t: (key: string, fallback?: string) => string;
}

export const ShapeAdvancedSection: React.FC<ShapeAdvancedSectionProps> = ({
  baseItem,
  selectedIds,
  updateCanvasItems,
  t,
}) => {
  const [expandPerItem, setExpandPerItem] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isBakeModalOpen, setIsBakeModalOpen] = useState(false);
  const setVectorEditingId = useSetAtom(vectorEditingItemIdAtom);

  if (baseItem.type !== 'shape') return null;

  const shape = baseItem.shape || { shapeType: 'rect' };
  const shapeType = shape.shapeType;

  const handleShapeTypeChange = (type: ShapeType) => {
    const nextShape = { ...shape, shapeType: type };
    if (type === 'star') {
      nextShape.starPoints = nextShape.starPoints ?? 5;
      nextShape.starRatio = nextShape.starRatio ?? 0.382;
    } else if (type === 'polygon') {
      nextShape.polygonSides = nextShape.polygonSides ?? 5;
    } else if (type === 'triangle') {
      nextShape.shapeType = 'polygon';
      nextShape.polygonSides = 3;
    } else if (type === 'circle') {
      nextShape.innerRadius = nextShape.innerRadius ?? 0;
    }
    updateCanvasItems(selectedIds, { shape: nextShape });
  };

  const updateShapeData = (updates: Partial<typeof shape>) => {
    updateCanvasItems(selectedIds, {
      shape: {
        ...shape,
        ...updates,
      },
    });
  };

  const handleConvertToPath = () => {
    const vector = shapeItemToVectorNodes(baseItem);
    updateCanvasItems(selectedIds, {
      type: 'path',
      shape: undefined,
      path: {
        nodes: vector.nodes,
        isClosed: vector.isClosed,
      },
    });
    setVectorEditingId(baseItem.id);
  };

  const isPolygonUnified = shapeType === 'polygon' || shapeType === 'triangle';

  return (
    <>
      <PropertySection
        title={t('shape_properties', 'Свойства фигуры')}
        icon={Shapes}
        extra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPresetsModalOpen(true)}
              className="p-1 rounded-lg text-stone-400 hover:text-accent hover:bg-white/5 transition-colors cursor-pointer"
              title={t('presets', 'Пресеты')}
            >
              <Library className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsBakeModalOpen(true)}
              className="p-1 rounded-lg text-stone-400 hover:text-accent hover:bg-white/5 transition-colors cursor-pointer"
              title={t('save_as_preset', 'Сохранить как пресет')}
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Shape Type Selector Grid */}
          <div className="grid grid-cols-5 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            {[
              { type: 'rect' as ShapeType, icon: Square, label: 'Rect' },
              { type: 'circle' as ShapeType, icon: Circle, label: 'Circle/Donut' },
              { type: 'polygon' as ShapeType, icon: Triangle, label: 'Polygon' },
              { type: 'star' as ShapeType, icon: Star, label: 'Star' },
              { type: 'diamond' as ShapeType, icon: Diamond, label: 'Diamond' },
            ].map((btn) => {
              const Icon = btn.icon;
              const active =
                shapeType === btn.type ||
                (btn.type === 'polygon' && shapeType === 'triangle');
              return (
                <button
                  key={btn.type}
                  type="button"
                  onClick={() => handleShapeTypeChange(btn.type)}
                  className={cn(
                    "h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer apple-press",
                    active
                      ? "bg-accent/20 text-accent font-semibold border border-accent/30 shadow-sm"
                      : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                  )}
                  title={btn.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Flatten / Convert to Path Button */}
          <button
            type="button"
            onClick={handleConvertToPath}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white text-xs border border-white/10 transition-colors cursor-pointer apple-press"
            title={t('convert_to_path_tooltip', 'Запечь фигуру в свободный векторный контур Безье')}
          >
            <Waypoints className="w-3.5 h-3.5 text-accent" />
            <span>{t('convert_to_path', 'Преобразовать в контур (Flatten)')}</span>
          </button>

          {/* ═══ STAR CONTROLS ═══ */}
          {shapeType === 'star' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput
                  label="Points"
                  name="Points"
                  value={shape.starPoints ?? 5}
                  min={3}
                  max={60}
                  step={1}
                  onChange={(v) => updateShapeData({ starPoints: Math.round(v) })}
                />
                <ScrubbableInput
                  label="Depth"
                  name="Ratio"
                  value={Math.round((shape.starRatio ?? 0.382) * 100)}
                  min={5}
                  max={95}
                  onChange={(v) => updateShapeData({ starRatio: v / 100 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput
                  label="Outer R"
                  name="OuterRadius"
                  value={shape.starOuterRadius ?? 0}
                  min={0}
                  max={100}
                  onChange={(v) => updateShapeData({ starOuterRadius: v })}
                />
                <ScrubbableInput
                  label="Inner R"
                  name="InnerRadius"
                  value={shape.starInnerRadius ?? 0}
                  min={0}
                  max={100}
                  onChange={(v) => updateShapeData({ starInnerRadius: v })}
                />
              </div>

              {/* Individual Ray Fillets */}
              {(shape.starPoints ?? 5) <= 16 && (
                <div className="pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setExpandPerItem((prev) => !prev)}
                    className="flex items-center justify-between w-full text-[11px] text-stone-400 hover:text-stone-200 transition-colors py-0.5 cursor-pointer"
                  >
                    <span>{t('per_ray_fillets', 'Индивидуальные скругления лучей')}</span>
                    <ChevronRight className={cn("w-3 h-3 transition-transform", expandPerItem && "rotate-90")} />
                  </button>

                  {expandPerItem && (
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {Array.from({ length: shape.starPoints ?? 5 }).map((_, idx) => (
                        <ScrubbableInput
                          key={idx}
                          label={`R${idx + 1}`}
                          name={`Ray_${idx + 1}`}
                          value={shape.starOuterRadii?.[idx] ?? shape.starOuterRadius ?? 0}
                          min={0}
                          max={100}
                          onChange={(v) => {
                            const cur = shape.starOuterRadii
                              ? [...shape.starOuterRadii]
                              : Array(shape.starPoints ?? 5).fill(shape.starOuterRadius ?? 0);
                            cur[idx] = v;
                            updateShapeData({ starOuterRadii: cur });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ POLYGON & TRIANGLE CONTROLS ═══ */}
          {isPolygonUnified && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput
                  label="Sides"
                  name="Sides"
                  value={shape.polygonSides ?? (shapeType === 'triangle' ? 3 : 5)}
                  min={3}
                  max={60}
                  step={1}
                  onChange={(v) => updateShapeData({ polygonSides: Math.round(v) })}
                />
                <ScrubbableInput
                  label="Radius"
                  name="PolygonRadius"
                  value={shape.polygonCornerRadius ?? 0}
                  min={0}
                  max={100}
                  onChange={(v) => updateShapeData({ polygonCornerRadius: v })}
                />
              </div>

              {/* Per-Vertex Fillets */}
              {(shape.polygonSides ?? 5) <= 12 && (
                <div className="pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setExpandPerItem((prev) => !prev)}
                    className="flex items-center justify-between w-full text-[11px] text-stone-400 hover:text-stone-200 transition-colors py-0.5 cursor-pointer"
                  >
                    <span>{t('per_vertex_fillets', 'Скругление каждого угла')}</span>
                    <ChevronRight className={cn("w-3 h-3 transition-transform", expandPerItem && "rotate-90")} />
                  </button>

                  {expandPerItem && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      {Array.from({ length: shape.polygonSides ?? 5 }).map((_, idx) => (
                        <ScrubbableInput
                          key={idx}
                          label={`V${idx + 1}`}
                          name={`Vertex_${idx + 1}`}
                          value={shape.polygonCornerRadii?.[idx] ?? shape.polygonCornerRadius ?? 0}
                          min={0}
                          max={100}
                          onChange={(v) => {
                            const cur = shape.polygonCornerRadii
                              ? [...shape.polygonCornerRadii]
                              : Array(shape.polygonSides ?? 5).fill(shape.polygonCornerRadius ?? 0);
                            cur[idx] = v;
                            updateShapeData({ polygonCornerRadii: cur });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ CIRCLE / DONUT / ARC CONTROLS ═══ */}
          {shapeType === 'circle' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput
                  label="Hole"
                  name="InnerRadius"
                  value={Math.round((shape.innerRadius ?? 0) * 100)}
                  min={0}
                  max={99}
                  onChange={(v) => updateShapeData({ innerRadius: v / 100 })}
                />
                <ScrubbableInput
                  label="Start"
                  name="ArcStart"
                  value={Math.round(shape.arcStart ?? 0)}
                  min={0}
                  max={360}
                  onChange={(v) => updateShapeData({ arcStart: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput
                  label="Sweep"
                  name="ArcSweep"
                  value={Math.round(shape.arcSweep ?? 360)}
                  min={1}
                  max={360}
                  onChange={(v) => updateShapeData({ arcSweep: v })}
                />
                <ScrubbableInput
                  label="Sectors"
                  name="SectorCount"
                  value={shape.sectorCount ?? 1}
                  min={1}
                  max={24}
                  step={1}
                  onChange={(v) => updateShapeData({ sectorCount: Math.round(v) })}
                />
              </div>

              {(shape.sectorCount ?? 1) > 1 && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                  <ScrubbableInput
                    label="Gap"
                    name="SectorGap"
                    value={Math.round(shape.sectorGap ?? 0)}
                    min={0}
                    max={30}
                    onChange={(v) => updateShapeData({ sectorGap: v })}
                  />
                </div>
              )}

              {/* Per-Sector Weights */}
              {(shape.sectorCount ?? 1) > 1 && (shape.sectorCount ?? 1) <= 8 && (
                <div className="pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setExpandPerItem((prev) => !prev)}
                    className="flex items-center justify-between w-full text-[11px] text-stone-400 hover:text-stone-200 transition-colors py-0.5 cursor-pointer"
                  >
                    <span>{t('sector_weights', 'Размеры секторов (пропорции)')}</span>
                    <ChevronRight className={cn("w-3 h-3 transition-transform", expandPerItem && "rotate-90")} />
                  </button>

                  {expandPerItem && (
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {Array.from({ length: shape.sectorCount ?? 1 }).map((_, idx) => (
                        <ScrubbableInput
                          key={idx}
                          label={`S${idx + 1}`}
                          name={`Sector_${idx + 1}`}
                          value={shape.sectorWeights?.[idx] ?? 1}
                          min={0.1}
                          max={10}
                          step={0.1}
                          onChange={(v) => {
                            const cur = shape.sectorWeights
                              ? [...shape.sectorWeights]
                              : Array(shape.sectorCount ?? 1).fill(1);
                            cur[idx] = v;
                            updateShapeData({ sectorWeights: cur });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </PropertySection>

      {/* Preset Modals */}
      <ShapePresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        filterShapeType={shapeType}
        onSelectPreset={(preset) => {
          const applied = applyPresetToCanvasItem(baseItem, preset);
          updateCanvasItems([baseItem.id], applied);
        }}
      />

      <ShapePresetBakeModal
        isOpen={isBakeModalOpen}
        onClose={() => setIsBakeModalOpen(false)}
        item={baseItem}
        onSaved={() => {}}
      />
    </>
  );
};
