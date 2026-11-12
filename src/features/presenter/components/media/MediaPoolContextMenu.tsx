import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2, FolderOpen, RefreshCw, Presentation, CopyPlus, XCircle, Eye, Image as ImageIcon, Download, X } from 'lucide-react';
import { db } from '@/core/db';
import { IMediaItem, IMediaBin, MediaColorTag } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { MediaPersistenceService } from '../../services/MediaPersistenceService';
import { ipcService } from '@/core/services/ipcService';
import { toast } from '@/core/utils/toast';
import { MediaRelinkService } from '../../services/MediaRelinkService';
import { MediaExportService } from '../../services/MediaExportService';
import { usePresentationStore } from '../../store/presentationStore';
import { createSlideFromMediaItem, createBackgroundLayerFromMedia } from '../../utils/mediaSlideUtils';
import { cn } from '@/core/utils/cn';

export interface IMediaContextMenu { x: number; y: number; kind: 'item'; item: IMediaItem; }
export interface IBinContextMenu { x: number; y: number; kind: 'bin'; bin: IMediaBin; }
export type ContextMenuState = IMediaContextMenu | IBinContextMenu | null;

export const TAG_COLORS: Record<MediaColorTag, { bg: string; name: string }> = {
  red:    { bg: 'bg-red-500',    name: 'Red' },
  orange: { bg: 'bg-orange-500', name: 'Orange' },
  yellow: { bg: 'bg-amber-400',  name: 'Yellow' },
  green:  { bg: 'bg-emerald-500', name: 'Green' },
  blue:   { bg: 'bg-blue-500',   name: 'Blue' },
  purple: { bg: 'bg-purple-500', name: 'Purple' },
};

interface MediaPoolContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  selectedIds: Set<string>;
  handleBulkDelete: () => void;
  activeBinId: string | null;
  setActiveBinId: (id: string | null) => void;
  bins?: IMediaBin[];
  mediaItems?: IMediaItem[];
  onClearSelection?: () => void;
  onQuickLook?: (item: IMediaItem) => void;
}

export const MediaPoolContextMenu: React.FC<MediaPoolContextMenuProps> = ({
  contextMenu,
  onClose,
  selectedIds,
  handleBulkDelete,
  activeBinId,
  setActiveBinId,
  bins = [],
  mediaItems = [],
  onClearSelection,
  onQuickLook
}) => {
  const { t } = useTranslation();
  const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));
  const activeServiceId = usePresentationStore(s => s.activeServiceId);
  const activePresentationId = usePresentationStore(s => s.activePresentationId);
  const activePresentation = usePresentationStore(s => s.activePresentation);
  const previewSlideId = usePresentationStore(s => s.previewSlideId);
  const updateSlideBackground = usePresentationStore(s => s.updateSlideBackground);
  const createPresentation = usePresentationStore(s => s.createPresentation);
  const updatePresentationSlides = usePresentationStore(s => s.updatePresentationSlides);
  const setActivePresentation = usePresentationStore(s => s.setActivePresentation);

  const handleRelink = async (item: IMediaItem) => {
    await MediaRelinkService.relinkSingleItem(item);
  };

  const handleRevealInFolder = async (item: IMediaItem) => {
    if (ipcService.isElectron() && item.path) {
      const success = await ipcService.showItemInFolder(item.path);
      if (!success) {
        toast.error(t('media_pool.reveal_failed', 'File not found on disk'));
      }
    }
  };

  const isMultiple = Boolean(
    selectedIds.size > 1 &&
    contextMenu &&
    contextMenu.kind === 'item' &&
    selectedIds.has(contextMenu.item.id)
  );

  const targetItems = React.useMemo(() => {
    if (!contextMenu || contextMenu.kind !== 'item') return [];
    if (isMultiple && mediaItems.length > 0) {
      const selectedSet = selectedIds;
      return mediaItems.filter(i => selectedSet.has(i.id));
    }
    return [contextMenu.item];
  }, [contextMenu, isMultiple, mediaItems, selectedIds]);

  const handleCreatePresentation = (items: IMediaItem[]) => {
    if (items.length === 0) return;
    const defaultTitle = items.length === 1
      ? items[0].name.replace(/\.[^/.]+$/, '')
      : `${t('presentation', 'Presentation')} (${new Date().toLocaleDateString()})`;

    openModal(ModalType.PROMPT, {
      title: items.length > 1
        ? t('media_pool.create_presentation_multiple', 'Create Presentation from Media ({{count}})', { count: items.length })
        : t('media_pool.create_presentation', 'Create Presentation from Media'),
      defaultValue: defaultTitle,
      onSelection: async (name: string | null) => {
        if (!name) return;
        try {
          const targetServiceId = activeServiceId || activePresentation?.serviceId || undefined;
          const presId = await createPresentation(name, { serviceId: targetServiceId });
          const slides = items.map((item, idx) => createSlideFromMediaItem(item, idx));
          await updatePresentationSlides(presId, slides);
          await setActivePresentation(presId);
          toast.success(t('media_pool.presentation_created', 'Presentation "{{name}}" created', { name }));
        } catch (err) {
          console.error('[MediaPoolContextMenu] Failed to create presentation:', err);
          toast.error(t('error_create_presentation', 'Failed to create presentation'));
        }
      }
    });
  };

  const handleAddToActivePresentation = async (items: IMediaItem[]) => {
    if (items.length === 0 || !activePresentationId || !activePresentation) return;
    try {
      const currentSlides = activePresentation.slides || [];
      const newSlides = items.map((item, idx) => createSlideFromMediaItem(item, currentSlides.length + idx));
      await updatePresentationSlides(activePresentationId, [...currentSlides, ...newSlides]);
    } catch (err) {
      console.error('[MediaPoolContextMenu] Failed to add slides:', err);
      toast.error(t('error_add_slide_failed', 'Failed to add slides'));
    }
  };

  const handleMoveToRoot = async () => {
    const targetIds = targetItems.map(i => i.id);
    await db.mediaPool.where('id').anyOf(targetIds).modify({ binId: undefined });
    toast.success(t('media_pool.moved_to_root', 'Moved to root'));
    onClose();
  };

  const handleMoveToBin = async (bin: IMediaBin) => {
    const targetIds = targetItems.map(i => i.id);
    await db.mediaPool.where('id').anyOf(targetIds).modify({ binId: bin.id });
    toast.success(t('media_pool.moved_to_bin', 'Moved to {{name}}', { name: bin.name }));
    onClose();
  };

  const handleSetAsSlideBackground = async (item: IMediaItem) => {
    if (!previewSlideId) return;
    try {
      const layer = createBackgroundLayerFromMedia(item);
      await updateSlideBackground(previewSlideId, [layer]);
      toast.success(t('media_pool.background_set', 'Set as slide background'));
    } catch (err) {
      console.error('[MediaPoolContextMenu] Failed to set background:', err);
      toast.error(t('error_update_background', 'Failed to update background'));
    }
  };

  const handleSetColorTag = async (colorTag?: MediaColorTag) => {
    const targetIds = targetItems.map(i => i.id);
    await db.mediaPool.where('id').anyOf(targetIds).modify({ colorTag });
  };

  const handleDelete = () => {
    if (isMultiple) {
      handleBulkDelete();
    } else if (contextMenu?.kind === 'item') {
      openModal(ModalType.CONFIRM, {
        title: t('media_pool.delete', 'Delete Asset'),
        message: t('media_pool.confirm_delete', 'Delete this asset?'),
        onSelection: (confirmed: boolean) => {
          if (confirmed) MediaPersistenceService.deleteMedia(contextMenu.item.id);
        }
      });
    }
    onClose();
  };

  if (!contextMenu) return null;

  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={onClose}
    >
      {contextMenu.kind === 'item' && (
        <>
          {/* Apple HIG Color Tag Selector */}
          <div className="flex items-center gap-2 px-3.5 h-12 min-h-[48px] border-b border-white/5">
            <span className="text-xs text-stone-400 font-medium mr-1">{t('media_pool.tags', 'Tags')}:</span>
            {(['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as MediaColorTag[]).map(color => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  handleSetColorTag(color);
                  onClose();
                }}
                className={cn(
                  "w-6 h-6 rounded-full transition-transform hover:scale-125 cursor-pointer border border-white/20 active:scale-95",
                  TAG_COLORS[color].bg,
                  targetItems.length > 0 && targetItems.every(i => i.colorTag === color) && "ring-2 ring-white scale-110"
                )}
                title={TAG_COLORS[color].name}
                aria-label={TAG_COLORS[color].name}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                handleSetColorTag(undefined);
                onClose();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold active:scale-95"
              title={t('media_pool.clear_tag', 'Clear tag')}
              aria-label={t('media_pool.clear_tag', 'Clear tag')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isMultiple ? (
            <>
              <ContextMenuItem
                icon={<Presentation className="w-3 h-3 text-accent" />}
                label={t('media_pool.create_presentation_multiple', 'Create Presentation ({{count}})', { count: targetItems.length })}
                onClick={() => {
                  handleCreatePresentation(targetItems);
                  onClose();
                }}
              />
              {activePresentationId && (
                <ContextMenuItem
                  icon={<CopyPlus className="w-3 h-3 text-sky-400" />}
                  label={t('media_pool.add_to_current_presentation_multiple', 'Add to Current Presentation ({{count}})', { count: targetItems.length })}
                  onClick={() => {
                    handleAddToActivePresentation(targetItems);
                    onClose();
                  }}
                />
              )}
              <ContextMenuItem
                icon={<Download className="w-3 h-3 text-sky-400" />}
                label={t('media_pool.export_to_disk_multiple', 'Save to Disk ({{count}})...', { count: targetItems.length })}
                onClick={() => {
                  MediaExportService.exportMultipleItems(targetItems);
                  onClose();
                }}
              />
              <div className="my-1 border-t border-white/5" />
              {targetItems.some(i => !!i.binId) && (
                <ContextMenuItem
                  icon={<FolderOpen className="w-3 h-3 text-amber-500/80" />}
                  label={t('media_pool.move_to_root', 'Move to Root')}
                  onClick={handleMoveToRoot}
                />
              )}
              {bins.map(bin => (
                <ContextMenuItem
                  key={bin.id}
                  icon={<FolderOpen className="w-3 h-3 text-amber-500/80" />}
                  label={t('media_pool.move_to_bin', 'Move to {{name}}', { name: bin.name })}
                  onClick={() => handleMoveToBin(bin)}
                />
              ))}
              <div className="my-1 border-t border-white/5" />
              {onClearSelection && (
                <ContextMenuItem
                  icon={<XCircle className="w-3 h-3 text-stone-400" />}
                  label={t('media_pool.clear_selection', 'Clear Selection')}
                  onClick={() => {
                    onClearSelection();
                    onClose();
                  }}
                />
              )}
              <ContextMenuItem
                icon={<Trash2 className="w-3 h-3" />}
                label={t('media_pool.delete_multiple', 'Delete Selected ({{count}})', { count: targetItems.length })}
                danger
                onClick={handleDelete}
              />
            </>
          ) : (
            <>
              {onQuickLook && !contextMenu.item.isMissing && (
                <ContextMenuItem
                  icon={<Eye className="w-3 h-3" />}
                  label={t('media_pool.quick_look', 'Quick Look')}
                  shortcut="Shift+Space"
                  onClick={() => {
                    onQuickLook(contextMenu.item);
                    onClose();
                  }}
                />
              )}
              {ipcService.isElectron() && contextMenu.item.path && !contextMenu.item.isMissing && (
                <ContextMenuItem
                  icon={<FolderOpen className="w-3 h-3" />}
                  label={t('media_pool.reveal_in_finder', 'Show in Folder')}
                  onClick={() => {
                    handleRevealInFolder(contextMenu.item);
                    onClose();
                  }}
                />
              )}
              <ContextMenuItem
                icon={<RefreshCw className="w-3 h-3" />}
                label={t('media_pool.relink', 'Relink File...')}
                onClick={() => {
                  handleRelink(contextMenu.item);
                  onClose();
                }}
              />
              <ContextMenuItem
                icon={<Edit2 className="w-3 h-3" />}
                label={t('media_pool.rename', 'Rename')}
                onClick={() => {
                  openModal(ModalType.PROMPT, {
                    title: t('media_pool.rename', 'Rename Asset'),
                    defaultValue: contextMenu.item.name,
                    onSelection: (name: string | null) => {
                      if (name) db.mediaPool.update(contextMenu.item.id, { name });
                    }
                  });
                  onClose();
                }}
              />
              <div className="my-1 border-t border-white/5" />
              <ContextMenuItem
                icon={<Presentation className="w-3 h-3 text-accent" />}
                label={t('media_pool.create_presentation', 'Create Presentation from Media')}
                onClick={() => {
                  handleCreatePresentation([contextMenu.item]);
                  onClose();
                }}
              />
              {activePresentationId && (
                <ContextMenuItem
                  icon={<CopyPlus className="w-3 h-3 text-sky-400" />}
                  label={t('media_pool.add_to_current_presentation', 'Add to Current Presentation')}
                  onClick={() => {
                    handleAddToActivePresentation([contextMenu.item]);
                    onClose();
                  }}
                />
              )}
              <ContextMenuItem
                icon={<Download className="w-3 h-3 text-sky-400" />}
                label={t('media_pool.export_to_disk', 'Save to Disk...')}
                onClick={() => {
                  MediaExportService.exportSingleItem(contextMenu.item);
                  onClose();
                }}
              />
              {activePresentationId && previewSlideId && (contextMenu.item.type === 'image' || contextMenu.item.type === 'video') && (
                <ContextMenuItem
                  icon={<ImageIcon className="w-3 h-3 text-emerald-400" />}
                  label={t('media_pool.set_as_background', 'Set as Slide Background')}
                  onClick={() => {
                    handleSetAsSlideBackground(contextMenu.item);
                    onClose();
                  }}
                />
              )}
              <div className="my-1 border-t border-white/5" />
              {contextMenu.item.binId && (
                <ContextMenuItem
                  icon={<FolderOpen className="w-3 h-3 text-amber-500/80" />}
                  label={t('media_pool.move_to_root', 'Move to Root')}
                  onClick={handleMoveToRoot}
                />
              )}
              {bins.filter(b => b.id !== contextMenu.item.binId).map(bin => (
                <ContextMenuItem
                  key={bin.id}
                  icon={<FolderOpen className="w-3 h-3 text-amber-500/80" />}
                  label={t('media_pool.move_to_bin', 'Move to {{name}}', { name: bin.name })}
                  onClick={() => handleMoveToBin(bin)}
                />
              ))}
              <div className="my-1 border-t border-white/5" />
              <ContextMenuItem
                icon={<Trash2 className="w-3 h-3" />}
                label={t('media_pool.delete', 'Delete')}
                danger
                onClick={handleDelete}
              />
            </>
          )}
        </>
      )}
      {contextMenu.kind === 'bin' && (
        <>
          <ContextMenuItem
            icon={<Edit2 className="w-3 h-3" />}
            label={t('media_pool.rename_bin', 'Rename Bin')}
            onClick={() => {
              openModal(ModalType.PROMPT, {
                title: t('media_pool.rename_bin', 'Rename Bin'),
                defaultValue: contextMenu.bin.name,
                onSelection: (name: string | null) => {
                  if (name) db.mediaBins.update(contextMenu.bin.id, { name });
                }
              });
              onClose();
            }}
          />
          <ContextMenuItem
            icon={<Trash2 className="w-3 h-3" />}
            label={t('media_pool.delete_bin', 'Delete Bin')}
            danger
            onClick={() => {
              openModal(ModalType.CONFIRM, {
                title: t('media_pool.delete_bin', 'Delete Bin'),
                message: t('media_pool.confirm_delete_bin', 'Delete this bin and move items to root?'),
                onSelection: async (confirmed: boolean) => {
                  if (confirmed) {
                    await db.mediaPool.where('binId').equals(contextMenu.bin.id).modify({ binId: undefined });
                    await db.mediaBins.delete(contextMenu.bin.id);
                    if (activeBinId === contextMenu.bin.id) setActiveBinId(null);
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
