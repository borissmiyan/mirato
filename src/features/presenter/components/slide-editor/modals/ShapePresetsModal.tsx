import React, { useEffect, useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shapes, Trash2, Plus, X } from 'lucide-react';
import { Modal } from '@/shared/ui/modals/Modal';
import { Button } from '@/shared/ui/Button';
import { IShapePreset, ShapeType, ICanvasItem } from '@/core/types';
import { getAllShapePresets, deleteCustomShapePreset } from '../../../services/shapePresetsService';
import { ShapePresetBakeModal } from './ShapePresetBakeModal';

interface ShapePresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterShapeType?: ShapeType;
  onSelectPreset: (preset: IShapePreset) => void;
  selectedItem?: ICanvasItem | null;
}

const PresetCard = memo<{
  preset: IShapePreset;
  onSelect: (p: IShapePreset) => void;
  onDelete?: (id: string) => void;
}>(({ preset, onSelect, onDelete }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(preset)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(preset);
        }
      }}
      className="group relative flex flex-col items-center justify-between p-3 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/5 hover:border-accent/40 transition-all cursor-pointer apple-press"
    >
      <div className="w-16 h-16 flex items-center justify-center p-2 rounded-xl bg-white/5 group-hover:bg-accent/10 transition-colors">
        <svg
          viewBox="0 0 1 1"
          className="w-full h-full text-stone-300 group-hover:text-accent transition-colors drop-shadow"
          preserveAspectRatio="none"
        >
          <path d={preset.previewPath} fill="currentColor" />
        </svg>
      </div>

      <div className="mt-2 text-center w-full">
        <div className="text-xs font-semibold text-stone-200 truncate group-hover:text-accent transition-colors">
          {preset.name}
        </div>
        <div className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">
          {preset.category === 'factory' ? 'Встроенный' : 'Мой пресет'}
        </div>
      </div>

      {preset.category === 'user' && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(preset.id);
          }}
          className="absolute top-2 right-2 p-1 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Удалить пресет"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

PresetCard.displayName = 'PresetCard';

export const ShapePresetsModal: React.FC<ShapePresetsModalProps> = ({
  isOpen,
  onClose,
  filterShapeType,
  onSelectPreset,
  selectedItem,
}) => {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<IShapePreset[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'star' | 'polygon' | 'circle' | 'user'>('all');
  const [isBakeModalOpen, setIsBakeModalOpen] = useState(false);

  const loadPresets = async () => {
    const list = await getAllShapePresets();
    setPresets(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadPresets();
      if (filterShapeType === 'star') setActiveTab('star');
      else if (filterShapeType === 'polygon' || filterShapeType === 'triangle') setActiveTab('polygon');
      else if (filterShapeType === 'circle') setActiveTab('circle');
      else setActiveTab('all');
    }
  }, [isOpen, filterShapeType]);

  const handleDelete = async (id: string) => {
    await deleteCustomShapePreset(id);
    await loadPresets();
  };

  const filteredPresets = useMemo(() => {
    if (activeTab === 'all') return presets;
    if (activeTab === 'user') return presets.filter((p) => p.category === 'user');
    return presets.filter((p) => p.shapeType === activeTab);
  }, [presets, activeTab]);

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Shapes className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-stone-100">
                {t('shape_presets_library', 'Библиотека пресетов фигур')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedItem && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBakeModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('save_current_as_preset', 'Сохранить выбранную')}
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
            {[
              { id: 'all', label: t('all_presets', 'Все') },
              { id: 'star', label: t('stars', 'Звезды') },
              { id: 'polygon', label: t('polygons', 'Многоугольники') },
              { id: 'circle', label: t('circles_donuts', 'Круги и Бублики') },
              { id: 'user', label: t('my_presets', 'Мои пресеты') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-accent/20 text-accent border border-accent/30 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onSelect={(p) => {
                  onSelectPreset(p);
                  onClose();
                }}
                onDelete={handleDelete}
              />
            ))}
            {filteredPresets.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-stone-500">
                {t('no_presets_found', 'Нет доступных пресетов в этой категории')}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <ShapePresetBakeModal
          isOpen={isBakeModalOpen}
          onClose={() => setIsBakeModalOpen(false)}
          item={selectedItem}
          onSaved={loadPresets}
        />
      )}
    </>
  );
};

