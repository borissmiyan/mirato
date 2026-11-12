import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid,
  ArrowRight,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  WrapText,
  SlidersHorizontal,
  Pin,
  Split,
} from 'lucide-react';
import { PropertySection } from './PropertySection';
import { ScrubbableInput } from './ScrubbableInput';
import { ICanvasItem, IAutoLayoutConfig } from '@/core/types';
import { computeAutoLayout } from '@/core/utils/autoLayoutEngine';
import { cn } from '@/core/utils/cn';

interface AutoLayoutSectionProps {
  baseItem: ICanvasItem;
  canvasItems: ICanvasItem[];
  onBatchUpdate: (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => void;
}

export const AutoLayoutSection: React.FC<AutoLayoutSectionProps> = ({
  baseItem,
  canvasItems,
  onBatchUpdate,
}) => {
  const { t } = useTranslation();
  const [showDetailedPadding, setShowDetailedPadding] = useState(false);

  const config: IAutoLayoutConfig = useMemo(() => baseItem.autoLayout || {
    enabled: false,
    direction: 'horizontal',
    gap: 16,
    padding: 16,
    align: 'start',
    hugContents: false,
    wrap: false,
    isSpaceBetween: false,
  }, [baseItem.autoLayout]);

  const handleUpdateConfig = useCallback((patch: Partial<IAutoLayoutConfig>) => {
    const nextConfig: IAutoLayoutConfig = {
      ...config,
      ...patch,
      enabled: patch.enabled !== undefined ? patch.enabled : true,
    };

    const containerWithConfig: ICanvasItem = {
      ...baseItem,
      autoLayout: nextConfig,
    };

    // Find children associated with this container (either by groupId or items visually inside)
    const children = canvasItems.filter(
      (it) => it.id !== baseItem.id && it.groupId && it.groupId === baseItem.groupId
    );

    if (children.length > 0 && nextConfig.enabled) {
      const { container: updatedContainer, children: updatedChildren } = computeAutoLayout(
        containerWithConfig,
        children
      );

      const updates: Array<{ id: string; updates: Partial<ICanvasItem> }> = [
        {
          id: baseItem.id,
          updates: {
            autoLayout: nextConfig,
            width: updatedContainer.width,
            height: updatedContainer.height,
          },
        },
        ...updatedChildren.map((c) => ({
          id: c.id,
          updates: { x: c.x, y: c.y },
        })),
      ];

      onBatchUpdate(updates);
    } else {
      onBatchUpdate([
        {
          id: baseItem.id,
          updates: { autoLayout: nextConfig },
        },
      ]);
    }
  }, [config, baseItem, canvasItems, onBatchUpdate]);

  const toggleAbsoluteInLayout = useCallback(() => {
    onBatchUpdate([
      {
        id: baseItem.id,
        updates: { isAbsoluteInLayout: !baseItem.isAbsoluteInLayout },
      },
    ]);
  }, [baseItem.id, baseItem.isAbsoluteInLayout, onBatchUpdate]);

  return (
    <PropertySection
      title={t('auto_layout', 'Auto Layout')}
      icon={LayoutGrid}
      extra={
        <div className="flex items-center gap-1.5">
          {baseItem.groupId && (
            <button
              type="button"
              onClick={toggleAbsoluteInLayout}
              className={cn(
                "p-1 rounded-md transition-all border cursor-pointer",
                baseItem.isAbsoluteInLayout
                  ? "bg-accent/20 border-accent/40 text-accent shadow-xs"
                  : "bg-white/5 border-white/5 text-stone-400 hover:text-stone-200"
              )}
              title={baseItem.isAbsoluteInLayout ? "Абсолютное позиционирование активно (выключить)" : "Сделать абсолютным внутри Auto Layout"}
            >
              <Pin className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleUpdateConfig({ enabled: !config.enabled })}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all border cursor-pointer apple-press",
              config.enabled
                ? "bg-accent/20 border-accent/40 text-accent shadow-sm"
                : "bg-white/5 border-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10"
            )}
            title={config.enabled ? "Отключить Auto Layout" : "Включить Auto Layout (Shift+A)"}
          >
            <span>{config.enabled ? "Вкл" : "Выкл"}</span>
          </button>
        </div>
      }
    >
      {config.enabled && (
        <div className="space-y-3 pt-1">
          {/* Direction, Alignment & Flow Controls */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Direction Selector */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ direction: 'horizontal' })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.direction === 'horizontal'
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Горизонтальный поток (Horizontal)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ direction: 'vertical' })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.direction === 'vertical'
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Вертикальный поток (Vertical)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cross-Axis Align Selector */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ align: 'start' })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.align === 'start'
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Выравнивание по началу"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ align: 'center' })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.align === 'center'
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Выравнивание по центру"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ align: 'end' })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.align === 'end'
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Выравнивание по концу"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hug Contents & Wrap Toggles */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => handleUpdateConfig({ hugContents: !config.hugContents })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.hugContents
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Hug contents (Авто-подгонка размера)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ wrap: !config.wrap })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.wrap
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Wrap (Перенос строк)"
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ isSpaceBetween: !config.isSpaceBetween })}
                className={cn(
                  "p-1.5 rounded transition-all cursor-pointer",
                  config.isSpaceBetween
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-stone-400 hover:text-stone-200"
                )}
                title="Space Between (Равномерное распределение)"
              >
                <Split className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gap & Padding Numeric Scrubbers */}
          <div className="grid grid-cols-2 gap-2">
            <ScrubbableInput
              label="Gap"
              value={config.gap ?? 16}
              onChange={(val) => handleUpdateConfig({ gap: Math.max(0, val) })}
              min={0}
              max={300}
              step={1}
              suffix="px"
            />
            <div className="relative flex items-center">
              <ScrubbableInput
                label="Pad"
                value={config.padding ?? 16}
                onChange={(val) => handleUpdateConfig({ padding: Math.max(0, val) })}
                min={0}
                max={300}
                step={1}
                suffix="px"
              />
              <button
                type="button"
                onClick={() => setShowDetailedPadding(!showDetailedPadding)}
                className={cn(
                  "absolute right-1 p-1 rounded transition-colors text-stone-400 hover:text-stone-200",
                  showDetailedPadding && "text-accent"
                )}
                title="Настроить отступы отдельно для каждой стороны"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Individual 4-Side Padding Drawer */}
          {showDetailedPadding && (
            <div className="grid grid-cols-4 gap-1.5 pt-1 bg-white/5 p-2 rounded-lg border border-white/5">
              <ScrubbableInput
                label="T"
                value={config.paddingTop ?? config.padding ?? 16}
                onChange={(val) => handleUpdateConfig({ paddingTop: Math.max(0, val) })}
                min={0} max={300} step={1} suffix="px"
              />
              <ScrubbableInput
                label="R"
                value={config.paddingRight ?? config.padding ?? 16}
                onChange={(val) => handleUpdateConfig({ paddingRight: Math.max(0, val) })}
                min={0} max={300} step={1} suffix="px"
              />
              <ScrubbableInput
                label="B"
                value={config.paddingBottom ?? config.padding ?? 16}
                onChange={(val) => handleUpdateConfig({ paddingBottom: Math.max(0, val) })}
                min={0} max={300} step={1} suffix="px"
              />
              <ScrubbableInput
                label="L"
                value={config.paddingLeft ?? config.padding ?? 16}
                onChange={(val) => handleUpdateConfig({ paddingLeft: Math.max(0, val) })}
                min={0} max={300} step={1} suffix="px"
              />
            </div>
          )}
        </div>
      )}
    </PropertySection>
  );
};
