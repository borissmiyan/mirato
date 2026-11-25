import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Info, ListTree, Trash2, FolderDown, HelpCircle, Loader2, AlertTriangle, X, ArrowLeft, ChevronRight, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IHymnal } from '@/core/types/hymn';
import { useHymnLiveState } from '../hooks/useHymnLiveState';
import { useSetAtom } from 'jotai';
import { removeHymnalModalAtom, importCollisionModalAtom, hymnalInstructionModalAtom } from '@/core/store/uiAtoms';
import { hymnLibraryService } from '../services/hymnLibraryService';
import { toast } from 'sonner';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import Button from '@/shared/ui/Button';
import IconButton from '@/shared/ui/IconButton';
import { CustomHymnalIcon, EmptyState, PickerOptionCard, SearchInput } from '@/shared/ui';

interface HymnalCardProps {
    hymnal: IHymnal;
    isSelected: boolean;
    onSelect: () => void;
    onOpenInfo?: () => void;
    onOpenThematic?: () => void;
    onRemove?: () => void;
}

const formatHymnCountWord = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    return mod10 === 1 && mod100 !== 11
        ? 'гимн'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'гимна'
            : 'гимнов';
};

const formatHymnCountLabel = (count: number, language?: string): string => {
    const word = formatHymnCountWord(count);
    const langTag = (language || 'ru').toUpperCase();
    return `${count} ${word} • ${langTag}`;
};

const HymnalCard: React.FC<HymnalCardProps> = React.memo(({ hymnal, isSelected, onSelect, onOpenInfo, onOpenThematic, onRemove }) => {
    const { isLive } = useHymnLiveState(undefined, hymnal.id);

    return (
        <PickerOptionCard
            title={hymnal.name}
            subtitle={formatHymnCountLabel(hymnal.itemCount, hymnal.language)}
            leading={
                hymnal.coverImageUrl ? (
                    <img
                        src={hymnal.coverImageUrl}
                        alt={hymnal.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <CustomHymnalIcon className="w-4 h-4" />
                )
            }
            leadingBleed={Boolean(hymnal.coverImageUrl)}
            isActive={isSelected}
            onClick={onSelect}
            trailing={
                isLive ? (
                    <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider">
                        LIVE
                    </span>
                ) : undefined
            }
            hoverActions={
                (onOpenThematic || onOpenInfo || (!hymnal.isBuiltIn && onRemove)) ? (
                    <>
                        {onOpenThematic && (
                            <IconButton
                                icon={<ListTree className="w-3.5 h-3.5" />}
                                onClick={(e) => { e.stopPropagation(); onOpenThematic(); }}
                                size="xs"
                                variant="ghost"
                                label="Тематическое оглавление"
                            />
                        )}
                        {onOpenInfo && (
                            <IconButton
                                icon={<Info className="w-3.5 h-3.5" />}
                                onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}
                                size="xs"
                                variant="ghost"
                                label="Информация о сборнике"
                            />
                        )}
                        {!hymnal.isBuiltIn && onRemove && (
                            <IconButton
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                size="xs"
                                variant="danger"
                                label="Удалить сборник"
                            />
                        )}
                    </>
                ) : undefined
            }
        />
    );
});
HymnalCard.displayName = 'HymnalCard';

// ─── Dropdown Portal ───────────────────────────────────────────────────────────

interface DropdownProps {
    hymnals: IHymnal[];
    currentHymnalId: string | null;
    triggerRect: DOMRect;
    onSelect: (id: string) => void;
    onClose: () => void;
    onOpenInfo?: (hymnal: IHymnal) => void;
    onOpenThematic?: (hymnal: IHymnal) => void;
    showAllOption?: boolean;
}

const formatLanguageLabel = (lang: string): string => {
    const code = (lang || 'ru').toLowerCase();
    const map: Record<string, string> = {
        ru: 'Русский',
        en: 'English',
        de: 'Deutsch',
        uk: 'Українська',
        es: 'Español',
        fr: 'Français',
    };
    return map[code] ?? code.toUpperCase();
};

const formatHymnalCountLabel = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'сборник'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'сборника'
            : 'сборников';
    return `${count} ${word}`;
};

export const HymnalPickerModal: React.FC<DropdownProps> = ({
    hymnals,
    currentHymnalId,
    triggerRect,
    onSelect,
    onClose,
    onOpenInfo,
    onOpenThematic,
    showAllOption = true,
}) => {
    const { t } = useTranslation();
    const setRemoveModal = useSetAtom(removeHymnalModalAtom);
    const setCollisionModal = useSetAtom(importCollisionModalAtom);
    const setInstructionModal = useSetAtom(hymnalInstructionModalAtom);

    const orphanCount = useLiveQuery(() => db.audioScopes.filter(s => s.needsManualReview === true).count(), []) || 0;

    const [isImporting, setIsImporting] = useState(false);
    const [search, setSearch] = useState('');

    const visibleHymnals = useMemo(() => hymnals.filter(h => !h.isDisabled), [hymnals]);

    const groupedByLang = useMemo(() => {
        const groups: Record<string, IHymnal[]> = {};
        for (const h of visibleHymnals) {
            const lang = (h.language || 'ru').toLowerCase();
            if (!groups[lang]) groups[lang] = [];
            groups[lang].push(h);
        }
        const langs = Object.keys(groups).sort();
        return { groups, langs };
    }, [visibleHymnals]);

    const initialLang = useMemo(() => {
        const cur = visibleHymnals.find(h => h.id === currentHymnalId)?.language?.toLowerCase();
        if (cur && groupedByLang.groups[cur]) return cur;
        return groupedByLang.langs[0] || 'ru';
    }, [visibleHymnals, currentHymnalId, groupedByLang]);

    // Open directly on the current language's hymnals; step back to Languages when 2+ languages exist
    const [view, setView] = useState<'languages' | 'hymnals'>('hymnals');
    const [selectedLang, setSelectedLang] = useState<string>(initialLang);

    const effectiveLang = groupedByLang.groups[selectedLang] ? selectedLang : initialLang;
    const filteredHymnals = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (q) {
            return visibleHymnals.filter(h =>
                h.name.toLowerCase().includes(q) ||
                (h.language || '').toLowerCase().includes(q)
            );
        }
        return groupedByLang.groups[effectiveLang] ?? [];
    }, [visibleHymnals, groupedByLang, effectiveLang, search]);

    const handleImport = async () => {
        setIsImporting(true);
        try {
            const result = await hymnLibraryService.importCustomHymnal();
            if (result.status === 'collision' && result.existingId && result.newDirName) {
                onClose();
                setCollisionModal({ isOpen: true, existingId: result.existingId, newDirName: result.newDirName });
            } else if (result.status === 'success') {
                toast.success(t('hymns.import_success', 'Сборник успешно загружен'));
                onClose();
            } else if (result.status === 'error') {
                toast.error(t('hymns.import_error', 'Ошибка при импорте сборника'), { description: result.error });
            }
        } catch (e) {
            console.error(e);
            toast.error(t('hymns.import_error', 'Ошибка при импорте сборника'));
        } finally {
            setIsImporting(false);
        }
    };

    const position = useMemo(() => {
        const spacing = 8;
        const menuHeight = 520;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        // Dynamic width based on hymnal titles
        const maxNameLen = filteredHymnals.reduce((max, h) => Math.max(max, h.name?.length || 0), 0);
        const contentWidth = Math.round(150 + maxNameLen * 8.5);
        const minWidth = Math.max(triggerRect.width, 320);
        const maxWidth = Math.min(Math.max(triggerRect.width * 2, 540), windowWidth - 32);
        const width = Math.min(Math.max(contentWidth, minWidth), maxWidth);

        let left = Math.max(16, triggerRect.left);
        if (left + width > windowWidth - 16) {
            left = Math.max(16, windowWidth - width - 16);
        }

        if (triggerRect.top > menuHeight + spacing) {
            return {
                bottom: windowHeight - triggerRect.top + spacing,
                left,
                width,
            };
        }
        return {
            top: triggerRect.bottom + spacing,
            left,
            width,
        };
    }, [triggerRect, filteredHymnals]);

    const canSwitchLanguages = groupedByLang.langs.length > 1;
    const isLanguagesView = view === 'languages' && !search.trim() && canSwitchLanguages;
    const totalHymnsCount = useMemo(() => hymnals.reduce((acc, h) => acc + (h.itemCount || 0), 0), [hymnals]);
    const allHymnalsLabel = t('all_hymnals', 'Все сборники');
    const shouldShowAllCard = showAllOption && hymnals.length > 1 && (
        !search.trim() || allHymnalsLabel.toLowerCase().includes(search.trim().toLowerCase())
    );

    return createPortal(
        <div className="fixed inset-0 z-[10010] pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

            {/* Dropdown content */}
            <div
 className="absolute bg-stone-900 border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                style={position}
            >
                {/* Header (unified with TranslationPicker) */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-stone-950/40 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {!isLanguagesView && canSwitchLanguages && !search.trim() && (
                            <Button
                                size="sm"
                                square
                                variant="ghost"
                                onClick={() => setView('languages')}
                                className="w-8 h-8 text-stone-400 hover:text-white shrink-0"
                                title={t('languages', 'Языки')}
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider truncate">
                            {isLanguagesView
                                ? t('languages', 'Языки')
                                : (canSwitchLanguages ? formatLanguageLabel(effectiveLang) : t('hymns.hymnals', 'Сборники гимнов'))}
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

                {/* Search */}
                <div className="p-3 border-b border-white/5 bg-stone-950/20">
                    <SearchInput
                        size="sm"
                        placeholder={t('hymns.search_hymnals_placeholder', 'Поиск сборников...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch('')}
                    />
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-1.5 flex flex-col gap-0.5 min-h-0">
                    {shouldShowAllCard && (
                        <PickerOptionCard
                            title={allHymnalsLabel}
                            subtitle={`${totalHymnsCount.toLocaleString('ru-RU')} ${formatHymnCountWord(totalHymnsCount)}`}
                            leading={<CustomHymnalIcon className="w-4 h-4" />}
                            isActive={currentHymnalId === 'ALL'}
                            onClick={() => { onSelect('ALL'); onClose(); }}
                        />
                    )}
                    {isLanguagesView ? (
                        groupedByLang.langs.map((lang) => (
                            <PickerOptionCard
                                key={lang}
                                title={formatLanguageLabel(lang)}
                                subtitle={`${lang.toUpperCase()} • ${formatHymnalCountLabel(groupedByLang.groups[lang].length)}`}
                                leading={<Languages className="w-4 h-4" />}
                                trailing={<ChevronRight className="w-3.5 h-3.5 text-stone-500 group-hover:translate-x-0.5 transition-transform" />}
                                onClick={() => {
                                    setSelectedLang(lang);
                                    setView('hymnals');
                                }}
                            />
                        ))
                    ) : filteredHymnals.length === 0 ? (
                        <div className="py-6">
                            <EmptyState
                                icon={CustomHymnalIcon}
                                title={t('hymns.no_hymnals', 'Нет доступных сборников')}
                                size="xs"
                                border="none"
                            />
                        </div>
                    ) : (
                        filteredHymnals.map((hymnal) => (
                            <HymnalCard
                                key={hymnal.id}
                                hymnal={hymnal}
                                isSelected={hymnal.id === currentHymnalId}
                                onSelect={() => { onSelect(hymnal.id); onClose(); }}
                                onOpenInfo={onOpenInfo ? () => { onOpenInfo(hymnal); onClose(); } : undefined}
                                onOpenThematic={onOpenThematic ? () => { onOpenThematic(hymnal); onClose(); } : undefined}
                                onRemove={() => { onClose(); setRemoveModal({ isOpen: true, hymnal }); }}
                            />
                        ))
                    )}
                </div>
                
                {/* Footer Actions */}
                <div className="border-t border-white/5 bg-stone-950/80 p-2 flex flex-col gap-1">
                    {orphanCount > 0 && (
                        <button
                            type="button"
                            onClick={() => { onClose(); useModalStore.getState().openModal(ModalType.ORPHAN_AUDIO_SCOPES); }}
                            className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl transition-colors apple-press cursor-pointer"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span>{orphanCount} {t('hymns.sync.orphan_badge', 'Ошибки аудио')}</span>
                        </button>
                    )}
                    <div className="flex items-center gap-1 w-full">
                        <IconButton
                            icon={<HelpCircle className="w-4 h-4" />}
                            onClick={() => { onClose(); setInstructionModal(true); }}
                            size="sm"
                            variant="ghost"
                            label={t('hymns.create_custom', 'Как создать свой сборник')}
                        />
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleImport}
                            disabled={isImporting}
                            leftIcon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderDown className="w-4 h-4" />}
                            className="flex-1 font-bold text-xs"
                        >
                            {t('hymns.import_custom', 'Добавить сборник')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default HymnalPickerModal;
