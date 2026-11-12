import React from 'react';
import { useTranslation } from 'react-i18next';
import { ICanvasItem } from '@/core/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ImageIcon, Square, Minus, Palette, Video, Type,
    Eye, EyeOff, Lock, Unlock, Trash2, GripVertical, Blend, Gem, Diamond
} from 'lucide-react';
import { cn } from '@/core/utils/cn';

// ─── Layer type icon mapping ───────────────────────────────────────────────
const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
    text: Type,
    image: ImageIcon,
    video: Video,
    shape: Square,
    stroke: Minus,
    effect: Palette,
};

export interface ILayerRowProps {
    item: ICanvasItem;
    isSelected: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
}

const LayerRowComponent: React.FC<ILayerRowProps> = ({ item, isSelected, onSelect, onUpdate, onRemove }) => {
    const { t } = useTranslation();
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [nameInput, setNameInput] = React.useState('');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const Icon = ITEM_TYPE_ICONS[item.type] || Square;

    const getLabel = () => {
        if (item.name?.trim()) return item.name.trim();
        if (item.type === 'text' && item.text?.content) {
            const stripped = item.text.content.replace(/<[^>]*>/g, '').trim();
            return stripped.length > 22 ? stripped.slice(0, 22) + '…' : stripped || t('type_text');
        }
        return t(`layer_type_${item.type}`, { defaultValue: item.type.charAt(0).toUpperCase() + item.type.slice(1) });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer select-none",
                isDragging && "opacity-60 z-50 shadow-xl scale-[1.01]",
                isSelected
                    ? "bg-accent/10 border-accent/25 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.15)]"
                    : "bg-transparent border-transparent hover:bg-white/4 hover:border-white/8"
            )}
            onClick={(e) => onSelect(item.id, e)}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 text-stone-700 hover:text-stone-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors pointer-events-auto"
            >
                <GripVertical className="w-3 h-3 pointer-events-none" />
            </div>

            {/* Type icon */}
            <div className={cn(
                "w-5 h-5 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                item.isMasterComponent
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-sm"
                    : item.masterComponentId
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                        : item.isMask
                            ? "bg-accent/20 border-accent/40 text-accent shadow-sm"
                            : isSelected
                                ? "bg-accent/20 border-accent/30 text-accent"
                                : "bg-white/5 border-white/5 text-stone-500"
            )}>
                {item.isMasterComponent ? (
                    <Gem className="w-3 h-3 text-purple-400" />
                ) : item.masterComponentId ? (
                    <Diamond className="w-3 h-3 text-purple-300" />
                ) : item.isMask ? (
                    <Blend className="w-3 h-3" />
                ) : (
                    <Icon className="w-3 h-3" />
                )}
            </div>

            {/* Label or In-place rename input */}
            {isEditingName ? (
                <input
                    type="text"
                    value={nameInput}
                    autoFocus
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.stopPropagation();
                            setIsEditingName(false);
                            onUpdate(item.id, { name: nameInput.trim() || undefined });
                        } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setIsEditingName(false);
                        }
                    }}
                    onBlur={() => {
                        setIsEditingName(false);
                        onUpdate(item.id, { name: nameInput.trim() || undefined });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-black/60 border border-accent/40 rounded px-1.5 py-0.5 text-[11px] font-medium text-white focus:outline-none focus:ring-1 focus:ring-accent selection:bg-accent/30"
                />
            ) : (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <span
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setNameInput(item.name || getLabel());
                            setIsEditingName(true);
                        }}
                        title={t('double_click_to_rename', 'Двойной клик для переименования')}
                        className={cn(
                            "text-[11px] font-medium truncate transition-colors",
                            isSelected ? "text-white" : "text-stone-400 group-hover:text-stone-200"
                        )}
                    >
                        {getLabel()}
                    </span>
                    {item.isMask && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-accent/15 text-accent font-semibold tracking-wide border border-accent/25 shrink-0">
                            {t('mask', 'Маска')}
                        </span>
                    )}
                </div>
            )}

            {/* Action buttons — visible on hover/selected */}
            <div className={cn(
                "flex items-center gap-0.5 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { visible: item.visible === false ? true : false }); }}
                    className={cn(
                        "p-1 rounded-xl transition-all cursor-pointer apple-press",
                        item.visible === false
                            ? "text-stone-600 hover:text-stone-400"
                            : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
                    )}
                    aria-label={item.visible === false ? t('show') : t('hide')}
                >
                    {item.visible === false
                        ? <EyeOff className="w-3 h-3" />
                        : <Eye className="w-3 h-3" />
                    }
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { locked: !item.locked }); }}
                    className={cn(
                        "p-1 rounded-xl transition-all cursor-pointer apple-press",
                        item.locked
                            ? "text-accent"
                            : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                    )}
                    aria-label={item.locked ? t('unlock') : t('lock')}
                >
                    {item.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    className="p-1 rounded-xl text-stone-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer apple-press"
                    aria-label={t('delete')}
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export const LayerRow = React.memo(LayerRowComponent);
