import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useShallow } from 'zustand/react/shallow';
import BibleManager from './BibleManager';
import { AlertCircle, Database, Trash2, Info, Layers, HardDrive, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { Card, Button, DropdownSelector } from '@/shared/ui';
import { StorageOptimizationService } from '@/core/services/StorageOptimizationService';
import { IpcService } from '@/core/services/ipcService';
import { toast } from '@/core/utils/toast';

const DataSettings: React.FC = () => {
    const { t } = useTranslation();
    const openModal = useModalStore(state => state.openModal);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [optimizeStatus, setOptimizeStatus] = useState<string | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
    const { secondTranslationId, setSecondTranslation } = useBibleStore(useShallow(state => ({
        secondTranslationId: state.secondTranslationId,
        setSecondTranslation: state.setSecondTranslation
    })));
    const translations = useLiveQuery(() => db.translations.toArray()) || [];

    const reindexProgress = useLiveQuery(
        () => db.settings.get('reindex_progress').then(s => s?.value as { indexed: number; total: number } | undefined),
        []
    );

    const progressPercent = reindexProgress
        ? Math.round((reindexProgress.indexed / reindexProgress.total) * 100)
        : 0;

    const handleOptimizeStorage = async () => {
        openModal(ModalType.CONFIRM, {
            title: t('optimize_storage', 'Оптимизация хранилища'),
            message: t('optimize_storage_confirm', 'Очистить неиспользуемые медиа, удалить старые видео, перенести аудио на диск и сжать картинки в WebP 2K? Это освободит память и ускорит приложение.'),
            onSelection: async (confirmed: boolean) => {
                if (!confirmed) return;
                setIsOptimizing(true);
                try {
                    const stats = await StorageOptimizationService.optimizeDatabase((step) => {
                        setOptimizeStatus(step);
                    });
                    const mbSaved = (stats.bytesSaved / (1024 * 1024)).toFixed(1);
                    toast.success(
                        t('optimize_success_title', 'Хранилище оптимизировано'),
                        t('optimize_success', `Удалено видео: ${stats.videosDeleted}, сирот: ${stats.orphansDeleted}, сжато фото: ${stats.imagesCompressed}, перенесено аудио: ${stats.audiosMigrated}. Освобождено: ~${mbSaved} МБ.`)
                    );
                } catch (err: unknown) {
                    console.error('Storage optimization error:', err);
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(t('optimize_error', 'Ошибка при оптимизации хранилища: ') + msg);
                } finally {
                    setIsOptimizing(false);
                    setOptimizeStatus(null);
                }
            }
        });
    };

    const handleClearAppCache = async () => {
        openModal(ModalType.CONFIRM, {
            title: t('clear_cache_title', 'Очистить кэш приложения?'),
            message: t('clear_cache_desc', 'Будут очищены временные файлы Chromium, кэш скомпилированного кода и сетевые данные. Это безопасно и может устранить сбои отображения.'),
            onSelection: async (confirmed: boolean) => {
                if (!confirmed) return;
                setIsClearingCache(true);
                try {
                    const res = await IpcService.clearAppCache();
                    if (res?.success) {
                        toast.success(t('cache_cleared', 'Кэш успешно очищен'));
                    } else {
                        toast.error(res?.error || t('cache_clear_failed', 'Не удалось очистить кэш'));
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(msg || t('cache_clear_failed', 'Ошибка при очистке кэша'));
                } finally {
                    setIsClearingCache(false);
                }
            }
        });
    };

    const handleRestoreMedia = async () => {
        openModal(ModalType.CONFIRM, {
            title: t('restore_media_title', 'Восстановить медиафайлы?'),
            message: t('restore_media_confirm', 'Поиск отсутствующих медиафайлов (фото, фоны, видео) в локальных папках приложения, архивах импорта и презентациях EKTP / PPTX. Это поможет вернуть слайды, если файлы были случайно удалены.'),
            onSelection: async (confirmed: boolean) => {
                if (!confirmed) return;
                setIsRestoring(true);
                setRestoreStatus(t('scanning_media', 'Поиск медиафайлов…'));
                try {
                    const { MediaRestorationService } = await import('@/core/services/MediaRestorationService');
                    const stats = await MediaRestorationService.restoreMissingMedia(undefined, (status) => {
                        setRestoreStatus(status);
                    });
                    if (stats.restored > 0) {
                        toast.success(
                            t('restore_success_title', 'Медиа восстановлены'),
                            t('restore_success_desc', `Восстановлено: ${stats.restored} из ${stats.missing} отсутствующих файлов.`)
                        );
                    } else if (stats.missing === 0) {
                        toast.success(t('no_missing_media', 'Все медиафайлы на месте, отсутствующих не обнаружено.'));
                    } else {
                        toast.warning(
                            t('restore_partial_title', 'Файлы не найдены'),
                            t('restore_partial_desc', `Не удалось автоматически восстановить ${stats.missing} файлов из локальных архивов.`)
                        );
                    }
                } catch (err: unknown) {
                    console.error('Media restoration failed:', err);
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(t('restore_error', 'Ошибка при восстановлении медиа: ') + msg);
                } finally {
                    setIsRestoring(false);
                    setRestoreStatus(null);
                }
            }
        });
    };

    const handleReset = () => {
        openModal(ModalType.CONFIRM, {
            title: t('reset_database_title'),
            message: t('reset_database_confirm'),
            variant: 'danger',
            confirmLabel: t('reset'),
            onSelection: async (confirmed: boolean) => {
                if (confirmed) {
                    await db.delete();
                    window.location.reload();
                }
            }
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Reindexing Progress Bar */}
            {reindexProgress && reindexProgress.indexed < reindexProgress.total && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                        <span>{t('reindexing_bibles', 'Индексация Библий для быстрого поиска…')}</span>
                        <span>{progressPercent}% ({reindexProgress.indexed} / {reindexProgress.total})</span>
                    </div>
                    <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-amber-500 h-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Main Data Section */}
            <Card padding="md" rounded="xl" className="relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-stone-800 rounded-xl">
                        <Database className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('bible_translations')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('data_management_desc')}</p>
                    </div>
                </div>

                {/* Bible Manager Content */}
                <BibleManager />
            </Card>

            {/* Multi-translation Selection */}
            <Card padding="md" rounded="xl" className="relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-stone-800 rounded-xl">
                        <Layers className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('secondary_translation')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('secondary_translation_desc')}</p>
                    </div>
                </div>

                <div className="relative z-10 max-w-md">
                    <DropdownSelector
                        size="md"
                        value={secondTranslationId || ''}
                        onChange={(val) => setSecondTranslation(val || null)}
                        options={[
                            { value: '', label: t('none') },
                            ...translations.map(tr => ({
                                value: tr.id,
                                label: `${tr.name} (${tr.id})`
                            }))
                        ]}
                    />
                </div>
            </Card>

            {/* Storage Optimization Card */}
            <Card padding="md" rounded="xl" className="relative overflow-hidden group">
                <div className="flex flex-col gap-5 relative z-10">
                    {/* Top Content: Icon, Title, Badges, Description */}
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-accent/15 rounded-2xl shrink-0 text-accent">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-lg font-bold text-white tracking-tight">
                                    {t('optimize_storage_title', 'Очистка и оптимизация хранилища')}
                                </h3>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-accent/20 text-accent">
                                        WebP 2K
                                    </span>
                                    <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                        Audio AAC
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-stone-400 font-medium mt-1.5 leading-relaxed">
                                {t('optimize_storage_desc', 'Удаляет неиспользуемые медиа, переносит видео и аудиофайлы на диск с аппаратным сжатием, сжимает картинки в WebP 2K и освобождает системный кэш.')}
                            </p>
                        </div>
                    </div>

                    {/* Bottom Actions Row with Standardized Buttons */}
                    <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-end gap-3">
                        {IpcService.isElectron() && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRestoreMedia}
                                disabled={isRestoring || isOptimizing}
                                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 gap-2"
                                title="Поиск и восстановление недостающих фото и медиафайлов из архивов EKTP, PPTX и папок пользователя"
                            >
                                {isRestoring ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="w-4 h-4 text-emerald-400" />
                                )}
                                <span>{isRestoring ? (restoreStatus || t('restoring', 'Восстановление…')) : t('restore_media', 'Восстановить медиа')}</span>
                            </Button>
                        )}
                        {IpcService.isElectron() && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleClearAppCache}
                                disabled={isClearingCache || isRestoring || isOptimizing}
                                className="gap-2"
                                title="Очистить временные файлы Chromium и скомпилированный код V8"
                            >
                                {isClearingCache ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4 text-stone-400" />
                                )}
                                <span>{isClearingCache ? t('clearing', 'Очистка…') : t('clear_cache', 'Очистить кэш')}</span>
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={handleOptimizeStorage}
                            disabled={isOptimizing || isRestoring}
                            className="gap-2 shadow-md shadow-accent/20"
                        >
                            {isOptimizing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            <span>{isOptimizing ? t('optimizing', 'Оптимизация…') : t('optimize_now', 'Оптимизировать')}</span>
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Danger Zone Card */}
            <div className="bg-red-950/10 border border-red-900/20 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-red-500/10 transition-colors pointer-events-none" />

                <div className="flex items-start justify-between gap-6 relative z-10 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-900/20 rounded-xl shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-lg font-bold text-red-100 tracking-tight">{t('danger_zone')}</h3>
                            <p className="text-xs text-red-900/80 font-medium mt-1 leading-relaxed">
                                {t('reset_database_desc')}
                            </p>
                        </div>
                    </div>

                    <Button
                        size="sm"
                        variant="danger"
                        onClick={handleReset}
                        className="gap-2 shrink-0 shadow-lg shadow-red-900/40"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('reset_database')}</span>
                    </Button>
                </div>

                <div className="mt-6 p-3 bg-red-950/30 rounded-xl border border-red-900/20 flex items-center gap-3 relative z-10">
                    <Info className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-xs text-red-300/70 font-medium italic">
                        {t('data_reset_warning')}
                    </p>
                </div>
            </div>

        </div>
    );
};

export default DataSettings;
