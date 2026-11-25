import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IHymnal } from '@/core/types/hymn';
import {
    VirtualList,
    CustomHymnalIcon,
    CustomSlideStackIcon,
    NavigationSelectorCard,
} from '@/shared/ui';
import HymnalPickerModal from '@/features/hymns/components/HymnalPicker';

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

export interface HymnPickerListProps {
    selectedHymnalId: string;
    searchQuery: string;
    filteredHymns: HymnRowItem[];
    selectedHymnPresId: string | null;
    onSelectHymn: (presentationId: string) => void;
}

export interface HymnPickerFooterProps {
    hymnals: IHymnal[];
    selectedHymnalId: string;
    onSelectHymnalId: (val: string) => void;
    onPickerOpenChange?: (isOpen: boolean) => void;
}

const formatHymnCount = (count: number, language?: string): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'гимн'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'гимна'
            : 'гимнов';
    return language ? `${count} ${word} • ${language.toUpperCase()}` : `${count.toLocaleString('ru-RU')} ${word}`;
};

/**
 * Virtualized hymn list rendered inside PickerModalShell's sidebarBody.
 */
export const HymnPickerList: React.FC<HymnPickerListProps> = ({
    selectedHymnalId,
    searchQuery,
    filteredHymns,
    selectedHymnPresId,
    onSelectHymn,
}) => {
    const { t } = useTranslation();
    const isAllSelected = !selectedHymnalId || selectedHymnalId === 'ALL';

    const getHymnKey = useCallback((h: HymnRowItem) => h.id, []);

    const renderHymn = useCallback((h: HymnRowItem) => {
        const isSelected = selectedHymnPresId === h.presentationId;
        return (
            <button
                type="button"
                onClick={() => onSelectHymn(h.presentationId)}
                className={cn(
                    "w-full h-[54px] flex items-center gap-2.5 text-left px-2.5 rounded-xl border transition-colors duration-150 group relative shrink-0 cursor-pointer",
                    isSelected
                        ? "bg-stone-800 border-stone-600 text-stone-100"
                        : "bg-[#1f1c1a] border-stone-800/90 hover:bg-[#262320] hover:border-stone-700"
                )}
            >
                <div
                    className={cn(
                        "min-w-[44px] h-7 px-2 rounded-lg flex items-center justify-center shrink-0 font-mono font-bold text-[11px] border tabular-nums transition-colors whitespace-nowrap",
                        isSelected
                            ? "bg-accent text-stone-950 border-accent"
                            : "bg-stone-950 text-stone-300 border-stone-800 group-hover:text-white"
                    )}
                >
                    {h.number}
                </div>
                <div className="flex-1 min-w-0">
                    <p
                        className={cn(
                            "text-[13px] font-semibold truncate leading-snug transition-colors",
                            isSelected ? "text-stone-100" : "text-stone-300 group-hover:text-white"
                        )}
                    >
                        {h.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-500 min-w-0">
                        {isAllSelected && h.hymnalName && (
                            <span className="truncate max-w-[140px] text-stone-400/80 font-medium">
                                {h.hymnalName}
                            </span>
                        )}
                        {h.matchSnippet ? (
                            <span className="text-accent/90 italic truncate">
                                {h.matchSnippet}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 shrink-0 tabular-nums text-stone-400/75">
                                <CustomSlideStackIcon className="w-3 h-3 opacity-70 shrink-0" />
                                <span>{h.verseCount}</span>
                            </span>
                        )}
                    </div>
                </div>
            </button>
        );
    }, [selectedHymnPresId, isAllSelected, onSelectHymn]);

    return (
        <VirtualList
            items={filteredHymns}
            getItemKey={getHymnKey}
            renderItem={renderHymn}
            itemHeight={60}
            gap={6}
            overscan={14}
            resetKey={`${selectedHymnalId}:${searchQuery}`}
            className="px-3 py-2.5"
            emptyState={
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3 text-stone-500">
                    <CustomHymnalIcon className="w-8 h-8 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {t('no_results', 'Ничего не найдено')}
                    </span>
                </div>
            }
        />
    );
};

/**
 * Unified hymnal selector card pinned to PickerModalShell's sidebarFooter.
 */
export const HymnPickerFooter: React.FC<HymnPickerFooterProps> = ({
    hymnals,
    selectedHymnalId,
    onSelectHymnalId,
    onPickerOpenChange,
}) => {
    const { t } = useTranslation();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const isAllSelected = !selectedHymnalId || selectedHymnalId === 'ALL';
    const activeHymnal = useMemo(
        () => (isAllSelected ? null : hymnals.find((h) => h.id === selectedHymnalId) ?? null),
        [isAllSelected, hymnals, selectedHymnalId]
    );
    const totalHymnsCount = useMemo(
        () => hymnals.reduce((sum, h) => sum + (h.itemCount || 0), 0),
        [hymnals]
    );

    const setOpen = (next: boolean) => {
        setIsPickerOpen(next);
        onPickerOpenChange?.(next);
    };

    const handleTogglePicker = () => {
        if (!isPickerOpen && triggerRef.current) {
            setTriggerRect(triggerRef.current.getBoundingClientRect());
        }
        setOpen(!isPickerOpen);
    };

    return (
        <>
            <NavigationSelectorCard
                ref={triggerRef}
                onClick={handleTogglePicker}
                title={
                    isAllSelected
                        ? t('all_hymnals', 'Все сборники')
                        : (activeHymnal?.name || t('hymns.select_hymnal', 'Выбрать сборник'))
                }
                subtitle={
                    isAllSelected
                        ? formatHymnCount(totalHymnsCount)
                        : activeHymnal
                            ? formatHymnCount(activeHymnal.itemCount, activeHymnal.language || 'ru')
                            : t('hymns.title', 'Гимны')
                }
                coverImageUrl={isAllSelected ? undefined : activeHymnal?.coverImageUrl}
                badge={<CustomHymnalIcon className="w-4 h-4" />}
                badgeVariant="accent"
                isOpen={isPickerOpen}
                ariaLabel={t('select_hymnal', 'Выберите сборник')}
            />

            {isPickerOpen && triggerRect && (
                <HymnalPickerModal
                    hymnals={hymnals}
                    currentHymnalId={selectedHymnalId}
                    triggerRect={triggerRect}
                    onSelect={onSelectHymnalId}
                    onClose={() => setOpen(false)}
                    showAllOption
                />
            )}
        </>
    );
};
