import { useState, useCallback } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { toast } from '@/core/utils/toast';
import { useTranslation } from 'react-i18next';

interface UseCanvasMediaDropProps {
  slideId: string;
  getContainerRect: () => { left: number; top: number; width: number; height: number } | DOMRect;
}

export function useCanvasMediaDrop({ slideId, getContainerRect }: UseCanvasMediaDropProps) {
  const { t } = useTranslation();
  const [isShiftDropActive, setIsShiftDropActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault();
      if (e.shiftKey !== isShiftDropActive) setIsShiftDropActive(e.shiftKey);
    }
  }, [isShiftDropActive]);

  const handleDragLeave = useCallback(() => {
    setIsShiftDropActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wasShift = e.shiftKey || isShiftDropActive;
    setIsShiftDropActive(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.source === 'media-pool' && (data.media.type === 'image' || data.media.type === 'video')) {
        if (wasShift) {
          await usePresentationStore.getState().setMediaBackground(slideId, data.media);
          toast.success(t('background_updated', 'Slide background updated'));
        } else {
          const rect = getContainerRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          await usePresentationStore.getState().addMediaLayer(slideId, data.media, { x, y });
        }
      }
    } catch (err) {
      console.error('Failed to parse drop data', err);
    }
  }, [slideId, isShiftDropActive, getContainerRect, t]);

  return {
    isShiftDropActive,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

