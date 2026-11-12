import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Verse } from '@/core/types';
import { List, Edit, Trash2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import VerseEditor from './VerseEditor';
import { VerseItem } from './VerseItem';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import TranslationPicker from '@/shared/ui/TranslationPicker';
import IconButton from '@/shared/ui/IconButton';
import { EmptyState, Badge, NavigationSelectorCard } from '@/shared/ui';
import { getBookName } from '@/core/data/bookData';
import { cn } from '@/core/utils/cn';

const VerseList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    activeVerse,
    clickVerse,
    commitToProjector,
    currentBookId,
    currentChapter,
    updateVerseText,
    currentTranslationId,
    secondTranslationId,
    setSecondTranslation,
    navigateNext,
    navigatePrev,
    selectedVerses,
    setSelectedVerses,
    toggleVerseSelection,
    selectVerseRange,
    isMultiVerseMode,
    projectorIsLive,
    exitMultiVerseMode,
    lastClickedVerseId,
    setLastClickedVerseId,
  } = useBibleStore(useShallow(s => ({
    activeVerse: s.activeVerse,
    clickVerse: s.clickVerse,
    commitToProjector: s.commitToProjector,
    currentBookId: s.currentBookId,
    currentChapter: s.currentChapter,
    updateVerseText: s.updateVerseText,
    currentTranslationId: s.currentTranslationId,
    secondTranslationId: s.secondTranslationId,
    setSecondTranslation: s.setSecondTranslation,
    navigateNext: s.navigateNext,
    navigatePrev: s.navigatePrev,
    selectedVerses: s.selectedVerses,
    setSelectedVerses: s.setSelectedVerses,
    toggleVerseSelection: s.toggleVerseSelection,
    selectVerseRange: s.selectVerseRange,
    isMultiVerseMode: s.isMultiVerseMode,
    projectorIsLive: s.projectorIsLive,
    exitMultiVerseMode: s.exitMultiVerseMode,
    lastClickedVerseId: s.lastClickedVerseId,
    setLastClickedVerseId: s.setLastClickedVerseId,
  })));

  const [editingId, setEditingId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; verseId: number } | null>(null);
  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartVerse, setDragStartVerse] = useState<Verse | null>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const liveVerses = useLiveQuery(
    () => db.verses
      .where('[translationId+bookId+chapter]')
      .equals([currentTranslationId, currentBookId, currentChapter])
      .sortBy('verseNumber'),
    [currentTranslationId, currentBookId, currentChapter]
  );
  const verses = useMemo(() => liveVerses || [], [liveVerses]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: verses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const activeVerseId = activeVerse?.id;
  useEffect(() => {
    if (activeVerseId) {
      const idx = verses.findIndex(v => v.id === activeVerseId);
      if (idx !== -1) {
        rowVirtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
      }
    }
  }, [activeVerseId, verses, rowVirtualizer]);

  const lang = useMemo(() => i18n.language?.substring(0, 2) || 'en', [i18n.language]);

  // ─── Keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId !== null) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        commitToProjector();
        return;
      }

      if (isMultiVerseMode || selectedVerses.length >= 2) {
        if (e.key.startsWith('Arrow')) return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, selectedVerses, isMultiVerseMode, commitToProjector, navigateNext, navigatePrev]);

  // ─── Clicks ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback((verse: Verse, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      toggleVerseSelection(verse);
      setLastClickedVerseId(verse.id || null);
      return;
    }
    if (e.shiftKey && lastClickedVerseId) {
      const lastVerse = verses.find(v => v.id === lastClickedVerseId);
      if (lastVerse) selectVerseRange(lastVerse, verse, verses);
      return;
    }

    // Plain click — exits multiverse if needed, updates preview (and projector if live)
    if (isMultiVerseMode) exitMultiVerseMode();
    clickVerse(verse);
    setLastClickedVerseId(verse.id || null);
  }, [toggleVerseSelection, setLastClickedVerseId, lastClickedVerseId, verses, selectVerseRange, isMultiVerseMode, exitMultiVerseMode, clickVerse]);

  // ─── Drag ─────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, verse: Verse) => {
    if (e.button !== 0) return;

    // Clear any existing timeout
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);

    // Only start dragging if the user holds the button for more than 100ms.
    // This prevents accidental dragging during simple clicks.
    dragTimeoutRef.current = setTimeout(() => {
      setDragStartVerse(verse);
      setIsDragging(true);
      dragTimeoutRef.current = null;
    }, 100);

    // We do NOT call e.preventDefault() here anymore because it prevents 
    // the 'onClick' event from firing, which we use for selection.
  }, []);

  const handleMouseEnter = useCallback((verse: Verse) => {
    if (isDragging && dragStartVerse) {
      selectVerseRange(dragStartVerse, verse, verses);
    }
  }, [isDragging, dragStartVerse, selectVerseRange, verses]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, verseId: id });
  }, []);

  useEffect(() => {
    const up = () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      setIsDragging(false);
      setDragStartVerse(null);
    };
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mouseup', up);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const handleSave = useCallback(async (newText: string) => {
    if (editingId !== null) {
      const verse = verses.find(v => v.id === editingId);
      if (verse) await updateVerseText(verse, newText);
      setEditingId(null);
    }
  }, [editingId, verses, updateVerseText]);

  return (
    <div className="flex flex-col h-full bg-stone-900/40 backdrop-blur-xl border-r border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-950/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent/20 rounded-xl">
            <List className="w-4 h-4 text-accent" />
          </div>
          <h2 className="font-bold text-stone-200 text-sm uppercase">{t('verses')}</h2>
        </div>
        <Badge size="xs" variant="secondary">{verses.length}</Badge>
      </div>

      <div
        ref={parentRef}
        className={cn('flex-1 overflow-y-auto no-scrollbar relative', isDragging && 'select-none is-dragging')}
      >
        {verses.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const verse = verses[virtualRow.index];
              if (!verse) return null;

              return (
                <div
                  key={verse.id || `${verse.bookId}-${verse.chapter}-${verse.verseNumber}`}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {editingId === verse.id ? (
                    <VerseEditor
                      verse={verse}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <VerseItem
                      verse={verse}
                      isActive={activeVerse?.id === verse.id}
                      isSelected={selectedVerses.some(v => v.id === verse.id)}
                      onSelect={handleSelect}
                      onMouseDown={handleMouseDown}
                      onMouseEnter={handleMouseEnter}
                      onContextMenu={handleContextMenu}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16">
            <EmptyState
              icon={List}
              title={t('no_verses_found', 'No verses found for this chapter')}
              size="sm"
              border="none"
            />
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 border-t border-white/5 bg-stone-950/60 relative z-30">
        {secondTranslationId ? (
          <NavigationSelectorCard
            ref={triggerRef}
            onClick={() => {
              if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
              setIsPickerOpen(true);
            }}
            title={currentBookId ? getBookName(currentBookId, lang) : '-'}
            subtitle={currentChapter ? `${t('chapter')} ${currentChapter}` : '-'}
            badge={secondTranslationId}
            badgeVariant="accent"
            isOpen={isPickerOpen}
            ariaLabel={t('select_second_translation', 'Second Translation')}
            trailing={
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setSecondTranslation(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setSecondTranslation(null);
                  }
                }}
                className="p-1.5 rounded-xl text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                title={t('remove', 'Remove')}
                aria-label={t('remove', 'Remove')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            }
          />
        ) : (
          <NavigationSelectorCard
            ref={triggerRef}
            onClick={() => {
              if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
              setIsPickerOpen(true);
            }}
            isDashed
            title={t('multi_translation', 'Multi-Translation')}
            subtitle={t('multi_select_hint', 'Show side-by-side')}
            badge={<Plus className="w-4 h-4 text-stone-600 group-hover:text-accent transition-colors" />}
            badgeVariant="outline"
            isOpen={isPickerOpen}
            ariaLabel={t('multi_translation', 'Multi-Translation')}
          />
        )}
        {isPickerOpen && (
          <TranslationPicker
            title={t('select_second_translation', 'Second Translation')}
            currentTranslationId={secondTranslationId}
            onSelect={setSecondTranslation}
            onClose={() => setIsPickerOpen(false)}
            triggerRect={triggerRect}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu}>
          <ContextMenuItem
            icon={<Edit className="w-4 h-4" />}
            label={t('edit_verse', 'Edit Verse')}
            onClick={() => { setEditingId(contextMenu.verseId); setContextMenu(null); }}
          />
        </ContextMenu>
      )}
    </div>
  );
};

export default VerseList;
