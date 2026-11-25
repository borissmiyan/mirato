import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2, VolumeX, Download, Clock, Hand, Music, Mic } from 'lucide-react';
import DropdownSelector, { DropdownOption } from '@/shared/ui/DropdownSelector';
import { SegmentedControl, SegmentedControlOption } from '@/shared/ui/SegmentedControl';
import { IpcService } from '@/core/services/ipcService';
import type { HymnalAudioVariant } from '@/core/types/audio';

export type HymnInsertAudioMode = 'auto' | 'manual' | 'delay' | 'off';

const HYMN_AUDIO_MODE_STORAGE_KEY = 'mirato-hymn-insert-audio-mode';
const HYMN_AUDIO_VARIANT_STORAGE_KEY = 'mirato-hymn-insert-audio-variant';

const readStoredHymnAudioMode = (): HymnInsertAudioMode => {
    try {
        if (typeof localStorage === 'undefined') return 'auto';
        const raw = localStorage.getItem(HYMN_AUDIO_MODE_STORAGE_KEY);
        if (raw === 'auto' || raw === 'manual' || raw === 'delay' || raw === 'off') return raw;
    } catch { /* ignore */ }
    return 'auto';
};

const readStoredHymnAudioVariant = (): HymnalAudioVariant => {
    try {
        if (typeof localStorage === 'undefined') return 'minus';
        const raw = localStorage.getItem(HYMN_AUDIO_VARIANT_STORAGE_KEY);
        if (raw === 'minus' || raw === 'plus') return raw;
    } catch { /* ignore */ }
    return 'minus';
};

/**
 * Manages persisted audio strategy + minus/plus variant selection and disk availability probing.
 */
export function useHymnPickerAudio(
    isOpen: boolean,
    hymnalId?: string,
    hymnNumber?: number
) {
    const [audioMode, setAudioMode] = useState<HymnInsertAudioMode>(readStoredHymnAudioMode);
    const [audioVariant, setAudioVariant] = useState<HymnalAudioVariant>(readStoredHymnAudioVariant);
    const [audioPackInstalled, setAudioPackInstalled] = useState<boolean | null>(null);
    const [availableVariants, setAvailableVariants] = useState<{ minus: boolean; plus: boolean } | null>(null);

    const handleAudioModeChange = useCallback((mode: string) => {
        const next = (mode === 'auto' || mode === 'manual' || mode === 'delay' || mode === 'off') ? mode : 'auto';
        setAudioMode(next);
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(HYMN_AUDIO_MODE_STORAGE_KEY, next);
        } catch { /* ignore */ }
    }, []);

    const handleAudioVariantChange = useCallback((variant: HymnalAudioVariant) => {
        setAudioVariant(variant);
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(HYMN_AUDIO_VARIANT_STORAGE_KEY, variant);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (!isOpen || !hymnalId || !IpcService.isElectron()) {
            setAudioPackInstalled(null);
            setAvailableVariants(null);
            return;
        }
        const api = window.electron?.ipcRenderer?.hymnalAudio;
        if (!api) {
            setAudioPackInstalled(null);
            setAvailableVariants(null);
            return;
        }
        let cancelled = false;
        api.isInstalled(hymnalId)
            .then((installed) => { if (!cancelled) setAudioPackInstalled(installed); })
            .catch(() => { if (!cancelled) setAudioPackInstalled(null); });

        if (typeof hymnNumber === 'number' && api.getAvailableVariants) {
            api.getAvailableVariants(hymnalId, hymnNumber)
                .then((variants) => { if (!cancelled) setAvailableVariants(variants); })
                .catch(() => { if (!cancelled) setAvailableVariants(null); });
        } else {
            setAvailableVariants(null);
        }
        return () => { cancelled = true; };
    }, [isOpen, hymnalId, hymnNumber]);

    const effectiveAudioVariant: HymnalAudioVariant = useMemo(() => {
        if (!availableVariants) return audioVariant;
        if (audioVariant === 'minus' && !availableVariants.minus && availableVariants.plus) return 'plus';
        if (audioVariant === 'plus' && !availableVariants.plus && availableVariants.minus) return 'minus';
        return audioVariant;
    }, [audioVariant, availableVariants]);

    return {
        audioMode,
        effectiveAudioVariant,
        audioPackInstalled,
        availableVariants,
        handleAudioModeChange,
        handleAudioVariantChange,
    };
}

interface HymnPickerAudioControlsProps {
    audioPackInstalled: boolean | null;
    availableVariants: { minus: boolean; plus: boolean } | null;
    audioMode: HymnInsertAudioMode;
    audioVariant: HymnalAudioVariant;
    onAudioModeChange: (mode: string) => void;
    onAudioVariantChange: (variant: HymnalAudioVariant) => void;
}

/**
 * Footer audio controls for HymnPickerModal:
 * playback start strategy dropdown + Minus / Plus variant SegmentedControl.
 */
export const HymnPickerAudioControls: React.FC<HymnPickerAudioControlsProps> = React.memo(({
    audioPackInstalled,
    availableVariants,
    audioMode,
    audioVariant,
    onAudioModeChange,
    onAudioVariantChange,
}) => {
    const { t } = useTranslation();

    const audioModeOptions: DropdownOption[] = useMemo(() => [
        { value: 'auto', label: t('audio_mode_auto', 'Автозапуск'), icon: <Volume2 className="w-3.5 h-3.5 text-amber-400" /> },
        { value: 'manual', label: t('audio_mode_manual', 'По клику'), icon: <Hand className="w-3.5 h-3.5 text-stone-300" /> },
        { value: 'delay', label: t('audio_mode_delay', 'С задержкой'), icon: <Clock className="w-3.5 h-3.5 text-stone-300" /> },
        { value: 'off', label: t('audio_mode_off', 'Без аудио'), icon: <VolumeX className="w-3.5 h-3.5 text-stone-500" /> },
    ], [t]);

    const variantOptions: SegmentedControlOption<HymnalAudioVariant>[] = useMemo(() => {
        const minusDisabled = availableVariants !== null && !availableVariants.minus;
        const plusDisabled = availableVariants !== null && !availableVariants.plus;
        return [
            {
                value: 'minus',
                label: t('audio_variant_minus', 'Минус'),
                icon: <Music className="w-3 h-3" />,
                disabled: minusDisabled,
                title: minusDisabled
                    ? t('audio_variant_minus_unavailable', 'Минусовка для этого гимна не загружена')
                    : t('audio_variant_minus_hint', 'Инструментальная минусовка'),
            },
            {
                value: 'plus',
                label: t('audio_variant_plus', 'Плюс'),
                icon: <Mic className="w-3 h-3" />,
                disabled: plusDisabled,
                title: plusDisabled
                    ? t('audio_variant_plus_unavailable', 'Плюсовка для этого гимна не загружена')
                    : t('audio_variant_plus_hint', 'Фонограмма с вокалом'),
            },
        ];
    }, [availableVariants, t]);

    if (audioPackInstalled === false) {
        return (
            <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-700 text-[11px] font-medium text-stone-400 truncate"
                title={t('download_backing_tracks_tooltip', 'Откройте Настройки → Данные, чтобы скачать аудио')}
            >
                <Download className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                <span className="truncate">{t('download_backing_tracks_hint', 'Аудио не загружено (Настройки → Данные)')}</span>
            </span>
        );
    }

    // Do not show audio controls when audio pack is not confirmed installed or this hymn has neither minus nor plus track
    if (audioPackInstalled !== true) {
        return null;
    }

    const hasMinus = availableVariants?.minus === true;
    const hasPlus = availableVariants?.plus === true;
    if (!hasMinus && !hasPlus) {
        return null;
    }

    const showVariantToggle = audioMode !== 'off' && (hasMinus || hasPlus);

    return (
        <div className="flex items-center gap-2">
            {showVariantToggle && (
                <SegmentedControl<HymnalAudioVariant>
                    size="xs"
                    variant="accent"
                    value={audioVariant}
                    options={variantOptions}
                    onChange={onAudioVariantChange}
                />
            )}
            <div className="w-40">
                <DropdownSelector
                    size="xs"
                    value={audioMode}
                    options={audioModeOptions}
                    onChange={onAudioModeChange}
                    placeholder={t('backing_track_mode', 'Режим аудио')}
                />
            </div>
        </div>
    );
});

HymnPickerAudioControls.displayName = 'HymnPickerAudioControls';
