import React, { useState, useRef, useEffect } from 'react';
import { Square, Circle, Triangle, Star, Diamond, ChevronDown } from 'lucide-react';
import { ShapeType } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { ToolbarTooltip } from './ToolbarTooltip';

export const SHAPES: Array<{ type: ShapeType; icon: React.ElementType; label: string; shortcut?: string }> = [
  { type: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { type: 'circle', icon: Circle, label: 'Circle / Donut', shortcut: 'O' },
  { type: 'polygon', icon: Triangle, label: 'Polygon / Triangle' },
  { type: 'star', icon: Star, label: 'Star' },
  { type: 'diamond', icon: Diamond, label: 'Diamond' },
];

interface ShapesDropdownProps {
  onSelect: (type: ShapeType, e: React.MouseEvent) => void;
  onOpenPresets: (type: ShapeType) => void;
  isActiveTool?: boolean;
}

export const ShapesDropdown: React.FC<ShapesDropdownProps> = ({
  onSelect,
  onOpenPresets,
  isActiveTool,
}) => {
  const [open, setOpen] = useState(false);
  const [activeShape, setActiveShape] = useState(SHAPES[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleButtonClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      onOpenPresets(activeShape.type);
      return;
    }
    onSelect(activeShape.type, e);
  };

  const handleItemSelect = (shape: typeof SHAPES[0], e: React.MouseEvent) => {
    setActiveShape(shape);
    setOpen(false);
    if (e.shiftKey) {
      onOpenPresets(shape.type);
      return;
    }
    onSelect(shape.type, e);
  };

  const Icon = activeShape.icon;

  return (
    <div ref={ref} className="relative flex items-center shrink-0">
      <ToolbarTooltip
        label={`${activeShape.label} (Shift+Click: Presets)`}
        shortcut={activeShape.shortcut}
      >
        <button
          type="button"
          onClick={handleButtonClick}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-l-lg transition-all apple-press cursor-pointer",
            isActiveTool
              ? "bg-accent/20 text-accent font-medium shadow-[inset_0_0_8px_rgba(var(--accent-rgb,147,51,234),0.2)]"
              : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      </ToolbarTooltip>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center w-4 h-9 rounded-r-lg transition-all cursor-pointer -ml-0.5 apple-press",
          isActiveTool ? "text-accent bg-accent/20" : "text-stone-500 hover:text-stone-300 hover:bg-white/5",
          open && "bg-white/10 text-stone-200"
        )}
      >
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-3 left-0 z-50 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
          <div className="bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 min-w-[170px]">
            {SHAPES.map((shape) => {
              const ShapeIcon = shape.icon;
              const isActive = activeShape.type === shape.type;
              return (
                <button
                  type="button"
                  key={shape.type}
                  onClick={(e) => handleItemSelect(shape, e)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all cursor-pointer group apple-press",
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
                  )}
                  title={`${shape.label} (Shift+Click for Presets)`}
                >
                  <ShapeIcon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                      isActive && "scale-110"
                    )}
                  />
                  <span className="text-xs font-semibold flex-1">{shape.label}</span>
                  {shape.shortcut && (
                    <span className="text-[10px] font-mono text-stone-600 group-hover:text-stone-400">
                      {shape.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
