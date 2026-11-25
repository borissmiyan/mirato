import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Download,
    FolderOpen,
    Trash2,
    X,
    CheckCircle2,
    RefreshCw,
    Loader2,
    Music,
    Mic,
} from 'lucide-react';
import { IHymnal } from '@/core/types/hymn';
import {
    HymnalAudioPackEntry,
    HymnalAudioVariant,
    formatBytesMb,
    formatTrackCount,
    getAudioPackStorageKey,
    hasPackDownloadSource,
} from '@/features/hymns/services/hymnalAudioCatalog';
import { Switch, Badge, Button, IconButton, Tooltip, CustomHymnalIcon } from '@/shared/ui';
import { AudioPackProgress, InstalledAudioPack } from './useHymnalAudioPacks';

const formatHymnCount = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'гимн'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'гимна'
            : 'гимнов';
    return `${count} ${word}`;
};

const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    if (bytesPerSec >= 1024 * 1024) return ` • ${(bytesPerSec / (1024 * 1024)).toFixed(1)} МБ/с`;
    return ` • ${Math.round(bytesPerSec / 1024)} КБ/с`;
};

interface HymnalSettingsRowProps {
    hymnal: IHymnal;
    audioPacks: HymnalAudioPackEntry[];
    audioAvailable: boolean;
    audioLoading: boolean;
    installedMap: Record<string, InstalledAudioPack>;
    progressMap: Record<string, AudioPackProgress>;
    onToggleEnabled: (hymnal: IHymnal, enabled: boolean) => void;
    onRemoveHymnal: (hymnal: IHymnal) => void;
    onDownloadAudio: (pack: HymnalAudioPackEntry) => void;
    onInstallAudioFromFile: (pack: HymnalAudioPackEntry) => void;
    onCancelAudioDownload: (hymnalId: string, variant?: HymnalAudioVariant) => void;
    onRemoveAudio: (pack: HymnalAudioPackEntry) => void;
}

/**
 * Single hymnal row inside a language group in Settings -> Data,
 * with clearly separated Minus (instrumental) and Plus (vocal) audio pack rows
 * and hover tooltips displaying track count & download size.
 */
export const HymnalSettingsRow: React.FC<HymnalSettingsRowProps> = React.memo(({
    hymnal,
    audioPacks,
    audioAvailable,
    audioLoading,
    installedMap,
    progressMap,
    onToggleEnabled,
    onRemoveHymnal,
    onDownloadAudio,
    onInstallAudioFromFile,
    onCancelAudioDownload,
    onRemoveAudio,
}) => {
    const { t } = useTranslation();
    const isEnabled = !hymnal.isDisabled;

    const renderPackActions = (pack: HymnalAudioPackEntry) => {
        const variant = pack.variant ?? 'minus';
        const key = getAudioPackStorageKey(pack.hymnalId, variant);
        const installed = installedMap[key];
        const progress = progressMap[key];
        const isBusy = Boolean(
            progress && (progress.phase === 'downloading' || progress.phase === 'verifying' || progress.phase === 'extracting')
        );
        const hasUpdate = Boolean(installed && installed.version < pack.version);
        const variantLabel = variant === 'plus'
            ? t('audio_variant_plus_pack', 'Плюсовки')
            : t('audio_variant_minus_pack', 'Минусовки');
        const hoverSummary = `${variantLabel}: ${formatTrackCount(pack.trackCount)} • ~${formatBytesMb(pack.sizeBytes)}`;

        if (isBusy) {
            return (
                <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onCancelAudioDownload(pack.hymnalId, variant)}
                    leftIcon={<X className="w-3.5 h-3.5" />}
                >
                    {t('cancel', 'Отмена')}
                </Button>
            );
        }

        return (
            <>
                {(!installed || hasUpdate) && (
                    <>
                        {hasPackDownloadSource(pack) && (
                            <Tooltip content={hoverSummary} position="top" delay={150}>
                                <Button
                                    size="xs"
                                    variant={variant === 'plus' ? 'secondary' : 'primary'}
                                    disabled={audioLoading}
                                    onClick={() => onDownloadAudio(pack)}
                                    leftIcon={hasUpdate ? <RefreshCw className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                >
                                    {hasUpdate ? t('update', 'Обновить') : t('download', 'Скачать')}
                                </Button>
                            </Tooltip>
                        )}
                        <Tooltip
                            content={`${t('install_from_zip_hint', 'Установить из файла (.mrta / .zip)')} • ${hoverSummary}`}
                            position="top"
                            delay={150}
                        >
                            <Button
                                size="xs"
                                variant="outline"
                                disabled={audioLoading}
                                onClick={() => onInstallAudioFromFile(pack)}
                                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                            >
                                {t('from_file', 'Из файла')}
                            </Button>
                        </Tooltip>
                    </>
                )}
                {installed && (
                    <IconButton
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        size="xs"
                        variant="danger"
                        label={variant === 'plus'
                            ? t('remove_hymnal_audio_plus_title', 'Удалить плюсовки')
                            : t('remove_hymnal_audio_title', 'Удалить минусовки')}
                        onClick={() => onRemoveAudio(pack)}
                    />
                )}
            </>
        );
    };

    const renderProgress = (pack: HymnalAudioPackEntry) => {
        const variant = pack.variant ?? 'minus';
        const key = getAudioPackStorageKey(pack.hymnalId, variant);
        const progress = progressMap[key];
        const isBusy = Boolean(
            progress && (progress.phase === 'downloading' || progress.phase === 'verifying' || progress.phase === 'extracting')
        );
        if (!isBusy || !progress) return null;

        return (
            <div key={key} className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-amber-300 tabular-nums">
                    <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {progress.phase === 'downloading' && (
                            variant === 'plus'
                                ? t('downloading_audio_plus', 'Скачивание плюсовок…')
                                : t('downloading_audio', 'Скачивание минусовок…')
                        )}
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
        );
    };

    return (
        <div className="p-3 rounded-xl bg-stone-950/55 border border-white/[0.06] flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-stone-800/80 border border-white/[0.06] flex items-center justify-center shrink-0 text-stone-300 overflow-hidden">
                        {hymnal.coverImageUrl ? (
                            <img src={hymnal.coverImageUrl} alt={hymnal.name} className="w-full h-full object-cover" />
                        ) : (
                            <CustomHymnalIcon className="w-4 h-4" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-stone-100 truncate">{hymnal.name}</span>
                            <Badge size="xs" variant={hymnal.isBuiltIn ? 'accent' : 'secondary'}>
                                {hymnal.isBuiltIn ? t('hymnal_builtin_badge', 'Встроенный') : t('hymnal_custom_badge', 'Свой')}
                            </Badge>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                            {formatHymnCount(hymnal.itemCount)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!hymnal.isBuiltIn && (
                        <IconButton
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            size="xs"
                            variant="danger"
                            label={t('delete', 'Удалить сборник')}
                            onClick={() => onRemoveHymnal(hymnal)}
                        />
                    )}

                    <Switch
                        checked={isEnabled}
                        onChange={(checked) => onToggleEnabled(hymnal, checked)}
                        aria-label={hymnal.name}
                    />
                </div>
            </div>

            {/* Separate Minus and Plus audio pack sub-rows */}
            {audioPacks.length > 0 && audioAvailable && (
                <div className="flex flex-col gap-1.5 pl-12">
                    {audioPacks.map((pack) => {
                        const variant = pack.variant ?? 'minus';
                        const key = getAudioPackStorageKey(pack.hymnalId, variant);
                        const installed = installedMap[key];
                        return (
                            <div
                                key={key}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-stone-900/60 border border-white/[0.05] flex-wrap"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    {variant === 'plus'
                                        ? <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        : <Music className="w-3.5 h-3.5 text-purple-300 shrink-0" />}
                                    <span className="text-xs font-semibold text-stone-200">
                                        {variant === 'plus'
                                            ? t('audio_variant_plus_pack', 'Плюсовки')
                                            : t('audio_variant_minus_pack', 'Минусовки')}
                                    </span>
                                    <span className="text-[11px] text-stone-500 tabular-nums">
                                        {installed
                                            ? `${formatTrackCount(installed.trackCount)} • ${formatBytesMb(installed.bytesOnDisk)}`
                                            : `${formatTrackCount(pack.trackCount)} • ~${formatBytesMb(pack.sizeBytes)}`}
                                    </span>
                                    {installed && (
                                        <Badge size="xs" variant="success" icon={<CheckCircle2 className="w-2.5 h-2.5" />}>
                                            {t('installed', 'Установлено')}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {renderPackActions(pack)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {audioPacks.map(renderProgress)}
        </div>
    );
});

HymnalSettingsRow.displayName = 'HymnalSettingsRow';
