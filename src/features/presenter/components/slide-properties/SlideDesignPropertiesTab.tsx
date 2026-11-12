import React from 'react';
import { TFunction } from 'i18next';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { applyBlockStyle } from '@/features/presenter/utils/applyBlockStyle';
import { LayerItem, ItemProperties, SlideColors } from './index';

interface SlideDesignPropertiesTabProps {
  selectedIds: string[];
  localItems: ICanvasItem[];
  setLocalItems: React.Dispatch<React.SetStateAction<ICanvasItem[]>>;
  selectionStyles: IStyleLayer[];
  previewSlideId: string | undefined;
  batchUpdateCanvasItems: (slideId: string, updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => void;
  handleBatchUpdateByArray: (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => Promise<void>;
  handleSelectionStyleUpdate: (oldLayer: IStyleLayer, updates: Partial<IStyleLayer>) => void;
  handleSlideColorClick: (layer: IStyleLayer) => void;
  t: TFunction;
}

export const SlideDesignPropertiesTab: React.FC<SlideDesignPropertiesTabProps> = ({
  selectedIds,
  localItems,
  setLocalItems,
  selectionStyles,
  previewSlideId,
  batchUpdateCanvasItems,
  handleBatchUpdateByArray,
  handleSelectionStyleUpdate,
  handleSlideColorClick,
  t,
}) => {
  return (
    <div className="p-3 space-y-4 animate-in fade-in duration-200">
      {selectedIds.length > 0 ? (
        <>
          <ItemProperties
            selectedIds={selectedIds}
            canvasItems={localItems}
            updateCanvasItems={(idList, updates) => {
              setLocalItems(prev => prev.map(item => {
                if (!idList.includes(item.id)) return item;
                const newItem = { ...item, ...updates };
                if (updates.text && item.text) {
                  newItem.text = { ...item.text, ...updates.text };
                }
                if (updates.shape && item.shape) {
                  newItem.shape = { ...item.shape, ...updates.shape };
                }
                return newItem;
              }));

              const allUpdates = idList.map(id => {
                const item = localItems.find(i => i.id === id);
                if (!item) return null;
                const finalUpdates = { ...updates };
                if (updates.text && item.text) {
                  const blockStyleUpdate = applyBlockStyle(item, updates.text);
                  finalUpdates.text = blockStyleUpdate.text;
                }
                if (updates.shape && item.shape) {
                  finalUpdates.shape = { ...item.shape, ...updates.shape };
                }
                return { id, updates: finalUpdates };
              }).filter(Boolean) as Array<{ id: string; updates: Partial<ICanvasItem> }>;

              if (allUpdates.length > 0 && previewSlideId) {
                batchUpdateCanvasItems(previewSlideId, allUpdates);
              }
            }}
            onBatchUpdate={handleBatchUpdateByArray}
            isPreview={true}
            t={t as never}
          />
          {selectionStyles.length > 0 && (
            <div className="space-y-2 pt-2 mt-4 border-t border-white/6">
              <div className="flex items-center mt-3 gap-2 px-1">
                <div className="w-1 h-3 bg-accent/40 rounded-full" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">
                  {t('selection_colors', 'Selection Colors')}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5">
                {selectionStyles.map((layer, idx) => (
                  <LayerItem
                    key={layer.id || idx}
                    layer={layer}
                    index={idx}
                    total={selectionStyles.length}
                    onUpdate={(updates) => handleSelectionStyleUpdate(layer, updates)}
                    onRemove={() => { }}
                    hideHandle={true}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <SlideColors
          items={localItems}
          onColorClick={handleSlideColorClick}
          selectionStyles={selectionStyles}
          onSelectionStyleUpdate={handleSelectionStyleUpdate}
        />
      )}
    </div>
  );
};

