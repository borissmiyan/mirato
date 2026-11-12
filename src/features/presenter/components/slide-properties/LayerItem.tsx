import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Trash2, Check, Video } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IStyleLayer, BLEND_MODES } from '@/core/types/style';
import { FloatingPopover } from '@/components/FloatingPopover';
import { BackgroundPicker } from '../slide-properties/BackgroundPicker';
import { SlideBackground } from '../display/SlideBackground';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';

interface ILayerItemProps {
    layer: IStyleLayer;
    index: number;
    total: number;
    onUpdate: (updates: Partial<IStyleLayer>) => void;
    onRemove: () => void;
    hideHandle?: boolean;
}

export const LayerItem: React.FC<ILayerItemProps> = React.memo(({
    layer,
    index,
    total,
    onUpdate,
    onRemove,
    hideHandle,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: layer.id, disabled: hideHandle });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [blendMenu, setBlendMenu] = useState<{ x: number, y: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [opacityStr, setOpacityStr] = useState(`${Math.round((layer.opacity ?? 1) * 100)}% `);

    useEffect(() => {
        setOpacityStr(`${Math.round((layer.opacity ?? 1) * 100)}% `);
    }, [layer.opacity]);

    const handleOpacityChange = (valStr: string) => {
        const num = parseInt(valStr.replace(/\D/g, ''));
        if (!isNaN(num)) {
            const clamped = Math.max(0, Math.min(100, num));
            onUpdate({ opacity: clamped / 100 });
            setOpacityStr(`${clamped}% `);
        } else {
            setOpacityStr(`${Math.round((layer.opacity ?? 1) * 100)}% `);
        }
    };

    const inputRef = useRef<HTMLInputElement>(null);
    const dragStateRef = useRef<{
        startX: number;
        startVal: number;
        isScrubbing: boolean;
        pointerId: number;
    } | null>(null);

    // Global cleanup on unmount for cursor and userSelect
    useEffect(() => {
        return () => {
            if (dragStateRef.current?.isScrubbing) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // If the user already focused the input and is clicking inside it, allow standard text editing/caret
        if (document.activeElement === inputRef.current && e.target === inputRef.current) {
            return;
        }

        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragStateRef.current = {
            startX: e.clientX,
            startVal: Math.round((layer.opacity ?? 1) * 100),
            isScrubbing: false,
            pointerId: e.pointerId,
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state) return;

        const diffX = e.clientX - state.startX;

        if (!state.isScrubbing) {
            if (Math.abs(diffX) >= 3) {
                state.isScrubbing = true;
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            } else {
                return;
            }
        }

        const mult = e.shiftKey ? 10 : (e.altKey ? 0.2 : 1);
        const newVal = Math.max(0, Math.min(100, Math.round(state.startVal + diffX * mult)));
        setOpacityStr(`${newVal}% `);
        onUpdate({ opacity: newVal / 100 });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state) return;

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Safe fallback if pointer capture was already released
        }

        if (state.isScrubbing) {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } else {
            // Movement < 3px is a click: focus and select all text for instant replacement
            inputRef.current?.focus();
            inputRef.current?.select();
        }

        dragStateRef.current = null;
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Safe fallback
        }

        if (dragStateRef.current?.isScrubbing) {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        dragStateRef.current = null;
    };

    const getBackgroundValue = () => {
        if (layer.type === 'color') return layer.color;
        if (layer.type === 'gradient' && layer.gradient) {
            const g = layer.gradient;
            const type = g.type || 'linear';
            if (g.cssGradient) return g.cssGradient;
            const stopsStr = g.stops
                ? g.stops.map(s => `${s.color} ${s.offset}%`).join(', ')
                : `${g.from}, ${g.to}`;
            if (type === 'linear') return `linear-gradient(${g.angle}deg, ${stopsStr})`;
            if (type === 'radial') return `radial-gradient(circle, ${stopsStr})`;
            if (type === 'conic') return `conic-gradient(from ${g.angle}deg at 50% 50%, ${stopsStr})`;
        }
        return '#171717';
    };

    const getDisplayText = () => {
        if (!layer.type) return 'LAYER';
        if (layer.type === 'color') return (layer.color || '#000').toUpperCase().replace('#', '');
        return layer.type.toUpperCase();
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-1 group relative outline-none",
                isDragging && "opacity-80 z-50 scale-[1.02] shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            )}
        >
            <div
                ref={triggerRef}
                className={cn(
                    "flex-1 flex items-center bg-black/40 h-10 rounded-xl border overflow-hidden",
                    !isDragging && "transition-all",
                    isOpen ? "border-accent/40 bg-accent/5 shadow-[0_0_10px_rgba(234,179,8,0.05)]" : "border-white/5 hover:border-white/10",
                )}
            >
                {!hideHandle && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="h-full w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-stone-600 hover:text-stone-300 hover:bg-white/5 transition-colors border-r border-white/5 shrink-0"
                    >
                        <GripVertical className="w-3 h-3" />
                    </div>
                )}

                <div
                    className="w-12 h-full border-r border-white/5 shrink-0 flex items-center justify-center bg-black/20 overflow-hidden p-0.5 cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="w-full h-full rounded-xl border border-white/10 shadow-inner relative overflow-hidden bg-stone-900" style={{ background: getBackgroundValue() }}>
                        {(layer.type === 'image') && (layer.image?.url || layer.image?.id) && (
                            <div className="absolute inset-0">
                                <SlideBackground background={[layer]} showOverlay={false} />
                            </div>
                        )}
                        {(layer.type === 'video') && (layer.video?.url || layer.video?.id) && (
                            <div className="absolute inset-0 bg-black flex items-center justify-center">
                                <Video className="w-4 h-4 text-white/50" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzMzIj48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPC9zdmc+')] opacity-20 -z-10 mix-blend-overlay pointer-events-none" />
                    </div>
                </div>

                <div className="flex-1 px-2.5 min-w-0 flex flex-col justify-center">
                    <span className="text-[10px] font-mono font-bold text-stone-200 uppercase truncate">
                        {getDisplayText()}
                    </span>
                    <span 
                        className="text-[8px] font-bold text-stone-500 hover:text-accent uppercase tracking-widest truncate cursor-pointer transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setBlendMenu({ x: rect.left, y: rect.bottom + 4 });
                        }}
                    >
                        {t(`blend_mode.${layer.blendMode}`, layer.blendMode)}
                    </span>
                </div>

                <div
                    className="h-full border-l border-white/5 flex flex-col justify-center items-center bg-black/10 w-14 hover:bg-black/20 transition-colors cursor-ew-resize select-none touch-none"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    title={t('scrub_opacity_hint', 'Перетащите горизонтально для изменения (Shift: ×10, Alt: 0.2×) или кликните для ввода')}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={opacityStr}
                        onChange={(e) => setOpacityStr(e.target.value)}
                        onBlur={(e) => handleOpacityChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className="w-full bg-transparent text-xs text-stone-200 font-sans tabular-nums font-semibold text-center focus:outline-none focus:text-accent selection:bg-accent/30 cursor-ew-resize"
                    />
                </div>
            </div>

            {/* audit-ignore: event propagation boundary */}
            <div className="flex flex-col items-center justify-center w-6 opacity-0 group-hover:opacity-100 transition-opacity gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={() => onUpdate({ visible: !layer.visible })}
                    onMouseDown={(e) => e.preventDefault()}
                    className={cn("p-1.5 transition-colors rounded-xl apple-press cursor-pointer", layer.visible ? "text-stone-500 hover:text-stone-300 hover:bg-white/5 active:bg-white/10" : "text-stone-700 hover:text-stone-500 hover:bg-white/5 bg-black/20")}
                    title={layer.visible ? t('hide_layer') : t('show_layer')}
                >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* audit-ignore: event propagation boundary */}
            <div className="flex flex-col items-center justify-center w-6 opacity-0 group-hover:opacity-100 transition-opacity gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onRemove}
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-1.5 text-stone-600 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors rounded-xl cursor-pointer apple-press"
                    title={t('remove_layer')}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            <FloatingPopover
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRef={triggerRef}
                title={t('fill_settings')}
                width={360}
            >
                <div className="h-[560px] max-h-[85vh]">
                    <BackgroundPicker
                        background={[layer]}
                        onChange={(newLayers) => {
                            if (newLayers.length > 0) onUpdate(newLayers[0]);
                        }}
                        hideLayerStack={true}
                        defaultActiveLayerId={layer.id}
                    />
                </div>
            </FloatingPopover>

            {blendMenu && (
                <ContextMenu
                    x={blendMenu.x}
                    y={blendMenu.y}
                    onClose={() => setBlendMenu(null)}
                >
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {BLEND_MODES.map(m => (
                            <ContextMenuItem
                                key={m.value}
                                label={t(`blend_mode.${m.value}`, m.label)}
                                icon={layer.blendMode === m.value ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5" />}
                                onClick={() => {
                                    onUpdate({ blendMode: m.value as IStyleLayer['blendMode'] });
                                    setBlendMenu(null);
                                }}
                            />
                        ))}
                    </div>
                </ContextMenu>
            )}
        </div>
    );
});
