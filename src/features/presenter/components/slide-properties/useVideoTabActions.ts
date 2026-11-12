import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IVideoSettings, VIDEO_MAX_FILE_SIZE } from '@/core/types';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { IpcService } from '@/core/services/ipcService';
import { ffmpegService } from '@/core/services/ffmpegService';
import { extractPosterFrame } from '@/core/utils/videoUtils';
import { mediaCache } from '@/core/utils/mediaCache';

export const useVideoTabActions = (
  settings: IVideoSettings,
  onUpdate: (updates: Partial<IVideoSettings>) => void
) => {
  const { t } = useTranslation();
  const { openModal } = useModalStore(useShallow(s => ({ openModal: s.openModal })));
  const [isTrimming, setIsTrimming] = useState(false);

  /**
   * Import a video from the filesystem.
   */
  const handleImportFile = useCallback(async () => {
    try {
      const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
      let mediaId: string | null = null;

      if (IpcService.isElectron()) {
        const files = await IpcService.selectFile({
          filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }]
        });
        if (!files || files.length === 0) return;
        
        mediaId = await MediaPersistenceService.importMediaFromPath(files[0], 'video');
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });

        if (!file) return;

        if (file.size > VIDEO_MAX_FILE_SIZE) {
          toast.error(t('video_too_large', 'Video file exceeds the 500 MB limit'));
          return;
        }

        mediaId = await MediaPersistenceService.importMediaBlob(file, null, 'video');
      }

      if (!mediaId) return;

      let posterFrame: string | undefined;
      const videoUrl = await mediaCache.getBackgroundUrl(mediaId);
      if (videoUrl) {
        posterFrame = await extractPosterFrame(videoUrl);
      }
      onUpdate({ mediaId, ...(posterFrame ? { posterFrame } : {}) });

      toast.success(t('video_imported', 'Video imported successfully'));
    } catch (error) {
      console.error('[VideoTabContent] Import failed:', error);
      toast.error(t('video_import_failed', 'Failed to import video'));
    }
  }, [onUpdate, t]);

  /**
   * Select a video from the media pool.
   */
  const handleSelectFromPool = useCallback(() => {
    openModal(ModalType.AUDIO_PICKER, {
      filterType: 'video',
      onSelect: async (mediaId: string) => {
        let posterFrame: string | undefined;
        const videoUrl = await mediaCache.getBackgroundUrl(mediaId);
        if (videoUrl) {
          posterFrame = await extractPosterFrame(videoUrl);
        }
        onUpdate({ mediaId, ...(posterFrame ? { posterFrame } : {}) });
      },
    });
  }, [openModal, onUpdate]);

  /**
   * Physically trim video file using ffmpeg.
   */
  const handleApplyTrim = useCallback(async () => {
    if (!settings.mediaId || !settings.trimStart || !settings.trimEnd) return;
    
    try {
      setIsTrimming(true);
      toast.info(t('trimming_video_start', 'Trimming video, please wait...'));

      const trimmedBlob = await ffmpegService.trimMediaById(
        settings.mediaId,
        settings.trimStart,
        settings.trimEnd
      );

      if (!trimmedBlob) {
        throw new Error("Failed to trim media");
      }

      const original = await db.mediaPool.get(settings.mediaId);
      const newName = original ? `${original.name} (Trimmed)` : 'Trimmed Video';

      const { MediaPersistenceService } = await import('../../services/MediaPersistenceService');
      const newMediaId = await MediaPersistenceService.importMediaBlob(
        trimmedBlob, 
        newName, 
        'video'
      );

      if (!newMediaId) {
        throw new Error("Failed to persist trimmed video");
      }

      let posterFrame: string | undefined;
      const videoUrl = await mediaCache.getBackgroundUrl(newMediaId);
      if (videoUrl) {
        posterFrame = await extractPosterFrame(videoUrl);
      }

      onUpdate({ 
        mediaId: newMediaId, 
        ...(posterFrame ? { posterFrame } : {}),
        trimStart: 0,
        trimEnd: 0
      });

      toast.success(t('video_trimmed_success', 'Video physically trimmed successfully!'));
    } catch (error: unknown) {
      console.error('[VideoTabContent] Trim failed:', error);
      toast.error(t('video_trim_failed', 'Failed to trim video. Check console.'));
    } finally {
      setIsTrimming(false);
    }
  }, [settings.mediaId, settings.trimStart, settings.trimEnd, onUpdate, t]);

  return {
    handleImportFile,
    handleSelectFromPool,
    handleApplyTrim,
    isTrimming,
  };
};
