import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Upload,
    HardDrive,
    Trash2,
    Edit3,
    Check,
    X,
    Star
} from 'lucide-react';
import { IPresentationFile } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CustomHymnStackIcon, CustomSlideStackIcon, PickerOptionCard } from '@/shared/ui';

interface PresentationListItemProps {
    pres: IPresentationFile;
    isActive: boolean;
    isRenaming: boolean;
    renameValue: string;
    setRenameValue: (val: string) => void;
    onStartRename: () => void;
    onCancelRename: () => void;
    onSaveRename: () => void;
    isEditingTags: boolean;
    setEditingTagsId: (id: string | null) => void;
    tagSearchInput: string;
    setTagSearchInput: (val: string) => void;
    allExistingTags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
    onToggleStar: () => void;
    onExport: () => void;
    onExportContextMenu?: (e: React.MouseEvent) => void;
    onDelete: () => void;
    onSelect: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

export const PresentationListItem: React.FC<PresentationListItemProps> = React.memo(({
    pres,
    isActive,
    isRenaming,
    renameValue,
    setRenameValue,
    onStartRename,
    onCancelRename,
    onSaveRename,
    isEditingTags,
    setEditingTagsId,
    tagSearchInput,
    setTagSearchInput,
    allExistingTags,
    onAddTag,
    onRemoveTag,
    onToggleStar,
    onExport,
    onExportContextMenu,
    onDelete,
    onSelect,
    onContextMenu,
}) => {
    const { t } = useTranslation();

    if (isRenaming || isEditingTags) {
        return (
            <div
                className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl transition-all text-left border",
                    isActive
                        ? "bg-accent/10 border-accent/20"
                        : "bg-white/5 border-white/10"
                )}
                onContextMenu={onContextMenu}
            >
                {isRenaming ? (
                    <div className="flex-1 flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <Input
                            size="xs"
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSaveRename();
                                if (e.key === 'Escape') onCancelRename();
                            }}
                            className="flex-1"
                        />
                        <Button
                            size="xs"
                            square
                            variant="ghost"
                            onClick={onSaveRename}
                            title={t('save', 'Save')}
                        >
                            <Check className="w-3.5 h-3.5 text-accent" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-2 p-2 bg-stone-950/80 rounded-xl border border-white/10 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                            {(pres.tags || []).map(tag => (
                                <span key={tag} className="flex items-center gap-1 text-[9px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                                    {tag}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveTag(tag);
                                        }}
                                        className="hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 relative">
                            <Input
                                size="xs"
                                autoFocus
                                value={tagSearchInput}
                                onChange={(e) => setTagSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        onAddTag(tagSearchInput);
                                    }
                                    if (e.key === 'Escape') {
                                        setEditingTagsId(null);
                                        setTagSearchInput('');
                                    }
                                }}
                                placeholder={t('add_tag', 'Add tag...')}
                                className="flex-1"
                            />
                            {tagSearchInput && (() => {
                                const query = tagSearchInput.toLowerCase();
                                const suggestions = allExistingTags.filter(tag =>
                                    tag.toLowerCase().includes(query) &&
                                    !(pres.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())
                                );
                                if (suggestions.length === 0) return null;
                                return (
                                    <div className="absolute left-0 right-0 bottom-full mb-1 max-h-24 overflow-y-auto bg-stone-950 border border-white/10 rounded-xl shadow-2xl z-50 no-scrollbar">
                                        {suggestions.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddTag(tag);
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-[10px] text-stone-300 hover:bg-accent/20 hover:text-white transition-colors cursor-pointer"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTagsId(null);
                                    setTagSearchInput('');
                                }}
                            >
                                <Check className="w-3.5 h-3.5 text-accent" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const leadingIcon = pres.thumbnailUrl ? (
        <img src={pres.thumbnailUrl} className="w-full h-full object-cover" alt="" />
    ) : pres.hymnalId ? (
        <CustomHymnStackIcon className="w-4 h-4" />
    ) : (
        <CustomSlideStackIcon className="w-4 h-4" />
    );

    return (
        <PickerOptionCard
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('application/json', JSON.stringify({
                    source: 'presentation-library',
                    presentationId: pres.id
                }));
                e.dataTransfer.effectAllowed = 'copyMove';
            }}
            title={pres.name}
            titleBadges={
                <>
                    {pres.isMaster && (
                        <span className="text-[8px] font-black bg-accent/20 text-accent px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0">
                            {t('master', 'Master')}
                        </span>
                    )}
                    {pres.fileHandle && (
                        <HardDrive className="w-3 h-3 text-accent shrink-0" />
                    )}
                </>
            }
            subtitle={t('slides_count', { count: pres.slides.length, defaultValue: '{{count}} slides' })}
            footer={
                pres.tags && pres.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {pres.tags.map(tag => (
                            <span key={tag} className="text-[8px] font-bold bg-white/5 text-stone-400 px-1.5 py-0.5 rounded-sm border border-white/5">
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : undefined
            }
            leading={leadingIcon}
            leadingBleed={Boolean(pres.thumbnailUrl)}
            isActive={isActive}
            onClick={onSelect}
            onContextMenu={onContextMenu}
            trailing={
                pres.isStarred ? (
                    <Button
                        size="xs"
                        square
                        variant="ghost"
                        onClick={onToggleStar}
                        title={t('unstar', 'Unstar')}
                    >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </Button>
                ) : undefined
            }
            hoverActions={
                <>
                    {!pres.isStarred && (
                        <Button
                            size="xs"
                            square
                            variant="ghost"
                            onClick={onToggleStar}
                            title={t('star', 'Star')}
                        >
                            <Star className="w-3.5 h-3.5 text-stone-500 hover:text-amber-400" />
                        </Button>
                    )}
                    <Button
                        size="xs"
                        square
                        variant="ghost"
                        onClick={onExport}
                        onContextMenu={(e) => {
                            if (!onExportContextMenu) return;
                            e.preventDefault();
                            e.stopPropagation();
                            onExportContextMenu(e);
                        }}
                        title={t('export_presentation_hint', 'Экспорт (.mrtp) · ПКМ — выбрать формат')}
                    >
                        <Upload className="w-3.5 h-3.5 text-stone-400 hover:text-accent" />
                    </Button>
                    {!pres.isMaster && (
                        <>
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={onStartRename}
                                title={t('rename', 'Rename')}
                            >
                                <Edit3 className="w-3.5 h-3.5 text-stone-400" />
                            </Button>
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={onDelete}
                                title={t('delete', 'Delete')}
                            >
                                <Trash2 className="w-3.5 h-3.5 text-stone-400 hover:text-red-400" />
                            </Button>
                        </>
                    )}
                </>
            }
        />
    );
});

PresentationListItem.displayName = 'PresentationListItem';
