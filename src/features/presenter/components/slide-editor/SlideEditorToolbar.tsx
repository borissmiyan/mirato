import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  selectedCanvasItemIdsAtom,
  canvasToolAtom,
  slideEditorDragActiveAtom,
  slidePreviewHoveredAtom,
  canvasZoomAtom,
  slideDesignPanelOpenAtom,
  canvasOffsetAtom,
  canvasSafeZonesAtom,
  canvasGridAtom,
  editorToolbarVisibleAtom,
  timelineModeAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/core/utils/cn';
import {
  MousePointer2, Hand, Type, ImageIcon, Video,
  Minus, Pen,
  ChevronDown, ChevronUp, Trash2, Copy, Clipboard, ZoomIn, ZoomOut,
  PanelBottomClose, PanelBottomOpen, Tv, Grid3X3,
} from 'lucide-react';
import { createCanvasItem, SHAPE_OPTIONS } from '../slide-properties/helpers';
import { ICanvasItem, ICanvasSlide, CanvasItemType, ShapeType, IShapePreset } from '@/core/types';

import { Tooltip, Kbd, Separator } from '@/shared/ui';
import { CanvasResolutionControl } from './CanvasResolutionControl';
import { ShapesDropdown } from './ShapesDropdown';
import { ShapePresetsModal } from './modals/ShapePresetsModal';
import { applyPresetToCanvasItem } from '../../services/shapePresetsService';
import { ToolbarTooltip } from './ToolbarTooltip';
export { ToolbarTooltip };

// ─── Tool Button ───────────────────────────────────────────────────────────
interface IToolButtonProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<IToolButtonProps> = ({
  icon: Icon, label, shortcut, active, disabled, danger, onClick
}) => (
  <ToolbarTooltip label={label} shortcut={shortcut}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 shrink-0 cursor-pointer apple-press",
        "disabled:opacity-20 disabled:pointer-events-none",
        active
          ? "bg-accent/20 text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          : danger
            ? "text-stone-500 hover:text-red-400 hover:bg-red-500/10"
            : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  </ToolbarTooltip>
);

// ─── Main Toolbar ──────────────────────────────────────────────────────────
export const SlideEditorToolbar: React.FC = () => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
  const [canvasTool, setCanvasTool] = useAtom(canvasToolAtom);
  const [zoom, setZoom] = useAtom(canvasZoomAtom);
  const [safeZones, setSafeZones] = useAtom(canvasSafeZonesAtom);
  const [gridActive, setGridActive] = useAtom(canvasGridAtom);
  const setOffset = useSetAtom(canvasOffsetAtom);
  const designPanelOpen = useAtomValue(slideDesignPanelOpenAtom);

  const {
    previewSlideId,
    addCanvasItem,
    removeCanvasItem,
    takeSnapshot,
    activePresentation,
    selectedPresentation,
  } = usePresentationStore(
    useShallow(s => ({
      previewSlideId: s.previewSlideId,
      addCanvasItem: s.addCanvasItem,
      removeCanvasItem: s.removeCanvasItem,
      takeSnapshot: s.takeSnapshot,
      activePresentation: s.activePresentation,
      selectedPresentation: s.selectedPresentation,
    }))
  );

  const presentation = selectedPresentation || activePresentation;
  const hasSelection = selectedIds.length > 0;

  // ─── Clipboard state ───
  const [clipboard, setClipboard] = useState<ICanvasItem[]>([]);
  const canPaste = clipboard.length > 0;

  // ─── Preset Modal state ───
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetModalShapeType, setPresetModalShapeType] = useState<ShapeType | undefined>(undefined);

  const handleOpenPresets = useCallback((type: ShapeType) => {
    setPresetModalShapeType(type);
    setIsPresetModalOpen(true);
  }, []);

  const handleSelectPreset = useCallback((preset: IShapePreset) => {
    if (!previewSlideId) return;
    const base = createCanvasItem('shape');
    const applied = applyPresetToCanvasItem(base, preset);
    applied.x = 50;
    applied.y = 50;
    addCanvasItem(previewSlideId, applied);
    setSelectedIds([applied.id]);
    setCanvasTool('select');
    takeSnapshot(previewSlideId).catch(console.error);
  }, [previewSlideId, addCanvasItem, setSelectedIds, setCanvasTool, takeSnapshot]);

  const onZoomFit = useCallback(() => {
    setZoom(1.0);
    setOffset({ x: 0, y: 0 });
  }, [setZoom, setOffset]);

  const addElement = useCallback((type: CanvasItemType, shapeType?: ShapeType) => {
    if (!previewSlideId) return;
    const item = createCanvasItem(type);
    if (shapeType && item.shape) item.shape.shapeType = shapeType;
    // Center on slide (percentage)
    item.x = 50;
    item.y = 50;
    addCanvasItem(previewSlideId, item);
    setSelectedIds([item.id]);
  }, [previewSlideId, addCanvasItem, setSelectedIds]);

  const deleteSelected = useCallback(async () => {
    if (!previewSlideId || !hasSelection) return;
    await takeSnapshot(previewSlideId);
    selectedIds.forEach(id => removeCanvasItem(previewSlideId, id));
    setSelectedIds([]);
  }, [previewSlideId, hasSelection, selectedIds, removeCanvasItem, setSelectedIds, takeSnapshot]);

  const copySelected = useCallback(() => {
    if (!hasSelection) return;
    const slide = presentation?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide;
    const items = slide?.content?.canvasItems || [];
    const toCopy = items.filter(i => selectedIds.includes(i.id));
    setClipboard(toCopy);
  }, [hasSelection, presentation, previewSlideId, selectedIds]);

  const pasteItems = useCallback(async () => {
    if (!previewSlideId || clipboard.length === 0) return;
    await takeSnapshot(previewSlideId);
    const newIds: string[] = [];
    clipboard.forEach(item => {
      const newItem: ICanvasItem = {
        ...item,
        id: crypto.randomUUID(),
        x: (item.x || 50) + 2,
        y: (item.y || 50) + 2,
        zIndex: 100, // Will be resolved by store
      };
      addCanvasItem(previewSlideId, newItem);
      newIds.push(newItem.id);
    });
    setSelectedIds(newIds);
  }, [previewSlideId, clipboard, addCanvasItem, setSelectedIds, takeSnapshot]);

  const isSelect = canvasTool === 'select';
  const isHand = canvasTool === 'pan';

  // The bottom offset based on timeline mode: expanded (316px), compact (176px = 160 + 16), hidden (16px)
  const timelineMode = useAtomValue(timelineModeAtom);
  const bottomOffset = timelineMode === 'expanded'
    ? 'bottom-[316px]'
    : timelineMode === 'compact'
      ? 'bottom-[176px]'
      : 'bottom-4';

  const [toolbarVisible, setToolbarVisible] = useAtom(editorToolbarVisibleAtom);

  // When hidden, show only a small pill to re-open
  if (!toolbarVisible) {
    return (
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-100",
          bottomOffset,
          designPanelOpen ? "-ml-40" : "ml-0"
        )}
      >
        <ToolbarTooltip label={t('show_toolbar', 'Show Toolbar')}>
          <button
            type="button"
            onClick={() => setToolbarVisible(true)}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer apple-press",
              "bg-stone-900/40 backdrop-blur-xl border border-white/10",
              "hover:bg-stone-900/70 hover:border-white/20 shadow-lg",
              "opacity-60 hover:opacity-100 transition-all duration-300",
              "animate-in fade-in zoom-in-75 duration-300"
            )}
            aria-label={t('show_toolbar', 'Show Toolbar')}
          >
            <ChevronUp className="w-4 h-4 text-stone-300" />
          </button>
        </ToolbarTooltip>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "absolute left-1/2 -translate-x-1/2 z-100 transition-all duration-300 ease-in-out",
        bottomOffset,
        designPanelOpen ? "-ml-40" : "ml-0"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 h-14 rounded-xl shadow-2xl transition-all duration-300",
          "bg-stone-900/40 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5",
          "hover:bg-stone-900/60 hover:border-white/20",
          "animate-in fade-in zoom-in-95 duration-300"
        )}
      >
        {/* Navigation Tools */}
        <div className="flex items-center gap-1 px-1 my-2">
          <ToolButton
            icon={MousePointer2}
            label={t('select_tool', 'Select')}
            shortcut="V"
            active={isSelect}
            onClick={() => setCanvasTool('select')}
          />
          <ToolButton
            icon={Hand}
            label={t('hand_tool', 'Hand (Pan)')}
            shortcut="H"
            active={isHand}
            onClick={() => setCanvasTool('pan')}
          />
        </div>

        <Separator orientation="vertical" className="h-5 my-auto" />

        {/* Creation Tools */}
        <div className="flex items-center gap-1 px-1 my-2">
          <ToolButton
            icon={Type}
            label={t('add_text', 'Text')}
            shortcut="T"
            disabled={!previewSlideId}
            onClick={() => addElement('text')}
          />
          <ToolButton
            icon={ImageIcon}
            label={t('add_image', 'Image')}
            disabled={!previewSlideId}
            onClick={() => addElement('image')}
          />
          <ToolButton
            icon={Video}
            label={t('add_video', 'Video')}
            disabled={!previewSlideId}
            onClick={() => addElement('video')}
          />
          
          <div className="h-4 w-px bg-white/5 mx-1" />
          
          <ShapesDropdown
            isActiveTool={canvasTool.startsWith('shape')}
            onSelect={(shapeType) => {
              setCanvasTool(canvasTool === `shape:${shapeType}` ? 'select' : `shape:${shapeType}`);
            }}
            onOpenPresets={handleOpenPresets}
          />

          <ToolButton
            icon={Minus}
            label={t('add_line', 'Line')}
            shortcut="L"
            disabled={!previewSlideId}
            active={canvasTool === 'line' || canvasTool === 'stroke'}
            onClick={() => setCanvasTool(canvasTool === 'line' || canvasTool === 'stroke' ? 'select' : 'line')}
          />
          <ToolButton
            icon={Pen}
            label={t('pen_tool', 'Перо')}
            shortcut="P"
            disabled={!previewSlideId}
            active={canvasTool === 'pen'}
            onClick={() => setCanvasTool(canvasTool === 'pen' ? 'select' : 'pen')}
          />
        </div>

        <Separator orientation="vertical" className="h-5 my-auto" />

        {/* Actions & Zoom */}
        <div className="flex items-center gap-1 px-1 my-2">
          <div className={cn(
            "flex items-center gap-1 transition-all duration-300 overflow-hidden",
            hasSelection ? "max-w-[150px] opacity-100" : "max-w-0 opacity-0"
          )}>
            <ToolButton
              icon={Copy}
              label={t('copy', 'Copy')}
              shortcut="⌘C"
              onClick={copySelected}
            />
            <ToolButton
              icon={Clipboard}
              label={t('paste', 'Paste')}
              shortcut="⌘V"
              disabled={!canPaste}
              onClick={pasteItems}
            />
            <ToolButton
              icon={Trash2}
              label={t('delete', 'Delete')}
              shortcut="⌫"
              danger
              onClick={deleteSelected}
            />
            <Separator orientation="vertical" className="h-5 my-auto" />
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
             <ToolButton
                icon={ZoomOut}
                label={t('zoom_out', 'Zoom Out')}
                shortcut="⌘−"
                disabled={zoom <= 0.1}
                onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.1))}
              />
              <ToolbarTooltip label={t('reset_zoom', 'Reset Zoom')} shortcut="⌘0">
                <button
                  type="button"
                  onClick={onZoomFit}
                  className="h-9 px-2 rounded-xl text-stone-500 hover:text-stone-100 hover:bg-white/5 transition-all text-[11px] font-mono font-bold tabular-nums min-w-[48px] apple-press cursor-pointer"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </ToolbarTooltip>
              <ToolButton
                icon={ZoomIn}
                label={t('zoom_in', 'Zoom In')}
                shortcut="⌘+"
                disabled={zoom >= 4}
                onClick={() => setZoom(prev => Math.min(prev + 0.1, 4))}
              />
          </div>

          <Separator orientation="vertical" className="h-5 my-auto" />

          {/* Safe Zones Toggle */}
          <ToolButton
            icon={Tv}
            label={safeZones ? t('disable_safe_zones', 'Отключить безопасные зоны') : t('enable_safe_zones', 'Безопасные зоны проектора/ТВ')}
            active={safeZones}
            onClick={() => setSafeZones(prev => !prev)}
          />

          {/* Dot Grid Toggle */}
          <ToolButton
            icon={Grid3X3}
            label={gridActive ? t('disable_grid', 'Скрыть сетку холста') : t('enable_grid', 'Сетка холста (Dot Grid)')}
            active={gridActive}
            onClick={() => setGridActive(prev => !prev)}
          />

          <Separator orientation="vertical" className="h-5 my-auto" />

          {/* Canvas Preview Resolution (1x, 1/2, 1/4) */}
          <CanvasResolutionControl />

          <Separator orientation="vertical" className="h-5 my-auto" />

          {/* Hide Toolbar Button — inside the bar */}
          <ToolButton
            icon={ChevronDown}
            label={t('hide_toolbar', 'Hide Toolbar')}
            onClick={() => setToolbarVisible(false)}
          />
        </div>
      </div>

      <ShapePresetsModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        filterShapeType={presetModalShapeType}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
};

export default SlideEditorToolbar;
