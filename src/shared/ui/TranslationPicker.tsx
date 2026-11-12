import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { X, ChevronRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { SearchInput } from '@/shared/ui/SearchInput';
import { Button } from '@/shared/ui/Button';

interface TranslationPickerProps {
    currentTranslationId: string | null;
    onSelect: (translationId: string) => void;
    onClose: () => void;
    title?: string;
    triggerRect?: DOMRect | null;
}

/**
 * Helper to highlight search matches
 */
const SearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="bg-accent/30 text-accent px-1 rounded ring-1 ring-accent/20">{part}</mark>
                    : <React.Fragment key={i}>{part}</React.Fragment>
            )}
        </>
    );
};

const TranslationPicker: React.FC<TranslationPickerProps> = ({
    currentTranslationId,
    onSelect,
    onClose,
    title,
    triggerRect
}) => {
    const { t } = useTranslation();
    const [view, setView] = useState<'languages' | 'translations'>('languages');
    const [selectedLang, setSelectedLang] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const liveTranslations = useLiveQuery(() => db.translations.toArray());
    const translations = useMemo(() => liveTranslations || [], [liveTranslations]);

    const pickerData = useMemo(() => {
        const filtered = translations.filter(tr =>
            tr.name.toLowerCase().includes(search.toLowerCase()) ||
            tr.id.toLowerCase().includes(search.toLowerCase())
        );

        const groups: Record<string, typeof translations> = {};
        filtered.forEach(tr => {
            const l = tr.language || 'Unknown';
            if (!groups[l]) groups[l] = [];
            groups[l].push(tr);
        });

        const uniqueLangs = Object.keys(groups).sort();
        return { groups, uniqueLangs };
    }, [translations, search]);

    // Positioning logic
    const position = useMemo(() => {
        if (!triggerRect) return { bottom: '16px', left: '16px', width: '320px' };

        const spacing = 8;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const menuHeight = 520;

        const bottom = windowHeight - triggerRect.top + spacing;

        // Dynamic width depending on current view and items
        const isLanguagesView = view === 'languages' && !search;
        const currentList = selectedLang ? (pickerData.groups[selectedLang] || []) : translations;
        const maxNameLen = isLanguagesView
            ? 0
            : currentList.reduce((max, t) => Math.max(max, t.name?.length || 0), 0);

        const contentWidth = isLanguagesView
            ? 280
            : Math.round(110 + maxNameLen * 8.2);

        const minWidth = Math.max(triggerRect.width, isLanguagesView ? 280 : 320);
        const maxWidth = Math.min(Math.max(triggerRect.width * 2, 540), windowWidth - 32);
        const width = Math.min(Math.max(contentWidth, minWidth), maxWidth);

        let left = Math.max(16, triggerRect.left);
        if (left + width > windowWidth - 16) {
            left = Math.max(16, windowWidth - width - 16);
        }

        // If it overlaps the top of the window, flip it to open downwards
        if (triggerRect.top < menuHeight + spacing) {
            return {
                top: `${triggerRect.bottom + spacing}px`,
                left: `${left}px`,
                width: `${width}px`
            };
        }

        return {
            bottom: `${bottom}px`,
            left: `${left}px`,
            width: `${width}px`
        };
    }, [triggerRect, view, search, selectedLang, pickerData, translations]);

    return createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
            {/* Backdrop - Transparent for dropdown feel */}
            <div
                className="absolute inset-0 bg-transparent pointer-events-auto"
                onClick={onClose}
            />

            {/* Dropdown Content */}
            <div
                className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                style={position}
            >
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {view === 'translations' && (
                            <Button
                                size="sm"
                                square
                                variant="ghost"
                                onClick={() => setView('languages')}
                                className="w-8 h-8 text-stone-400 hover:text-white shrink-0"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider truncate">
                            {view === 'languages' ? t('languages') : (selectedLang || title || t('translations'))}
                        </h3>
                    </div>
                    <Button
                        size="sm"
                        square
                        variant="ghost"
                        onClick={onClose}
                        className="w-8 h-8 text-stone-500 hover:text-white shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="p-3 border-b border-white/5 bg-stone-950/20">
                    <SearchInput
                        size="sm"
                        autoFocus
                        placeholder={t('search_bibles_placeholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch('')}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1 no-scrollbar min-h-0">
                    {search ? (
                        pickerData.uniqueLangs.flatMap(langKey =>
                            pickerData.groups[langKey].map(tr => (
                                <button
                                    key={tr.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(tr.id);
                                        onClose();
                                    }}
                                    className={cn(
                                        "w-full flex flex-col gap-1 p-2.5 rounded-xl transition-all group text-left border cursor-pointer apple-press",
                                        currentTranslationId === tr.id
                                            ? "bg-accent/15 border-accent/30 text-accent"
                                            : "hover:bg-white/5 border-transparent hover:border-white/10"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn("text-xs font-bold truncate", currentTranslationId === tr.id ? "text-accent" : "text-stone-200")}>
                                            <SearchHighlight text={tr.name} query={search} />
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-stone-400 bg-white/5 px-1.5 py-0.5 rounded-full uppercase shrink-0">{tr.language}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider leading-none">
                                        <SearchHighlight text={tr.id} query={search} />
                                    </span>
                                </button>
                            ))
                        )
                    ) : view === 'languages' ? (
                        pickerData.uniqueLangs.map(langKey => (
                            <button
                                key={langKey}
                                type="button"
                                onClick={() => {
                                    setSelectedLang(langKey);
                                    setView('translations');
                                }}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group text-left cursor-pointer apple-press"
                            >
                                <span className="text-xs font-bold text-stone-200 group-hover:text-white uppercase tracking-wider">{langKey}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-stone-500 font-bold">{pickerData.groups[langKey].length}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-stone-500 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </button>
                        ))
                    ) : (
                        (selectedLang ? pickerData.groups[selectedLang] || [] : translations).map(tr => (
                            <button
                                key={tr.id}
                                type="button"
                                onClick={() => {
                                    onSelect(tr.id);
                                    onClose();
                                }}
                                className={cn(
                                    "w-full flex flex-col gap-1 p-2.5 rounded-xl transition-all group text-left border cursor-pointer apple-press",
                                    currentTranslationId === tr.id
                                        ? "bg-accent/15 border-accent/30 text-accent"
                                        : "hover:bg-white/5 border-transparent hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className={cn("text-xs font-bold truncate", currentTranslationId === tr.id ? "text-accent" : "text-stone-200")}>
                                        {tr.name}
                                    </span>
                                    {currentTranslationId === tr.id && <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(234,179,8,0.5)] shrink-0" />}
                                </div>
                                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider leading-none">{tr.id.toUpperCase()}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TranslationPicker;
