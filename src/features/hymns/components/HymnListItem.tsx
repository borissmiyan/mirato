import React, { useState, useMemo } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { CustomHymnStackIcon, DropdownSelector } from '@/shared/ui';
import { IHymnTheme } from '@/core/types/hymn';
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
    const isRu = lang === 'ru';

    const themeOptions = useMemo(() => {
        if (!showThemePicker) return [];
        return themes.map(th => ({
            value: th.id,
            label: isRu && th.nameRu ? th.nameRu : th.name,
            keywords: `${th.name} ${th.nameRu || ''} ${th.textStyle?.fontFamily || ''}`,
            icon: (
                <span
                    className="w-5 h-5 rounded-md border border-white/15 flex items-center justify-center text-[10px] font-bold shrink-0 leading-none"
                    style={{
                        background: getHymnThemeSwatchBackground(th),
                        color: th.textStyle?.color || '#FFFFFF',
                        fontFamily: th.textStyle?.fontFamily,
                    }}
                >
                    А
                </span>
            ),
        }));
    }, [themes, isRu, showThemePicker]);

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
                        type="button"
                        aria-label="Выбрать тему оформления"
                        title="Выбрать тему оформления"
                        onClick={() => setShowThemePicker(prev => !prev)}
                        className={cn(
                            "w-7 h-7 inline-flex items-center justify-center rounded-lg cursor-pointer",
                            showThemePicker
                                ? "bg-accent/20 text-accent"
                                : "text-stone-400 hover:text-stone-200 hover:bg-white/10"
                        )}
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>
                    {showThemePicker && (
                        <div className="absolute right-0 top-full mt-1 w-56 z-50">
                            <DropdownSelector
                                value={selectedThemeId}
                                options={themeOptions}
                                searchable
                                searchPlaceholder={isRu ? 'Поиск темы...' : 'Search themes...'}
                                size="xs"
                                onChange={(val) => {
                                    onThemeChange(val);
                                    setShowThemePicker(false);
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />}
        </div>
    );
});

HymnListItem.displayName = 'HymnListItem';
