import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Verse, PresenterSettings } from '@/core/types';
import { IconButton } from '@/shared/ui';
import { SlideBackground } from '../display/SlideBackground';
import { LogicalCanvas } from '../slide-editor/LogicalCanvas';
import { VerseDisplay } from '../bible/VerseDisplay';
import { MultiVerseDisplay } from '../bible/MultiVerseDisplay';
import { ParallelVerseDisplay } from '../bible/ParallelVerseDisplay';

interface BibleSelectionPreviewProps {
  selectedVerses: Verse[];
  secondTranslationId: string | null;
  secondTranslationVerse: Verse | null;
  secondTranslationVerses: Verse[];
  insertMode: 'single' | 'multiple';
  carouselIndex: number;
  settings: PresenterSettings;
}

/**
 * Clean 16:9 slide preview surface rendered inside PickerModalShell's preview slot.
 */
export const BibleSelectionPreview: React.FC<BibleSelectionPreviewProps> = ({
  selectedVerses,
  secondTranslationId,
  secondTranslationVerse,
  secondTranslationVerses,
  insertMode,
  carouselIndex,
  settings,
}) => {
  const { t } = useTranslation();

  if (selectedVerses.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-stone-600 gap-4 p-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/5">
          <BookOpen className="w-8 h-8 opacity-30" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
          {t('select_verse_preview', 'Выберите стихи для просмотра')}
        </p>
      </div>
    );
  }

  const showCarousel = insertMode === 'multiple' && selectedVerses.length > 1;
  const clampedIndex = Math.min(carouselIndex, Math.max(0, selectedVerses.length - 1));

  if (showCarousel) {
    const currentVerse = selectedVerses[clampedIndex];
    const matchingSecondVerse = secondTranslationId
      ? secondTranslationVerses.find((sv) => sv.verseNumber === currentVerse?.verseNumber)
      : null;

    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        <LogicalCanvas containerClassName="rounded-xl border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          <SlideBackground background={settings.background} />
          <div className="absolute inset-0 z-10 w-full h-full max-w-full">
            {currentVerse && matchingSecondVerse ? (
              <ParallelVerseDisplay
                verse1={currentVerse}
                verse2={matchingSecondVerse}
                autoFit={true}
                settings={settings}
              />
            ) : currentVerse ? (
              <VerseDisplay
                verse={currentVerse}
                showReference={true}
                autoFit={true}
                className="h-full w-full"
                settings={settings}
              />
            ) : null}
          </div>
        </LogicalCanvas>
      </div>
    );
  }

  const isMulti = selectedVerses.length > 1;
  const hasSecondTranslation = !!secondTranslationId;

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-0">
      <LogicalCanvas containerClassName="rounded-xl border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
        <SlideBackground background={settings.background} />
        <div className="absolute inset-0 z-10 w-full h-full max-w-full">
          {isMulti ? (
            <MultiVerseDisplay
              verses={selectedVerses}
              showReference={true}
              autoFit={true}
              className="h-full w-full"
              settings={settings}
            />
          ) : hasSecondTranslation && selectedVerses[0] && secondTranslationVerse ? (
            <ParallelVerseDisplay
              verse1={selectedVerses[0]}
              verse2={secondTranslationVerse}
              autoFit={true}
              settings={settings}
            />
          ) : selectedVerses[0] ? (
            <VerseDisplay
              verse={selectedVerses[0]}
              showReference={true}
              autoFit={true}
              className="h-full w-full"
              settings={settings}
            />
          ) : null}
        </div>
      </LogicalCanvas>
    </div>
  );
};

interface BibleSelectionCarouselTrayProps {
  selectedVerses: Verse[];
  selectedChapter: number;
  clampedCarouselIndex: number;
  setCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
}

export const BibleSelectionCarouselTray: React.FC<BibleSelectionCarouselTrayProps> = ({
  selectedVerses,
  selectedChapter,
  clampedCarouselIndex,
  setCarouselIndex,
}) => {
  const { t } = useTranslation();

  return (
    <div className="h-[64px] shrink-0 bg-[#141210] border-t border-white/[0.06] flex items-center justify-between px-6 gap-4">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
        {selectedVerses.map((v, idx) => {
          const isCurrent = idx === clampedCarouselIndex;
          return (
            <button
              type="button"
              key={v.verseNumber}
              onClick={() => setCarouselIndex(idx)}
              className={cn(
                'px-2.5 h-8 rounded-lg border text-xs font-bold transition-colors cursor-pointer shrink-0 tabular-nums',
                isCurrent
                  ? 'bg-accent text-stone-950 border-accent'
                  : 'bg-[#211e1c] text-stone-300 border-white/[0.06] hover:border-white/20 hover:text-white'
              )}
            >
              {selectedChapter}:{v.verseNumber}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
          {clampedCarouselIndex + 1} / {selectedVerses.length}
        </span>
        <IconButton
          icon={<ChevronLeft className="w-4 h-4" />}
          label={t('previous_slide', 'Previous Slide')}
          size="xs"
          variant="surface"
          disabled={clampedCarouselIndex === 0}
          onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
        />
        <IconButton
          icon={<ChevronRight className="w-4 h-4" />}
          label={t('next_slide', 'Next Slide')}
          size="xs"
          variant="surface"
          disabled={clampedCarouselIndex >= selectedVerses.length - 1}
          onClick={() => setCarouselIndex((i) => Math.min(selectedVerses.length - 1, i + 1))}
        />
      </div>
    </div>
  );
};
