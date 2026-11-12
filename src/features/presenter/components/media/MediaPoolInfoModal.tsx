import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, HardDrive, FolderOpen, Image as ImageIcon, Film, Music, CheckCircle2, AlertTriangle, RefreshCw, Trash2, Tag, Sparkles, FolderSearch } from 'lucide-react';
import { IMediaItem, IMediaBin, MediaColorTag } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { Button } from '@/shared/ui/Button';
import { IpcService } from '@/core/services/ipcService';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { TAG_COLORS } from './MediaPoolContextMenu';
import { MediaRelinkService } from '../../services/MediaRelinkService';
import { MediaCleanerService } from '../../services/MediaCleanerService';

interface MediaPoolInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: IMediaItem[];
  bins: IMediaBin[];
}

/** Formats byte counts into human-readable strings (KB, MB, GB). */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Apple HIG modal presenting statistics, storage analysis, integrity checks,
 * batch relinking, and orphan media cleaning for Media Pool.
 */
export const MediaPoolInfoModal: React.FC<MediaPoolInfoModalProps> = ({
  isOpen,
  onClose,
  mediaItems,
  bins
}) => {
  const { t } = useTranslation();
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);
  const [isScanningOrphans, setIsScanningOrphans] = useState(false);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
  const [orphanData, setOrphanData] = useState<{ count: number; bytes: number; ids: string[] } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate stats
  const stats = useMemo(() => {
    let images = 0;
    let videos = 0;
    let audio = 0;
    let missing = 0;
    let totalBytes = 0;
    const tagCounts: Partial<Record<MediaColorTag, number>> = {};

    mediaItems.forEach(item => {
      if (item.type === 'image') images++;
      else if (item.type === 'video') videos++;
      else if (item.type === 'audio') audio++;

      if (item.isMissing) missing++;
      if (item.fileSize) totalBytes += item.fileSize;
      else if (item.data) totalBytes += item.data.size;

      if (item.colorTag) {
        tagCounts[item.colorTag] = (tagCounts[item.colorTag] || 0) + 1;
      }
    });

    const total = mediaItems.length;
    return {
      total,
      images,
      videos,
      audio,
      missing,
      totalBytes,
      tagCounts,
      imagesPct: total > 0 ? Math.round((images / total) * 100) : 0,
      videosPct: total > 0 ? Math.round((videos / total) * 100) : 0,
      audioPct: total > 0 ? Math.round((audio / total) * 100) : 0,
    };
  }, [mediaItems]);

  const handleVerifyIntegrity = async () => {
    if (!IpcService.isElectron()) return;
    setIsVerifying(true);
    let newlyMissing = 0;
    let recovered = 0;

    try {
      for (const item of mediaItems) {
        if (!item.data && item.path) {
          const fileStats = await IpcService.invoke('get-file-stats', item.path);
          const isMissing = !fileStats;
          if (isMissing !== item.isMissing) {
            await db.mediaPool.update(item.id, { isMissing });
            if (isMissing) newlyMissing++;
            else recovered++;
          }
        }
      }
      toast.success(
        t('media_pool.integrity_complete', 'Integrity check complete: {{missing}} missing, {{recovered}} restored', {
          missing: newlyMissing,
          recovered
        })
      );
    } catch (err) {
      console.error('[MediaPoolInfoModal] Integrity verification failed:', err);
      toast.error(t('media_pool.integrity_error', 'Failed to complete integrity check'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCleanMissing = async () => {
    const missingIds = mediaItems.filter(i => i.isMissing).map(i => i.id);
    if (missingIds.length === 0) return;

    setIsCleaning(true);
    try {
      await db.mediaPool.where('id').anyOf(missingIds).delete();
      toast.success(t('media_pool.cleaned_missing', 'Removed {{count}} missing files', { count: missingIds.length }));
    } catch (err) {
      console.error('[MediaPoolInfoModal] Clean missing error:', err);
      toast.error(t('media_pool.clean_error', 'Failed to remove missing assets'));
    } finally {
      setIsCleaning(false);
    }
  };

  const handleBatchRelink = async () => {
    const missing = mediaItems.filter(i => i.isMissing);
    if (missing.length === 0) return;
    setIsRelinking(true);
    try {
      await MediaRelinkService.batchRelinkFromFolder(missing);
    } finally {
      setIsRelinking(false);
    }
  };

  const handleScanOrphans = async () => {
    setIsScanningOrphans(true);
    try {
      const { orphans, orphanBytes } = await MediaCleanerService.scanOrphans();
      setOrphanData({
        count: orphans.length,
        bytes: orphanBytes,
        ids: orphans.map(o => o.id)
      });
      if (orphans.length === 0) {
        toast.info(t('media_pool.no_orphans_found', 'No unused media files found. All assets are in use!'));
      }
    } catch (err) {
      console.error('[MediaPoolInfoModal] Scan orphans error:', err);
      toast.error(t('media_pool.scan_orphans_error', 'Failed to scan for unused files'));
    } finally {
      setIsScanningOrphans(false);
    }
  };

  const handleDeleteOrphans = async () => {
    if (!orphanData || orphanData.ids.length === 0) return;
    setIsCleaningOrphans(true);
    try {
      const count = await MediaCleanerService.deleteOrphans(orphanData.ids);
      toast.success(t('media_pool.orphans_deleted', 'Deleted {{count}} unused media assets', { count }));
      setOrphanData(null);
    } catch (err) {
      console.error('[MediaPoolInfoModal] Delete orphans error:', err);
      toast.error(t('media_pool.delete_orphans_error', 'Failed to delete unused assets'));
    } finally {
      setIsCleaningOrphans(false);
    }
  };

  if (!isRendered) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex flex-col w-full max-w-lg bg-stone-900/95 border border-white/10 rounded-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-stone-950/40 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t('media_pool.storage_stats', 'Media Pool Statistics')}
              </h3>
              <p className="text-[11px] text-stone-400 font-medium">
                {t('media_pool.stats_subtitle', 'Storage analysis & asset health')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors apple-press cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-stone-950/50 border border-white/5 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                {t('media_pool.total_assets', 'Total Files')}
              </span>
              <span className="text-lg font-bold text-white mt-1 tabular-nums">{stats.total}</span>
            </div>

            <div className="bg-stone-950/50 border border-white/5 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                {t('media_pool.storage_size', 'Storage Size')}
              </span>
              <span className="text-lg font-bold text-accent mt-1 tabular-nums">
                {stats.totalBytes > 0 ? formatBytes(stats.totalBytes) : '—'}
              </span>
            </div>

            <div className="bg-stone-950/50 border border-white/5 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                {t('media_pool.bins', 'Bins')}
              </span>
              <span className="text-lg font-bold text-amber-400 mt-1 tabular-nums">{bins.length}</span>
            </div>

            <div className={cn(
              "border rounded-xl p-3 flex flex-col",
              stats.missing > 0 ? "bg-red-950/30 border-red-500/30" : "bg-stone-950/50 border-white/5"
            )}>
              <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                {t('media_pool.health', 'Health')}
              </span>
              <span className={cn(
                "text-lg font-bold mt-1 flex items-center gap-1.5",
                stats.missing > 0 ? "text-red-400" : "text-emerald-400"
              )}>
                {stats.missing > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>{stats.missing}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs">{t('media_pool.all_good', '100% OK')}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Missing Files Alert & Batch Relink */}
          {stats.missing > 0 && (
            <div className="bg-red-950/20 border border-red-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="text-[11px] min-w-0">
                  <p className="font-semibold text-red-200">
                    {t('media_pool.missing_files_notice', '{{count}} missing files detected', { count: stats.missing })}
                  </p>
                  <p className="text-red-300/70 text-[10px]">
                    {t('media_pool.missing_files_desc', 'Locate folder on disk to auto-relink matching files')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={handleBatchRelink}
                  disabled={isRelinking}
                  leftIcon={<FolderOpen className={cn("w-3.5 h-3.5", isRelinking && "animate-spin")} />}
                >
                  {isRelinking ? t('media_pool.relinking', 'Scanning...') : t('media_pool.batch_relink_btn', 'Find Folder...')}
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  onClick={handleCleanMissing}
                  disabled={isCleaning}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  {t('media_pool.clean_missing', 'Clean Missing ({{count}})', { count: stats.missing })}
                </Button>
              </div>
            </div>
          )}

          {/* Type Distribution Bar & Details */}
          <div className="bg-stone-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-3">
            <span className="text-[11px] font-semibold text-stone-300">
              {t('media_pool.type_breakdown', 'File Type Breakdown')}
            </span>

            {/* Segmented Bar */}
            <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden flex">
              {stats.imagesPct > 0 && (
                <div style={{ width: `${stats.imagesPct}%` }} className="bg-emerald-500 h-full transition-all" />
              )}
              {stats.videosPct > 0 && (
                <div style={{ width: `${stats.videosPct}%` }} className="bg-blue-500 h-full transition-all" />
              )}
              {stats.audioPct > 0 && (
                <div style={{ width: `${stats.audioPct}%` }} className="bg-purple-500 h-full transition-all" />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-stone-300 truncate">{t('media_pool.images', 'Images')}:</span>
                <span className="font-bold text-white tabular-nums ml-auto">{stats.images}</span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-stone-300 truncate">{t('media_pool.videos', 'Videos')}:</span>
                <span className="font-bold text-white tabular-nums ml-auto">{stats.videos}</span>
              </div>
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-stone-300 truncate">{t('media_pool.audio', 'Audio')}:</span>
                <span className="font-bold text-white tabular-nums ml-auto">{stats.audio}</span>
              </div>
            </div>
          </div>

          {/* Color Tags Summary (if any) */}
          {Object.keys(stats.tagCounts).length > 0 && (
            <div className="bg-stone-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-300">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span>{t('media_pool.color_tags', 'Color Tags')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(Object.entries(stats.tagCounts) as [MediaColorTag, number][]).map(([tag, count]) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-900 border border-white/5"
                  >
                    <div className={cn("w-2.5 h-2.5 rounded-full", TAG_COLORS[tag]?.bg)} />
                    <span className="text-[10px] text-stone-300 capitalize">{tag}</span>
                    <span className="text-[10px] font-bold text-white tabular-nums ml-1">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unused Media Cleaner Section */}
          <div className="bg-stone-950/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-300">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>{t('media_pool.orphan_cleaner_title', 'Unused Assets Cleaner')}</span>
              </div>
              {!orphanData ? (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={handleScanOrphans}
                  disabled={isScanningOrphans}
                  leftIcon={<FolderSearch className={cn("w-3.5 h-3.5", isScanningOrphans && "animate-spin")} />}
                >
                  {isScanningOrphans ? t('media_pool.scanning', 'Scanning...') : t('media_pool.scan_unused', 'Scan Unused Files')}
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setOrphanData(null)}
                >
                  {t('media_pool.rescan', 'Reset')}
                </Button>
              )}
            </div>

            {orphanData && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                <span className="text-[11px] text-stone-300">
                  {orphanData.count === 0 ? (
                    <span className="text-emerald-400 font-medium">
                      {t('media_pool.no_unused_assets', 'All media assets are in use!')}
                    </span>
                  ) : (
                    <span>
                      {t('media_pool.unused_found', 'Found {{count}} unused files ({{size}})', {
                        count: orphanData.count,
                        size: formatBytes(orphanData.bytes)
                      })}
                    </span>
                  )}
                </span>

                {orphanData.count > 0 && (
                  <Button
                    size="xs"
                    variant="danger"
                    onClick={handleDeleteOrphans}
                    disabled={isCleaningOrphans}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    {t('media_pool.clean_unused_btn', 'Delete {{count}} Unused', { count: orphanData.count })}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
            {IpcService.isElectron() && (
              <Button
                size="xs"
                variant="secondary"
                onClick={handleVerifyIntegrity}
                disabled={isVerifying}
                leftIcon={<RefreshCw className={cn("w-3.5 h-3.5", isVerifying && "animate-spin")} />}
              >
                {t('media_pool.verify_integrity', 'Verify Files')}
              </Button>
            )}

            <div className="ml-auto">
              <Button size="xs" variant="primary" onClick={onClose}>
                {t('close', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
