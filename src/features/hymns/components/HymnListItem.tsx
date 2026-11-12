import React, { useState, useMemo } from 'react';
import { Music, ChevronRight, Settings } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useHymnLiveState } from '../hooks/useHymnLiveState';
import { DropdownSelector, IconButton } from '@/shared/ui';

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
    searchQuery: string;
    themes: Array<{ id: string; name: string; nameRu?: string }>;
    selectedThemeId: string;
    onThemeChange: (themeId: string) => void;
    onClick: () => void;
    lang: string;
}

export const HymnListItem: React.FC<HymnListItemProps> = React.memo(({
    hymn,
    isActive,
    searchQuery,
    themes,
    selectedThemeId,
    onThemeChange,
    onClick,
    lang
}) => {
    const { isLive } = useHymnLiveState(hymn.presentationId);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const isRu = lang === 'ru';

    const themeOptions = useMemo(() => {
        return themes.map(t => ({
            value: t.id,
            label: isRu && t.nameRu ? t.nameRu : t.name
        }));
    }, [themes, isRu]);

    return (
        <div
            onClick={onClick}
            className={cn(
                'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-3 border shadow-sm cursor-pointer group',
                isActive
                    ? 'bg-accent/10 border-accent/30 text-accent shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                    : 'bg-white/2 border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-200'
            )}
        >
            <Music className={cn('w-4 h-4 shrink-0 transition-transform duration-200', isActive ? 'scale-110 text-accent' : 'opacity-40')} />
            <span className={cn("shrink-0 w-8 text-xs font-mono text-right", isActive ? 'text-accent/80 font-bold' : 'text-stone-500')}>{hymn.number}</span>
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
                    <IconButton
                        icon={Settings}
                        label="Выбрать тему оформления"
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowThemePicker(prev => !prev)}
                        className={cn(
                            "p-1.5 rounded-xl transition-colors",
                            showThemePicker
                                ? "bg-accent/20 text-accent"
                                : "text-stone-400 hover:text-stone-200 hover:bg-white/10"
                        )}
                    />
                    {showThemePicker && (
                        <div className="absolute right-0 top-full mt-1 w-56 z-50">
                            <DropdownSelector
                                value={selectedThemeId}
                                options={themeOptions}
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
