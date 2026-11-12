import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Verse } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { processChildren } from '@/core/utils/markdownUtils';

export interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (verse: Verse, event: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent, verse: Verse) => void;
  onMouseEnter: (verse: Verse) => void;
  onContextMenu: (e: React.MouseEvent, verseId: number) => void;
}

export const VerseItem = React.memo(({
  verse, isActive, isSelected,
  onSelect, onMouseDown, onMouseEnter, onContextMenu,
}: VerseItemProps) => {
  return (
    <button
      type="button"
      onMouseDown={(e) => onMouseDown(e, verse)}
      onClick={(e) => {
        // Ignore keyboard-triggered clicks (Enter/Space) since global shortcuts handle Enter
        if (e.detail === 0) return;
        onSelect(verse, e);
      }}
      onMouseEnter={() => onMouseEnter(verse)}
      onContextMenu={(e) => { if (verse.id) onContextMenu(e, verse.id); }}
      className={cn(
        'group w-full text-left p-4 transition-all duration-300 relative focus:outline-none border-b border-white/5 select-none',
        isActive && !isSelected && 'bg-accent/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
        isSelected && !isActive && 'bg-accent/20',
        isSelected && isActive && 'bg-accent/25',
        !isActive && !isSelected && 'hover:bg-white/5 [.is-dragging_&]:hover:bg-transparent',
      )}
    >
      <div className="flex gap-4 pointer-events-none">
        <div className={cn(
          'flex flex-col items-center min-w-8 pt-1 transition-colors duration-300',
          isActive || isSelected ? 'text-accent' : 'text-stone-600 group-hover:text-stone-400',
        )}>
          <span className="text-[10px] font-black font-sans tracking-tighter opacity-80 mb-1">
            {verse.verseNumber}
          </span>
          {(isActive || isSelected) && (
            <div className={cn(
              'w-1.5 h-1.5 rounded-full bg-accent shadow-glow transition-all',
              isSelected && !isActive && 'opacity-60 scale-75',
            )} />
          )}
        </div>
        <div className={cn(
          'flex-1 font-serif text-lg leading-relaxed transition-colors duration-300',
          isActive || isSelected ? 'text-stone-100' : 'text-stone-400 group-hover:text-stone-200',
        )}>
          <ReactMarkdown
            components={{
              strong: ({ children }) => (
                <span className={cn('font-bold', isActive ? 'text-accent/90' : 'text-stone-200')}>
                  {processChildren(children)}
                </span>
              ),
              p: ({ children }) => <span>{processChildren(children)}</span>,
              em: ({ children }) => <em className="italic opacity-90">{processChildren(children)}</em>,
            }}
          >
            {verse.text}
          </ReactMarkdown>
        </div>
      </div>
      <div className={cn(
        'absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-300',
        isActive ? 'bg-accent opacity-100 scale-y-100 shadow-glow'
          : isSelected ? 'bg-accent opacity-60 scale-y-90'
            : 'bg-accent opacity-0 scale-y-50',
      )} />
    </button>
  );
}, (prev, next) =>
  prev.verse.id === next.verse.id &&
  prev.verse.text === next.verse.text &&
  prev.isActive === next.isActive &&
  prev.isSelected === next.isSelected
);

VerseItem.displayName = 'VerseItem';

