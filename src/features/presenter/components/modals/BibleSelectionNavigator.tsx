import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Book, Verse } from '@/core/types';
import { getBookName } from '@/core/data/bookData';
import { BookList } from '@/features/bible-browser/components/navigation/BookList';
import { ChapterGrid } from '@/features/bible-browser/components/navigation/ChapterGrid';
import { SearchOverlay } from '@/features/bible-browser/components/navigation/SearchOverlay';
import { SearchResult } from '@/features/search/services/globalSearchService';
import { NavigationSelectorCard, TranslationPicker } from '@/shared/ui';
import { BibleSelectionVerseList } from './BibleSelectionVerseList';

export interface BibleSelectionNavigatorProps {
    filteredBooks: Book[];
    currentBook: Book | null;
    selectedBookId: string;
    selectedChapter: number;
    bookSearchQuery: string;
    lang: string;
    versesInChapter: Verse[];
    selectedVerseNumbers: number[];
    selectedTranslationId: string;
    secondTranslationId: string | null;
    showSearchOverlay: boolean;
    isSearching: boolean;
    searchResults: SearchResult[];
    onSearchResultClick: (result: SearchResult) => void;
    onBookSelect: (bookId: string) => void;
    onChapterSelect: (chapter: number) => void;
    onVerseClick: (v: Verse, e: React.MouseEvent) => void;
    onSelectPrimaryTranslation: (trId: string) => void;
    onSelectSecondTranslation: (trId: string | null) => void;
    onPopoverOpenChange: (isOpen: boolean) => void;
}

/**
 * Two-column Bible navigator matching the main Bible page layout:
 * - Left column: color-coded BookList (top) + color-coded ChapterGrid (bottom) + Primary Translation card.
 * - Right column: full-height VerseList + Parallel Translation card.
 */
export const BibleSelectionNavigator: React.FC<BibleSelectionNavigatorProps> = ({
    filteredBooks,
    currentBook,
    selectedBookId,
    selectedChapter,
    bookSearchQuery,
    lang,
    versesInChapter,
    selectedVerseNumbers,
    selectedTranslationId,
    secondTranslationId,
    showSearchOverlay,
    isSearching,
    searchResults,
    onSearchResultClick,
    onBookSelect,
    onChapterSelect,
    onVerseClick,
    onSelectPrimaryTranslation,
    onSelectSecondTranslation,
    onPopoverOpenChange,
}) => {
    const { t } = useTranslation();

    const [isPrimaryPickerOpen, setIsPrimaryPickerOpen] = useState(false);
    const [primaryTriggerRect, setPrimaryTriggerRect] = useState<DOMRect | null>(null);
    const primaryTriggerRef = useRef<HTMLButtonElement>(null);

    const [isSecondPickerOpen, setIsSecondPickerOpen] = useState(false);
    const [secondTriggerRect, setSecondTriggerRect] = useState<DOMRect | null>(null);
    const secondTriggerRef = useRef<HTMLButtonElement>(null);

    const currentBookName = selectedBookId ? getBookName(selectedBookId, lang) : '-';
    const chapterSubtitle = selectedChapter ? `${t('chapter', 'Глава')} ${selectedChapter}` : '-';

    const setPrimaryOpen = useCallback((next: boolean) => {
        setIsPrimaryPickerOpen(next);
        if (next) setIsSecondPickerOpen(false);
        onPopoverOpenChange(next);
    }, [onPopoverOpenChange]);

    const setSecondOpen = useCallback((next: boolean) => {
        setIsSecondPickerOpen(next);
        if (next) setIsPrimaryPickerOpen(false);
        onPopoverOpenChange(next);
    }, [onPopoverOpenChange]);

    const handleTogglePrimaryPicker = useCallback(() => {
        if (!isPrimaryPickerOpen && primaryTriggerRef.current) {
            setPrimaryTriggerRect(primaryTriggerRef.current.getBoundingClientRect());
        }
        setPrimaryOpen(!isPrimaryPickerOpen);
    }, [isPrimaryPickerOpen, setPrimaryOpen]);

    const handleToggleSecondPicker = useCallback(() => {
        if (!isSecondPickerOpen && secondTriggerRef.current) {
            setSecondTriggerRect(secondTriggerRef.current.getBoundingClientRect());
        }
        setSecondOpen(!isSecondPickerOpen);
    }, [isSecondPickerOpen, setSecondOpen]);

    return (
        <>
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {showSearchOverlay && (
                    <SearchOverlay
                        isSearching={isSearching}
                        searchResults={searchResults}
                        onResultClick={onSearchResultClick}
                        lang={lang}
                    />
                )}

                {/* Left Column: Books (top) + Color-coded Chapters (bottom) + Primary Translation footer */}
                <div className="w-[232px] shrink-0 flex flex-col min-h-0 border-r border-white/[0.06]">
                    <div className="flex-[55] flex flex-col min-h-0 overflow-hidden">
                        <BookList
                            books={filteredBooks}
                            currentBookId={selectedBookId}
                            onBookSelect={onBookSelect}
                            searchQuery={bookSearchQuery}
                            lang={lang}
                        />
                    </div>

                    <div className="h-px bg-white/[0.06] shrink-0" />

                    <div className="flex-[45] flex flex-col min-h-0 bg-[#141210] overflow-hidden">
                        <ChapterGrid
                            currentBook={currentBook}
                            currentChapter={selectedChapter}
                            onChapterSelect={onChapterSelect}
                        />
                    </div>

                    <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#141210]">
                        <NavigationSelectorCard
                            ref={primaryTriggerRef}
                            onClick={handleTogglePrimaryPicker}
                            title={currentBookName}
                            subtitle={chapterSubtitle}
                            badge={selectedTranslationId || '—'}
                            badgeVariant="accent"
                            isOpen={isPrimaryPickerOpen}
                            ariaLabel={t('select_translation', 'Выберите перевод')}
                        />
                    </div>
                </div>

                {/* Right Column: Full-height Verses + Parallel Translation footer */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-stone-900">
                    <BibleSelectionVerseList
                        versesInChapter={versesInChapter}
                        selectedVerseNumbers={selectedVerseNumbers}
                        handleVerseClick={onVerseClick}
                    />

                    <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#141210]">
                        {secondTranslationId ? (
                            <NavigationSelectorCard
                                ref={secondTriggerRef}
                                onClick={handleToggleSecondPicker}
                                title={currentBookName}
                                subtitle={chapterSubtitle}
                                badge={secondTranslationId}
                                badgeVariant="accent"
                                isOpen={isSecondPickerOpen}
                                ariaLabel={t('select_second_translation', 'Параллельный перевод')}
                                trailing={
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectSecondTranslation(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.stopPropagation();
                                                onSelectSecondTranslation(null);
                                            }
                                        }}
                                        className="p-1.5 rounded-xl text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                        title={t('remove', 'Удалить')}
                                        aria-label={t('remove', 'Удалить')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </span>
                                }
                            />
                        ) : (
                            <NavigationSelectorCard
                                ref={secondTriggerRef}
                                onClick={handleToggleSecondPicker}
                                isDashed
                                title={t('multi_translation', 'Параллельный')}
                                subtitle={t('multi_select_hint', 'Показать рядом')}
                                badge={<Plus className="w-4 h-4 text-stone-600 group-hover:text-accent transition-colors" />}
                                badgeVariant="outline"
                                isOpen={isSecondPickerOpen}
                                ariaLabel={t('multi_translation', 'Параллельный перевод')}
                            />
                        )}
                    </div>
                </div>
            </div>

            {isPrimaryPickerOpen && primaryTriggerRect && (
                <TranslationPicker
                    currentTranslationId={selectedTranslationId}
                    triggerRect={primaryTriggerRect}
                    onSelect={onSelectPrimaryTranslation}
                    onClose={() => setPrimaryOpen(false)}
                />
            )}

            {isSecondPickerOpen && secondTriggerRect && (
                <TranslationPicker
                    title={t('select_second_translation', 'Параллельный перевод')}
                    currentTranslationId={secondTranslationId}
                    triggerRect={secondTriggerRect}
                    onSelect={(trId) => onSelectSecondTranslation(trId)}
                    onClose={() => setSecondOpen(false)}
                />
            )}
        </>
    );
};

export default BibleSelectionNavigator;
