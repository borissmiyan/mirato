import React, { useMemo, useCallback } from 'react';
import { Book as BookIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { VirtualList } from '@/shared/ui';
import { getBookSection, getSectionColors, getBookName, SECTION_NAMES, BibleSection } from '@/core/data/bookData';
import { Book } from '@/core/types';

interface BookListProps {
  books: Book[];
  currentBookId: string;
  onBookSelect: (bookId: string) => void;
  searchQuery: string;
  lang: string;
}

type BookRowItem =
  | { kind: 'header'; key: string; section: BibleSection; iconColor: string; isFirst: boolean }
  | { kind: 'book'; key: string; book: Book; colors: ReturnType<typeof getSectionColors> };

const SearchHighlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-accent/30 text-accent px-0.5 rounded-sm ring-1 ring-accent/20">{part}</mark>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};

export const BookList: React.FC<BookListProps> = React.memo(({
  books,
  currentBookId,
  onBookSelect,
  searchQuery,
  lang
}) => {
  const rows = useMemo<BookRowItem[]>(() => {
    const result: BookRowItem[] = [];
    let lastSection: BibleSection | null = null;
    for (const book of books) {
      const section = getBookSection(book.bookId);
      const colors = getSectionColors(book.bookId);
      if (section !== lastSection) {
        result.push({
          kind: 'header',
          key: `header-${section}`,
          section,
          iconColor: colors.icon,
          isFirst: lastSection === null,
        });
        lastSection = section;
      }
      result.push({ kind: 'book', key: book.bookId, book, colors });
    }
    return result;
  }, [books]);

  const getRowKey = useCallback((item: BookRowItem) => item.key, []);

  const renderRow = useCallback((item: BookRowItem) => {
    if (item.kind === 'header') {
      const sectionName = SECTION_NAMES[lang]?.[item.section] || SECTION_NAMES.en[item.section];
      return (
        <div
          className={cn(
            "h-[40px] flex items-end px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60",
            item.iconColor
          )}
        >
          {sectionName}
        </div>
      );
    }

    const { book, colors } = item;
    const isActive = currentBookId === book.bookId;
    return (
      <button
        type="button"
        onClick={() => onBookSelect(book.bookId)}
        className={cn(
          "w-full h-[42px] text-left px-3 rounded-xl text-sm transition-colors duration-150 flex items-center gap-3 border shadow-sm apple-press cursor-pointer",
          isActive
            ? `${colors.bg} ${colors.border} ${colors.icon} font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)]`
            : "bg-[#211e1c] border-white/[0.04] text-stone-400 hover:bg-[#292524] hover:border-white/[0.08] hover:text-stone-200"
        )}
      >
        <BookIcon className={cn("w-4 h-4 shrink-0", isActive ? "scale-110" : "opacity-40")} />
        <span className="truncate flex-1">
          <SearchHighlight text={getBookName(book.bookId, lang)} query={searchQuery} />
        </span>
        {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
      </button>
    );
  }, [currentBookId, onBookSelect, searchQuery, lang]);

  return (
    <VirtualList
      items={rows}
      getItemKey={getRowKey}
      renderItem={renderRow}
      itemHeight={46}
      gap={4}
      overscan={12}
      className="px-3 pb-4"
    />
  );
});

BookList.displayName = 'BookList';

export default BookList;
