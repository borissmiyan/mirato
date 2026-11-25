import React, { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Plus } from 'lucide-react';
import { db } from '@/core/db';
import { useModalStore, ModalType, ModalState } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { getBookName } from '@/core/data/bookData';
import { Verse, ISlide, ICanvasSlide } from '@/core/types';
import { formatMultiVerseReference } from '@/features/bible-browser/utils/bibleUtils';
import {
    Badge,
    Button,
    CustomSlideIcon,
    CustomSlideStackIcon,
    PickerModalShell,
    SearchInput,
    SegmentedControl,
} from '@/shared/ui';

// Hooks
import { useBibleSelection } from '../../hooks/useBibleSelection';
import { useNavigationSearch } from '@/features/bible-browser/hooks/useNavigationSearch';
import { SearchResult } from '@/features/search/services/globalSearchService';

// Sub-components
import { BibleSelectionNavigator } from './BibleSelectionNavigator';
import {
    BibleSelectionPreview,
    BibleSelectionCarouselTray,
} from './BibleSelectionPreview';

interface BibleSelectionModalContentProps {
    modalData: ModalState;
}

const BibleSelectionModalContent: React.FC<BibleSelectionModalContentProps> = ({ modalData }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const closeModal = useModalStore(s => s.closeModal);

    const slideId = modalData?.props?.slideId as string | undefined;
    const modalPresentationId = modalData?.props?.presentationId as string | undefined;

    const [hasNestedPopoverOpen, setHasNestedPopoverOpen] = useState(false);

    // ─── Store ───
    const {
        activePresentationId,
        selectedPresentationId,
        activePresentation,
        selectedPresentation,
        updatePresentationSlides,
        previewSlideId
    } = usePresentationStore(
        useShallow(s => ({
            activePresentationId: s.activePresentationId,
            selectedPresentationId: s.selectedPresentationId,
            activePresentation: s.activePresentation,
            selectedPresentation: s.selectedPresentation,
            updatePresentationSlides: s.updatePresentationSlides,
            previewSlideId: s.previewSlideId
        }))
    );
    const settings = usePresenterStore(s => s.settings);

    const targetPresentationId = modalPresentationId || selectedPresentationId || activePresentationId;

    const dbPresentation = useLiveQuery(
        () => targetPresentationId ? db.presentationFiles.get(targetPresentationId) : undefined,
        [targetPresentationId]
    );

    const presentation = useMemo(() => {
        if (modalPresentationId) {
            if (selectedPresentation?.id === modalPresentationId) return selectedPresentation;
            if (activePresentation?.id === modalPresentationId) return activePresentation;
        }
        if (selectedPresentation?.id === selectedPresentationId) return selectedPresentation;
        if (activePresentation?.id === activePresentationId) return activePresentation;
        return dbPresentation;
    }, [modalPresentationId, selectedPresentation, selectedPresentationId, activePresentation, activePresentationId, dbPresentation]);

    // ─── Bible Selection Hook ───
    const bible = useBibleSelection(presentation, slideId);

    const {
        lastClickedVerseNumber,
        setSelectedVerseNumbers,
        setLastClickedVerseNumber,
        selectedVerses,
        selectedVerseNumbers,
        selectedBookId,
        selectedChapter,
        selectedTranslationId,
        secondTranslationId,
        secondTranslationVerse,
        secondTranslationVerses,
        insertMode,
    } = bible;

    // Full Bible search (references like "Ин 3:16" + full-text keyword search, identical to NavigationPanel)
    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        parseResult,
    } = useNavigationSearch(lang, selectedTranslationId);

    // Filter books by reference/book query (mirrors NavigationPanel logic)
    const filteredBooks = useMemo(() => {
        if (!searchQuery.trim() || parseResult.type === 'keyword') return bible.sortedBooks;
        const primaryItem = parseResult.items[0];
        const bookSearchPart = primaryItem?.bookId?.toLowerCase()
            || parseResult.originalQuery.split(/\d/)[0].trim().toLowerCase();

        return bible.sortedBooks.filter((book) => {
            const name = getBookName(book.bookId, lang).toLowerCase();
            return name.includes(bookSearchPart) || book.bookId.toLowerCase().includes(bookSearchPart);
        });
    }, [bible.sortedBooks, searchQuery, parseResult, lang]);

    const currentBook = useMemo(
        () => bible.sortedBooks.find(b => b.bookId === selectedBookId) ?? null,
        [bible.sortedBooks, selectedBookId]
    );

    const handleBookSelect = useCallback((bookId: string) => {
        bible.setSelectedBookId(bookId);
        const primaryItem = parseResult.items[0];
        if (primaryItem?.type === 'reference' && primaryItem.bookId === bookId && primaryItem.chapter) {
            bible.setSelectedChapter(primaryItem.chapter);
            if (primaryItem.verse) {
                bible.setSelectedVerseNumbers([primaryItem.verse]);
            } else {
                bible.setSelectedVerseNumbers([]);
            }
            return;
        }
        bible.setSelectedChapter(1);
        bible.setSelectedVerseNumbers([]);
    }, [bible, parseResult]);

    const handleSearchResultClick = useCallback((res: SearchResult) => {
        bible.setSelectedBookId(res.verse.bookId);
        bible.setSelectedChapter(res.verse.chapter);
        bible.setSelectedVerseNumbers([res.verse.verseNumber]);
        setSearchQuery('');
    }, [bible, setSearchQuery]);

    const handleChapterSelect = useCallback((chapter: number) => {
        bible.setSelectedChapter(chapter);
        bible.setSelectedVerseNumbers([]);
    }, [bible]);

    const handleSelectPrimaryTranslation = useCallback((trId: string) => {
        bible.setSelectedTranslationId(trId);
        bible.setSelectedBookId('');
        bible.setSelectedChapter(1);
        bible.setSelectedVerseNumbers([]);
    }, [bible]);

    const handleSelectSecondTranslation = useCallback((trId: string | null) => {
        bible.setSecondTranslationId(trId);
        bible.setShowSecondTranslation(Boolean(trId));
    }, [bible]);

    // ─── Verse click handler ───
    const handleVerseClick = useCallback((v: Verse, e: React.MouseEvent) => {
        const isShift = e.shiftKey;
        const isCmdCtrl = e.metaKey || e.ctrlKey;

        if (isShift && lastClickedVerseNumber !== null) {
            const start = Math.min(lastClickedVerseNumber, v.verseNumber);
            const end = Math.max(lastClickedVerseNumber, v.verseNumber);
            const range: number[] = [];
            for (let i = start; i <= end; i++) range.push(i);
            setSelectedVerseNumbers(prev => {
                const others = prev.filter(n => n < start || n > end);
                return [...new Set([...others, ...range])];
            });
        } else if (isCmdCtrl) {
            setSelectedVerseNumbers(prev =>
                prev.includes(v.verseNumber)
                    ? prev.filter(n => n !== v.verseNumber)
                    : [...prev, v.verseNumber]
            );
        } else {
            setSelectedVerseNumbers([v.verseNumber]);
        }
        setLastClickedVerseNumber(v.verseNumber);
    }, [lastClickedVerseNumber, setSelectedVerseNumbers, setLastClickedVerseNumber]);

    // ─── Apply handler ───
    const handleApply = useCallback(async () => {
        if (!targetPresentationId || !presentation) return;
        if (selectedVerses.length === 0) return;

        const sortedSelected = [...selectedVerseNumbers].sort((a, b) => a - b);

        const getReference = (verses: Verse[]) => {
            if (verses.length === 0) return '';
            const bookName = getBookName(selectedBookId, lang);
            return formatMultiVerseReference(verses, bookName, lang);
        };

        const existingSlides = presentation.slides || [];
        let newSlides = [...existingSlides];

        const buildVariables = (verses: Verse[], verseNums: number[], secondVerse?: Verse | null) => {
            const verseText = verses.map(v => v.text).join(' ');
            const reference = getReference(verses);
            const base: Record<string, string | number> = {
                title: reference,
                content: verseText,
                text: verseText,
                reference: reference,
                translationId: selectedTranslationId,
                bookId: selectedBookId,
                chapter: selectedChapter,
                verses: JSON.stringify(verseNums),
                verseStart: verseNums[0],
                verseEnd: verseNums[verseNums.length - 1],
            };

            if (secondTranslationId && secondVerse) {
                base.secondTranslationId = secondTranslationId;
                base.secondVerseText = secondVerse.text;
            }

            return base;
        };

        if (slideId) {
            const variables = buildVariables(selectedVerses, sortedSelected, secondTranslationVerse);
            newSlides = newSlides.map(s => {
                if (s.id === slideId && s.type === 'normal') {
                    const canvasSlide = s as ICanvasSlide;
                    return {
                        ...canvasSlide,
                        content: { ...canvasSlide.content, variables }
                    };
                }
                return s;
            });
        } else {
            const insertBefore = modalData?.props?.insertBefore as boolean | undefined;
            const selectedIdx = previewSlideId
                ? existingSlides.findIndex(s => s.id === previewSlideId)
                : -1;
            const insertionIndex = selectedIdx !== -1
                ? (insertBefore ? selectedIdx : selectedIdx + 1)
                : existingSlides.length;

            const slidesToInsert: ISlide[] = [];

            if (insertMode === 'single') {
                slidesToInsert.push({
                    id: crypto.randomUUID(),
                    type: 'normal',
                    order: 0,
                    blockId: 'bible',
                    templateId: 'bible-default',
                    content: { variables: buildVariables(selectedVerses, sortedSelected, secondTranslationVerse) }
                } as ICanvasSlide);
            } else {
                selectedVerses.forEach((verse) => {
                    const matchingSecondVerse = secondTranslationVerses.find(
                        sv => sv.verseNumber === verse.verseNumber
                    );
                    slidesToInsert.push({
                        id: crypto.randomUUID(),
                        type: 'normal',
                        order: 0,
                        blockId: 'bible',
                        templateId: 'bible-default',
                        content: {
                            variables: buildVariables([verse], [verse.verseNumber], matchingSecondVerse)
                        }
                    } as ICanvasSlide);
                });
            }

            newSlides = [
                ...existingSlides.slice(0, insertionIndex),
                ...slidesToInsert,
                ...existingSlides.slice(insertionIndex),
            ].map((s, i) => ({ ...s, order: i }));
        }

        await updatePresentationSlides(targetPresentationId, newSlides);
        closeModal(ModalType.BIBLE_SELECTION);
    }, [
        presentation, targetPresentationId, selectedVerses,
        selectedVerseNumbers, selectedBookId, selectedChapter,
        selectedTranslationId, secondTranslationId, secondTranslationVerse,
        secondTranslationVerses, slideId, insertMode, lang,
        previewSlideId, modalData?.props?.insertBefore,
        updatePresentationSlides, closeModal
    ]);

    const handleClose = useCallback(() => {
        closeModal(ModalType.BIBLE_SELECTION);
    }, [closeModal]);

    const handleModalKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && selectedVerses.length > 0) {
            e.preventDefault();
            handleApply();
        }
    }, [handleApply, selectedVerses.length]);

    // ─── Reference text ───
    const referenceText = useMemo(() => {
        if (bible.selectedVerses.length === 0) return '';
        const bookName = getBookName(bible.selectedBookId, lang);
        return formatMultiVerseReference(bible.selectedVerses, bookName, lang);
    }, [bible.selectedVerses, bible.selectedBookId, lang]);

    const showCarousel = bible.insertMode === 'multiple' && bible.selectedVerses.length > 1;
    const totalSlidesCount = showCarousel ? bible.selectedVerses.length : (bible.selectedVerses.length > 0 ? 1 : 0);
    const clampedCarouselIndex = Math.min(bible.carouselIndex, Math.max(0, bible.selectedVerses.length - 1));
    const secondTranslationName = secondTranslationId
        ? bible.translations.find(tr => tr.id === secondTranslationId)?.name
        : null;

    return (
        <PickerModalShell
            isOpen={true}
            onClose={handleClose}
            onKeyDown={handleModalKeyDown}
            disableEscapeClose={hasNestedPopoverOpen}
            sidebarWidthClassName="w-[500px]"
            sidebarIcon={<BookOpen className="w-4 h-4" />}
            sidebarTitle={slideId ? t('edit_verse', 'Редактировать стих') : t('add_bible_verse', 'Вставить стих')}
            sidebarHeaderExtra={
                <SearchInput
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    placeholder={t('search.placeholder', 'Поиск книги, главы или текста...')}
                />
            }
            sidebarBody={
                <BibleSelectionNavigator
                    filteredBooks={filteredBooks}
                    currentBook={currentBook}
                    selectedBookId={selectedBookId}
                    selectedChapter={selectedChapter}
                    bookSearchQuery={searchQuery}
                    lang={lang}
                    versesInChapter={bible.versesInChapter}
                    selectedVerseNumbers={bible.selectedVerseNumbers}
                    selectedTranslationId={selectedTranslationId}
                    secondTranslationId={secondTranslationId}
                    showSearchOverlay={parseResult.type === 'keyword' && parseResult.originalQuery.length >= 2}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    onSearchResultClick={handleSearchResultClick}
                    onBookSelect={handleBookSelect}
                    onChapterSelect={handleChapterSelect}
                    onVerseClick={handleVerseClick}
                    onSelectPrimaryTranslation={handleSelectPrimaryTranslation}
                    onSelectSecondTranslation={handleSelectSecondTranslation}
                    onPopoverOpenChange={setHasNestedPopoverOpen}
                />
            }
            contentTitle={referenceText || t('select_verse_preview', 'Выберите стихи для просмотра')}
            contentBadge={
                totalSlidesCount > 0 ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span
                            title={t('slides_count', { count: totalSlidesCount, defaultValue: `${totalSlidesCount} слайдов` })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/10 rounded-md text-[10px] font-semibold text-stone-400 shrink-0 tabular-nums"
                        >
                            <CustomSlideStackIcon className="w-3 h-3 opacity-75 shrink-0" />
                            <span>{totalSlidesCount}</span>
                        </span>
                        {secondTranslationName && (
                            <Badge variant="secondary" size="xs">
                                + {secondTranslationName}
                            </Badge>
                        )}
                    </div>
                ) : undefined
            }
            preview={
                <BibleSelectionPreview
                    selectedVerses={bible.selectedVerses}
                    secondTranslationId={bible.secondTranslationId}
                    secondTranslationVerse={bible.secondTranslationVerse}
                    secondTranslationVerses={bible.secondTranslationVerses}
                    insertMode={bible.insertMode}
                    carouselIndex={clampedCarouselIndex}
                    settings={settings}
                />
            }
            tray={
                showCarousel ? (
                    <BibleSelectionCarouselTray
                        selectedVerses={bible.selectedVerses}
                        selectedChapter={bible.selectedChapter}
                        clampedCarouselIndex={clampedCarouselIndex}
                        setCarouselIndex={bible.setCarouselIndex}
                    />
                ) : undefined
            }
            footerLeft={
                !slideId ? (
                    <SegmentedControl<'single' | 'multiple'>
                        value={bible.insertMode}
                        onChange={(val) => bible.setInsertMode(val)}
                        options={[
                            { value: 'single', label: t('single_slide', 'Один слайд'), icon: <CustomSlideIcon className="w-3.5 h-3.5" /> },
                            { value: 'multiple', label: t('multiple_slides', 'Несколько слайдов'), icon: <CustomSlideStackIcon className="w-3.5 h-3.5" /> },
                        ]}
                        size="xs"
                    />
                ) : (
                    <span className="text-xs text-stone-400 truncate">
                        {referenceText || t('select_verse_preview', 'Выберите стихи для просмотра')}
                    </span>
                )
            }
            footerRight={
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApply}
                    disabled={bible.selectedVerses.length === 0}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="px-5 font-bold tracking-wide shrink-0"
                >
                    {slideId ? t('update_slide', 'Обновить слайд') : (
                        bible.insertMode === 'multiple' && bible.selectedVerses.length > 1
                            ? t('insert_slides_count', 'Добавить {{count}} слайдов', { count: bible.selectedVerses.length })
                            : t('add_to_timeline', 'Добавить на таймлайн')
                    )}
                </Button>
            }
        />
    );
};

const BibleSelectionModal: React.FC = () => {
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.BIBLE_SELECTION))
    );
    if (!modalData) return null;
    return <BibleSelectionModalContent modalData={modalData} />;
};

export default BibleSelectionModal;
