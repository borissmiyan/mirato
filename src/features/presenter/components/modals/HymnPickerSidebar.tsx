import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Music } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/core/utils/cn';
import DropdownSelector, { DropdownOption } from '@/shared/ui/DropdownSelector';
import SearchInput from '@/shared/ui/SearchInput';
import IconButton from '@/shared/ui/IconButton';
import Badge from '@/shared/ui/Badge';

export interface HymnRowItem {
    id: string;
    presentationId: string;
    number: string;
    title: string;
    hymnalId?: string;
    hymnalName?: string;
    matchSnippet?: string;
    verseCount: number;
}

export interface HymnPickerSidebarProps {
    selectedHymnalId: string;
    onSelectHymnalId: (val: string) => void;
    hymnalOptions: DropdownOption[];
    searchQuery: string;
    onSearchQueryChange: (val: string) => void;
    filteredHymns: HymnRowItem[];
    selectedHymnPresId: string | null;
    onSelectHymn: (presentationId: string) => void;
    onClose: () => void;
}

/**
 * Sidebar component for filtering and selecting hymns within HymnPickerModal with virtual scrolling.
 */
export const HymnPickerSidebar: React.FC<HymnPickerSidebarProps> = ({
    selectedHymnalId,
    onSelectHymnalId,
    hymnalOptions,
    searchQuery,
    onSearchQueryChange,
    filteredHymns,
    selectedHymnPresId,
    onSelectHymn,
    onClose,
}) => {
    const { t } = useTranslation();
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredHymns.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 5,
    });

    return (
        <div className="w-96 shrink-0 border-r border-white/5 bg-stone-900/50 flex flex-col z-20">
            {/* Header with Hymnal Picker & Search */}
            <div className="p-6 border-b border-white/5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Music className="w-5 h-5 text-accent" />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">
                            {t('add_hymn_slide', 'Вставить гимн')}
                        </h2>
                    </div>
                    <IconButton
                        icon={<X className="w-4 h-4" />}
                        onClick={onClose}
                        variant="subtle"
                        size="sm"
                        label={t('close', 'Close')}
                    />
                </div>

                {/* Hymnal Selector */}
                <DropdownSelector
                    value={selectedHymnalId}
                    options={hymnalOptions}
                    onChange={onSelectHymnalId}
                    placeholder={t('select_hymnal', 'Выберите сборник')}
                />

                {/* Search Input */}
                <SearchInput
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder={t('search_hymns_placeholder', 'Поиск по номеру, названию или словам...')}
                    autoFocus
                />
            </div>

            {/* Hymns List */}
            <div ref={parentRef} className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {filteredHymns.length > 0 ? (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const h = filteredHymns[virtualRow.index];
                            if (!h) return null;
                            const isSelected = selectedHymnPresId === h.presentationId;

                            return (
                                <div
                                    key={h.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        paddingBottom: '6px',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectHymn(h.presentationId)}
                                        className={cn(
                                            "w-full flex items-center gap-3 text-left p-3 rounded-xl border transition-all duration-200 group relative shrink-0 cursor-pointer apple-press",
                                            isSelected
                                                ? "bg-accent/15 border-accent/40 shadow-[0_0_20px_rgba(234,179,8,0.15)] ring-1 ring-accent/30"
                                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                        )}
                                    >
                                        {/* Number Badge */}
                                        <div
                                            className={cn(
                                                "w-[58px] h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs border transition-colors whitespace-nowrap",
                                                isSelected
                                                    ? "bg-accent text-black border-accent-hover shadow-md shadow-accent/20"
                                                    : "bg-black/40 text-stone-300 border-white/10 group-hover:border-white/20 group-hover:text-white"
                                            )}
                                        >
                                            № {h.number}
                                        </div>

                                        {/* Title, hymnal tag & snippet */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p
                                                    className={cn(
                                                        "text-xs font-bold truncate transition-colors",
                                                        isSelected ? "text-white" : "text-stone-300 group-hover:text-white"
                                                    )}
                                                >
                                                    {h.title}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {selectedHymnalId === 'ALL' && h.hymnalName && (
                                                    <Badge variant="neutral" size="sm" className="truncate max-w-[120px]">
                                                        {h.hymnalName}
                                                    </Badge>
                                                )}
                                                {h.matchSnippet ? (
                                                    <p className="text-[10px] text-accent/90 italic truncate">
                                                        {h.matchSnippet}
                                                    </p>
                                                ) : (
                                                    <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">
                                                        {t('slides_count', { count: h.verseCount, defaultValue: `${h.verseCount} слайдов` })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 flex flex-col items-center justify-center gap-3 text-stone-500">
                        <Music className="w-8 h-8 opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {t('no_results', 'Ничего не найдено')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HymnPickerSidebar;
