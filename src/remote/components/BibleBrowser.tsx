import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ChevronRight, Loader2, 
  Layers, Languages, LibraryBig, Hash, X, CheckCircle2
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';
import { Translation, Book, Verse } from '@/core/types/bible';
import { RemoteOverrides } from './RemoteOverrides';
import { Button } from '@/shared/ui/Button';

interface IBibleBrowserProps {
  onSelect: (verse: Verse | Verse[]) => void;
  onQuery: (type: string, payload: Record<string, unknown>) => Promise<unknown[]>;
  onCommand?: (command: string, payload?: Record<string, unknown>) => void;
  activeOverride?: 'blackout' | 'whiteout' | 'logo' | null;
  activeLogoUrl?: string;
  onOverrideToggle?: (type: 'blackout' | 'whiteout' | 'logo') => void;
}

export const BibleBrowser: React.FC<IBibleBrowserProps> = ({
  onSelect,
  onQuery,
  onCommand,
  activeOverride,
  activeLogoUrl,
  onOverrideToggle
}) => {
  const { t } = useTranslation();
  // Navigation Data
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [parallelVerses, setParallelVerses] = useState<Record<number, Verse>>({});
  
  // Selection state
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [secondTranslation, setSecondTranslation] = useState<Translation | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVerseItems, setSelectedVerseItems] = useState<Verse[]>([]);
  const [isParallelMode, setIsParallelMode] = useState(false);
  const [isSelectingParallel, setIsSelectingParallel] = useState(false);

  // Scrolling Refs
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll when data changes (Books, Chapters, or Verses)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [books, chapters, verses, translations]);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const results = await onQuery('GET_TRANSLATIONS', {});
      setTranslations(results as Translation[]);
    } catch (err) {
      console.error('Failed to load translations:', err);
    } finally {
      setLoading(false);
    }
  }, [onQuery]);

  // Initial load: Translations
  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const handleSelectTranslation = async (trans: Translation) => {
    if (isSelectingParallel) {
      setSecondTranslation(trans);
      setIsSelectingParallel(false);
      setIsParallelMode(true);
      onCommand?.('BIBLE_PARALLEL_SELECT', { translationId: trans.id });
      if (selectedChapter) handleSelectChapter(selectedChapter, trans);
      return;
    }

    setLoading(true);
    try {
      setSelectedTranslation(trans);
      onCommand?.('BIBLE_TRANSLATION_SELECT', { translationId: trans.id });
      const results = await onQuery('GET_BOOKS', { translationId: trans.id });
      setBooks(results as Book[]);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    const rawCount = 'chaptersCount' in book && typeof (book as { chaptersCount?: unknown }).chaptersCount === 'number' ? (book as { chaptersCount: number }).chaptersCount : undefined;
    const chapCount = book.chapters?.length || rawCount || 50;
    setChapters(Array.from({ length: chapCount }, (_, i) => i + 1));
  };

  const handleSelectChapter = async (chap: number, overridenParallel?: Translation) => {
    if (!selectedTranslation || !selectedBook) return;
    setLoading(true);
    setSelectedChapter(chap);
    
    try {
      const results = await onQuery('GET_VERSES', { 
        translationId: selectedTranslation.id,
        bookId: selectedBook.bookId,
        chapter: chap
      });
      setVerses(results as Verse[]);

      const parallelTarget = overridenParallel || secondTranslation;
      if ((isParallelMode || overridenParallel) && parallelTarget) {
        const pResults = await onQuery('GET_VERSES', {
          translationId: parallelTarget.id,
          bookId: selectedBook.bookId,
          chapter: chap
        });
        const pMap: Record<number, Verse> = {};
        (pResults as Verse[]).forEach(v => { pMap[v.verseNumber] = v; });
        setParallelVerses(pMap);
      }
    } catch (err) {
      console.error('Failed to load chapter verses:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerse = (verse: Verse) => {
    if (!isSelectMode) {
      onSelect(verse);
      return;
    }

    setSelectedVerseItems(prev => {
      const exists = prev.find(v => v.id === verse.id);
      if (exists) return prev.filter(v => v.id !== verse.id);
      return [...prev, verse].sort((a, b) => a.verseNumber - b.verseNumber);
    });
  };

  const handleProjectSelected = () => {
    if (selectedVerseItems.length > 0) {
      onSelect(selectedVerseItems);
    }
  };

  // Stage Resolver
  const currentStage = useMemo(() => {
    if (isSelectingParallel) return 'SELECT_PARALLEL';
    if (!selectedTranslation) return 'TRANSLATION';
    if (!selectedBook) return 'BOOK';
    if (selectedChapter === null) return 'CHAPTER';
    return 'VERSE';
  }, [selectedTranslation, selectedBook, selectedChapter, isSelectingParallel]);

  // Header / Breadcrumbs component
  const Breadcrumbs = () => (
    <div className="flex flex-col gap-3 mb-5 animate-in fade-in slide-in-from-top-4 duration-300 shrink-0">
      {onOverrideToggle && (
        <RemoteOverrides 
          activeOverride={activeOverride} 
          activeLogoUrl={activeLogoUrl} 
          onOverrideToggle={onOverrideToggle} 
          className="mb-2"
        />
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button 
          type="button"
          onClick={() => { setSelectedTranslation(null); setSelectedBook(null); setSelectedChapter(null); setVerses([]); setIsSelectingParallel(false); }}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all shrink-0 apple-press cursor-pointer",
            currentStage === 'TRANSLATION' || isSelectingParallel ? "bg-accent/15 border-accent/40 text-accent font-bold" : "bg-stone-900/60 border-white/5 text-stone-400 font-medium"
          )}
        >
          <Languages size={14} />
          <span className="text-[10px] uppercase tracking-widest">{selectedTranslation?.id || t('remote.bible')}</span>
        </button>

        {selectedTranslation && !isSelectingParallel && (
          <>
            <ChevronRight size={12} className="text-stone-700 shrink-0" />
            <button 
              type="button"
              onClick={() => { setSelectedBook(null); setSelectedChapter(null); setVerses([]); }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all shrink-0 apple-press cursor-pointer",
                currentStage === 'BOOK' ? "bg-accent/15 border-accent/40 text-accent font-bold" : "bg-stone-900/60 border-white/5 text-stone-400 font-medium"
              )}
            >
              <LibraryBig size={14} />
              <span className="text-[10px] uppercase tracking-widest truncate max-w-[90px]">{selectedBook?.name || t('remote.books')}</span>
            </button>
          </>
        )}

        {selectedBook && !isSelectingParallel && (
          <>
            <ChevronRight size={12} className="text-stone-700 shrink-0" />
            <button 
              type="button"
              onClick={() => { setSelectedChapter(null); setVerses([]); }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all shrink-0 apple-press cursor-pointer",
                currentStage === 'CHAPTER' ? "bg-accent/15 border-accent/40 text-accent font-bold" : "bg-stone-900/60 border-white/5 text-stone-400 font-medium"
              )}
            >
              <Hash size={14} />
              <span className="text-[10px] uppercase tracking-widest">{selectedChapter || t('remote.chapters_short')}</span>
            </button>
          </>
        )}
      </div>

      {currentStage === 'VERSE' && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setIsSelectMode(!isSelectMode)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all apple-press cursor-pointer",
                isSelectMode ? "bg-accent text-accent-foreground border-accent font-bold shadow-md" : "bg-stone-900/60 border-white/5 text-stone-400 font-medium"
              )}
            >
              <CheckCircle2 size={15} />
              <span className="text-[10px] uppercase tracking-widest">{t('remote.select')}</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                if (!secondTranslation) {
                  setIsSelectingParallel(true);
                } else {
                  const nextVal = !isParallelMode;
                  setIsParallelMode(nextVal);
                  if (nextVal && selectedChapter) handleSelectChapter(selectedChapter);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all apple-press cursor-pointer",
                isParallelMode ? "bg-accent/20 border-accent/40 text-accent font-bold" : "bg-stone-900/60 border-white/5 text-stone-400 font-medium"
              )}
            >
              <Layers size={15} />
              <span className="text-[10px] uppercase tracking-widest overflow-hidden whitespace-nowrap">
                {secondTranslation && isParallelMode ? secondTranslation.id : t('remote.parallel')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // --- RENDERERS ---

  if (currentStage === 'TRANSLATION' || currentStage === 'SELECT_PARALLEL') {
    const title = isSelectingParallel ? t('remote.select_parallel') : t('remote.select_translation');
    return (
      <div className="flex-1 overflow-y-auto w-full flex flex-col pt-2 min-h-0">
        <Breadcrumbs />
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent/60 mb-3 px-1">{title}</h2>
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-20"><Loader2 className="animate-spin text-accent w-10 h-10" /></div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-1 gap-2.5 pb-20">
            {translations
              .filter(t => !isSelectingParallel || t.id !== selectedTranslation?.id)
              .map((t, idx) => (
              <button 
                type="button"
                key={t.id}
                onClick={() => handleSelectTranslation(t)}
                className="w-full p-4 bg-stone-900/50 border border-white/5 rounded-2xl flex items-center justify-between apple-press transition-all cursor-pointer backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-stone-950/60 rounded-xl flex items-center justify-center border border-white/5">
                    <Languages size={20} className="text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/70 mb-0.5">{t.id.toUpperCase()}</p>
                    <span className="font-bold text-base text-stone-100">{t.name}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-stone-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (currentStage === 'BOOK') {
    return (
      <div className="flex-1 min-h-0 flex flex-col w-full pt-2">
        <Breadcrumbs />
        <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-1 gap-2.5 pb-20 align-top content-start">
          {books.map((b, idx) => (
            <button 
              type="button"
              key={b.id}
              onClick={() => handleSelectBook(b)}
              className="w-full p-4 bg-stone-900/50 border border-white/5 rounded-2xl flex items-center justify-between apple-press transition-all cursor-pointer backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 group"
              style={{ animationDelay: `${(idx % 20) * 15}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-stone-950/60 rounded-xl flex items-center justify-center border border-white/5">
                  <LibraryBig size={20} className="text-stone-400 group-active:text-accent transition-colors" />
                </div>
                <div className="text-left">
                  <span className="font-bold text-base text-stone-100 uppercase tracking-tight">{b.name}</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mt-0.5">
                    {t('remote.chapters_count', { count: b.chapters?.length || ('chaptersCount' in b && typeof (b as { chaptersCount?: unknown }).chaptersCount === 'number' ? (b as { chaptersCount: number }).chaptersCount : 0), defaultValue: '{{count}} Chapters' })}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-stone-600" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (currentStage === 'CHAPTER') {
    return (
      <div className="flex-1 min-h-0 flex flex-col w-full pt-2">
        <Breadcrumbs />
        <div ref={scrollRef} className="flex-1 overflow-y-auto grid grid-cols-4 gap-2.5 pb-20 content-start">
          {chapters.map((c, idx) => (
            <button 
              type="button"
              key={c}
              onClick={() => handleSelectChapter(c)}
              className="aspect-square bg-stone-900/50 border border-white/5 rounded-2xl flex items-center justify-center font-bold text-xl active:bg-accent active:text-accent-foreground apple-press transition-all text-stone-300 backdrop-blur-2xl animate-in fade-in zoom-in-95 cursor-pointer"
              style={{ animationDelay: `${(idx % 20) * 15}ms`, animationFillMode: 'both' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // VERSE STAGE
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full pt-2 relative">
      <Breadcrumbs />
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pb-24 pr-1">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent w-10 h-10" /></div>
        ) : (
          verses.map((v, idx) => {
            const isSelected = selectedVerseItems.some(item => item.id === v.id);
            const parallelVerse = parallelVerses[v.verseNumber];

            return (
              <button 
                type="button"
                key={v.id}
                onClick={() => toggleVerse(v)}
                className={cn(
                  "w-full p-4 border transition-all flex flex-col gap-2.5 text-left backdrop-blur-2xl apple-press rounded-2xl group relative overflow-hidden cursor-pointer",
                  isSelected 
                    ? "bg-accent/15 border-accent/40 shadow-sm shadow-accent/10" 
                    : "bg-stone-900/50 border-white/5 hover:border-white/10"
                )}
                style={{ animationDelay: `${(idx % 12) * 25}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start gap-3.5">
                  <span className={cn(
                    "font-black text-xs shrink-0 pt-0.5 transition-colors",
                    isSelected ? "text-accent" : "text-stone-500"
                  )}>
                    {v.verseNumber}
                  </span>
                  <div className="flex flex-col gap-3 w-full">
                    <span className={cn(
                      "leading-relaxed font-medium transition-colors text-sm",
                      isSelected ? "text-white font-bold" : "text-stone-200"
                    )}>
                      {v.text}
                    </span>
                    
                    {isParallelMode && parallelVerse && (
                      <div className="pt-2.5 border-t border-white/5 flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsParallelMode(false);
                            setSecondTranslation(null);
                            onCommand?.('BIBLE_PARALLEL_SELECT', { translationId: null });
                          }}
                          className="px-2.5 py-1 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1 transition-colors self-start mb-0.5"
                        >
                          <X size={10} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{secondTranslation?.id?.toUpperCase()}</span>
                        </button>
                        <span className="text-stone-400 font-medium italic leading-relaxed text-xs">
                          {parallelVerse.text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {isSelectMode && isSelected && (
                  <div className="absolute top-3.5 right-3.5 text-accent animate-in zoom-in-50 duration-200">
                    <CheckCircle2 size={16} fill="currentColor" className="text-accent-foreground" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Selection Action Bar */}
      {isSelectMode && selectedVerseItems.length > 0 && (
        <div className="absolute bottom-4 left-0 right-0 z-50 px-4 animate-in slide-in-from-bottom-6 duration-300">
          <Button
            variant="primary"
            size="lg"
            className="w-full h-14 justify-center uppercase tracking-[0.2em] text-xs font-black shadow-2xl"
            onClick={handleProjectSelected}
          >
            {selectedVerseItems.length === 1 
              ? t('remote.project_verse') 
              : t('remote.project_verses', { count: selectedVerseItems.length })}
          </Button>
        </div>
      )}
    </div>
  );
};
