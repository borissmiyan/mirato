import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { Music, Info, ListTree, Trash2, FolderDown, HelpCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { IHymnal } from '@/core/types/hymn';
import { useHymnLiveState } from '../hooks/useHymnLiveState';
import { useSetAtom } from 'jotai';
import { removeHymnalModalAtom, importCollisionModalAtom, hymnalInstructionModalAtom } from '@/core/store/uiAtoms';
import { hymnLibraryService } from '../services/hymnLibraryService';
import { toast } from 'sonner';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import Button from '@/shared/ui/Button';
import IconButton from '@/shared/ui/IconButton';
import { EmptyState } from '@/shared/ui';

interface HymnalCardProps {
    hymnal: IHymnal;
    isSelected: boolean;
    onSelect: () => void;
    onOpenInfo: () => void;
    onOpenThematic: () => void;
    onRemove?: () => void;
}

const HymnalCard: React.FC<HymnalCardProps> = React.memo(({ hymnal, isSelected, onSelect, onOpenInfo, onOpenThematic, onRemove }) => {
    const [hovered, setHovered] = useState(false);
    const { isLive } = useHymnLiveState(undefined, hymnal.id);

    return (
        <div
            className={cn(
                'relative flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all group border apple-press',
                isSelected
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-white/2 border-transparent text-stone-300 hover:bg-white/5 hover:border-white/10'
            )}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onSelect}
        >
            {/* Cover thumbnail (2:3 ratio) */}
            <div className="shrink-0 w-8 rounded-xl overflow-hidden border border-white/10 shadow-md" style={{ aspectRatio: '2/3' }}>
                {hymnal.coverImageUrl ? (
                    <img
                        src={hymnal.coverImageUrl}
                        alt={hymnal.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                        <Music className="w-3 h-3 text-stone-600" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div
                    title={hymnal.name}
                    className={cn('text-xs font-bold truncate', isSelected ? 'text-accent' : 'text-stone-200')}
                >
                    {hymnal.name}
                </div>
                <div className="text-[10px] text-stone-500 truncate">
                    {hymnal.itemCount} {hymnal.language}
                </div>
            </div>

            {isLive && (
                <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shrink-0 uppercase tracking-wider">
                    LIVE
                </span>
            )}

            {/* Hover action buttons */}
            <div
                className={cn(
                    'flex items-center gap-1 shrink-0 transition-all duration-150',
                    hovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
                )}
            >
                <IconButton
                    icon={<ListTree className="w-3.5 h-3.5" />}
                    onClick={(e) => { e.stopPropagation(); onOpenThematic(); }}
                    size="xs"
                    variant="ghost"
                    label="Тематическое оглавление"
                />
                <IconButton
                    icon={<Info className="w-3.5 h-3.5" />}
                    onClick={(e) => { e.stopPropagation(); onOpenInfo(); }}
                    size="xs"
                    variant="ghost"
                    label="Информация о сборнике"
                />
                {!hymnal.isBuiltIn && onRemove && (
                    <IconButton
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        size="xs"
                        variant="danger"
                        label="Удалить сборник"
                    />
                )}
            </div>
        </div>
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
    onOpenInfo: (hymnal: IHymnal) => void;
    onOpenThematic: (hymnal: IHymnal) => void;
}

export const HymnalPickerModal: React.FC<DropdownProps> = ({
    hymnals,
    currentHymnalId,
    triggerRect,
    onSelect,
    onClose,
    onOpenInfo,
    onOpenThematic,
}) => {
    const { t } = useTranslation();
    const setRemoveModal = useSetAtom(removeHymnalModalAtom);
    const setCollisionModal = useSetAtom(importCollisionModalAtom);
    const setInstructionModal = useSetAtom(hymnalInstructionModalAtom);
    
    const orphanCount = useLiveQuery(() => db.audioScopes.filter(s => s.needsManualReview === true).count(), []) || 0;
    
    const [isImporting, setIsImporting] = useState(false);

    const languages = useMemo(() => Array.from(new Set(hymnals.map(h => h.language || 'ru'))).sort(), [hymnals]);
    const currentHymnalLang = useMemo(() => hymnals.find(h => h.id === currentHymnalId)?.language || languages[0], [hymnals, currentHymnalId, languages]);
    const [selectedLang, setSelectedLang] = useState<string>(currentHymnalLang);
    const filteredHymnals = useMemo(() => hymnals.filter(h => (h.language || 'ru') === selectedLang), [hymnals, selectedLang]);

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
            // open upwards
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

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

            {/* Dropdown content */}
            <div
                className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[520px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                style={position}
            >
                {/* Language Tabs */}
                {languages.length > 1 && (
                    <div className="flex items-center px-2 pt-2 border-b border-white/10 shrink-0">
                        {languages.map(lang => (
                            <button
                                key={lang}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedLang(lang); }}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] apple-press cursor-pointer',
                                    selectedLang === lang
                                        ? 'text-accent border-accent bg-accent/10'
                                        : 'text-stone-400 border-transparent hover:text-stone-200 hover:bg-white/5'
                                )}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                    {filteredHymnals.length === 0 ? (
                        <div className="py-6">
                            <EmptyState
                                icon={Music}
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
                                onOpenInfo={() => { onOpenInfo(hymnal); onClose(); }}
                                onOpenThematic={() => { onOpenThematic(hymnal); onClose(); }}
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
