import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaType } from '@/core/types';
import { IpcService } from '@/core/services/ipcService';
import { toast } from '@/core/utils/toast';
import { MediaPersistenceService } from '../services/MediaPersistenceService';

function getMediaTypeFromExtension(ext: string): MediaType {
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'aiff'].includes(ext)) return 'audio';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  return 'image';
}

/**
 * Hook to handle importing media into the Media Pool via native file dialog
 * or operating system drag-and-drop.
 */
export function useMediaImport(activeBinId: string | null) {
  const { t } = useTranslation();
  const [isOsDraggingOver, setIsOsDraggingOver] = useState(false);

  const importDroppedFiles = useCallback(async (files: FileList | File[], targetBinId?: string | null) => {
    if (!files || files.length === 0) return;

    let importedCount = 0;
    let skippedCount = 0;
    const bin = targetBinId !== undefined ? targetBinId : activeBinId;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as File & { path?: string }).path;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const type = getMediaTypeFromExtension(ext);

      try {
        let newId: string | null = null;
        if (filePath && IpcService.isElectron()) {
          newId = await MediaPersistenceService.importMediaFromPath(filePath, type, {
            binId: bin ?? undefined
          });
        } else {
          newId = await MediaPersistenceService.importMediaBlob(file, file.name, type, {
            binId: bin ?? undefined
          });
        }

        if (newId) importedCount++;
        else skippedCount++;
      } catch (err) {
        console.error('Failed to import file:', file.name, err);
      }
    }

    if (importedCount > 0) {
      toast.success(t('media_imported', 'Imported {{count}} files', { count: importedCount }));
    } else if (skippedCount > 0) {
      toast.info(t('media_skipped', 'Skipped {{count}} already imported files', { count: skippedCount }));
    }
  }, [activeBinId, t]);

  const handleImportMedia = useCallback(async () => {
    if (!IpcService.isElectron()) return;
    try {
      const files = await IpcService.selectFile({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Media Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }
        ]
      });

      if (!files) return;
      const filePaths = Array.isArray(files) ? files : [files];

      let importedCount = 0;
      let skippedCount = 0;

      for (const filePath of filePaths) {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const type = getMediaTypeFromExtension(ext);

        const newId = await MediaPersistenceService.importMediaFromPath(filePath, type, {
          binId: activeBinId ?? undefined
        });

        if (newId) importedCount++;
        else skippedCount++;
      }

      if (importedCount > 0) {
        const message = t('media_imported', 'Imported {{count}} files', { count: importedCount }) +
          (skippedCount > 0 ? ` (${t('skipped_count', '{{count}} skipped', { count: skippedCount })})` : '');
        toast.success(message);
      } else if (skippedCount > 0) {
        toast.info(t('media_skipped', 'Skipped {{count}} already imported files', { count: skippedCount }));
      }
    } catch (error) {
      console.error('Failed to import media:', error);
      toast.error(t('import_error', 'Failed to import media'));
    }
  }, [activeBinId, t]);

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsOsDraggingOver(true);
    }
  }, []);

  const handlePanelDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOsDraggingOver(false);
    }
  }, []);

  const handlePanelDrop = useCallback(async (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsOsDraggingOver(false);
      if (e.dataTransfer.files.length > 0) {
        await importDroppedFiles(e.dataTransfer.files, activeBinId);
      }
    }
  }, [activeBinId, importDroppedFiles]);

  return {
    isOsDraggingOver,
    setIsOsDraggingOver,
    handleImportMedia,
    importDroppedFiles,
    handlePanelDragOver,
    handlePanelDragLeave,
    handlePanelDrop
  };
}

