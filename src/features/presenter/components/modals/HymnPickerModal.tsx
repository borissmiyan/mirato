import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ISlide, IHymnSlide, ICanvasSlide } from '@/core/types';
import { SOURCE_THEME_ID } from '@/core/types/hymn';
import { getOrderedHymnSlides } from '@/features/hymns/services/hymnMigrationUtils';
import { useContainFit } from '@/core/hooks/useContainFit';
import { HymnSlideRenderer } from '@/features/presenter/components/display/HymnSlideRenderer';
import DropdownSelector, { DropdownOption } from '@/shared/ui/DropdownSelector';
import Button from '@/shared/ui/Button';
import { Music, BookOpen, Palette, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import HymnPickerSidebar, { HymnRowItem } from './HymnPickerSidebar';

export const HymnPickerModal: React.FC = () => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);

    // Support nested modals
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.HYMN_PICKER))
    );
    const isOpen = !!modalData;
    const insertionIndex = modalData?.props?.insertionIndex as number | undefined;

    const addHymnToActivePresentation = usePresentationStore(s => s.addHymnToActivePresentation);

    // Data from Dexie — only query when modal is open to save RAM
    const rawHymnals = useLiveQuery(() => (isOpen ? db.hymnals.toArray() : []), [isOpen]);
    const rawThemes = useLiveQuery(() => (isOpen ? db.hymnThemes.toArray() : []), [isOpen]);

    // State: 'ALL' by default to allow searching across all hymnals immediately
    const [selectedHymnalId, setSelectedHymnalId] = useState<string>('ALL');
    const [selectedThemeId, setSelectedThemeId] = useState<string>('default');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedHymnPresId, setSelectedHymnPresId] = useState<string | null>(null);
    const [selectedVerseIndex, setSelectedVerseIndex] = useState<number>(0);

    // Map hymnals for quick lookup
    const hymnalsMap = useMemo(() => {
        return new Map((rawHymnals || []).map(h => [h.id, h]));
    }, [rawHymnals]);

    // Query hymn presentations for selected hymnal or all hymnals
    const rawHymnPresentations = useLiveQuery(
        () => {
            if (!isOpen) return [];
            if (!selectedHymnalId || selectedHymnalId === 'ALL') {
                return db.presentationFiles.filter(p => !p.hymnalId).toArray();
            }
            return db.presentationFiles.where('hymnalId').equals(selectedHymnalId).sortBy('name');
        },
        [isOpen, selectedHymnalId]
    );

    // Parse hymn list
    const hymns: HymnRowItem[] = useMemo(() => {
        const sorted = [...(rawHymnPresentations || [])].sort((a, b) => {
            const aHymnal = a.hymnalId || '';
            const bHymnal = b.hymnalId || '';
            if (aHymnal !== bHymnal && selectedHymnalId === 'ALL') {
                const aHymnalName = hymnalsMap.get(aHymnal)?.name || '';
                const bHymnalName = hymnalsMap.get(bHymnal)?.name || '';
                const hComp = aHymnalName.localeCompare(bHymnalName);
                if (hComp !== 0) return hComp;
            }

            const aOrder = a.metadata?.hymnOrder ?? 9999;
            const bOrder = b.metadata?.hymnOrder ?? 9999;
            return aOrder - bOrder;
        });

        return sorted.map((p) => {
            const match = p.name.match(/^(\d+)\s*[—–-]\s*(.+)$/);
            const hymnal = p.hymnalId ? hymnalsMap.get(p.hymnalId) : undefined;
            return {
                id: p.id,
                presentationId: p.id,
                number: match ? match[1] : String(p.metadata?.hymnOrder ?? ''),
                title: match ? match[2] : (p.metadata?.hymnTitle ?? p.name),
                hymnalId: p.hymnalId,
                hymnalName: hymnal?.name,
                verseCount: p.slides?.length || 0
            };
        });
    }, [rawHymnPresentations, selectedHymnalId, hymnalsMap]);

    // Search filter with lyrics snippet extraction
    const filteredHymns = useMemo(() => {
        if (!searchQuery.trim()) return hymns;
        const q = searchQuery.toLowerCase().trim();

        return hymns.map(h => {
            const numMatch = h.number.includes(q);
            const titleMatch = h.title.toLowerCase().includes(q);
            const hymnalMatch = h.hymnalName?.toLowerCase().includes(q);

            if (numMatch || titleMatch || hymnalMatch) {
                return h;
            }

            const pres = (rawHymnPresentations || []).find(p => p.id === h.presentationId);
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
                                    let snippet = rawText.substring(start, end).replace(/[\r\n]+/g, ' ');
                                    return { ...h, matchSnippet: `...${snippet}...` };
                                }
                            }
                        }
                    }
                }
            }
            return null;
        }).filter(Boolean) as HymnRowItem[];
    }, [hymns, searchQuery, rawHymnPresentations]);

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

    // Active hymn presentation & verses
    const activeHymnPres = useMemo(() => {
        return (rawHymnPresentations || []).find(p => p.id === selectedHymnPresId) || null;
    }, [rawHymnPresentations, selectedHymnPresId]);

    const verses: ISlide[] = useMemo(() => {
        if (!activeHymnPres) return [];
        return getOrderedHymnSlides(activeHymnPres);
    }, [activeHymnPres]);

    const currentVerse = verses[selectedVerseIndex] || verses[0];

    // Build temporary IHymnSlide for preview
    const previewHymnSlide: IHymnSlide | null = useMemo(() => {
        if (!selectedHymnPresId || !currentVerse) return null;
        return {
            id: currentVerse.id,
            type: 'hymn',
            order: selectedVerseIndex,
            blockId: 'default',
            templateId: '',
            hymnPresentationId: selectedHymnPresId,
            sourceSlideId: currentVerse.id,
            themeId: selectedThemeId || 'default',
            duration: 0,
            transition: { type: 'none', duration: 0.5 }
        };
    }, [selectedHymnPresId, currentVerse, selectedThemeId, selectedVerseIndex]);

    const { width: fitWidth, height: fitHeight, containerRef } = useContainFit(16 / 9, 32);

    // Hymnal options dropdown
    const hymnalOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [
            {
                value: 'ALL',
                label: t('all_hymnals', 'Все сборники'),
                icon: <BookOpen className="w-4 h-4 text-accent" />
            }
        ];

        (rawHymnals || []).forEach(h => {
            list.push({
                value: h.id,
                label: `${h.name} (${h.language?.toUpperCase() || 'RU'})`,
                icon: <BookOpen className="w-4 h-4 text-stone-400" />
            });
        });

        return list;
    }, [rawHymnals, t]);

    const themeOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [
            {
                value: 'default',
                label: t('default_theme', 'Default Theme'),
                icon: <Sparkles className="w-4 h-4 text-amber-400" />
            },
            {
                value: SOURCE_THEME_ID,
                label: t('source_theme', 'Original Theme'),
                icon: <Palette className="w-4 h-4 text-purple-400" />
            }
        ];

        (rawThemes || []).forEach(th => {
            list.push({
                value: th.id,
                label: th.name,
                icon: <Palette className="w-4 h-4 text-accent" />
            });
        });

        return list;
    }, [rawThemes, t]);

    // Handle insertion
    const handleInsert = useCallback(async () => {
        if (!selectedHymnPresId) return;
        await addHymnToActivePresentation(selectedHymnPresId, selectedThemeId, insertionIndex);
        closeModal(ModalType.HYMN_PICKER);
    }, [selectedHymnPresId, selectedThemeId, insertionIndex, addHymnToActivePresentation, closeModal]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal(ModalType.HYMN_PICKER);
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (!searchQuery && selectedHymnPresId))) {
                e.preventDefault();
                handleInsert();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeModal, handleInsert, searchQuery, selectedHymnPresId]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6"
        >
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-7xl h-[90vh] flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] apple-modal">

                {/* Left Sidebar - Hymnal & Hymn List */}
                <HymnPickerSidebar
                    selectedHymnalId={selectedHymnalId}
                    onSelectHymnalId={(val) => {
                        setSelectedHymnalId(val);
                        setSelectedHymnPresId(null);
                        setSelectedVerseIndex(0);
                    }}
                    hymnalOptions={hymnalOptions}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    filteredHymns={filteredHymns}
                    selectedHymnPresId={selectedHymnPresId}
                    onSelectHymn={(presId) => {
                        setSelectedHymnPresId(presId);
                        setSelectedVerseIndex(0);
                    }}
                    onClose={() => closeModal(ModalType.HYMN_PICKER)}
                />

                {/* Right Area - Large Slide Preview & Carousel */}
                <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                    {/* Top Bar with Theme Selector */}
                    <div className="px-8 py-4 border-b border-white/5 flex items-center justify-between bg-stone-900/40 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-black text-white tracking-wide truncate max-w-md">
                                {activeHymnPres?.name || t('select_hymn_to_preview', 'Выберите гимн')}
                            </h3>
                            {verses.length > 0 && (
                                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                                    {t('slides_count', { count: verses.length, defaultValue: `${verses.length} слайдов` })}
                                </span>
                            )}
                        </div>

                        {/* Theme Dropdown */}
                        <div className="w-64">
                            <DropdownSelector
                                value={selectedThemeId}
                                options={themeOptions}
                                onChange={setSelectedThemeId}
                                placeholder={t('hymn_theme', 'Тема оформления')}
                            />
                        </div>
                    </div>

                    {/* Center: Large 16:9 Presentation Preview */}
                    <div
                        ref={containerRef}
                        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden group/main-preview p-6 min-h-0"
                    >
                        {!activeHymnPres || !previewHymnSlide ? (
                            <div className="text-stone-700 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center border border-white/5">
                                    <Music className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest opacity-30">
                                    {t('select_hymn_to_preview', 'Выберите гимн для просмотра')}
                                </p>
                            </div>
                        ) : (() => {
                            const w = fitWidth || 800;
                            const h = fitHeight || Math.round(w / (16 / 9));
                            return (
                                <div
                                    className="relative shadow-[0_40px_100px_rgba(0,0,0,0.7)] rounded-xl overflow-hidden border border-white/10 ring-4 ring-white/5 animate-in fade-in zoom-in-95 duration-500 shrink-0"
                                    style={{ width: w, height: h }}
                                >
                                    <HymnSlideRenderer
                                        slide={previewHymnSlide}
                                        scale={w / 1920}
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* Bottom: Verses Carousel */}
                    {verses.length > 0 && (
                        <div className="h-28 shrink-0 bg-stone-950 border-t border-white/10 flex items-center px-8 gap-3 overflow-x-auto no-scrollbar shadow-[0_-20px_50px_rgba(0,0,0,0.4)]">
                            {verses.map((verse, index) => {
                                const isCurrent = selectedVerseIndex === index;
                                const miniSlide: IHymnSlide = {
                                    id: verse.id,
                                    type: 'hymn',
                                    order: index,
                                    blockId: 'default',
                                    templateId: '',
                                    hymnPresentationId: selectedHymnPresId || '',
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
                                            "relative h-20 aspect-video rounded-xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer group apple-press",
                                            isCurrent
                                                ? "border-accent ring-4 ring-accent/20 scale-105 shadow-xl shadow-accent/20"
                                                : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100 bg-stone-900"
                                        )}
                                    >
                                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                            <HymnSlideRenderer
                                                slide={miniSlide}
                                                scale={142.22 / 1920}
                                            />
                                        </div>

                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[8px] font-black text-white z-10 tracking-wider">
                                            {index + 1}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer with Action Button */}
                    <div className="px-8 py-5 border-t border-white/5 bg-stone-900 flex items-center justify-between shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-20">
                        <div className="flex items-center gap-2 text-stone-400 text-xs">
                            {activeHymnPres && (
                                <>
                                    <span className="font-bold text-white">{activeHymnPres.name}</span>
                                    <span>•</span>
                                    <span>{t('slides_count', { count: verses.length, defaultValue: `${verses.length} слайдов` })}</span>
                                </>
                            )}
                        </div>

                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleInsert}
                            disabled={!selectedHymnPresId}
                            leftIcon={<Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90 duration-500", !selectedHymnPresId && "opacity-20")} />}
                            className="px-8 py-3.5 uppercase tracking-widest font-black"
                        >
                            {t('add_to_timeline', 'Вставить в таймлайн')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default HymnPickerModal;
