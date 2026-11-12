import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Music } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { IHymnal } from '@/core/types/hymn';
import { ISlide, ICanvasSlide } from '@/core/types/presentation';
import { useAtom } from 'jotai';
import { hymnModalReturnStateAtom, activeHymnalIdAtom } from '@/core/store/uiAtoms';
import { HymnalInfoModal } from './HymnalInfoModal';
import { hymnLibraryService } from '../services/hymnLibraryService';
import { getOrderedHymnSlides } from '../services/hymnMigrationUtils';
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
    const listRef = useRef<HTMLDivElement>(null);
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up click timer on unmount
    useEffect(() => {
        return () => {
            if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
            }
        };
    }, []);

    // DB Data
    const rawHymnals = useLiveQuery(() => db.hymnals.toArray());
    const hymnals = useMemo(() => rawHymnals ?? [], [rawHymnals]);

    const rawThemes = useLiveQuery(() => db.hymnThemes.toArray());
    const themes = useMemo(() => rawThemes ?? [], [rawThemes]);

    const rawHymnPresentations = useLiveQuery(
        () => activeHymnalId
            ? db.presentationFiles.where('hymnalId').equals(activeHymnalId).sortBy('name')
            : Promise.resolve([]),
        [activeHymnalId]
    );
    const hymnPresentations = useMemo(() => rawHymnPresentations ?? [], [rawHymnPresentations]);

    const currentHymnPres = useMemo(() => {
        return hymnPresentations.find(p => p.id === activeHymnId) ?? null;
    }, [hymnPresentations, activeHymnId]);

    const verses: ISlide[] = useMemo(() => {
        if (!currentHymnPres?.slides) return [];
        return getOrderedHymnSlides(currentHymnPres);
    }, [currentHymnPres]);

    // Presentation store actions
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setActivePresentation = usePresentationStore(s => s.setActivePresentation);

    // Sync activeHymnId with presentationStore so the timeline knows what to render
    useEffect(() => {
        if (activeHymnId !== undefined) {
            setActivePresentation(activeHymnId);
        }
    }, [activeHymnId, setActivePresentation]);

    // Derived Hymns
    const hymns: HymnRowData[] = useMemo(() => {
        const sorted = [...hymnPresentations].sort((a, b) => {
            const aOrder = a.metadata?.hymnOrder ?? 9999;
            const bOrder = b.metadata?.hymnOrder ?? 9999;
            return aOrder - bOrder;
        });
        return sorted.map((p) => {
            const match = p.name.match(/^(\d+)\s*[—–-]\s*(.+)$/);
            return {
                id: p.id,
                number: match ? match[1] : String(p.metadata?.hymnOrder ?? ''),
                title: match ? match[2] : (p.metadata?.hymnTitle ?? p.name),
                presentationId: p.id,
            };
        });
    }, [hymnPresentations]);

    const filteredHymns = useMemo(() => {
        if (!searchQuery.trim()) return hymns;
        const q = searchQuery.toLowerCase();

        return hymns.map(h => {
            if (h.title.toLowerCase().includes(q) || h.number.includes(q)) {
                return h;
            }

            const pres = hymnPresentations.find(p => p.id === h.presentationId);
            if (pres?.slides) {
                for (const slide of pres.slides) {
                    const content = slide.type === 'normal' ? (slide as ICanvasSlide).content : undefined;
                    if (content?.canvasItems) {
                        for (const item of content.canvasItems) {
                            if (item.type === 'text' && item.text?.content) {
                                const textLower = item.text.content.toLowerCase();
                                const idx = textLower.indexOf(q);
                                if (idx !== -1) {
                                    const rawText = item.text.content;
                                    const start = Math.max(0, idx - 20);
                                    const end = Math.min(rawText.length, idx + q.length + 20);
                                    let snippet = rawText.substring(start, end);

                                    // Remove newlines from snippet for single line display
                                    snippet = snippet.replace(/[\r\n]+/g, ' ');

                                    if (start > 0) snippet = '...' + snippet;
                                    if (end < rawText.length) snippet = snippet + '...';

                                    return { ...h, matchedSnippet: snippet };
                                }
                            }
                        }
                    }
                }
            }

            return null;
        }).filter(Boolean) as HymnRowData[];
    }, [hymns, searchQuery, hymnPresentations]);

    useEffect(() => {
        if (!selectedThemeId && themes.length > 0) {
            const defaultTheme = themes.find((t) => t.isDefault) ?? themes[0];
            setSelectedThemeId(defaultTheme.id);
        }
    }, [themes, selectedThemeId]);

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

    const rowVirtualizer = useVirtualizer({
        count: filteredHymns.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => 48,
        overscan: 6,
    });

    const handleSelectFromThematic = useCallback((hymnalId: string, hymnNumber: string) => {
        setActiveHymnalId(hymnalId);
        setTimeout(() => {
            const idx = filteredHymns.findIndex(h => h.number === hymnNumber);
            if (idx !== -1) {
                rowVirtualizer.scrollToIndex(idx, { align: 'center' });
                setActiveHymnId(filteredHymns[idx].id);
            }
        }, 200);
    }, [setActiveHymnalId, filteredHymns, rowVirtualizer]);

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
            <div ref={listRef} className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 py-3 space-y-0.5 min-h-0">
                {!activeHymnalId ? (
                    <div className="flex flex-col items-center justify-center h-full text-stone-500 py-12">
                        <Music className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm text-center">{t('hymns.select_hymnal_prompt', 'Выберите сборник гимнов')}</p>
                    </div>
                ) : filteredHymns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                        <Music className="w-8 h-8 mb-3 opacity-40" />
                        <p className="text-xs text-center">
                            {searchQuery
                                ? t('hymns.no_results', 'Ничего не найдено')
                                : t('hymns.library_empty_desc', 'В этом сборнике нет гимнов')
                            }
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const hymn = filteredHymns[virtualRow.index];
                            if (!hymn) return null;
                            return (
                                <div
                                    key={hymn.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        paddingBottom: '2px',
                                    }}
                                >
                                    <HymnListItem
                                        hymn={hymn}
                                        isActive={activeHymnId === hymn.id}
                                        searchQuery={searchQuery}
                                        themes={themes}
                                        selectedThemeId={selectedThemeId}
                                        onThemeChange={setSelectedThemeId}
                                        onClick={() => handleSelectHymn(hymn.id)}
                                        lang={lang}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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
