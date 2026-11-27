import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, IHymnSlide } from '@/core/types';
import { SOURCE_THEME_ID } from '@/core/types/hymn';
import { DEFAULT_HYMN_THEME } from '@/features/hymns/services/hymnThemeService';
import { getHymnThemeSwatchBackground } from '@/features/hymns/services/hymnThemeConstants';
import { getOrderedHymnSlides } from '@/features/hymns/services/hymnMigrationUtils';
import { useHymnIndex } from '@/features/hymns/services/hymnIndexCache';
import { useContainFit } from '@/core/hooks/useContainFit';
import { HymnSlideRenderer } from '@/features/presenter/components/display/HymnSlideRenderer';
import DropdownSelector, { DropdownOption } from '@/shared/ui/DropdownSelector';
import Button from '@/shared/ui/Button';
import SearchInput from '@/shared/ui/SearchInput';
import { Palette, Plus } from 'lucide-react';
import { CustomHymnStackIcon, CustomSlideStackIcon, PickerModalShell } from '@/shared/ui';
import { HymnPickerAudioControls, useHymnPickerAudio } from './HymnPickerAudioControls';
import { cn } from '@/core/utils/cn';
import { HymnPickerList, HymnPickerFooter, HymnRowItem } from './HymnPickerSidebar';

export const HymnPickerModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isRu = i18n.language?.startsWith('ru');
    const closeModal = useModalStore(s => s.closeModal);

    // Support nested modals
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.HYMN_PICKER))
    );
    const isOpen = !!modalData;
    const insertionIndex = modalData?.props?.insertionIndex as number | undefined;

    const addHymnToActivePresentation = usePresentationStore(s => s.addHymnToActivePresentation);

    // Data from Dexie — only query when modal is open to save RAM; exclude disabled hymnals.
    // Keep last resolved hymnals ref so transient `undefined` ticks during background DB writes
    // never empty `hymnalsMap` or blank out the picker list.
    const queriedHymnals = useLiveQuery(
        () => (isOpen ? db.hymnals.toArray().then(list => list.filter(h => !h.isDisabled)) : []),
        [isOpen]
    );
    const lastHymnalsRef = React.useRef<typeof queriedHymnals>(undefined);
    if (queriedHymnals !== undefined) {
        lastHymnalsRef.current = queriedHymnals;
    }
    const rawHymnals = queriedHymnals ?? lastHymnalsRef.current;

    const queriedThemes = useLiveQuery(() => (isOpen ? db.hymnThemes.toArray() : []), [isOpen]);
    const lastThemesRef = React.useRef<typeof queriedThemes>(undefined);
    if (queriedThemes !== undefined) {
        lastThemesRef.current = queriedThemes;
    }
    const rawThemes = queriedThemes ?? lastThemesRef.current;

    // State: 'ALL' by default to allow searching across all hymnals immediately
    const [selectedHymnalId, setSelectedHymnalId] = useState<string>('ALL');
    const [selectedThemeId, setSelectedThemeId] = useState<string>('default');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedHymnPresId, setSelectedHymnPresId] = useState<string | null>(null);
    const [selectedVerseIndex, setSelectedVerseIndex] = useState<number>(0);
    const [isHymnalPopoverOpen, setIsHymnalPopoverOpen] = useState(false);

    // Map hymnals for quick lookup
    const hymnalsMap = useMemo(() => {
        return new Map((rawHymnals || []).map(h => [h.id, h]));
    }, [rawHymnals]);

    // Instant in-memory hymn index (~2-3 MB total, pre-warmed at startup — 0ms open latency)
    const { entries: allIndexedEntries } = useHymnIndex(isOpen);

    // Filter & sort lightweight hymn entries for the selected hymnal (or all enabled hymnals)
    const scopedEntries = useMemo(() => {
        const matching = !selectedHymnalId || selectedHymnalId === 'ALL'
            ? allIndexedEntries.filter(e => hymnalsMap.has(e.hymnalId))
            : allIndexedEntries.filter(e => e.hymnalId === selectedHymnalId);

        const sorted = [...matching].sort((a, b) => {
            if (a.hymnalId !== b.hymnalId && (!selectedHymnalId || selectedHymnalId === 'ALL')) {
                const aHymnalName = hymnalsMap.get(a.hymnalId)?.name || '';
                const bHymnalName = hymnalsMap.get(b.hymnalId)?.name || '';
                const hComp = aHymnalName.localeCompare(bHymnalName);
                if (hComp !== 0) return hComp;
            }
            return a.order - b.order;
        });

        return sorted.map((e) => {
            const hymnalName = hymnalsMap.get(e.hymnalId)?.name;
            const row: HymnRowItem = {
                id: e.id,
                presentationId: e.presentationId,
                number: e.number,
                title: e.title,
                hymnalId: e.hymnalId,
                hymnalName,
                verseCount: e.verseCount,
            };
            return { entry: e, row, hymnalNameLower: (hymnalName || '').toLowerCase() };
        });
    }, [allIndexedEntries, selectedHymnalId, hymnalsMap]);

    // O(N) search filter with lyrics snippet extraction (no IndexedDB reads!)
    const filteredHymns = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return scopedEntries.map(s => s.row);
        const q = trimmed.toLowerCase();
        const results: HymnRowItem[] = [];

        for (const { entry, row, hymnalNameLower } of scopedEntries) {
            if (entry.number.includes(q) || entry.titleLower.includes(q) || hymnalNameLower.includes(q)) {
                results.push(row);
                continue;
            }
            for (let i = 0; i < entry.lowerTexts.length; i++) {
                const idx = entry.lowerTexts[i].indexOf(q);
                if (idx !== -1) {
                    const rawText = entry.rawTexts[i];
                    const start = Math.max(0, idx - 20);
                    const end = Math.min(rawText.length, idx + q.length + 20);
                    const snippet = rawText.substring(start, end).replace(/[\r\n]+/g, ' ');
                    results.push({ ...row, matchSnippet: `...${snippet}...` });
                    break;
                }
            }
        }
        return results;
    }, [scopedEntries, searchQuery]);

    // Auto-select first hymn on filter change
    useEffect(() => {
        if (filteredHymns.length > 0) {
            if (!selectedHymnPresId || !filteredHymns.some(h => h.presentationId === selectedHymnPresId)) {
                setSelectedHymnPresId(filteredHymns[0].presentationId);
                setSelectedVerseIndex(0);
            }
        } else {
            setSelectedHymnPresId(null);
            setSelectedVerseIndex(0);
        }
    }, [filteredHymns, selectedHymnPresId]);

    // Load full slide payload ONLY for the single currently selected hymn (O(1) IndexedDB get)
    const activeHymnPres = useLiveQuery(
        () => (isOpen && selectedHymnPresId) ? db.presentationFiles.get(selectedHymnPresId) : Promise.resolve(undefined),
        [isOpen, selectedHymnPresId]
    ) ?? null;

    // Check if audio pack & specific minus/plus tracks are installed on disk for the selected hymn
    const activeHymnalIdForAudio = activeHymnPres?.hymnalId || (selectedHymnalId !== 'ALL' ? selectedHymnalId : undefined);
    const {
        audioMode,
        effectiveAudioVariant,
        audioPackInstalled,
        availableVariants,
        handleAudioModeChange,
        handleAudioVariantChange,
    } = useHymnPickerAudio(isOpen, activeHymnalIdForAudio, activeHymnPres?.metadata?.hymnOrder);

    const verses: ISlide[] = useMemo(() => {
        if (!activeHymnPres) return [];
        return getOrderedHymnSlides(activeHymnPres);
    }, [activeHymnPres]);

    const currentVerse = verses[selectedVerseIndex] || verses[0];

    // Resolve the active theme once so every preview/thumbnail renders synchronously without duplicate DB reads
    const resolvedPreviewTheme = useMemo(() => {
        if (selectedThemeId === SOURCE_THEME_ID) return null;
        if (!selectedThemeId || selectedThemeId === 'default') {
            return (rawThemes || []).find(th => !!th.isDefault) || DEFAULT_HYMN_THEME;
        }
        return (rawThemes || []).find(th => th.id === selectedThemeId) || DEFAULT_HYMN_THEME;
    }, [rawThemes, selectedThemeId]);

    // Build temporary IHymnSlide for preview (always bind hymnPresentationId to activeHymnPres.id to prevent ID/slide mismatch)
    const previewHymnSlide: IHymnSlide | null = useMemo(() => {
        if (!activeHymnPres || !currentVerse) return null;
        return {
            id: currentVerse.id,
            type: 'hymn',
            order: selectedVerseIndex,
            blockId: 'default',
            templateId: '',
            hymnPresentationId: activeHymnPres.id,
            sourceSlideId: currentVerse.id,
            themeId: selectedThemeId || 'default',
            duration: 0,
            transition: { type: 'none', duration: 0.5 }
        };
    }, [activeHymnPres, currentVerse, selectedThemeId, selectedVerseIndex]);

    const { width: fitWidth, height: fitHeight, containerRef } = useContainFit(16 / 9, 32);

    const themeOptions: DropdownOption[] = useMemo(() => {
        const dbDefault = (rawThemes || []).find(th => !!th.isDefault) || DEFAULT_HYMN_THEME;
        const renderSwatch = (bg: string, color: string, fontFamily?: string) => (
            <span
                className="w-5 h-5 rounded-md border border-white/15 flex items-center justify-center text-[10px] font-bold shrink-0 leading-none"
                style={{ background: bg, color, fontFamily }}
            >
                А
            </span>
        );

        const list: DropdownOption[] = [
            {
                value: 'default',
                label: (isRu && dbDefault.nameRu ? dbDefault.nameRu : dbDefault.name) || t('default_theme', 'По умолчанию'),
                icon: renderSwatch(
                    getHymnThemeSwatchBackground(dbDefault),
                    dbDefault.textStyle?.color || '#FFFFFF',
                    dbDefault.textStyle?.fontFamily
                )
            },
            {
                value: SOURCE_THEME_ID,
                label: t('source_theme', 'Оригинал'),
                icon: <Palette className="w-4 h-4 text-purple-400" />
            }
        ];

        (rawThemes || []).forEach(th => {
            if (th.isDefault) return;
            list.push({
                value: th.id,
                label: isRu && th.nameRu ? th.nameRu : th.name,
                keywords: `${th.name} ${th.nameRu || ''} ${th.textStyle?.fontFamily || ''}`,
                icon: renderSwatch(
                    getHymnThemeSwatchBackground(th),
                    th.textStyle?.color || '#FFFFFF',
                    th.textStyle?.fontFamily
                )
            });
        });

        return list;
    }, [rawThemes, isRu, t]);

    // Handle insertion as an embedded nested presentation (snapshot mode) so it behaves identically to embedded presentations
    const handleInsert = useCallback(async () => {
        if (!selectedHymnPresId) return;
        const hasTrackOnDisk = audioPackInstalled === true
            && availableVariants !== null
            && (availableVariants.minus || availableVariants.plus);
        const shouldIncludeAudio = hasTrackOnDisk && audioMode !== 'off';

        await addHymnToActivePresentation(selectedHymnPresId, selectedThemeId, insertionIndex, {
            mode: 'nested-hymn',
            includeAudio: shouldIncludeAudio,
            audioStrategy: shouldIncludeAudio ? audioMode : undefined,
            audioVariant: shouldIncludeAudio ? effectiveAudioVariant : undefined,
        });
        closeModal(ModalType.HYMN_PICKER);
    }, [
        selectedHymnPresId,
        selectedThemeId,
        insertionIndex,
        audioPackInstalled,
        availableVariants,
        audioMode,
        effectiveAudioVariant,
        addHymnToActivePresentation,
        closeModal,
    ]);

    const handleModalKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (!searchQuery && selectedHymnPresId))) {
            e.preventDefault();
            handleInsert();
        }
    }, [handleInsert, searchQuery, selectedHymnPresId]);

    const handleClose = useCallback(() => {
        closeModal(ModalType.HYMN_PICKER);
    }, [closeModal]);

    return (
        <PickerModalShell
            isOpen={isOpen}
            onClose={handleClose}
            onKeyDown={handleModalKeyDown}
            disableEscapeClose={isHymnalPopoverOpen}
            sidebarIcon={<CustomHymnStackIcon className="w-4 h-4" />}
            sidebarTitle={t('add_hymn_slide', 'Вставить гимн')}
            sidebarHeaderExtra={
                <SearchInput
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    placeholder={t('search_hymns_placeholder', 'Поиск по номеру, названию или словам...')}
                    autoFocus
                />
            }
            sidebarBody={
                <HymnPickerList
                    selectedHymnalId={selectedHymnalId}
                    searchQuery={searchQuery}
                    filteredHymns={filteredHymns}
                    selectedHymnPresId={selectedHymnPresId}
                    onSelectHymn={(presId) => {
                        setSelectedHymnPresId(presId);
                        setSelectedVerseIndex(0);
                    }}
                />
            }
            sidebarFooter={
                <HymnPickerFooter
                    hymnals={rawHymnals || []}
                    selectedHymnalId={selectedHymnalId}
                    onSelectHymnalId={(val) => {
                        setSelectedHymnalId(val);
                        setSelectedHymnPresId(null);
                        setSelectedVerseIndex(0);
                    }}
                    onPickerOpenChange={setIsHymnalPopoverOpen}
                />
            }
            contentTitle={activeHymnPres?.name || t('select_hymn_to_preview', 'Выберите гимн')}
            contentBadge={
                verses.length > 0 ? (
                    <span
                        title={t('slides_count', { count: verses.length, defaultValue: `${verses.length} слайдов` })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/10 rounded-md text-[10px] font-semibold text-stone-400 shrink-0 tabular-nums"
                    >
                        <CustomSlideStackIcon className="w-3 h-3 opacity-75 shrink-0" />
                        <span>{verses.length}</span>
                    </span>
                ) : undefined
            }
            contentHeaderRight={
                <div className="w-56">
                    <DropdownSelector
                        size="xs"
                        searchable
                        searchPlaceholder={t('search_themes', 'Поиск темы...')}
                        value={selectedThemeId}
                        options={themeOptions}
                        onChange={setSelectedThemeId}
                        placeholder={t('hymn_theme', 'Тема оформления')}
                    />
                </div>
            }
            preview={
                <div
                    ref={containerRef}
                    className="flex-1 flex flex-col items-center justify-center relative overflow-hidden group/main-preview p-6 min-h-0"
                >
                    {!activeHymnPres || !previewHymnSlide ? (
                        <div className="text-stone-600 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5">
                                <CustomHymnStackIcon className="w-8 h-8 opacity-30" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
                                {t('select_hymn_to_preview', 'Выберите гимн для просмотра')}
                            </p>
                        </div>
                    ) : (() => {
                        const w = fitWidth || 800;
                        const h = fitHeight || Math.round(w / (16 / 9));
                        return (
                            <div
                                className="relative shadow-[0_24px_70px_rgba(0,0,0,0.75)] rounded-xl overflow-hidden border border-white/10 shrink-0"
                                style={{ width: w, height: h }}
                            >
                                <HymnSlideRenderer
                                    slide={previewHymnSlide}
                                    scale={w / 1920}
                                    sourcePresentation={activeHymnPres}
                                    themeOverride={resolvedPreviewTheme}
                                />
                            </div>
                        );
                    })()}
                </div>
            }
            tray={
                verses.length > 0 && activeHymnPres ? (
                    <div className="h-[100px] shrink-0 bg-[#141210] border-t border-white/[0.06] flex items-center px-6 gap-2.5 overflow-x-auto no-scrollbar">
                        {verses.map((verse, index) => {
                            const isCurrent = selectedVerseIndex === index;
                            const miniSlide: IHymnSlide = {
                                id: verse.id,
                                type: 'hymn',
                                order: index,
                                blockId: 'default',
                                templateId: '',
                                hymnPresentationId: activeHymnPres.id,
                                sourceSlideId: verse.id,
                                themeId: selectedThemeId || 'default',
                                duration: 0,
                                transition: { type: 'none', duration: 0.5 }
                            };

                            return (
                                <button
                                    key={verse.id}
                                    type="button"
                                    onClick={() => setSelectedVerseIndex(index)}
                                    className={cn(
                                        "relative h-[68px] aspect-video rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer group apple-press",
                                        isCurrent
                                            ? "border-accent ring-2 ring-accent/30 shadow-lg shadow-black/50"
                                            : "border-white/10 hover:border-white/25 opacity-65 hover:opacity-100 bg-black"
                                    )}
                                >
                                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                        <HymnSlideRenderer
                                            slide={miniSlide}
                                            scale={121 / 1920}
                                            sourcePresentation={activeHymnPres}
                                            themeOverride={resolvedPreviewTheme}
                                        />
                                    </div>

                                    <div className={cn(
                                        "absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold z-10 tabular-nums leading-none",
                                        isCurrent
                                            ? "bg-accent text-stone-950"
                                            : "bg-black/70 text-stone-300 border border-white/10"
                                    )}>
                                        {index + 1}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : undefined
            }
            footerLeft={
                selectedHymnPresId ? (
                    <HymnPickerAudioControls
                        audioPackInstalled={audioPackInstalled}
                        availableVariants={availableVariants}
                        audioMode={audioMode}
                        audioVariant={effectiveAudioVariant}
                        onAudioModeChange={handleAudioModeChange}
                        onAudioVariantChange={handleAudioVariantChange}
                    />
                ) : (
                    <span className="text-xs text-stone-500">
                        {t('select_hymn_to_preview', 'Выберите гимн для просмотра')}
                    </span>
                )
            }
            footerRight={
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleInsert}
                    disabled={!selectedHymnPresId}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="px-5 font-bold tracking-wide shrink-0"
                >
                    {t('add_to_timeline', 'Добавить на таймлайн')}
                </Button>
            }
        />
    );
};

export default HymnPickerModal;
