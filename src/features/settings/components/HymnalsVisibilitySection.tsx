import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    ChevronDown,
    ChevronRight,
    Download,
    Trash2,
    Languages,
    Heart,
    ExternalLink,
    Music,
    Mic,
} from 'lucide-react';
import { useSetAtom } from 'jotai';
import { db } from '@/core/db';
import { IHymnal } from '@/core/types/hymn';
import { removeHymnalModalAtom } from '@/core/store/uiAtoms';
import {
    BUILTIN_HYMNAL_AUDIO_CATALOG,
    HymnalAudioPackEntry,
    formatBytesMb,
    formatTrackCount,
    getAudioPackStorageKey,
    hasPackDownloadSource,
} from '@/features/hymns/services/hymnalAudioCatalog';
import { Card, Switch, Button, SearchInput, Tooltip, CustomHymnalIcon } from '@/shared/ui';
import { useHymnalAudioPacks } from './useHymnalAudioPacks';
import { HymnalSettingsRow } from './HymnalSettingsRow';

const formatLanguageName = (lang: string): string => {
    const code = (lang || 'ru').toLowerCase();
    const map: Record<string, string> = {
        ru: 'Русский',
        en: 'English',
        de: 'Deutsch',
        uk: 'Українська',
        es: 'Español',
        fr: 'Français',
    };
    return map[code] ?? code.toUpperCase();
};

const formatHymnalCount = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'сборник'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'сборника'
            : 'сборников';
    return `${count} ${word}`;
};

const AUDIO_PACKS_BY_HYMNAL_ID = (() => {
    const map = new Map<string, HymnalAudioPackEntry[]>();
    for (const pack of BUILTIN_HYMNAL_AUDIO_CATALOG) {
        const list = map.get(pack.hymnalId);
        if (list) list.push(pack);
        else map.set(pack.hymnalId, [pack]);
    }
    return map;
})();

/**
 * Unified Settings -> Data section for managing hymnals and their backing track audio packs,
 * organized into collapsible language groups with optimized search and batch actions.
 */
export const HymnalsVisibilitySection: React.FC = () => {
    const { t } = useTranslation();
    const setRemoveModal = useSetAtom(removeHymnalModalAtom);
    const rawHymnals = useLiveQuery(() => db.hymnals.toArray(), []);
    const [search, setSearch] = useState('');
    const [collapsedLangs, setCollapsedLangs] = useState<Record<string, boolean>>({});

    const audio = useHymnalAudioPacks();

    // Pre-index hymnals once for O(N) search
    const indexedHymnals = useMemo(() => {
        return (rawHymnals || []).map(h => {
            const lang = (h.language || 'ru').toLowerCase();
            const langName = formatLanguageName(lang);
            return {
                hymnal: h,
                lang,
                searchKey: `${h.name} ${lang} ${langName}`.toLowerCase(),
            };
        });
    }, [rawHymnals]);

    // Group filtered hymnals by language
    const languageGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const map = new Map<string, IHymnal[]>();
        for (const item of indexedHymnals) {
            if (q && !item.searchKey.includes(q)) continue;
            const list = map.get(item.lang);
            if (list) list.push(item.hymnal);
            else map.set(item.lang, [item.hymnal]);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([lang, list]) => ({
                lang,
                name: formatLanguageName(lang),
                hymnals: list.sort((a, b) => a.name.localeCompare(b.name)),
            }));
    }, [indexedHymnals, search]);

    // Global batch audio pack targets (separated into Minus and Plus)
    const allDownloadableMinusPacks = useMemo(() => {
        if (!audio.isAvailable) return [];
        return BUILTIN_HYMNAL_AUDIO_CATALOG.filter(p => {
            if ((p.variant ?? 'minus') !== 'minus' || !hasPackDownloadSource(p)) return false;
            const key = getAudioPackStorageKey(p.hymnalId, 'minus');
            const inst = audio.installedMap[key];
            return !inst || inst.version < p.version;
        });
    }, [audio.isAvailable, audio.installedMap]);

    const allDownloadablePlusPacks = useMemo(() => {
        if (!audio.isAvailable) return [];
        return BUILTIN_HYMNAL_AUDIO_CATALOG.filter(p => {
            if (p.variant !== 'plus' || !hasPackDownloadSource(p)) return false;
            const key = getAudioPackStorageKey(p.hymnalId, 'plus');
            const inst = audio.installedMap[key];
            return !inst || inst.version < p.version;
        });
    }, [audio.isAvailable, audio.installedMap]);

    const allInstalledPacks = useMemo(() => {
        if (!audio.isAvailable) return [];
        return BUILTIN_HYMNAL_AUDIO_CATALOG.filter(p => {
            const key = getAudioPackStorageKey(p.hymnalId, p.variant ?? 'minus');
            return Boolean(audio.installedMap[key]);
        });
    }, [audio.isAvailable, audio.installedMap]);

    const summarizePacks = useCallback((packs: HymnalAudioPackEntry[], label: string): string => {
        const tracks = packs.reduce((sum, p) => sum + p.trackCount, 0);
        const bytes = packs.reduce((sum, p) => sum + p.sizeBytes, 0);
        return `${label}: ${formatTrackCount(tracks)} • ~${formatBytesMb(bytes)}`;
    }, []);

    const isAnyBusy = Object.values(audio.progressMap).some(
        p => p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting'
    );

    const handleToggleHymnal = useCallback(async (hymnal: IHymnal, enabled: boolean) => {
        await db.hymnals.update(hymnal.id, { isDisabled: !enabled });
    }, []);

    const handleToggleLanguage = useCallback(async (hymnals: IHymnal[], enabled: boolean) => {
        await db.transaction('rw', db.hymnals, async () => {
            for (const h of hymnals) {
                await db.hymnals.update(h.id, { isDisabled: !enabled });
            }
        });
    }, []);

    const handleRemoveHymnal = useCallback((hymnal: IHymnal) => {
        setRemoveModal({ isOpen: true, hymnal });
    }, [setRemoveModal]);

    const handleRemoveSingleAudio = useCallback((pack: HymnalAudioPackEntry) => {
        audio.removePacks([pack]);
    }, [audio]);

    const toggleCollapse = useCallback((lang: string) => {
        setCollapsedLangs(prev => ({ ...prev, [lang]: !prev[lang] }));
    }, []);

    if (!rawHymnals || rawHymnals.length === 0) return null;

    const isSearching = search.trim().length > 0;

    return (
        <Card padding="md" rounded="xl" className="relative overflow-hidden">
            <div className="flex flex-col gap-4">
                {/* Header + Global Audio Batch Controls */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="p-2.5 bg-accent/15 rounded-2xl shrink-0 text-accent">
                            <CustomHymnalIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-white tracking-tight">
                                {t('hymnals_visibility_title', 'Сборники гимнов и минусовки')}
                            </h3>
                            <p className="text-xs text-stone-400 font-medium mt-1 leading-relaxed">
                                {t(
                                    'hymnals_visibility_desc',
                                    'Отключайте ненужные языки и сборники и управляйте минусовками (.mrta). Тексты остаются в базе, поэтому уже вставленные в презентации гимны продолжат работать.'
                                )}
                            </p>
                        </div>
                    </div>

                    {audio.isAvailable && (allDownloadableMinusPacks.length > 0 || allDownloadablePlusPacks.length > 0 || allInstalledPacks.length > 0) && (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {allDownloadableMinusPacks.length > 0 && (
                                <Tooltip
                                    content={summarizePacks(allDownloadableMinusPacks, t('audio_variant_minus_pack', 'Минусовки'))}
                                    position="bottom"
                                    delay={150}
                                >
                                    <Button
                                        size="xs"
                                        variant="primary"
                                        disabled={audio.isLoading || isAnyBusy}
                                        onClick={() => audio.downloadPacks(allDownloadableMinusPacks)}
                                        leftIcon={<Music className="w-3.5 h-3.5" />}
                                    >
                                        {t('download_all_minus', 'Скачать минусовки')}
                                    </Button>
                                </Tooltip>
                            )}
                            {allDownloadablePlusPacks.length > 0 && (
                                <Tooltip
                                    content={summarizePacks(allDownloadablePlusPacks, t('audio_variant_plus_pack', 'Плюсовки'))}
                                    position="bottom"
                                    delay={150}
                                >
                                    <Button
                                        size="xs"
                                        variant="secondary"
                                        disabled={audio.isLoading || isAnyBusy}
                                        onClick={() => audio.downloadPacks(allDownloadablePlusPacks)}
                                        leftIcon={<Mic className="w-3.5 h-3.5" />}
                                    >
                                        {t('download_all_plus', 'Скачать плюсовки')}
                                    </Button>
                                </Tooltip>
                            )}
                            {allInstalledPacks.length > 0 && (
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    disabled={audio.isLoading || isAnyBusy}
                                    onClick={() => audio.removePacks(allInstalledPacks)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                                >
                                    {t('delete_all_audio', 'Удалить всё')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Search */}
                <SearchInput
                    size="sm"
                    placeholder={t('hymns.search_hymnals_placeholder', 'Поиск сборников и языков...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClear={() => setSearch('')}
                />

                {/* Language Accordion Groups */}
                {languageGroups.length === 0 ? (
                    <p className="text-xs text-stone-500 text-center py-6">
                        {t('no_results', 'Ничего не найдено')}
                    </p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {languageGroups.map((group) => {
                            const isExpanded = isSearching || !collapsedLangs[group.lang];
                            const allEnabled = group.hymnals.every(h => !h.isDisabled);
                            const groupPacks = group.hymnals.flatMap(h => AUDIO_PACKS_BY_HYMNAL_ID.get(h.id) || []);
                            const downloadableGroupMinus = groupPacks.filter(p => {
                                if ((p.variant ?? 'minus') !== 'minus' || !hasPackDownloadSource(p)) return false;
                                const key = getAudioPackStorageKey(p.hymnalId, 'minus');
                                const inst = audio.installedMap[key];
                                return !inst || inst.version < p.version;
                            });
                            const downloadableGroupPlus = groupPacks.filter(p => {
                                if (p.variant !== 'plus' || !hasPackDownloadSource(p)) return false;
                                const key = getAudioPackStorageKey(p.hymnalId, 'plus');
                                const inst = audio.installedMap[key];
                                return !inst || inst.version < p.version;
                            });
                            const installedGroupPacks = groupPacks.filter(p => {
                                const key = getAudioPackStorageKey(p.hymnalId, p.variant ?? 'minus');
                                return Boolean(audio.installedMap[key]);
                            });

                            return (
                                <div
                                    key={group.lang}
                                    className="rounded-xl border border-white/[0.07] bg-stone-900/45 overflow-hidden"
                                >
                                    {/* Language Group Header */}
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleCollapse(group.lang)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleCollapse(group.lang);
                                            }
                                        }}
                                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {isExpanded
                                                ? <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                                                : <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />}
                                            <div className="w-7 h-7 rounded-lg bg-stone-800/80 border border-white/[0.06] flex items-center justify-center text-stone-300 shrink-0">
                                                <Languages className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-sm font-bold text-stone-100 truncate">
                                                {group.name}
                                            </span>
                                            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider shrink-0">
                                                {group.lang.toUpperCase()} • {formatHymnalCount(group.hymnals.length)}
                                            </span>
                                        </div>

                                        <div
                                            className="flex items-center gap-2 shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {audio.isAvailable && downloadableGroupMinus.length > 0 && (
                                                <Tooltip
                                                    content={summarizePacks(downloadableGroupMinus, t('audio_variant_minus_pack', 'Минусовки'))}
                                                    position="top"
                                                    delay={150}
                                                >
                                                    <Button
                                                        size="xs"
                                                        variant="secondary"
                                                        disabled={audio.isLoading || isAnyBusy}
                                                        onClick={() => audio.downloadPacks(downloadableGroupMinus)}
                                                        leftIcon={<Download className="w-3 h-3" />}
                                                    >
                                                        {t('audio_variant_minus_pack', 'Минусовки')}
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {audio.isAvailable && downloadableGroupPlus.length > 0 && (
                                                <Tooltip
                                                    content={summarizePacks(downloadableGroupPlus, t('audio_variant_plus_pack', 'Плюсовки'))}
                                                    position="top"
                                                    delay={150}
                                                >
                                                    <Button
                                                        size="xs"
                                                        variant="secondary"
                                                        disabled={audio.isLoading || isAnyBusy}
                                                        onClick={() => audio.downloadPacks(downloadableGroupPlus)}
                                                        leftIcon={<Mic className="w-3 h-3" />}
                                                    >
                                                        {t('audio_variant_plus_pack', 'Плюсовки')}
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {audio.isAvailable && installedGroupPacks.length > 0 && (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    disabled={audio.isLoading || isAnyBusy}
                                                    onClick={() => audio.removePacks(installedGroupPacks, group.name)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    leftIcon={<Trash2 className="w-3 h-3" />}
                                                >
                                                    {t('delete_audio', 'Удалить аудио')}
                                                </Button>
                                            )}
                                            <Switch
                                                checked={allEnabled}
                                                onChange={(checked) => handleToggleLanguage(group.hymnals, checked)}
                                                aria-label={group.name}
                                            />
                                        </div>
                                    </div>

                                    {/* Language Group Items */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-white/[0.05]">
                                            {group.hymnals.map((hymnal) => {
                                                const packs = AUDIO_PACKS_BY_HYMNAL_ID.get(hymnal.id) || [];
                                                return (
                                                    <HymnalSettingsRow
                                                        key={hymnal.id}
                                                        hymnal={hymnal}
                                                        audioPacks={packs}
                                                        audioAvailable={audio.isAvailable}
                                                        audioLoading={audio.isLoading}
                                                        installedMap={audio.installedMap}
                                                        progressMap={audio.progressMap}
                                                        onToggleEnabled={handleToggleHymnal}
                                                        onRemoveHymnal={handleRemoveHymnal}
                                                        onDownloadAudio={audio.downloadPack}
                                                        onInstallAudioFromFile={audio.installFromFile}
                                                        onCancelAudioDownload={audio.cancelDownload}
                                                        onRemoveAudio={handleRemoveSingleAudio}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Credits & Attribution */}
                <div className="pt-4 border-t border-white/5 space-y-2">
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
            </div>
        </Card>
    );
};
