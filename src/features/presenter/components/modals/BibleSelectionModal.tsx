import React, { useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType, ModalState } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { getBookName } from '@/core/data/bookData';
import { Verse, ISlide, ICanvasSlide } from '@/core/types';
import { Layers } from 'lucide-react';
import { formatMultiVerseReference, formatVerseRange } from '@/features/bible-browser/utils/bibleUtils';
import { SegmentedControl, Button } from '@/shared/ui';

// Hooks
import { useBibleSelection } from '../../hooks/useBibleSelection';

// Sub-components
import { BibleSelectionHeader } from './BibleSelectionHeader';
import { BibleSelectionSidebar } from './BibleSelectionSidebar';
import { BibleSelectionChapters } from './BibleSelectionChapters';
import { BibleSelectionVerseList } from './BibleSelectionVerseList';
import { BibleSelectionPreview } from './BibleSelectionPreview';

/**
 * Bible selection modal for presentation mode.
 * Features: live slide preview, multi-verse, multi-translation, carousel preview.
 */
interface BibleSelectionModalContentProps {
    modalData: ModalState;
}

const BibleSelectionModalContent: React.FC<BibleSelectionModalContentProps> = ({ modalData }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const closeModal = useModalStore(s => s.closeModal);

    const slideId = modalData?.props?.slideId as string | undefined;
    const modalPresentationId = modalData?.props?.presentationId as string | undefined;

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

    // ─── Verse click handler ───
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

    // ─── Reference text ───
    const referenceText = useMemo(() => {
        if (bible.selectedVerses.length === 0) return '';
        const bookName = getBookName(bible.selectedBookId, lang);
        return formatMultiVerseReference(bible.selectedVerses, bookName, lang);
    }, [bible.selectedVerses, bible.selectedBookId, lang]);

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl apple-modal">

                <BibleSelectionHeader
                    slideId={slideId}
                    onClose={() => closeModal(ModalType.BIBLE_SELECTION)}
                />

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Panel — Selection */}
                    <div className="w-[420px] shrink-0 flex flex-col border-r border-white/5 overflow-hidden">
                        <div className="flex-1 flex overflow-hidden p-4 gap-3">
                            <BibleSelectionSidebar
                                translations={bible.translations}
                                sortedBooks={bible.sortedBooks}
                                selectedTranslationId={bible.selectedTranslationId}
                                selectedBookId={bible.selectedBookId}
                                setSelectedTranslationId={bible.setSelectedTranslationId}
                                setSelectedBookId={bible.setSelectedBookId}
                                setSelectedChapter={bible.setSelectedChapter}
                                setSelectedVerseNumbers={bible.setSelectedVerseNumbers}
                                lang={lang}
                            />

                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                <BibleSelectionChapters
                                    chaptersCount={bible.chaptersCount}
                                    selectedChapter={bible.selectedChapter}
                                    setSelectedChapter={bible.setSelectedChapter}
                                    setSelectedVerseNumbers={bible.setSelectedVerseNumbers}
                                />

                                <BibleSelectionVerseList
                                    versesInChapter={bible.versesInChapter}
                                    selectedVerseNumbers={bible.selectedVerseNumbers}
                                    handleVerseClick={handleVerseClick}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel — Preview */}
                    <BibleSelectionPreview
                        selectedVerses={bible.selectedVerses}
                        secondTranslationId={bible.secondTranslationId}
                        secondTranslationVerse={bible.secondTranslationVerse}
                        secondTranslationVerses={bible.secondTranslationVerses}
                        showSecondTranslation={bible.showSecondTranslation}
                        setShowSecondTranslation={bible.setShowSecondTranslation}
                        setSecondTranslationId={bible.setSecondTranslationId}
                        translations={bible.translations}
                        selectedTranslationId={bible.selectedTranslationId}
                        insertMode={bible.insertMode}
                        carouselIndex={bible.carouselIndex}
                        setCarouselIndex={bible.setCarouselIndex}
                        settings={settings}
                        referenceText={referenceText}
                    />
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-white/5 bg-stone-950/50 backdrop-blur-xl flex items-center justify-between shrink-0">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest mb-0.5">
                            {t('selection', 'Selection')}
                        </span>
                        <p className="text-xs font-bold text-amber-500 truncate">
                            {bible.selectedBookId ? getBookName(bible.selectedBookId, lang) : ''} {bible.selectedChapter}:{formatVerseRange(bible.selectedVerseNumbers)}
                        </p>
                    </div>

                    {!slideId && (
                        <div className="hidden sm:flex shrink-0 mx-4">
                            <SegmentedControl<'single' | 'multiple'>
                                value={bible.insertMode}
                                onChange={(val) => bible.setInsertMode(val)}
                                options={[
                                    { value: 'single', label: t('single_slide', 'Single Slide'), icon: <Layers className="w-3.5 h-3.5" /> },
                                    { value: 'multiple', label: t('multiple_slides', 'Multiple Slides'), icon: <Layers className="w-3.5 h-3.5" /> },
                                ]}
                                size="xs"
                            />
                        </div>
                    )}

                    <div className="flex gap-2.5 shrink-0">
                        <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => closeModal(ModalType.BIBLE_SELECTION)}
                        >
                            {t('cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            size="xs"
                            onClick={handleApply}
                            disabled={bible.selectedVerses.length === 0}
                        >
                            {slideId ? t('update_slide', 'Update Slide') : (
                                bible.insertMode === 'multiple' && bible.selectedVerses.length > 1
                                    ? t('insert_slides_count', 'Insert {{count}} Slides', { count: bible.selectedVerses.length })
                                    : t('insert_slide', 'Insert Slide')
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
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
