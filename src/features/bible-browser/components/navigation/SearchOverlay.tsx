import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight } from 'lucide-react';
import { SearchResult } from '@/features/search/services/globalSearchService';
import { getBookName } from '@/core/data/bookData';
import { Button } from '@/shared/ui';
import { sanitizeHtml } from '@/core/utils/sanitizeHtml';

interface SearchOverlayProps {
  isSearching: boolean;
  searchResults: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  lang: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = React.memo(({
  isSearching,
  searchResults,
  onResultClick,
  lang
}) => {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = React.useState(40);

  // Reset visible count when search results change
  React.useEffect(() => {
    setVisibleCount(40);
  }, [searchResults]);

  const displayedResults = searchResults.slice(0, visibleCount);
  const hasMore = searchResults.length > visibleCount;

  return (
    <div className="absolute inset-0 z-20 bg-stone-900 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
      <div className="p-3 border-b border-white/5 sticky top-0 bg-stone-900/95 backdrop-blur-sm flex items-center justify-between">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
          {isSearching ? t('search.searching', 'Searching...') : t('search.found_verses', 'Found Verses')}
        </span>
        {!isSearching && (
          <span className="text-[10px] text-accent font-medium">
            {displayedResults.length} / {searchResults.length}
          </span>
        )}
      </div>

      <div className="p-2 space-y-1">
        {displayedResults.map((res, i) => (
          <button
            type="button"
            key={`${res.verse.bookId}-${res.verse.chapter}-${res.verse.verseNumber}-${i}`}
            onClick={() => onResultClick(res)}
            className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-all apple-press cursor-pointer group flex flex-col gap-1 border border-transparent hover:border-white/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300 group-hover:text-accent transition-colors">
                {getBookName(res.verse.bookId, lang)} {res.verse.chapter}:{res.verse.verseNumber}
              </span>
              <ChevronRight className="w-3 h-3 text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p
              className="text-xs text-stone-500 line-clamp-2 leading-relaxed"
              // audit-ignore: sanitized with DOMPurify
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(res.highlightedText) }}
            />
          </button>
        ))}

        {hasMore && (
          <div className="p-2 text-center">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setVisibleCount(prev => prev + 40)}
              className="w-full text-xs font-bold text-accent"
            >
              {t('search.show_more', 'Показать ещё')} ({searchResults.length - visibleCount})
            </Button>
          </div>
        )}

        {!isSearching && searchResults.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <Search className="w-10 h-10 text-stone-800 mx-auto" strokeWidth={1} />
            <p className="text-sm text-stone-600 italic">{t('search.no_results_found', 'No verses found')}</p>
          </div>
        )}
      </div>
    </div>
  );
});

SearchOverlay.displayName = 'SearchOverlay';
