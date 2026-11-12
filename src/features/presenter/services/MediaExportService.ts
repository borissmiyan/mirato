import { db } from '@/core/db';
import { IMediaItem } from '@/core/types';
import { ipcService } from '@/core/services/ipcService';
import { readLocalFileSafe } from './mediaPackingUtils';
import { getLocalResourceUrl } from '@/core/hooks/useMediaUrl';
import { toast } from '@/core/utils/toast';
import i18n from '@/core/i18n';

/**
 * Service for exporting/saving media pool items to local disk.
 * Supports both Electron (native file/folder dialogs) and Web (File System Access or blob download).
 */
export class MediaExportService {
  /**
   * Retrieves the raw Blob for a media item from cache, IndexedDB, or local filesystem.
   */
  static async getItemBlob(item: IMediaItem): Promise<Blob | null> {
    try {
      // 1. Check if item has embedded binary Blob
      if (item.data instanceof Blob) {
        return item.data;
      }
      const poolItem = await db.mediaPool.get(item.id);
      if (poolItem?.data instanceof Blob) {
        return poolItem.data;
      }

      // 2. Electron local file read
      if (ipcService.isElectron() && item.path) {
        const localBlob = await readLocalFileSafe(item.path);
        if (localBlob) return localBlob;
      }

      // 3. Fallback to resource URL streaming fetch
      const url = getLocalResourceUrl(item.path);
      if (url) {
        const response = await fetch(url);
        if (response.ok) {
          return await response.blob();
        }
      }
    } catch (err) {
      console.warn(`[MediaExportService] Failed to get blob for ${item.name}:`, err);
    }
    return null;
  }

  /**
   * Triggers a web-based download of a blob.
   */
  private static triggerWebDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Exports a single media item to disk.
   */
  static async exportSingleItem(item: IMediaItem): Promise<boolean> {
    try {
      const blob = await this.getItemBlob(item);
      if (!blob) {
        toast.error(i18n.t('media_pool.export_failed_not_found', 'Could not retrieve file data for export'));
        return false;
      }

      const filename = item.name || 'media_item';

      // Electron native Save Dialog
      if (ipcService.isElectron()) {
        const uint8Array = new Uint8Array(await blob.arrayBuffer());
        const ext = filename.split('.').pop() || '';
        const saved = await ipcService.invoke<boolean>('export:save-file', {
          filename,
          data: uint8Array,
          title: i18n.t('media_pool.export_save_title', 'Save Media File'),
          filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : []
        });

        if (saved) {
          toast.success(i18n.t('media_pool.export_success', 'File saved successfully'));
          return true;
        }
        return false; // User cancelled
      }

      // Web File System Access API
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker?.({
            suggestedName: filename
          });
          if (handle) {
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast.success(i18n.t('media_pool.export_success', 'File saved successfully'));
            return true;
          }
        } catch (e: unknown) {
          if ((e as { name?: string })?.name === 'AbortError') return false;
        }
      }

      // Web download fallback
      this.triggerWebDownload(blob, filename);
      toast.success(i18n.t('media_pool.export_success', 'File downloaded'));
      return true;
    } catch (err) {
      console.error('[MediaExportService] Single export error:', err);
      toast.error(i18n.t('media_pool.export_error', 'Failed to save file to disk'));
      return false;
    }
  }

  /**
   * Exports multiple media items to a selected directory.
   */
  static async exportMultipleItems(items: IMediaItem[]): Promise<boolean> {
    if (!items || items.length === 0) return false;

    try {
      if (ipcService.isElectron()) {
        const folder = await ipcService.selectFolder();
        if (!folder) return false; // cancelled

        const filesData: { filename: string; data: Uint8Array }[] = [];
        for (const item of items) {
          const blob = await this.getItemBlob(item);
          if (blob) {
            filesData.push({
              filename: item.name,
              data: new Uint8Array(await blob.arrayBuffer())
            });
          }
        }

        if (filesData.length === 0) {
          toast.error(i18n.t('media_pool.export_no_data', 'No files could be exported'));
          return false;
        }

        const success = await ipcService.invoke<boolean>('export:save-collection', {
          folderPath: folder,
          files: filesData
        });

        if (success) {
          toast.success(i18n.t('media_pool.export_batch_success', 'Exported {{count}} files to folder', { count: filesData.length }));
          return true;
        }
        toast.error(i18n.t('media_pool.export_error', 'Failed to save files'));
        return false;
      }

      // Web fallback: download sequentially
      for (const item of items) {
        const blob = await this.getItemBlob(item);
        if (blob) {
          this.triggerWebDownload(blob, item.name);
          await new Promise(r => setTimeout(r, 200));
        }
      }
      toast.success(i18n.t('media_pool.export_batch_success', 'Downloaded {{count}} files', { count: items.length }));
      return true;
    } catch (err) {
      console.error('[MediaExportService] Batch export error:', err);
      toast.error(i18n.t('media_pool.export_error', 'Failed to export files'));
      return false;
    }
  }
}
