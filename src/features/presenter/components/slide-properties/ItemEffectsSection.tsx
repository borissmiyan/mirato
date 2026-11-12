import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Plus, Eye, EyeOff, Trash2, Sun, Layers, Hash, MoveRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { ICanvasItem, ICanvasEffect, CanvasEffectType } from '@/core/types';
import { ensureEffects } from '@/core/utils/styleMigration';
import { PropertySection } from './PropertySection';
import { FloatingPopover } from '@/components/FloatingPopover';
import { CompactColorPicker } from '@/components/CompactColorPicker';
import { ScrubbableInput } from './ScrubbableInput';
import { Button } from '@/shared/ui/Button';

interface IItemEffectsSectionProps {
  baseItem: ICanvasItem;
  selectedIds: string[];
  updateCanvasItems: (ids: string[], updates: Partial<ICanvasItem>) => void;
  t: (key: string, fallback?: string) => string;
}

export const ItemEffectsSection = React.memo<IItemEffectsSectionProps>(({
  baseItem,
  selectedIds,
  updateCanvasItems,
  t,
}) => {
  const effects = React.useMemo(() => ensureEffects(baseItem), [baseItem]);

  const handleAddEffect = (type: CanvasEffectType) => {
    const newEffect: ICanvasEffect = {
      id: crypto.randomUUID(),
      type,
      visible: true,
      ...(type.includes('shadow')
        ? { x: 0, y: 10, blur: 20, color: 'rgba(0,0,0,0.5)', spread: 0 }
        : { blur: 20 }),
    };
    updateCanvasItems(selectedIds, { effects: [...effects, newEffect] });
  };

  const handleUpdateEffect = (idx: number, updates: Partial<ICanvasEffect>) => {
    const newEffects = [...effects];
    newEffects[idx] = { ...effects[idx], ...updates };
    updateCanvasItems(selectedIds, { effects: newEffects });
  };

  const handleRemoveEffect = (idx: number) => {
    updateCanvasItems(selectedIds, { effects: effects.filter((_, i) => i !== idx) });
  };

  return (
    <PropertySection
      title={t('effects')}
      icon={Wand2}
      defaultOpen={false}
      extra={<AddEffectButton onAdd={handleAddEffect} />}
    >
      <div className="space-y-1.5 -mx-1">
        {effects.map((fx, idx) => (
          <EffectRow
            key={fx.id}
            effect={fx}
            onUpdate={(updates) => handleUpdateEffect(idx, updates)}
            onRemove={() => handleRemoveEffect(idx)}
          />
        ))}
        {effects.length === 0 && (
          <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-25 group">
            <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500 text-stone-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">
              {t('no_effects_applied', 'No Effects Applied')}
            </span>
          </div>
        )}
      </div>
    </PropertySection>
  );
});

const AddEffectButton: React.FC<{ onAdd: (type: CanvasEffectType) => void }> = ({ onAdd }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const effectTypes: { type: CanvasEffectType; label: string }[] = [
    { type: 'drop-shadow', label: t('drop_shadow', 'Drop Shadow') },
    { type: 'inner-shadow', label: t('inner_shadow', 'Inner Shadow') },
    { type: 'layer-blur', label: t('layer_blur', 'Layer Blur') },
    { type: 'background-blur', label: t('background_blur', 'Background Blur') },
    { type: 'noise', label: t('noise', 'Noise') },
  ];

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="xs"
        square
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label={t('add_effect_label', 'Add Effect')}
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
      <FloatingPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={buttonRef}
        title={t('add_effect_label', 'Add Effect')}
        width={180}
      >
        <div className="p-1 flex flex-col gap-0.5">
          {effectTypes.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-100 hover:bg-white/5 rounded-xl transition-all apple-press cursor-pointer flex items-center justify-between group"
            >
              {label}
              <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </FloatingPopover>
    </>
  );
};

const EffectRow: React.FC<{
  effect: ICanvasEffect;
  onUpdate: (updates: Partial<ICanvasEffect>) => void;
  onRemove: () => void;
}> = ({ effect, onUpdate, onRemove }) => {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const Icon = effect.type.includes('shadow')
    ? MoveRight
    : effect.type === 'layer-blur'
    ? Layers
    : effect.type === 'noise'
    ? Hash
    : Sun;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 border border-transparent",
        effect.visible ? "bg-white/3 hover:bg-white/5 hover:border-white/5" : "opacity-40"
      )}
    >
      <Button
        ref={settingsButtonRef}
        variant="ghost"
        size="xs"
        square
        onClick={() => setIsSettingsOpen(true)}
        className="text-stone-500 hover:text-accent"
        title={t('properties', 'Properties')}
      >
        <Icon className={cn("w-3.5 h-3.5", effect.type.includes('shadow') && "rotate-45")} />
      </Button>

      <span className="flex-1 text-[10px] font-bold text-stone-300 uppercase tracking-widest truncate select-none">
        {t(effect.type.replace('-', '_'))}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={() => onUpdate({ visible: !effect.visible })}
          title={effect.visible ? t('hide', 'Hide') : t('show', 'Show')}
        >
          {effect.visible ? <Eye className="w-3.5 h-3.5 text-stone-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={onRemove}
          className="text-stone-500 hover:text-red-400 hover:bg-red-500/10"
          title={t('remove', 'Remove')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <FloatingPopover
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        anchorRef={settingsButtonRef}
        title={`${t(effect.type.replace('-', '_'))} ${t('properties', 'Properties')}`}
        width={220}
      >
        <div className="p-3 space-y-3">
          {effect.type.includes('shadow') ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput label="X" name="fx-x" value={effect.x ?? 0} onChange={(v) => onUpdate({ x: v })} />
                <ScrubbableInput label="Y" name="fx-y" value={effect.y ?? 0} onChange={(v) => onUpdate({ y: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput label={t('effect_blur', 'Blur')} name="fx-blur" value={effect.blur ?? 0} min={0} onChange={(v) => onUpdate({ blur: v })} />
                <ScrubbableInput label={t('effect_spread', 'Spread')} name="fx-spread" value={effect.spread ?? 0} onChange={(v) => onUpdate({ spread: v })} />
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {t('effect_color', 'Color')}
                </span>
                <CompactColorPicker color={effect.color || '#000000'} onChange={(c) => onUpdate({ color: c })} />
              </div>
            </div>
          ) : effect.type === 'noise' ? (
            <div className="space-y-2.5">
              <ScrubbableInput label={t('intensity', 'Intensity')} name="fx-noise" value={effect.blur ?? 0} min={0} max={100} onChange={(v) => onUpdate({ blur: v })} />
              <div className="grid grid-cols-2 gap-2">
                <ScrubbableInput label={t('scale', 'Scale')} name="fx-n-scale" value={effect.noiseScale ?? 65} min={1} max={100} onChange={(v) => onUpdate({ noiseScale: v })} />
                <ScrubbableInput label={t('softness', 'Softness')} name="fx-n-soft" value={effect.noiseSoftness ?? 0} min={0} max={100} onChange={(v) => onUpdate({ noiseSoftness: v })} />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <ScrubbableInput label={t('effect_radius', 'Radius')} name="fx-blur-only" value={effect.blur ?? 0} min={0} onChange={(v) => onUpdate({ blur: v })} />
            </div>
          )}
        </div>
      </FloatingPopover>
    </div>
  );
};
