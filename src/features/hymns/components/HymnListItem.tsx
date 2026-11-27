import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Palette } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomHymnStackIcon } from '@/shared/ui';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import { getHymnThemeSwatchBackground } from '../services/hymnThemeConstants';

// ─── SearchHighlight ─────────────────────────────────────────────────────────

export const SearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20">{part}</mark>
                    : <React.Fragment key={i}>{part}</React.Fragment>
            )}
        </>
    );
};

// ─── Hymn number row ─────────────────────────────────────────────────────────

export interface HymnRowData {
    id: string;
    number: string;
    title: string;
    presentationId: string;
    matchedSnippet?: string;
}

export interface HymnListItemProps {
    hymn: HymnRowData;
    isActive: boolean;
    isLive: boolean;
    searchQuery: string;
    themes: Array<Pick<IHymnTheme, 'id' | 'name' | 'nameRu'> & Partial<Pick<IHymnTheme, 'background' | 'textStyle'>>>;
    selectedThemeId: string;
    onThemeChange: (themeId: string) => void;
    onSelect: (hymnId: string) => void;
    lang: string;
}

export const HymnListItem: React.FC<HymnListItemProps> = React.memo(({
    hymn,
    isActive,
    isLive,
    searchQuery,
    themes,
    selectedThemeId,
    onThemeChange,
    onSelect,
    lang
}) => {
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
    const triggerBtnRef = useRef<HTMLButtonElement>(null);
    const popoverListRef = useRef<HTMLDivElement>(null);
    const isRu = lang === 'ru';

    useEffect(() => {
        if (!showThemePicker) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowThemePicker(false);
        };
        window.addEventListener('keydown', onKey);
        const raf = window.requestAnimationFrame(() => {
            const activeEl = popoverListRef.current?.querySelector<HTMLElement>('[data-theme-active="true"]');
            if (activeEl && typeof activeEl.scrollIntoView === 'function') {
                activeEl.scrollIntoView({ block: 'center', behavior: 'instant' });
            }
        });
        return () => {
            window.removeEventListener('keydown', onKey);
            window.cancelAnimationFrame(raf);
        };
    }, [showThemePicker]);

    const themeOptions = useMemo(() => {
        if (!showThemePicker) return [];
        return [
            {
                value: SOURCE_THEME_ID,
                label: isRu ? 'Оригинал' : 'Original',
                bg: '#1c1917',
                color: '#c084fc',
                fontFamily: undefined as string | undefined,
            },
            ...themes.map(th => ({
                value: th.id,
                label: isRu && th.nameRu ? th.nameRu : th.name,
                bg: getHymnThemeSwatchBackground(th),
                color: th.textStyle?.color || '#FFFFFF',
                fontFamily: th.textStyle?.fontFamily,
            })),
        ];
    }, [themes, isRu, showThemePicker]);

    const handleToggleThemePopover = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showThemePicker && triggerBtnRef.current) {
            const rect = triggerBtnRef.current.getBoundingClientRect();
            const menuWidth = 224;
            const menuMaxH = 300;
            const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
            const top = rect.bottom + menuMaxH > window.innerHeight - 12
                ? Math.max(12, rect.top - menuMaxH - 6)
                : rect.bottom + 6;
            setPopoverPos({ top, left });
        }
        setShowThemePicker(prev => !prev);
    };

    return (
        <div
            onClick={() => onSelect(hymn.id)}
            className={cn(
                'w-full shrink-0 text-left px-3 rounded-xl text-sm flex items-center gap-3 border cursor-pointer group',
                hymn.matchedSnippet ? 'h-[60px]' : 'h-[46px]',
                isActive
                    ? 'bg-stone-800 border-stone-600 text-stone-100'
                    : 'bg-[#1f1c1a] border-stone-800/90 text-stone-400 hover:bg-[#262320] hover:border-stone-700 hover:text-stone-200'
            )}
        >
            <span
                className={cn(
                    "shrink-0 min-w-[52px] h-6 px-2 rounded-lg inline-flex items-center justify-center gap-1.5 text-[11px] font-mono tabular-nums border transition-colors",
                    isActive
                        ? 'bg-accent text-stone-950 border-accent font-bold'
                        : 'bg-stone-950 text-stone-300 border-stone-800 group-hover:border-stone-700'
                )}
            >
                <CustomHymnStackIcon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-stone-950' : 'text-accent/70')} />
                {hymn.number && <span>{hymn.number}</span>}
            </span>
            <div className="flex-1 min-w-0 flex flex-col">
                <span className={cn("truncate", isActive ? 'font-bold' : '')}>
                    <SearchHighlight text={hymn.title} query={searchQuery} />
                </span>
                {hymn.matchedSnippet && (
                    <span className="text-[10px] text-stone-500 truncate leading-tight mt-0.5">
                        <SearchHighlight text={hymn.matchedSnippet} query={searchQuery} />
                    </span>
                )}
            </div>

            {isLive && (
                <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider">
                    LIVE
                </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
                {/* audit-ignore: event propagation boundary */}
                <div onClick={(e) => e.stopPropagation()} className="relative">
                    <button
                        ref={triggerBtnRef}
                        type="button"
                        aria-label="Выбрать тему оформления"
                        title="Выбрать тему оформления"
                        onClick={handleToggleThemePopover}
                        className={cn(
                            "w-7 h-7 inline-flex items-center justify-center rounded-lg cursor-pointer transition-colors",
                            showThemePicker
                                ? "bg-accent/20 text-accent"
                                : "text-stone-400 hover:text-stone-200 hover:bg-white/10"
                        )}
                    >
                        <Palette className="w-3.5 h-3.5" />
                    </button>
                    {showThemePicker && popoverPos && createPortal(
                        <div className="fixed inset-0 z-[10050]" onClick={(e) => { e.stopPropagation(); setShowThemePicker(false); }}>
                            <div
                                ref={popoverListRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{ top: popoverPos.top, left: popoverPos.left }}
                                className="fixed w-56 max-h-[300px] overflow-y-auto no-scrollbar rounded-xl bg-stone-900 border border-white/12 shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                            >
                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                                    {isRu ? 'Тема оформления' : 'Hymn Theme'}
                                </div>
                                {themeOptions.map((opt) => {
                                    const isSelected = selectedThemeId === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            data-theme-active={isSelected ? 'true' : undefined}
                                            onClick={() => {
                                                onSelect(hymn.id);
                                                onThemeChange(opt.value);
                                                setShowThemePicker(false);
                                            }}
                                            className={cn(
                                                'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer',
                                                isSelected
                                                    ? 'bg-accent/15 text-amber-200 font-semibold'
                                                    : 'text-stone-200 hover:bg-white/8'
                                            )}
                                        >
                                            <span
                                                className="w-5 h-5 rounded-md border border-white/15 flex items-center justify-center text-[10px] font-bold shrink-0 leading-none"
                                                style={{ background: opt.bg, color: opt.color, fontFamily: opt.fontFamily }}
                                            >
                                                А
                                            </span>
                                            <span className="flex-1 truncate">{opt.label}</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            </div>

            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />}
        </div>
    );
});

HymnListItem.displayName = 'HymnListItem';
