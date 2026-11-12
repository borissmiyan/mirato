import React from 'react';
import { Edit2, Download, Trash2, RefreshCw, Copy } from 'lucide-react';
import { TFunction } from 'i18next';
import { getUniquePresentationName } from '@/core/utils/nameUtils';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { ModalType } from '@/core/store/modalStore';
import { GraceLibExportService } from '@/features/presenter/services/GraceLibExportService';
import { db } from '@/core/db';
import { ITemplateNav } from './LibraryTemplatesSection';
import { ITemplate, ITemplateSlide, IPresentationBin, IPresentationFile } from '@/core/types';

export type LibraryContextMenuItem = {
    id?: string;
    name?: string;
    nameRu?: string;
    templateId?: string;
    mediaIds?: string[];
    slide?: ITemplateSlide;
    isSystem?: boolean;
    type?: string;
};

export interface LibraryContextMenuData {
    x: number;
    y: number;
    item: LibraryContextMenuItem;
    type: 'template' | 'media-bin' | 'template-slide' | 'presentation-bin' | 'presentation';
}

export interface LibraryContextMenuProps {
    contextMenu: LibraryContextMenuData | null;
    onClose: () => void;
    t: TFunction;
    isRu: boolean;
    devMode: boolean;
    openGlobalModal: (type: ModalType, props?: Record<string, unknown>) => void;
    updateTemplate: (id: string, data: Partial<ITemplate>, devMode: boolean) => void;
    renamePresentationBin: (id: string, name: string) => void;
    updateMediaBin: (id: string, data: Partial<{ name: string; mediaIds: string[] }>) => void;
    removeTemplate: (id: string, devMode: boolean) => Promise<void>;
    templateNavPath: ITemplateNav[];
    setTemplateNavPath: (path: ITemplateNav[]) => void;
    removePresentationBin: (id: string) => Promise<void>;
    presentationBinNavPath: string[];
    setPresentationBinNavPath: (path: string[]) => void;
    removeMediaBin: (id: string) => void;
    renameTemplateSlide: (templateId: string, slideId: string, name: string, devMode: boolean) => void;
    removeTemplateSlide: (templateId: string, slideId: string, devMode: boolean) => void;
    handleOverrideTemplateSlide: (template: ITemplate | { id: string }, slideId: string) => void;
}

export const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
    contextMenu,
    onClose,
    t,
    isRu,
    devMode,
    openGlobalModal,
    updateTemplate,
    renamePresentationBin,
    updateMediaBin,
    removeTemplate,
    templateNavPath,
    setTemplateNavPath,
    removePresentationBin,
    presentationBinNavPath,
    setPresentationBinNavPath,
    removeMediaBin,
    renameTemplateSlide,
    removeTemplateSlide,
    handleOverrideTemplateSlide
}) => {
    if (!contextMenu) return null;

    const itemId = contextMenu.item.id || '';
    const itemName = contextMenu.item.name || '';
    const itemTemplateId = contextMenu.item.templateId || '';
    const itemSlide = contextMenu.item.slide;

    return (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={onClose}
        >
            {contextMenu.type === 'template' || contextMenu.type === 'media-bin' || contextMenu.type === 'presentation-bin' ? (
                <>
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename', 'Rename')}
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('rename_item', 'New name:'),
                                defaultValue: isRu ? contextMenu.item.nameRu || itemName : itemName,
                                onSelection: (newName: string | null) => {
                                    if (newName && newName !== (isRu ? contextMenu.item.nameRu : itemName)) {
                                        if (contextMenu.type === 'template') {
                                            updateTemplate(itemId, isRu ? { nameRu: newName } : { name: newName }, devMode);
                                        } else if (contextMenu.type === 'presentation-bin') {
                                            renamePresentationBin(itemId, newName);
                                        } else {
                                            updateMediaBin(itemId, { name: newName });
                                        }
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Download className="w-3 h-3" />}
                        label={t('export', 'Export')}
                        onClick={() => {
                            GraceLibExportService.exportItem(itemId, contextMenu.type === 'template' ? 'template' : 'presentation', itemName);
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            openGlobalModal(ModalType.CONFIRM, {
                                title: t('confirm_delete', 'Confirm Delete'),
                                message: t('confirm_remove_item', 'Remove this item?'),
                                variant: 'danger',
                                onSelection: (confirmed: boolean) => {
                                    if (confirmed) {
                                        if (contextMenu.type === 'template') {
                                            removeTemplate(itemId, devMode).then(() => {
                                                if (templateNavPath.some(path => path.id === itemId)) {
                                                    setTemplateNavPath(templateNavPath.filter(path => path.id !== itemId));
                                                }
                                            });
                                        } else if (contextMenu.type === 'presentation-bin') {
                                            removePresentationBin(itemId).then(() => {
                                                if (presentationBinNavPath.includes(itemId)) {
                                                    setPresentationBinNavPath(presentationBinNavPath.slice(0, presentationBinNavPath.indexOf(itemId)));
                                                }
                                            });
                                        } else {
                                            removeMediaBin(itemId);
                                        }
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                </>
            ) : contextMenu.type === 'presentation' ? (
                <>
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename', 'Rename')}
                        onClick={() => {
                            openGlobalModal(ModalType.PROMPT, {
                                title: t('rename_presentation', 'New name:'),
                                defaultValue: itemName,
                                onSelection: (newName: string | null) => {
                                    if (newName) {
                                        db.presentationFiles.update(itemId, { name: newName });
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Copy className="w-3 h-3" />}
                        label={t('duplicate', 'Duplicate')}
                        onClick={async () => {
                            const original = await db.presentationFiles.get(itemId);
                            if (original) {
                                const newName = await getUniquePresentationName(original.name);
                                const clone = structuredClone(original);
                                clone.id = crypto.randomUUID();
                                clone.name = newName;
                                const now = new Date();
                                clone.createdAt = now;
                                clone.updatedAt = now;
                                clone.lastOpened = now;
                                await db.presentationFiles.add(clone);
                            }
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Download className="w-3 h-3" />}
                        label={t('export', 'Export')}
                        onClick={() => {
                            GraceLibExportService.exportItem(itemId, 'presentation', itemName);
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete', 'Delete')}
                        danger
                        onClick={() => {
                            openGlobalModal(ModalType.CONFIRM, {
                                title: t('confirm_delete', 'Confirm Delete'),
                                message: t('confirm_remove_presentation', 'Remove this presentation from library?'),
                                variant: 'danger',
                                onSelection: (confirmed: boolean) => {
                                    if (confirmed) {
                                        db.presentationFiles.delete(itemId);
                                    }
                                }
                            });
                            onClose();
                        }}
                    />
                </>
            ) : contextMenu.type === 'template-slide' ? (
                <>
                    <ContextMenuItem
                        icon={<RefreshCw className="w-3 h-3" />}
                        label={t('override_template_slide', "Override template's slide")}
                        onClick={() => {
                            if (itemSlide && itemTemplateId) {
                                handleOverrideTemplateSlide({ id: itemTemplateId }, itemSlide.id);
                            }
                            onClose();
                        }}
                    />
                    <div className="h-px bg-white/5 my-1 mx-2" />
                    <ContextMenuItem
                        icon={<Edit2 className="w-3 h-3" />}
                        label={t('rename_slide', 'Rename Slide')}
                        onClick={() => {
                            if (itemSlide) {
                                const currentName = isRu ? itemSlide.nameRu || itemSlide.name : itemSlide.name;
                                openGlobalModal(ModalType.PROMPT, {
                                    title: t('rename_slide', 'Rename Slide:'),
                                    defaultValue: currentName,
                                    onSelection: (newName: string | null) => {
                                        if (newName && newName !== currentName) {
                                            renameTemplateSlide(itemTemplateId, itemSlide.id, newName, devMode);
                                        }
                                    }
                                });
                            }
                            onClose();
                        }}
                    />
                    <ContextMenuItem
                        icon={<Trash2 className="w-3 h-3" />}
                        label={t('delete_slide', 'Delete Slide')}
                        danger
                        onClick={() => {
                            if (itemSlide) {
                                openGlobalModal(ModalType.CONFIRM, {
                                    title: t('confirm_delete_slide', 'Confirm Delete Slide'),
                                    message: t('confirm_remove_slide', 'Remove this slide from template?'),
                                    variant: 'danger',
                                    onSelection: (confirmed: boolean) => {
                                        if (confirmed) {
                                            removeTemplateSlide(itemTemplateId, itemSlide.id, devMode);
                                        }
                                    }
                                });
                            }
                            onClose();
                        }}
                    />
                </>
            ) : null}
        </ContextMenu>
    );
};
