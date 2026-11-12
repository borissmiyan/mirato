import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { IMediaBin } from '@/core/types';

interface MediaPoolBreadcrumbProps {
  activeBinId: string | null;
  activeBin: IMediaBin | null | undefined;
  binPath?: IMediaBin[];
  draggingOverId: string | null;
  setActiveBinId: (id: string | null) => void;
  setDraggingOverId: (id: string | null) => void;
  handleBinDrop: (e: React.DragEvent, binId: string | undefined) => void;
}

export const MediaPoolBreadcrumb: React.FC<MediaPoolBreadcrumbProps> = ({
  activeBinId,
  activeBin,
  binPath = [],
  draggingOverId,
  setActiveBinId,
  setDraggingOverId,
  handleBinDrop
}) => {
  const { t } = useTranslation();

  if (!activeBinId) return null;

  const path = binPath.length > 0 ? binPath : (activeBin ? [activeBin] : []);

  return (
    <div className="flex items-center gap-1 mb-1.5 shrink-0 text-[10px] overflow-x-auto no-scrollbar">
      <button
        type="button"
        onClick={() => setActiveBinId(null)}
        onDragOver={(e) => { e.preventDefault(); setDraggingOverId('root'); }}
        onDragLeave={() => setDraggingOverId(null)}
        onDrop={(e) => handleBinDrop(e, undefined)}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0",
          draggingOverId === 'root' ? "bg-accent/20 text-accent font-bold" : "text-stone-500 hover:text-stone-300"
        )}
      >
        <ChevronLeft className="w-3 h-3" />
        <span>{t('media_pool.root', 'Media Pool')}</span>
      </button>

      {path.map((bin, idx) => {
        const isLast = idx === path.length - 1;
        const isDragging = draggingOverId === bin.id;

        return (
          <React.Fragment key={bin.id}>
            <ArrowRight className="w-2.5 h-2.5 text-stone-600 shrink-0" />
            {isLast ? (
              <span className="text-stone-200 font-semibold truncate shrink-0 max-w-[120px]">
                {bin.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setActiveBinId(bin.id)}
                onDragOver={(e) => { e.preventDefault(); setDraggingOverId(bin.id); }}
                onDragLeave={() => setDraggingOverId(null)}
                onDrop={(e) => handleBinDrop(e, bin.id)}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0 max-w-[100px] truncate",
                  isDragging ? "bg-accent/20 text-accent font-bold" : "text-stone-400 hover:text-stone-200"
                )}
              >
                {bin.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
