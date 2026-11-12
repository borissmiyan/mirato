import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Command,
  ArrowRight,
  Sparkles,
  Combine,
  Scissors,
  SquaresIntersect,
  Diff,
  Gem,
  Diamond,
  Blend,
  Group,
  Ungroup,
  Maximize2,
  Grid,
  Ruler,
  ZoomIn,
  ZoomOut,
  PenTool,
  MousePointer,
  Hand,
  Type,
  Square,
  Circle,
  Minus,
} from 'lucide-react';
import {
  showCanvasQuickActionsAtom,
  canvasToolAtom,
  showCanvasRulersAtom,
  canvasGridAtom,
  canvasZoomAtom,
  selectedCanvasItemIdsAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasSlide } from '@/core/types';
import { tidyUpItems } from '@/core/utils/tidyUpUtils';
import { groupAsBooleanOperation } from '@/core/utils/canvasBooleanGroups';
import { createCanvasItem } from '@/features/presenter/components/slide-properties/helpers';
import { filterQuickActions, IQuickActionCommand } from './quickActionsData';
import { cn } from '@/core/utils/cn';

export const CanvasQuickActionsModal: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useAtom(showCanvasQuickActionsAtom);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setCanvasTool = useSetAtom(canvasToolAtom);
  const [showRulers, setShowRulers] = useAtom(showCanvasRulersAtom);
  const [showGrid, setShowGrid] = useAtom(canvasGridAtom);
  const setZoom = useSetAtom(canvasZoomAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);

  const {
    previewSlideId,
    selectedPresentation,
    activePresentation,
    addCanvasItem,
    updateCanvasItems,
    updateCanvasItemsOrder,
    takeSnapshot,
  } = usePresentationStore();

  const pres = selectedPresentation || activePresentation;
  const slide = pres?.slides?.find((s) => s.id === previewSlideId) as ICanvasSlide | undefined;
  const canvasItems = useMemo(() => slide?.content?.canvasItems || [], [slide?.content?.canvasItems]);
  const selectedItems = useMemo(() => canvasItems.filter((i) => selectedIds.includes(i.id)), [canvasItems, selectedIds]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const executeAndClose = useCallback(async (action: () => void | Promise<void>) => {
    setIsOpen(false);
    await action();
  }, [setIsOpen]);

  // Build command registry
  const commands: IQuickActionCommand[] = useMemo(() => {
    const list: IQuickActionCommand[] = [
      // Tools
      {
        id: 'tool-select',
        title: t('tool_select', 'Move / Select Tool'),
        shortcut: 'V',
        category: t('tools', 'Инструменты'),
        action: () => setCanvasTool('select'),
      },
      {
        id: 'tool-pan',
        title: t('tool_pan', 'Hand / Pan Tool'),
        shortcut: 'H',
        category: t('tools', 'Инструменты'),
        action: () => setCanvasTool('pan'),
      },
      {
        id: 'tool-pen',
        title: t('tool_pen', 'Pen Tool (Векторное перо)'),
        shortcut: 'P',
        category: t('tools', 'Инструменты'),
        action: () => setCanvasTool('pen'),
      },
      {
        id: 'add-text',
        title: t('add_text', 'Add Text'),
        shortcut: 'T',
        category: t('insert', 'Вставка'),
        action: () => {
          if (!previewSlideId) return;
          const item = createCanvasItem('text');
          addCanvasItem(previewSlideId, item);
          setSelectedIds([item.id]);
        },
      },
      {
        id: 'add-rect',
        title: t('add_rectangle', 'Add Rectangle'),
        shortcut: 'R',
        category: t('insert', 'Вставка'),
        action: () => {
          if (!previewSlideId) return;
          const item = createCanvasItem('shape');
          if (item.shape) item.shape.shapeType = 'rect';
          addCanvasItem(previewSlideId, item);
          setSelectedIds([item.id]);
        },
      },
      {
        id: 'add-circle',
        title: t('add_circle', 'Add Circle / Donut'),
        shortcut: 'O',
        category: t('insert', 'Вставка'),
        action: () => {
          if (!previewSlideId) return;
          const item = createCanvasItem('shape');
          if (item.shape) item.shape.shapeType = 'circle';
          addCanvasItem(previewSlideId, item);
          setSelectedIds([item.id]);
        },
      },
      // Layout & Smart Selection
      {
        id: 'tidy-up',
        title: t('tidy_up', 'Tidy Up (Упорядочить с равными отступами)'),
        shortcut: '⌥⇧⌘T',
        category: t('layout', 'Макет'),
        action: async () => {
          if (!previewSlideId || selectedItems.length < 2) return;
          const tidied = tidyUpItems(selectedItems);
          const updates = tidied.map((item) => ({ id: item.id, updates: { x: item.x, y: item.y } }));
          if (updates.length > 0) {
            await updateCanvasItems(previewSlideId, updates);
            await takeSnapshot(previewSlideId);
          }
        },
      },
      // Boolean Operations
      {
        id: 'bool-union',
        title: t('bool_union', 'Boolean: Union (Объединить контуры)'),
        category: t('boolean', 'Булевы операции'),
        action: async () => {
          if (!previewSlideId || selectedItems.length < 2) return;
          const updated = groupAsBooleanOperation(canvasItems, selectedIds, 'union');
          await updateCanvasItemsOrder(previewSlideId, updated);
          await takeSnapshot(previewSlideId);
        },
      },
      {
        id: 'bool-subtract',
        title: t('bool_subtract', 'Boolean: Subtract (Вычесть контуры)'),
        category: t('boolean', 'Булевы операции'),
        action: async () => {
          if (!previewSlideId || selectedItems.length < 2) return;
          const updated = groupAsBooleanOperation(canvasItems, selectedIds, 'subtract');
          await updateCanvasItemsOrder(previewSlideId, updated);
          await takeSnapshot(previewSlideId);
        },
      },
      {
        id: 'bool-intersect',
        title: t('bool_intersect', 'Boolean: Intersect (Пересечение)'),
        category: t('boolean', 'Булевы операции'),
        action: async () => {
          if (!previewSlideId || selectedItems.length < 2) return;
          const updated = groupAsBooleanOperation(canvasItems, selectedIds, 'intersect');
          await updateCanvasItemsOrder(previewSlideId, updated);
          await takeSnapshot(previewSlideId);
        },
      },
      {
        id: 'bool-exclude',
        title: t('bool_exclude', 'Boolean: Exclude (Исключить)'),
        category: t('boolean', 'Булевы операции'),
        action: async () => {
          if (!previewSlideId || selectedItems.length < 2) return;
          const updated = groupAsBooleanOperation(canvasItems, selectedIds, 'exclude');
          await updateCanvasItemsOrder(previewSlideId, updated);
          await takeSnapshot(previewSlideId);
        },
      },
      // Components
      {
        id: 'comp-create',
        title: t('create_component', 'Create Master Component'),
        shortcut: '⌥⌘K',
        category: t('components', 'Компоненты'),
        action: async () => {
          if (!previewSlideId || selectedIds.length === 0) return;
          const updates = selectedIds.map((id) => ({ id, updates: { isMasterComponent: true } }));
          await updateCanvasItems(previewSlideId, updates);
          await takeSnapshot(previewSlideId);
        },
      },
      {
        id: 'comp-detach',
        title: t('detach_instance', 'Detach Instance (Отвязать от мастер-компонента)'),
        shortcut: '⌥⇧⌘B',
        category: t('components', 'Компоненты'),
        action: async () => {
          if (!previewSlideId || selectedIds.length === 0) return;
          const updates = selectedIds.map((id) => ({
            id,
            updates: { masterComponentId: undefined, componentOverrides: undefined },
          }));
          await updateCanvasItems(previewSlideId, updates);
          await takeSnapshot(previewSlideId);
        },
      },
      // Canvas view
      {
        id: 'view-rulers',
        title: t('toggle_rulers', 'Toggle Rulers (Линейки)'),
        shortcut: '⇧R',
        category: t('view', 'Вид'),
        action: () => setShowRulers(!showRulers),
      },
      {
        id: 'view-grid',
        title: t('toggle_grid', 'Toggle Grid (Сетка)'),
        category: t('view', 'Вид'),
        action: () => setShowGrid(!showGrid),
      },
      {
        id: 'zoom-in',
        title: t('zoom_in', 'Zoom In (Приблизить)'),
        shortcut: '⌘+',
        category: t('view', 'Вид'),
        action: () => setZoom((z) => Math.min(z + 0.1, 4)),
      },
      {
        id: 'zoom-out',
        title: t('zoom_out', 'Zoom Out (Отдалить)'),
        shortcut: '⌘-',
        category: t('view', 'Вид'),
        action: () => setZoom((z) => Math.max(z - 0.1, 0.1)),
      },
      {
        id: 'zoom-reset',
        title: t('zoom_100', 'Zoom to 100%'),
        shortcut: '⌘0',
        category: t('view', 'Вид'),
        action: () => setZoom(1.0),
      },
    ];
    return list;
  }, [
    t,
    setCanvasTool,
    previewSlideId,
    selectedItems,
    canvasItems,
    selectedIds,
    showRulers,
    showGrid,
    addCanvasItem,
    setSelectedIds,
    updateCanvasItems,
    takeSnapshot,
    updateCanvasItemsOrder,
    setShowRulers,
    setShowGrid,
    setZoom,
  ]);

  const filteredCommands = useMemo(() => filterQuickActions(commands, query), [commands, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) executeAndClose(cmd.action);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-2xl bg-stone-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('quick_actions_placeholder', 'Поиск действия, инструмента или команды…')}
            className="flex-1 bg-transparent text-sm text-stone-100 placeholder:text-stone-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 text-stone-400 border border-white/10">
            Esc
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-500">
              {t('no_commands_found', 'Команды не найдены')}
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeAndClose(cmd.action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors select-none",
                    isSelected ? "bg-accent text-accent-foreground shadow-xs" : "text-stone-300 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border",
                      isSelected ? "bg-black/20 border-black/10 text-accent-foreground" : "bg-white/5 border-white/5 text-stone-500"
                    )}>
                      {cmd.category}
                    </span>
                    <span className="font-medium truncate">{cmd.title}</span>
                  </div>
                  {cmd.shortcut && (
                    <kbd className={cn(
                      "px-1.5 py-0.5 text-[10px] font-mono rounded border shrink-0",
                      isSelected ? "bg-black/20 border-black/10 text-accent-foreground" : "bg-white/5 border-white/10 text-stone-400"
                    )}>
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
