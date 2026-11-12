import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Check, X } from 'lucide-react';
import { Modal } from '@/shared/ui/modals/Modal';
import { Button } from '@/shared/ui/Button';
import { ICanvasItem, ShapePresetBakedFlags } from '@/core/types';
import { saveCustomShapePreset } from '../../../services/shapePresetsService';

interface ShapePresetBakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ICanvasItem;
  onSaved?: () => void;
}

export const ShapePresetBakeModal: React.FC<ShapePresetBakeModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [flags, setFlags] = useState<ShapePresetBakedFlags>({
    geometry: true,
    radii: true,
    fills: true,
    strokes: true,
    effects: true,
    dimensions: true,
    position: false, // OFF by default
  });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const toggleFlag = (key: keyof ShapePresetBakedFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await saveCustomShapePreset({
        name: name.trim(),
        shapeType: item.shape?.shapeType || 'rect',
        category: 'user',
        shapeData: item.shape || { shapeType: 'rect' },
        bakedFlags: flags,
        fills: flags.fills ? item.fills : undefined,
        strokes: flags.strokes ? item.strokes : undefined,
        effects: flags.effects ? item.effects : undefined,
        borderWidth: flags.strokes ? item.borderWidth : undefined,
        borderColor: flags.strokes ? item.borderColor : undefined,
        strokeAlign: flags.strokes ? item.strokeAlign : undefined,
        strokeJoin: flags.strokes ? item.strokeJoin : undefined,
        strokeDashArray: flags.strokes ? item.strokeDashArray : undefined,
        borderRadius: flags.radii ? item.borderRadius : undefined,
        borderRadiusTL: flags.radii ? item.borderRadiusTL : undefined,
        borderRadiusTR: flags.radii ? item.borderRadiusTR : undefined,
        borderRadiusBR: flags.radii ? item.borderRadiusBR : undefined,
        borderRadiusBL: flags.radii ? item.borderRadiusBL : undefined,
        lockBorderRadius: flags.radii ? item.lockBorderRadius : undefined,
        width: flags.dimensions ? item.width : undefined,
        height: flags.dimensions ? item.height : undefined,
        rotation: flags.dimensions ? item.rotation : undefined,
        pivotX: flags.dimensions ? item.pivotX : undefined,
        pivotY: flags.dimensions ? item.pivotY : undefined,
        x: flags.position ? item.x : undefined,
        y: flags.position ? item.y : undefined,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to bake shape preset:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const flagOptions: Array<{ key: keyof ShapePresetBakedFlags; label: string; desc: string }> = [
    { key: 'geometry', label: t('preset_flag_geometry', 'Геометрия фигуры'), desc: t('preset_flag_geometry_desc', 'Лучи, стороны, углы, внутренний радиус бублика') },
    { key: 'radii', label: t('preset_flag_radii', 'Скругления углов'), desc: t('preset_flag_radii_desc', 'Внутренние и внешние радиусы скругления') },
    { key: 'fills', label: t('preset_flag_fills', 'Заливки'), desc: t('preset_flag_fills_desc', 'Цвета, градиенты, изображения') },
    { key: 'strokes', label: t('preset_flag_strokes', 'Обводки'), desc: t('preset_flag_strokes_desc', 'Толщина, цвет, штрихи') },
    { key: 'effects', label: t('preset_flag_effects', 'Эффекты'), desc: t('preset_flag_effects_desc', 'Тени, размытие, свечение') },
    { key: 'dimensions', label: t('preset_flag_dimensions', 'Размеры и пропорции'), desc: t('preset_flag_dimensions_desc', 'Ширина, высота, угол поворота, пивот') },
    { key: 'position', label: t('preset_flag_position', 'Фиксированная позиция X, Y'), desc: t('preset_flag_position_desc', 'Сохранить точные координаты на слайде') },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-stone-100">
              {t('save_shape_preset', 'Сохранить как пресет фигуры')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-stone-300">
            {t('preset_name', 'Название пресета')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('preset_name_placeholder', 'Например: Золотая звезда 8 лучей')}
            className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-stone-100 text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-stone-300">
            {t('preset_parameters_to_bake', 'Параметры для запекания в пресет')}
          </label>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {flagOptions.map((opt) => {
              const active = flags[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleFlag(opt.key)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-black/30 hover:bg-black/50 border border-white/5 hover:border-white/10 transition-colors text-left cursor-pointer"
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      active
                        ? 'bg-accent border-accent text-white'
                        : 'border-white/20 bg-transparent'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-stone-200">{opt.label}</div>
                    <div className="text-[11px] text-stone-400 truncate">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel', 'Отмена')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? t('saving', 'Сохранение...') : t('save', 'Сохранить')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
