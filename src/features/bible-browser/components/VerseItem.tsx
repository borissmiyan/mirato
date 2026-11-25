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
  const isHighlighted = isActive || isSelected;

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
        'group w-full text-left px-3.5 py-3 rounded-xl border transition-colors duration-150 relative focus:outline-none select-none cursor-pointer',
        isActive
          ? 'bg-stone-800 border-stone-600'
          : isSelected
            ? 'bg-[#262320] border-stone-700'
            : 'bg-[#1f1c1a] border-stone-800/90 hover:bg-[#262320] hover:border-stone-700 [.is-dragging_&]:hover:bg-[#1f1c1a] [.is-dragging_&]:hover:border-stone-800/90',
      )}
    >
      <div className="flex items-start gap-3 pointer-events-none">
        <span
          className={cn(
            'min-w-[28px] h-6 px-1.5 rounded-lg flex items-center justify-center shrink-0 font-mono font-bold text-[11px] border tabular-nums transition-colors mt-0.5',
            isActive
              ? 'bg-accent text-stone-950 border-accent'
              : isSelected
                ? 'bg-stone-700 text-accent border-stone-600'
                : 'bg-stone-950 text-stone-400 border-stone-800 group-hover:text-stone-200',
          )}
        >
          {verse.verseNumber}
        </span>
        <div
          className={cn(
            'flex-1 font-serif text-lg leading-relaxed transition-colors duration-150 min-w-0',
            isHighlighted ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100',
          )}
        >
          <ReactMarkdown
            components={{
              strong: ({ children }) => (
                <span className={cn('font-bold', isActive ? 'text-accent' : 'text-stone-100')}>
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
    </button>
  );
}, (prev, next) =>
  prev.verse.id === next.verse.id &&
  prev.verse.text === next.verse.text &&
  prev.isActive === next.isActive &&
  prev.isSelected === next.isSelected
);

VerseItem.displayName = 'VerseItem';

