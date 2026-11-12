import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/core/utils/cn';
import { Verse } from '@/core/types';
import { colorTokens, radiusTokens, spacingTokens } from '@/shared/tokens';

interface BibleSelectionVerseListProps {
  versesInChapter: Verse[];
  selectedVerseNumbers: number[];
  handleVerseClick: (v: Verse, e: React.MouseEvent) => void;
}

export const BibleSelectionVerseList: React.FC<BibleSelectionVerseListProps> = ({
  versesInChapter,
  selectedVerseNumbers,
  handleVerseClick
}) => {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: versesInChapter.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 px-1 shrink-0">
        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          {t('verses', 'Verses')}
        </label>
        {selectedVerseNumbers.length > 0 && (
          <span className="text-xs font-bold text-amber-500/80">
            {t('selected_count', { count: selectedVerseNumbers.length, defaultValue: '{{count}} selected' })}
          </span>
        )}
      </div>
      <div
        ref={parentRef}
        className={cn(
          "flex-1 overflow-y-auto no-scrollbar bg-stone-950/60 border border-white/5 p-2",
          radiusTokens.lg
        )}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const v = versesInChapter[virtualRow.index];
            if (!v) return null;
            const isSelected = selectedVerseNumbers.includes(v.verseNumber);

            return (
              <div
                key={v.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => handleVerseClick(v, e)}
                  className={cn(
                    "w-full p-3 rounded-xl text-left transition-all border cursor-pointer group relative overflow-hidden",
                    isSelected
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20"
                      : "bg-stone-900/50 border-white/5 hover:border-white/10 hover:bg-stone-900/80"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      "text-xs font-bold mt-0.5 shrink-0 w-6 text-right font-mono",
                      isSelected ? "text-amber-500" : "text-stone-500"
                    )}>
                      {v.verseNumber}
                    </span>
                    <p className={cn(
                      "text-xs leading-relaxed transition-colors line-clamp-2 min-w-0 font-medium",
                      isSelected ? "text-stone-100" : "text-stone-300 group-hover:text-white"
                    )}>
                      {v.text}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BibleSelectionVerseList;
