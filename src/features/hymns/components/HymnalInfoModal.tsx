import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, BookOpen, ListTree, Calendar, Building2, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IHymnal } from '@/core/types/hymn';
import { Button, IconButton } from '@/shared/ui';
import { useSetAtom } from 'jotai';
import { hymnModalReturnStateAtom } from '@/core/store/uiAtoms';

type ModalView = 'info' | 'thematic';

interface HymnalInfoModalProps {
    hymnal: IHymnal;
    initialView?: ModalView;
    onClose: () => void;
    /** Called when user clicks a hymn number from the thematic index */
    onSelectHymn: (hymnalId: string, hymnNumber: string) => void;
}

// ─── Thematic Index View ───────────────────────────────────────────────────────

const ThematicIndexView: React.FC<{
    hymnal: IHymnal;
    onSelectHymn: (number: string) => void;
}> = ({ hymnal, onSelectHymn }) => {
    const { t } = useTranslation();
    
    // Normalize thematicIndex which could be an array [{theme, hymnIds}] or Record<string, string[]>
    const themes: [string, string[]][] = React.useMemo(() => {
        if (!hymnal.thematicIndex) return [];
        if (Array.isArray(hymnal.thematicIndex)) {
            return (hymnal.thematicIndex as Array<{ theme: string; hymnIds?: string[] }>).map(t => [t.theme, t.hymnIds || []] as [string, string[]]);
        }
        return Object.entries(hymnal.thematicIndex as Record<string, string[]>);
    }, [hymnal.thematicIndex]);

    if (themes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 p-8">
                <ListTree className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm text-center">
                    {t('hymns.no_thematic_index', 'Тематическое оглавление отсутствует')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
            <div className="space-y-4">
                {themes.map(([theme, numbers]) => (
                    <div key={theme}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-accent/70 px-1 mb-2">
                            {theme}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {numbers.map((num: string) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => onSelectHymn(num)}
                                    className="px-2.5 py-1 rounded-xl bg-stone-800 border border-white/5 text-xs text-stone-300 font-mono hover:bg-accent/20 hover:border-accent/30 hover:text-accent transition-all apple-press cursor-pointer"
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Info View ─────────────────────────────────────────────────────────────────

const InfoView: React.FC<{
    hymnal: IHymnal;
    onSwitchToThematic: () => void;
}> = ({ hymnal, onSwitchToThematic }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Metadata fields */}
            <div className="flex-1 space-y-3">
                {hymnal.year && (
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-stone-500">{t('hymns.year', 'Год издания')}</div>
                            <div className="text-sm text-stone-200 font-medium">{hymnal.year}</div>
                        </div>
                    </div>
                )}

                {hymnal.publisher && (
                    <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-stone-500 shrink-0" />
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-stone-500">{t('hymns.publisher', 'Издатель')}</div>
                            <div className="text-sm text-stone-200 font-medium">{hymnal.publisher}</div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-stone-500 shrink-0" />
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-stone-500">{t('hymns.count', 'Количество гимнов')}</div>
                        <div className="text-sm text-stone-200 font-medium">{hymnal.itemCount}</div>
                    </div>
                </div>

                {hymnal.description && (
                    <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">{t('hymns.description', 'Описание')}</div>
                        <p className="text-sm text-stone-400 leading-relaxed">{hymnal.description}</p>
                    </div>
                )}
            </div>

            {/* Thematic Button */}
            {hymnal.thematicIndex && Object.keys(hymnal.thematicIndex).length > 0 && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onSwitchToThematic}
                    leftIcon={<ListTree className="w-4 h-4 text-accent" />}
                    className="w-full text-accent font-semibold text-sm"
                >
                    {t('hymns.thematic_index', 'Тематическое содержание')}
                </Button>
            )}
        </div>
    );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────

export const HymnalInfoModal: React.FC<HymnalInfoModalProps> = ({
    hymnal,
    initialView = 'info',
    onClose,
    onSelectHymn,
}) => {
    const { t } = useTranslation();
    const [view, setView] = useState<ModalView>(initialView);
    const setReturnState = useSetAtom(hymnModalReturnStateAtom);

    const handleSelectHymn = useCallback((hymnNumber: string) => {
        // Store the minimized state so the Return button appears
        setReturnState({
            isOpen: false,
            activeHymnalId: hymnal.id,
            view: 'thematic',
        });
        onSelectHymn(hymnal.id, hymnNumber);
        onClose();
    }, [hymnal.id, onSelectHymn, onClose, setReturnState]);

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 apple-backdrop bg-stone-950/75 backdrop-blur-xl"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 flex w-full max-w-2xl h-[520px] bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl shadow-2xl overflow-hidden apple-modal">

                {/* Left: Cover */}
                <div className="w-48 shrink-0 relative bg-stone-950">
                    {hymnal.coverImageUrl ? (
                        <img
                            src={hymnal.coverImageUrl}
                            alt={hymnal.name}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-stone-800 to-stone-950 p-4">
                            <BookOpen className="w-12 h-12 text-stone-600 mb-4" />
                            <p className="text-xs text-stone-500 text-center leading-snug font-medium">{hymnal.name}</p>
                        </div>
                    )}
                    {/* Gradient overlay for title readability */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-stone-950/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[11px] text-stone-300 font-bold leading-tight line-clamp-3">{hymnal.name}</p>
                    </div>
                </div>

                {/* Right: Content */}
                <div className="flex-1 flex flex-col min-w-0 p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {view === 'thematic' && (
                                <IconButton
                                    icon={ChevronLeft}
                                    label={t('common.back', 'Назад')}
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setView('info')}
                                />
                            )}
                            <h2 className="text-sm font-bold text-stone-100">
                                {view === 'info'
                                    ? t('hymns.about_hymnal', 'О сборнике')
                                    : t('hymns.thematic_index', 'Тематическое содержание')
                                }
                            </h2>
                        </div>
                        <IconButton
                            icon={X}
                            label={t('common.close', 'Закрыть')}
                            variant="ghost"
                            size="xs"
                            onClick={onClose}
                        />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {view === 'info' ? (
                            <InfoView
                                hymnal={hymnal}
                                onSwitchToThematic={() => setView('thematic')}
                            />
                        ) : (
                            <ThematicIndexView
                                hymnal={hymnal}
                                onSelectHymn={handleSelectHymn}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
