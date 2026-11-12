import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Star,
    Tag,
    Copy,
    Edit3,
    Upload,
    Trash2
} from 'lucide-react';
import { IPresentationFile } from '@/core/types';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { getUniquePresentationName } from '@/core/utils/nameUtils';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { cn } from '@/core/utils/cn';

interface PresentationContextMenuProps {
    contextMenu: {
        x: number;
        y: number;
        presentation: IPresentationFile;
    };
    onClose: () => void;
    activeServiceId: string | null;
    handleToggleStar: (id: string) => void;
    setEditingTagsId: (id: string | null) => void;
    setTagSearchInput: (val: string) => void;
    setRenamingId: (id: string | null) => void;
    setRenameValue: (val: string) => void;
    handleExportPresentation: (id: string) => void;
}

export const PresentationContextMenu: React.FC<PresentationContextMenuProps> = ({
    contextMenu,
    onClose,
    activeServiceId,
    handleToggleStar,
    setEditingTagsId,
    setTagSearchInput,
    setRenamingId,
    setRenameValue,
    handleExportPresentation,
}) => {
    const { t } = useTranslation();
    const { setActiveService, setActivePresentation, removePresentation } = usePresentationStore(
        useShallow(s => ({
            setActiveService: s.setActiveService,
            setActivePresentation: s.setActivePresentation,
            removePresentation: s.removePresentation
        }))
    );
    const openModal = useModalStore(s => s.openModal);

    return (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={onClose}
        >
            <ContextMenuItem
                icon={<Star className={cn("w-3 h-3", contextMenu.presentation.isStarred ? "fill-amber-400 text-amber-400" : "")} />}
                label={contextMenu.presentation.isStarred ? t('unstar', 'Unstar') : t('star', 'Star')}
                onClick={() => {
                    handleToggleStar(contextMenu.presentation.id);
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Tag className="w-3 h-3" />}
                label={t('manage_tags', 'Manage Tags...')}
                onClick={() => {
                    setEditingTagsId(contextMenu.presentation.id);
                    setTagSearchInput('');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Copy className="w-3 h-3" />}
                label={t('duplicate', 'Duplicate')}
                onClick={async () => {
                    const original = await db.presentationFiles.get(contextMenu.presentation.id);
                    if (original && activeServiceId) {
                        const newName = await getUniquePresentationName(original.name);
                        const clone = structuredClone(original);
                        const newId = crypto.randomUUID();
                        clone.id = newId;
                        clone.name = newName;
                        clone.isMaster = false;
                        clone.isStarred = false;
                        clone.serviceId = activeServiceId;
                        const now = new Date();
                        clone.createdAt = now;
                        clone.updatedAt = now;
                        clone.lastOpened = now;
                        await db.presentationFiles.add(clone);

                        const service = await db.serviceFiles.get(activeServiceId);
                        if (service) {
                            const updatedIds = [...service.presentationIds, newId];
                            await db.serviceFiles.update(activeServiceId, {
                                presentationIds: updatedIds,
                                updatedAt: now
                            });
                            await setActiveService(activeServiceId);
                            await setActivePresentation(newId);
                        }
                        toast.success(t('presentation_duplicated', 'Presentation duplicated'));
                    }
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Edit3 className="w-3 h-3" />}
                label={t('rename', 'Rename')}
                onClick={() => {
                    setRenamingId(contextMenu.presentation.id);
                    setRenameValue(contextMenu.presentation.name);
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<Upload className="w-3 h-3" />}
                label={t('export_presentation', 'Export (.ektp)')}
                onClick={() => {
                    handleExportPresentation(contextMenu.presentation.id);
                    onClose();
                }}
            />
            {!contextMenu.presentation.isMaster && (
                <>
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            openModal(ModalType.CONFIRM, {
                                title: t('confirm_delete', 'Confirm Delete'),
                                message: t('confirm_delete_presentation', 'Delete this presentation?'),
                                variant: 'danger',
                                onSelection: (confirmed: boolean) => {
                                    if (confirmed) {
                                        removePresentation(contextMenu.presentation.id);
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                </>
            )}
        </ContextMenu>
    );
};
