import React from 'react';
import { Layers } from 'lucide-react';
import { TFunction } from 'i18next';
import { ICanvasItem } from '@/core/types';
import {
  DndContext, closestCenter, SensorDescriptor, SensorOptions, DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { LayerRow } from './LayerRow';
import { Button } from '@/shared/ui/Button';

interface ISlideDesignLayersTabProps {
  localItems: ICanvasItem[];
  displayItems: ICanvasItem[];
  selectedIds: string[];
  sensors: SensorDescriptor<SensorOptions>[];
  onDragStart: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
  onRemove: (id: string) => void;
  onClearSelection: () => void;
  t: TFunction;
}

export const SlideDesignLayersTab: React.FC<ISlideDesignLayersTabProps> = ({
  localItems,
  displayItems,
  selectedIds,
  sensors,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onSelect,
  onUpdate,
  onRemove,
  onClearSelection,
  t,
}) => {
  if (localItems.length === 0) {
    return (
      <div className="p-3 animate-in fade-in duration-200">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
            <Layers className="w-5 h-5 text-stone-600" />
          </div>
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest text-center">
            {t('no_layers_yet', { defaultValue: 'No layers yet' })}
          </p>
          <p className="text-[9px] text-stone-600 text-center leading-relaxed max-w-[180px]">
            {t('use_toolbar_hint', { defaultValue: 'Use the toolbar to add text, shapes, and images to this slide' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 animate-in fade-in duration-200 space-y-2">
      {/* Selection summary */}
      {selectedIds.length > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl">
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
            {t('selected_count', { count: selectedIds.length, defaultValue: '{{count}} selected' })}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClearSelection}
            className="text-[9px] text-stone-400 hover:text-stone-200 h-6 px-2"
          >
            {t('clear', { defaultValue: 'Clear' })}
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={displayItems.map(i => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {displayItems.map(item => (
              <LayerRow
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onSelect={onSelect}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Hint */}
      <p className="text-[9px] text-stone-600 px-2 pt-2 leading-relaxed">
        ⌘ or Shift+click for multi-select
      </p>
    </div>
  );
};
