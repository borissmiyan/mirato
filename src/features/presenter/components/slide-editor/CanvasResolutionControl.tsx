import React, { memo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { Gauge, Check, ChevronUp, Sparkles, Cpu, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { canvasResolutionAtom, CanvasResolution } from '@/core/store/uiAtoms';
import { cn } from '@/core/utils/cn';
import { ToolbarTooltip } from './ToolbarTooltip';

interface ResolutionOption {
    value: CanvasResolution;
    badge: string;
    title: string;
    desc: string;
    icon: React.ElementType;
}

/**
 * Canvas preview resolution switcher with a portal-based popover menu.
 * Renders in document.body above all UI panels (z-[9999]) so it is never
 * clipped or hidden under the timeline panel.
 */
export const CanvasResolutionControl: React.FC<{ className?: string }> = memo(({ className }) => {
    const { t } = useTranslation();
    const [resolution, setResolution] = useAtom(canvasResolutionAtom);
    const [isOpen, setIsOpen] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 });

    const labelMap: Record<CanvasResolution, string> = {
        full: '1x',
        half: '1/2',
        quarter: '1/4',
    };

    const options: ResolutionOption[] = [
        {
            value: 'full',
            badge: '1x',
            title: t('res_full_title', 'Полное качество (Full)'),
            desc: t('res_full_desc', '100% чёткость, исходный рендеринг'),
            icon: Sparkles,
        },
        {
            value: 'half',
            badge: '1/2',
            title: t('res_half_title', 'Сбалансированное (540p)'),
            desc: t('res_half_desc', 'Оптимальный баланс чёткости и скорости'),
            icon: Cpu,
        },
        {
            value: 'quarter',
            badge: '1/4',
            title: t('res_quarter_title', 'Максимальная скорость (270p)'),
            desc: t('res_quarter_desc', '120 FPS для слабых компьютеров'),
            icon: Zap,
        },
    ];

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverWidth = 280;

        // Position upwards above the toolbar with an 8px gap (towards the slide canvas)
        const bottom = Math.max(16, window.innerHeight - rect.top + 8);

        // Center horizontally over the trigger button, clamped inside the viewport
        let left = rect.left + rect.width / 2 - popoverWidth / 2;
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

        setPopoverPos({ bottom, left });
    }, []);

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
        }
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popoverRef.current &&
                !popoverRef.current.contains(target) &&
                triggerRef.current &&
                !triggerRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        const handleReposition = () => {
            updatePosition();
        };

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);

        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [isOpen, updatePosition]);

    const handleSelect = (val: CanvasResolution) => {
        setResolution(val);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-flex items-center">
            <ToolbarTooltip
                label={t('canvas_resolution', 'Разрешение предпросмотра холста')}
                disabled={isOpen}
            >
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={cn(
                        "h-9 px-2.5 rounded-xl transition-all text-[11px] font-mono font-bold tabular-nums apple-press cursor-pointer flex items-center gap-1.5 border select-none",
                        resolution === 'full'
                            ? "bg-white/5 border-white/10 text-stone-300 hover:text-white hover:bg-white/10"
                            : (resolution === 'half'
                                ? "bg-accent/15 border-accent/30 text-accent hover:bg-accent/25 shadow-xs"
                                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 shadow-xs"),
                        isOpen && "ring-2 ring-accent/50 bg-stone-800 border-white/20",
                        className
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    aria-label={t('canvas_resolution', 'Разрешение предпросмотра холста')}
                >
                    <Gauge className="w-3.5 h-3.5 shrink-0" />
                    <span>{labelMap[resolution]}</span>
                    <ChevronUp className={cn("w-3 h-3 text-stone-400 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>
            </ToolbarTooltip>

            {/* Portal-based popover placed in document.body above everything */}
            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label={t('canvas_resolution_title', 'Качество холста')}
                    className="fixed z-[9999] w-[280px] p-2 rounded-2xl bg-stone-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl text-stone-100 select-none animate-in fade-in zoom-in-95 duration-150 ease-out"
                    style={{
                        bottom: `${popoverPos.bottom}px`,
                        left: `${popoverPos.left}px`,
                    }}
                >
                    {/* Header */}
                    <div className="px-2.5 py-1.5 mb-1 border-b border-white/5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                            <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{t('canvas_resolution_title', 'Качество предпросмотра')}</span>
                        </div>
                        <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">
                            {t('canvas_res_note', 'Проектор и сцена всегда выводятся в 100%')}
                        </p>
                    </div>

                    {/* Options */}
                    <div className="flex flex-col gap-1">
                        {options.map((opt) => {
                            const isSelected = resolution === opt.value;
                            const Icon = opt.icon;

                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all apple-press cursor-pointer border",
                                        isSelected
                                            ? "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-xs"
                                            : "bg-white/5 border-transparent text-stone-300 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border",
                                            isSelected
                                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                                : "bg-stone-800/80 border-white/5 text-stone-400"
                                        )}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs font-bold tabular-nums">
                                                    {opt.badge}
                                                </span>
                                                <span className="text-xs font-medium truncate">
                                                    {opt.title}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-stone-400 leading-tight mt-0.5">
                                                {opt.desc}
                                            </span>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

CanvasResolutionControl.displayName = 'CanvasResolutionControl';
