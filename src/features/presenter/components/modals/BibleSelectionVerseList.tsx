import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Verse } from '@/core/types';
import { Badge, CustomScriptureStackIcon, EmptyState, VirtualList } from '@/shared/ui';

interface BibleSelectionVerseListProps {
  versesInChapter: Verse[];
  selectedVerseNumbers: number[];
  handleVerseClick: (v: Verse, e: React.MouseEvent) => void;
}

/**
 * Full-height virtualized verse column for BibleSelectionModal,
 * matching the Bible page's VerseList header and verse-row visual language.
 */
export const BibleSelectionVerseList: React.FC<BibleSelectionVerseListProps> = ({
  versesInChapter,
  selectedVerseNumbers,
  handleVerseClick,
}) => {
  const { t } = useTranslation();

  const getItemKey = useCallback(
    (v: Verse) => v.id ?? `${v.translationId}-${v.bookId}-${v.chapter}-${v.verseNumber}`,
    []
  );

  const estimateItemHeight = useCallback(
    (index: number) => {
      const textLen = versesInChapter[index]?.text?.length ?? 80;
      const estimatedLines = Math.max(1, Math.ceil(textLen / 30));
      return 26 + estimatedLines * 20;
    },
    [versesInChapter]
  );

  const renderVerse = useCallback(
    (v: Verse) => {
      const isSelected = selectedVerseNumbers.includes(v.verseNumber);
      return (
        <button
          type="button"
          onClick={(e) => handleVerseClick(v, e)}
          className={cn(
            'group w-full text-left px-3 py-2.5 rounded-xl border transition-colors duration-150 cursor-pointer select-none',
            isSelected
              ? 'bg-stone-800 border-stone-600'
              : 'bg-[#1f1c1a] border-stone-800/90 hover:bg-[#262320] hover:border-stone-700'
          )}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                'min-w-[26px] h-6 px-1.5 rounded-lg flex items-center justify-center shrink-0 font-mono font-bold text-[11px] border tabular-nums transition-colors mt-0.5',
                isSelected
                  ? 'bg-accent text-stone-950 border-accent'
                  : 'bg-stone-950 text-stone-400 border-stone-800 group-hover:text-stone-200'
              )}
            >
              {v.verseNumber}
            </span>
            <p
              className={cn(
                'flex-1 font-serif text-[14px] leading-relaxed transition-colors duration-150 min-w-0',
                isSelected ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'
              )}
            >
              {v.text}
            </p>
          </div>
        </button>
      );
    },
    [selectedVerseNumbers, handleVerseClick]
  );

  const firstKey = versesInChapter[0]
    ? `${versesInChapter[0].translationId}:${versesInChapter[0].bookId}:${versesInChapter[0].chapter}`
    : 'empty';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between bg-[#141210] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-accent/20 rounded-lg shrink-0">
            <CustomScriptureStackIcon className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-xs font-bold text-stone-200 uppercase tracking-wider truncate">
            {t('verses', 'Стихи')}
          </span>
        </div>
        <Badge size="xs" variant="secondary">
          {versesInChapter.length}
        </Badge>
      </div>

      <VirtualList
        items={versesInChapter}
        getItemKey={getItemKey}
        renderItem={renderVerse}
        estimateItemHeight={estimateItemHeight}
        gap={6}
        overscan={8}
        resetKey={firstKey}
        className="px-2.5 py-2.5"
        emptyState={
          <div className="py-12">
            <EmptyState
              icon={List}
              title={t('no_verses_found', 'No verses found for this chapter')}
              size="sm"
              border="none"
            />
          </div>
        }
      />
    </div>
  );
};

export default BibleSelectionVerseList;
