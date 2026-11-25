import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CustomHymnalIcon, VirtualList, VirtualListHandle } from '@/shared/ui';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { IHymnal } from '@/core/types/hymn';
import { ISlide } from '@/core/types/presentation';
import { useAtom } from 'jotai';
import { hymnModalReturnStateAtom, activeHymnalIdAtom } from '@/core/store/uiAtoms';
import { HymnalInfoModal } from './HymnalInfoModal';
import { hymnLibraryService } from '../services/hymnLibraryService';
import { getOrderedHymnSlides } from '../services/hymnMigrationUtils';
import { useHymnIndex } from '../services/hymnIndexCache';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { HymnListItem, HymnRowData } from './HymnListItem';

// ─── HymnsBrowser Main ─────────────────────────────────────────────────────────

interface HymnsBrowserProps {
    onAddHymn?: (hymnPresentationId: string, themeId: string) => void;
    searchQuery?: string;
}

export const HymnsBrowser: React.FC<HymnsBrowserProps> = ({ onAddHymn, searchQuery: externalQuery }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';

    // State
    const [activeHymnalId, setActiveHymnalId] = useAtom(activeHymnalIdAtom);
    const [activeHymnId, setActiveHymnId] = useState<string | null>(null);
    const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
    const [selectedThemeId, setSelectedThemeId] = useState<string>('');

    const searchQuery = externalQuery ?? '';

    // Modals
    // audit-ignore: local modal state isolated to this component
    const [infoModal, setInfoModal] = useState<{ hymnal: IHymnal; view: 'info' | 'thematic' } | null>(null);
    const [hymnReturnState, setHymnReturnState] = useAtom(hymnModalReturnStateAtom);

    // Refs
    const listRef = useRef<VirtualListHandle>(null);
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up click timer on unmount
    useEffect(() => {
        return () => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    // DB Data (only enabled hymnals are visible in browser)
    const rawHymnals = useLiveQuery(() => db.hymnals.toArray());
    const hymnals = useMemo(() => (rawHymnals ?? []).filter(h => !h.isDisabled), [rawHymnals]);

    const rawThemes = useLiveQuery(() => db.hymnThemes.toArray());
    const themes = useMemo(() => rawThemes ?? [], [rawThemes]);

    // Instant in-memory hymn index (~2-3 MB total, shared with HymnPickerModal)
    const { entries: allIndexedEntries } = useHymnIndex(Boolean(activeHymnalId));

    const indexedHymns = useMemo(() => {
        if (!activeHymnalId) return [];
        const enabledMap = new Map(hymnals.map(h => [h.id, h]));
        const matching = activeHymnalId === 'ALL'
            ? allIndexedEntries.filter(e => enabledMap.has(e.hymnalId))
            : allIndexedEntries.filter(e => e.hymnalId === activeHymnalId);

        const sorted = [...matching].sort((a, b) => {
            if (activeHymnalId === 'ALL' && a.hymnalId !== b.hymnalId) {
                const aName = enabledMap.get(a.hymnalId)?.name || '';
                const bName = enabledMap.get(b.hymnalId)?.name || '';
                const cmp = aName.localeCompare(bName);
                if (cmp !== 0) return cmp;
            }
            return a.order - b.order;
        });

        return sorted.map((e) => {
            const hymnalName = activeHymnalId === 'ALL' ? enabledMap.get(e.hymnalId)?.name : undefined;
            const row: HymnRowData = {
                id: e.id,
                number: e.number,
                title: e.title,
                presentationId: e.presentationId,
                matchedSnippet: hymnalName,
            };
            return { row, titleLower: e.titleLower, rawTexts: e.rawTexts, lowerTexts: e.lowerTexts };
        });
    }, [activeHymnalId, hymnals, allIndexedEntries]);

    // Load full slide data ONLY for the single currently selected hymn
    const currentHymnPres = useLiveQuery(
        () => activeHymnId ? db.presentationFiles.get(activeHymnId) : Promise.resolve(undefined),
        [activeHymnId]
    ) ?? null;

    const verses: ISlide[] = useMemo(() => {
        if (!currentHymnPres?.slides) return [];
        return getOrderedHymnSlides(currentHymnPres);
    }, [currentHymnPres]);

    // Presentation store actions + single live-hymn check (avoids per-row useLiveQuery during scroll)
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setActivePresentation = usePresentationStore(s => s.setActivePresentation);
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const liveRootPresentationId = usePresentationStore(s => s.liveRootPresentationId);
    const liveHymnPresId = useMemo(() => {
        if (!liveSlideId) return null;
        return liveRootPresentationId;
    }, [liveSlideId, liveRootPresentationId]);

    // Sync activeHymnId with presentationStore so the timeline knows what to render
    useEffect(() => {
        if (activeHymnId !== undefined) {
            setActivePresentation(activeHymnId);
        }
    }, [activeHymnId, setActivePresentation]);

    const filteredHymns = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return indexedHymns.map(entry => entry.row);
        const q = trimmed.toLowerCase();
        const results: HymnRowData[] = [];

        for (const entry of indexedHymns) {
            if (entry.titleLower.includes(q) || entry.row.number.includes(q)) {
                results.push(entry.row);
                continue;
            }
            for (let i = 0; i < entry.lowerTexts.length; i++) {
                const idx = entry.lowerTexts[i].indexOf(q);
                if (idx !== -1) {
                    const rawText = entry.rawTexts[i];
                    const start = Math.max(0, idx - 20);
                    const end = Math.min(rawText.length, idx + q.length + 20);
                    let snippet = rawText.substring(start, end).replace(/[\r\n]+/g, ' ');
                    if (start > 0) snippet = '...' + snippet;
                    if (end < rawText.length) snippet = snippet + '...';
                    results.push({ ...entry.row, matchedSnippet: snippet });
                    break;
                }
            }
        }
        return results;
    }, [indexedHymns, searchQuery]);

    useEffect(() => {
        if (!selectedThemeId && themes.length > 0) {
            const defaultTheme = themes.find((t) => t.isDefault) ?? themes[0];
            setSelectedThemeId(defaultTheme.id);
        }
    }, [themes, selectedThemeId]);

    // Auto-select a valid enabled hymnal if activeHymnalId is empty, disabled, or removed (preserve 'ALL')
    useEffect(() => {
        if (hymnals.length === 0) {
            if (activeHymnalId) setActiveHymnalId(null);
            return;
        }
        if (activeHymnalId === 'ALL') return;
        if (!activeHymnalId || !hymnals.some(h => h.id === activeHymnalId)) {
            setActiveHymnalId(hymnals[0].id);
        }
    }, [hymnals, activeHymnalId, setActiveHymnalId]);

    useEffect(() => {
        setActiveHymnId(null);
        setSelectedVerseId(null);
    }, [activeHymnalId]);

    useEffect(() => {
        if (verses.length > 0 && !selectedVerseId) {
            setSelectedVerseId(verses[0].id);
        }
    }, [verses, selectedVerseId]);

    useEffect(() => {
        if (hymnReturnState?.isOpen && hymnReturnState.activeHymnalId) {
            const hymnal = hymnals.find((h) => h.id === hymnReturnState.activeHymnalId);
            if (hymnal) {
                setInfoModal({ hymnal, view: hymnReturnState.view });
                setHymnReturnState({ ...hymnReturnState, isOpen: false });
            }
        }
    }, [hymnReturnState, hymnals, setHymnReturnState]);

    // Handlers
    const handleSelectHymn = useCallback((hymnId: string) => {
        setActiveHymnId((prev) => {
            if (prev === hymnId) return null;
            setSelectedVerseId(null);
            return hymnId;
        });
    }, []);

    const hasSearchSnippets = Boolean(searchQuery.trim()) || activeHymnalId === 'ALL';
    const rowHeight = hasSearchSnippets ? 66 : 52;

    const handleSelectFromThematic = useCallback((hymnalId: string, hymnNumber: string) => {
        setActiveHymnalId(hymnalId);
        setTimeout(() => {
            const idx = filteredHymns.findIndex(h => h.number === hymnNumber);
            if (idx !== -1) {
                listRef.current?.scrollToIndex(idx, 'center');
                setActiveHymnId(filteredHymns[idx].id);
            }
        }, 200);
    }, [setActiveHymnalId, filteredHymns]);

    const getHymnKey = useCallback((hymn: HymnRowData) => hymn.id, []);

    const renderHymnItem = useCallback((hymn: HymnRowData) => (
        <HymnListItem
            hymn={hymn}
            isActive={activeHymnId === hymn.id}
            isLive={liveHymnPresId === hymn.presentationId}
            searchQuery={searchQuery}
            themes={themes}
            selectedThemeId={selectedThemeId}
            onThemeChange={setSelectedThemeId}
            onSelect={handleSelectHymn}
            lang={lang}
        />
    ), [activeHymnId, liveHymnPresId, searchQuery, themes, selectedThemeId, handleSelectHymn, lang]);

    const handleInsert = useCallback(() => {
        if (!activeHymnId || !selectedThemeId || !onAddHymn) return;
        onAddHymn(activeHymnId, selectedThemeId);
    }, [activeHymnId, selectedThemeId, onAddHymn]);

    const handleLiveVerse = useCallback((slideId: string) => {
        if (!activeHymnId) return;
        setLiveSlide(slideId, activeHymnId, activeHymnId, null, null);
    }, [activeHymnId, setLiveSlide]);

    const handlePreviewVerse = useCallback((slideId: string) => {
        if (!activeHymnId) return;
        setPreviewSlide(slideId, activeHymnId, activeHymnId, null, null);
    }, [activeHymnId, setPreviewSlide]);

    const handleSelectVerse = useCallback((slideId: string, isDoubleClick: boolean) => {
        setSelectedVerseId(slideId);
        if (isDoubleClick) {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
            }
            handleLiveVerse(slideId);
        } else {
            if (clickTimerRef.current) return;
            clickTimerRef.current = setTimeout(() => {
                handlePreviewVerse(slideId);
                clickTimerRef.current = null;
            }, 250);
        }
    }, [handleLiveVerse, handlePreviewVerse]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            );
            if (isTyping) return;

            const isShiftOrCmd = e.shiftKey || e.metaKey || (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'));
            const isCtrlOnly = e.ctrlKey && !e.metaKey && !e.shiftKey;

            if (isShiftOrCmd && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                if (filteredHymns.length === 0) return;
                const currentIdx = filteredHymns.findIndex(h => h.id === activeHymnId);
                let nextIdx = 0;
                if (e.key === 'ArrowDown') {
                    nextIdx = currentIdx < filteredHymns.length - 1 ? currentIdx + 1 : 0;
                } else {
                    nextIdx = currentIdx > 0 ? currentIdx - 1 : filteredHymns.length - 1;
                }
                const nextHymn = filteredHymns[nextIdx];
                if (nextHymn) {
                    setActiveHymnId(nextHymn.id);
                    setSelectedVerseId(null);
                }
                return;
            }

            if (verses.length > 0) {
                const currentVerseIdx = verses.findIndex(v => v.id === selectedVerseId);

                if (isCtrlOnly && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    let nextIdx = 0;
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        nextIdx = currentVerseIdx < verses.length - 1 ? currentVerseIdx + 1 : 0;
                    } else {
                        nextIdx = currentVerseIdx > 0 ? currentVerseIdx - 1 : verses.length - 1;
                    }
                    const nextVerse = verses[nextIdx];
                    if (nextVerse) {
                        setSelectedVerseId(nextVerse.id);
                        handlePreviewVerse(nextVerse.id);
                    }
                    return;
                }

                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    let nextIdx = 0;
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        nextIdx = currentVerseIdx < verses.length - 1 ? currentVerseIdx + 1 : 0;
                    } else {
                        nextIdx = currentVerseIdx > 0 ? currentVerseIdx - 1 : verses.length - 1;
                    }
                    const nextVerse = verses[nextIdx];
                    if (nextVerse) {
                        setSelectedVerseId(nextVerse.id);
                    }
                    return;
                }
            }

            if (e.key === 'Enter') {
                if (selectedVerseId) {
                    e.preventDefault();
                    handleLiveVerse(selectedVerseId);
                }
            } else if (e.key === ' ') {
                if (selectedVerseId) {
                    e.preventDefault();
                    handlePreviewVerse(selectedVerseId);
                }
            } else if (e.key === 'Escape') {
                setActiveHymnId(null);
                setSelectedVerseId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredHymns, activeHymnId, verses, selectedVerseId, handleLiveVerse, handlePreviewVerse]);

    return (
        <div className="flex flex-col h-full bg-stone-900 overflow-hidden">
            {!activeHymnalId ? (
                <div className="flex flex-col items-center justify-center flex-1 text-stone-500 py-12 px-3">
                    <CustomHymnalIcon className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">{t('hymns.select_hymnal_prompt', 'Выберите сборник гимнов')}</p>
                </div>
            ) : (
                <VirtualList
                    listRef={listRef}
                    items={filteredHymns}
                    getItemKey={getHymnKey}
                    renderItem={renderHymnItem}
                    itemHeight={rowHeight}
                    gap={6}
                    overscan={14}
                    resetKey={`${activeHymnalId}:${searchQuery}`}
                    className="px-3 py-3"
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                            <CustomHymnalIcon className="w-8 h-8 mb-3 opacity-40" />
                            <p className="text-xs text-center">
                                {searchQuery
                                    ? t('hymns.no_results', 'Ничего не найдено')
                                    : t('hymns.library_empty_desc', 'В этом сборнике нет гимнов')
                                }
                            </p>
                        </div>
                    }
                />
            )}

            {infoModal && (
                <HymnalInfoModal
                    hymnal={infoModal.hymnal}
                    initialView={infoModal.view}
                    onClose={() => setInfoModal(null)}
                    onSelectHymn={handleSelectFromThematic}
                />
            )}
        </div>
    );
};
