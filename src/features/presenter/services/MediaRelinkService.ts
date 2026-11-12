import { db } from '@/core/db';
import { IMediaItem } from '@/core/types';
import { ipcService } from '@/core/services/ipcService';
import { readLocalFileSafe } from './mediaPackingUtils';
import { mediaCache } from '@/core/utils/mediaCache';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

/**
 * Service for single and batch relinking of missing media files.
 */
export class MediaRelinkService {
  /**
   * Relinks a single media item by prompting the user to pick the file.
   */
  static async relinkSingleItem(item: IMediaItem): Promise<boolean> {
    try {
      let newPath: string | null = null;
      let newBlob: Blob | undefined = undefined;

      if (ipcService.isElectron()) {
        const filters = item.type === 'video'
          ? [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] }]
          : item.type === 'audio'
          ? [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'] }]
          : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'] }];

        const filePaths = await ipcService.selectFile({
          title: i18n.t('media_pool.relink_select_title', 'Select replacement file for {{name}}', { name: item.name }),
          filters
        });
        if (filePaths && filePaths.length > 0) {
          newPath = filePaths[0];
        }
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = item.type === 'video' ? 'video/*' : item.type === 'audio' ? 'audio/*' : 'image/*';
        const file = await new Promise<File | null>(resolve => {
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });
        if (file) {
          newBlob = file;
          newPath = file.name;
        }
      }

      if (newPath || newBlob) {
        const fileName = newPath ? (newPath.split(/[/\\]/).pop() || item.name) : (newBlob as File)?.name || item.name;

        if (newPath && ipcService.isElectron()) {
          try {
            const loadedBlob = await readLocalFileSafe(newPath);
            if (loadedBlob) {
              newBlob = loadedBlob;
            }
          } catch (e) {
            console.warn('[MediaRelinkService] Failed to read blob for relinked file:', e);
          }
        }

        await db.mediaPool.update(item.id, {
          path: newPath || item.path,
          name: fileName,
          ...(newBlob ? { data: newBlob } : {}),
          isMissing: false,
          updatedAt: Date.now()
        });

        if (newBlob) {
          mediaCache.put(item.id, newBlob);
        }

        toast.success(i18n.t('media_pool.relink_success', 'File relinked successfully'));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[MediaRelinkService] Relink error:', err);
      toast.error(i18n.t('media_pool.relink_error', 'Failed to relink file'));
      return false;
    }
  }

  /**
   * Batch relinks multiple missing media items by searching a directory recursively.
   */
  static async batchRelinkFromFolder(missingItems: IMediaItem[]): Promise<{ relinkedCount: number; stillMissingCount: number }> {
    if (!missingItems || missingItems.length === 0) {
      return { relinkedCount: 0, stillMissingCount: 0 };
    }

    try {
      if (ipcService.isElectron()) {
        const folder = await ipcService.selectFolder();
        if (!folder) {
          return { relinkedCount: 0, stillMissingCount: missingItems.length };
        }

        toast.info(i18n.t('media_pool.batch_relink_scanning', 'Scanning folder for missing files...'));
        const files = await ipcService.readDirectoryRecursive(folder, ['*']);
        if (!files || files.length === 0) {
          toast.warning(i18n.t('media_pool.batch_relink_empty_dir', 'No matching files found in selected directory'));
          return { relinkedCount: 0, stillMissingCount: missingItems.length };
        }

        // Map filename -> full path
        const fileMap = new Map<string, string>();
        for (const filePath of files) {
          const base = filePath.split(/[/\\]/).pop()?.toLowerCase();
          if (base && !fileMap.has(base)) {
            fileMap.set(base, filePath);
          }
        }

        let relinkedCount = 0;
        for (const item of missingItems) {
          const itemName = item.name.toLowerCase();
          const itemOriginalBase = (item.path.split(/[/\\]/).pop() || '').toLowerCase();

          const matchedPath = fileMap.get(itemName) || fileMap.get(itemOriginalBase);
          if (matchedPath) {
            let loadedBlob: Blob | undefined;
            try {
              const b = await readLocalFileSafe(matchedPath);
              if (b) loadedBlob = b;
            } catch {
              // ignore
            }

            await db.mediaPool.update(item.id, {
              path: matchedPath,
              isMissing: false,
              ...(loadedBlob ? { data: loadedBlob } : {}),
              updatedAt: Date.now()
            });

            if (loadedBlob) {
              mediaCache.put(item.id, loadedBlob);
            }
            relinkedCount++;
          }
        }

        const stillMissingCount = missingItems.length - relinkedCount;
        if (relinkedCount > 0) {
          toast.success(i18n.t('media_pool.batch_relink_success', 'Successfully relinked {{count}} files', { count: relinkedCount }));
        } else {
          toast.warning(i18n.t('media_pool.batch_relink_none_found', 'No missing files matched in selected directory'));
        }

        return { relinkedCount, stillMissingCount };
      }

      // Web directory input fallback
      const input = document.createElement('input');
      input.type = 'file';
      const dirInput = input as HTMLInputElement & { webkitdirectory?: boolean; directory?: boolean };
      dirInput.webkitdirectory = true;
      dirInput.directory = true;

      const files = await new Promise<FileList | null>(resolve => {
        input.onchange = () => resolve(input.files || null);
        input.click();
      });

      if (!files || files.length === 0) {
        return { relinkedCount: 0, stillMissingCount: missingItems.length };
      }

      const fileMap = new Map<string, File>();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        fileMap.set(file.name.toLowerCase(), file);
      }

      let relinkedCount = 0;
      for (const item of missingItems) {
        const itemName = item.name.toLowerCase();
        const matchedFile = fileMap.get(itemName);
        if (matchedFile) {
          await db.mediaPool.update(item.id, {
            data: matchedFile,
            name: matchedFile.name,
            isMissing: false,
            updatedAt: Date.now()
          });
          mediaCache.put(item.id, matchedFile);
          relinkedCount++;
        }
      }

      const stillMissingCount = missingItems.length - relinkedCount;
      if (relinkedCount > 0) {
        toast.success(i18n.t('media_pool.batch_relink_success', 'Successfully relinked {{count}} files', { count: relinkedCount }));
      } else {
        toast.warning(i18n.t('media_pool.batch_relink_none_found', 'No missing files matched'));
      }

      return { relinkedCount, stillMissingCount };
    } catch (err) {
      console.error('[MediaRelinkService] Batch relink error:', err);
      toast.error(i18n.t('media_pool.relink_error', 'Failed to relink files'));
      return { relinkedCount: 0, stillMissingCount: missingItems.length };
    }
  }
}
