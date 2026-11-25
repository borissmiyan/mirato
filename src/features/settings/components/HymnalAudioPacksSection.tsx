import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FolderOpen, Trash2, X, CheckCircle2, RefreshCw, Loader2, Heart, ExternalLink } from 'lucide-react';
import { CustomHymnalIcon } from '@/shared/ui';
import { Card, Button, Badge } from '@/shared/ui';
import { IpcService } from '@/core/services/ipcService';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { toast } from '@/core/utils/toast';
import { audioService } from '@/features/presenter/services/AudioService';
import {
    BUILTIN_HYMNAL_AUDIO_CATALOG,
    HymnalAudioPackEntry,
    formatBytesMb,
} from '@/features/hymns/services/hymnalAudioCatalog';

interface InstalledPack {
    hymnalId: string;
    version: number;
    trackCount: number;
    bytesOnDisk: number;
    installedAt?: string;
}

interface PackProgress {
    phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error' | 'canceled';
    percent: number;
    bytesReceived: number;
    totalBytes: number;
    speedBytesPerSec?: number;
    error?: string;
}

const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    if (bytesPerSec >= 1024 * 1024) return ` • ${(bytesPerSec / (1024 * 1024)).toFixed(1)} МБ/с`;
    return ` • ${Math.round(bytesPerSec / 1024)} КБ/с`;
};

/**
 * Settings -> Data section for downloading, installing offline (.zip), updating,
 * and removing hymnal backing track audio packs.
 */
export const HymnalAudioPacksSection: React.FC = () => {
    const { t } = useTranslation();
    const openModal = useModalStore(s => s.openModal);
    const [installedMap, setInstalledMap] = useState<Record<string, InstalledPack>>({});
    const [progressMap, setProgressMap] = useState<Record<string, PackProgress>>({});
    const [isLoading, setIsLoading] = useState(true);

    const api = IpcService.isElectron() ? window.electron?.ipcRenderer?.hymnalAudio : undefined;

    const refreshInstalled = useCallback(async () => {
        if (!api) {
            setIsLoading(false);
            return;
        }
        try {
            const list = await api.listInstalled();
            const map: Record<string, InstalledPack> = {};
            for (const item of list) {
                map[item.hymnalId] = item;
            }
            setInstalledMap(map);
        } finally {
            setIsLoading(false);
        }
    }, [api]);

    useEffect(() => {
        refreshInstalled();
    }, [refreshInstalled]);

    useEffect(() => {
        if (!api) return;
        const unsub = api.onProgress((ev) => {
            setProgressMap(prev => ({ ...prev, [ev.hymnalId]: ev }));
            if (ev.phase === 'done' || ev.phase === 'error' || ev.phase === 'canceled') {
                refreshInstalled();
            }
        });
        return () => unsub();
    }, [api, refreshInstalled]);

    if (!IpcService.isElectron() || !api) return null;

    const handleDownload = async (pack: HymnalAudioPackEntry) => {
        setProgressMap(prev => ({
            ...prev,
            [pack.hymnalId]: { phase: 'downloading', percent: 0, bytesReceived: 0, totalBytes: pack.sizeBytes },
        }));
        const res = await api.downloadPack({
            hymnalId: pack.hymnalId,
            url: pack.downloadUrl,
            version: pack.version,
            expectedSha256: pack.sha256,
            expectedBytes: pack.sizeBytes,
        });
        if (res.success) {
            toast.success(t('hymnal_audio_installed', 'Минусовки установлены'), `${pack.name} (${res.info?.trackCount ?? pack.trackCount})`);
        } else if (!res.canceled) {
            toast.error(t('hymnal_audio_download_error', 'Не удалось скачать минусовки'), res.error || '');
        }
        setProgressMap(prev => {
            const next = { ...prev };
            delete next[pack.hymnalId];
            return next;
        });
        await refreshInstalled();
    };

    const handleInstallFromFile = async (pack: HymnalAudioPackEntry) => {
        const res = await api.installFromFile(pack.hymnalId, pack.version);
        if (res.success) {
            toast.success(t('hymnal_audio_installed', 'Минусовки установлены'), `${pack.name} (${res.info?.trackCount ?? pack.trackCount})`);
        } else if (!res.canceled) {
            toast.error(t('hymnal_audio_install_error', 'Не удалось установить архив'), res.error || '');
        }
        setProgressMap(prev => {
            const next = { ...prev };
            delete next[pack.hymnalId];
            return next;
        });
        await refreshInstalled();
    };

    const handleRemove = (pack: HymnalAudioPackEntry) => {
        openModal(ModalType.CONFIRM, {
            title: t('remove_hymnal_audio_title', 'Удалить минусовки?'),
            message: t('remove_hymnal_audio_confirm', `Удалить загруженные минусовки для «${pack.name}»? Тексты гимнов останутся на месте, а аудио можно будет скачать снова в любой момент.`),
            variant: 'danger',
            confirmLabel: t('delete', 'Удалить'),
            onSelection: async (confirmed: boolean) => {
                if (!confirmed) return;
                // Stop active audio tracks first to prevent EBUSY file locks on Windows
                audioService.stopAll(0);
                const res = await api.removePack(pack.hymnalId);
                if (res.success) {
                    toast.success(t('hymnal_audio_removed', 'Минусовки удалены'));
                    await refreshInstalled();
                } else {
                    toast.error(res.error || t('delete_failed', 'Не удалось удалить файлы'));
                }
            },
        });
    };

    return (
        <Card padding="md" rounded="xl" className="relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500/15 rounded-xl text-amber-400">
                    <CustomHymnalIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                        {t('hymnal_audio_packs_title', 'Минусовки гимнов')}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">
                        {t('hymnal_audio_packs_desc', 'Тексты гимнов встроены в приложение. Минусовки загружаются отдельно (.mrta), сохраняются между обновлениями и могут устанавливаться с флешки.')}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {BUILTIN_HYMNAL_AUDIO_CATALOG.map((pack) => {
                    const installed = installedMap[pack.hymnalId];
                    const progress = progressMap[pack.hymnalId];
                    const isBusy = progress && (progress.phase === 'downloading' || progress.phase === 'verifying' || progress.phase === 'extracting');
                    const hasUpdate = installed && installed.version < pack.version;

                    return (
                        <div
                            key={pack.hymnalId}
                            className="p-4 rounded-xl bg-stone-950/60 border border-white/5 flex flex-col gap-3"
                        >
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-stone-100">{pack.name}</span>
                                        {installed ? (
                                            <Badge size="xs" variant="success" icon={<CheckCircle2 className="w-2.5 h-2.5" />}>
                                                {t('installed', 'Установлено')}
                                            </Badge>
                                        ) : (
                                            <Badge size="xs" variant="secondary">
                                                {t('not_downloaded', 'Не загружено')}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-stone-500 mt-1 tabular-nums">
                                        {installed
                                            ? `${installed.trackCount} ${t('tracks', 'треков')} • ${formatBytesMb(installed.bytesOnDisk)}`
                                            : `${pack.trackCount} ${t('tracks', 'треков')} • ~${formatBytesMb(pack.sizeBytes)}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {isBusy ? (
                                        <Button
                                            size="xs"
                                            variant="secondary"
                                            onClick={() => api.cancelDownload(pack.hymnalId)}
                                            leftIcon={<X className="w-3.5 h-3.5" />}
                                        >
                                            {t('cancel', 'Отмена')}
                                        </Button>
                                    ) : (
                                        <>
                                            {(!installed || hasUpdate) && (
                                                <Button
                                                    size="xs"
                                                    variant="primary"
                                                    disabled={isLoading}
                                                    onClick={() => handleDownload(pack)}
                                                    leftIcon={hasUpdate ? <RefreshCw className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                                >
                                                    {hasUpdate ? t('update', 'Обновить') : t('download', 'Скачать')}
                                                </Button>
                                            )}
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                disabled={isLoading}
                                                onClick={() => handleInstallFromFile(pack)}
                                                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                                                title={t('install_from_zip_hint', 'Установить пакет минусовок (.mrta / .zip) офлайн с флешки или диска')}
                                            >
                                                {t('from_file', 'Из файла')}
                                            </Button>
                                            {installed && (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => handleRemove(pack)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                                                >
                                                    {t('delete', 'Удалить')}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {isBusy && progress && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-medium text-amber-300 tabular-nums">
                                        <span className="flex items-center gap-1.5">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            {progress.phase === 'downloading' && t('downloading_audio', 'Скачивание минусовок…')}
                                            {progress.phase === 'verifying' && t('verifying_archive', 'Проверка целостности…')}
                                            {progress.phase === 'extracting' && t('extracting_archive', 'Распаковка архива…')}
                                        </span>
                                        <span>
                                            {progress.percent}%
                                            {progress.totalBytes > 0 && progress.phase === 'downloading'
                                                ? ` (${formatBytesMb(progress.bytesReceived)} / ${formatBytesMb(progress.totalBytes)}${formatSpeed(progress.speedBytesPerSec)})`
                                                : ''}
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 transition-all duration-200"
                                            style={{ width: `${Math.max(2, progress.percent)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Credits & Attribution for Hymnals and Backing Tracks */}
            <div className="mt-5 pt-4 border-t border-white/5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-300 uppercase tracking-wider">
                    <Heart className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('hymnal_credits_title', 'Источники и благодарности')}</span>
                </div>
                <div className="text-xs text-stone-400 space-y-1.5 leading-relaxed">
                    <p>
                        <span className="text-stone-300 font-semibold">{t('hymnal_credits_texts', 'Тексты «Гимны Надежды» (1–385):')}</span>{' '}
                        {t('hymnal_credits_publisher', 'издательство «Источник Жизни» (2000).')}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-stone-300 font-semibold">{t('hymnal_credits_audio', 'Фонограммы (минусовки):')}</span>
                        <a
                            href="https://www.youtube.com/channel/UCHC6lJm81duSkz-lr9siETg"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
                        >
                            <span>Татьяна Кузьмина (383)</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="text-stone-600">•</span>
                        <a
                            href="https://www.youtube.com/watch?v=jpdF5E-iw7U"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
                        >
                            <span>Канал «Благословение» (№ 351, № 370)</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </p>
                    <p className="text-[11px] text-stone-500">
                        {t('hymnal_credits_notice', 'Материалы используются исключительно для некоммерческого богослужебного пения в церквях. Права на тексты и записи принадлежат их авторам и исполнителям.')}
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default HymnalAudioPacksSection;
