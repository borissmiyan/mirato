import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IpcService } from '@/core/services/ipcService';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { toast } from '@/core/utils/toast';
import { audioService } from '@/features/presenter/services/AudioService';
import {
    HymnalAudioPackEntry,
    HymnalAudioVariant,
    getAudioPackStorageKey,
} from '@/features/hymns/services/hymnalAudioCatalog';

export interface InstalledAudioPack {
    hymnalId: string;
    variant?: HymnalAudioVariant;
    packKey?: string;
    version: number;
    trackCount: number;
    bytesOnDisk: number;
    installedAt?: string;
}

export interface AudioPackProgress {
    phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error' | 'canceled';
    percent: number;
    bytesReceived: number;
    totalBytes: number;
    speedBytesPerSec?: number;
    error?: string;
}

/**
 * Manages hymnal backing track audio packs (single & batch download, offline install, remove, cancel).
 */
export function useHymnalAudioPacks() {
    const { t } = useTranslation();
    const openModal = useModalStore(s => s.openModal);
    const [installedMap, setInstalledMap] = useState<Record<string, InstalledAudioPack>>({});
    const [progressMap, setProgressMap] = useState<Record<string, AudioPackProgress>>({});
    const [isLoading, setIsLoading] = useState(true);

    const api = IpcService.isElectron() ? window.electron?.ipcRenderer?.hymnalAudio : undefined;

    const refreshInstalled = useCallback(async () => {
        if (!api) {
            setIsLoading(false);
            return;
        }
        try {
            const list = await api.listInstalled();
            const map: Record<string, InstalledAudioPack> = {};
            for (const item of list) {
                const key = item.packKey || getAudioPackStorageKey(item.hymnalId, item.variant ?? 'minus');
                map[key] = item;
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
            const key = ev.packKey || getAudioPackStorageKey(ev.hymnalId, ev.variant ?? 'minus');
            setProgressMap(prev => ({ ...prev, [key]: ev }));
            if (ev.phase === 'done' || ev.phase === 'error' || ev.phase === 'canceled') {
                refreshInstalled();
            }
        });
        return () => unsub();
    }, [api, refreshInstalled]);

    const downloadPack = useCallback(async (pack: HymnalAudioPackEntry) => {
        if (!api) return;
        const variant = pack.variant ?? 'minus';
        const key = getAudioPackStorageKey(pack.hymnalId, variant);
        setProgressMap(prev => ({
            ...prev,
            [key]: { phase: 'downloading', percent: 0, bytesReceived: 0, totalBytes: pack.sizeBytes },
        }));
        const res = await api.downloadPack({
            hymnalId: pack.hymnalId,
            variant,
            url: pack.downloadUrl,
            version: pack.version,
            expectedSha256: pack.sha256,
            expectedBytes: pack.sizeBytes,
            parts: pack.parts,
        });
        if (res.success) {
            toast.success(
                variant === 'plus'
                    ? t('hymnal_audio_plus_installed', 'Плюсовки установлены')
                    : t('hymnal_audio_installed', 'Минусовки установлены'),
                `${pack.name} (${res.info?.trackCount ?? pack.trackCount})`
            );
        } else if (!res.canceled) {
            toast.error(t('hymnal_audio_download_error', 'Не удалось скачать аудио'), res.error || '');
        }
        setProgressMap(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        await refreshInstalled();
    }, [api, refreshInstalled, t]);

    const downloadPacks = useCallback(async (packs: HymnalAudioPackEntry[]) => {
        for (const pack of packs) {
            await downloadPack(pack);
        }
    }, [downloadPack]);

    const installFromFile = useCallback(async (pack: HymnalAudioPackEntry) => {
        if (!api) return;
        const variant = pack.variant ?? 'minus';
        const key = getAudioPackStorageKey(pack.hymnalId, variant);
        const res = await api.installFromFile(pack.hymnalId, pack.version, variant);
        if (res.success) {
            toast.success(
                variant === 'plus'
                    ? t('hymnal_audio_plus_installed', 'Плюсовки установлены')
                    : t('hymnal_audio_installed', 'Минусовки установлены'),
                `${pack.name} (${res.info?.trackCount ?? pack.trackCount})`
            );
        } else if (!res.canceled) {
            toast.error(t('hymnal_audio_install_error', 'Не удалось установить архив'), res.error || '');
        }
        setProgressMap(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        await refreshInstalled();
    }, [api, refreshInstalled, t]);

    const cancelDownload = useCallback((hymnalId: string, variant?: HymnalAudioVariant) => {
        api?.cancelDownload(hymnalId, variant);
    }, [api]);

    const removePacks = useCallback((packs: HymnalAudioPackEntry[], scopeLabel?: string) => {
        if (!api || packs.length === 0) return;
        const title = packs.length === 1
            ? (packs[0].variant === 'plus'
                ? t('remove_hymnal_audio_plus_title', 'Удалить плюсовки?')
                : t('remove_hymnal_audio_title', 'Удалить минусовки?'))
            : t('remove_all_hymnal_audio_title', 'Удалить все аудиопакеты?');
        const message = packs.length === 1
            ? t('remove_hymnal_audio_confirm', `Удалить загруженное аудио для «${packs[0].name}»? Тексты гимнов останутся на месте, а аудио можно будет скачать снова в любой момент.`)
            : t('remove_batch_hymnal_audio_confirm', `Удалить загруженные аудиопакеты (${packs.length}) ${scopeLabel ? `для ${scopeLabel}` : ''}? Тексты гимнов останутся на месте.`);

        openModal(ModalType.CONFIRM, {
            title,
            message,
            variant: 'danger',
            confirmLabel: t('delete', 'Удалить'),
            onSelection: async (confirmed: boolean) => {
                if (!confirmed) return;
                audioService.stopAll(0);
                let removed = 0;
                for (const pack of packs) {
                    const res = await api.removePack(pack.hymnalId, pack.variant ?? 'minus');
                    if (res.success) removed++;
                }
                if (removed > 0) {
                    toast.success(t('hymnal_audio_removed', 'Аудио удалено'));
                    await refreshInstalled();
                } else {
                    toast.error(t('delete_failed', 'Не удалось удалить файлы'));
                }
            },
        });
    }, [api, openModal, refreshInstalled, t]);

    return {
        isAvailable: Boolean(api),
        isLoading,
        installedMap,
        progressMap,
        downloadPack,
        downloadPacks,
        installFromFile,
        cancelDownload,
        removePacks,
    };
}
