import React from 'react';
import { cn } from '@/core/utils/cn';

export interface PickerOptionCardProps {
  /** Primary option title (plain string or highlighted JSX). */
  title: React.ReactNode;
  /** Optional native title attribute for truncated text. */
  titleTooltip?: string;
  /** Secondary uppercase metadata line below the title. */
  subtitle?: React.ReactNode;
  /** Leading icon or thumbnail rendered inside the 32x32 rounded badge. */
  leading: React.ReactNode;
  /** Removes internal icon tint/background when rendering a full-bleed thumbnail/cover. */
  leadingBleed?: boolean;
  /** Highlights the card as the currently active/selected item. */
  isActive?: boolean;
  /** Optional inline badges rendered next to the title (e.g. Master, HardDrive). */
  titleBadges?: React.ReactNode;
  /** Optional extra row rendered below the subtitle (e.g. tags). */
  footer?: React.ReactNode;
  /** Always-visible trailing content (e.g. LIVE badge, pinned star, chevron). */
  trailing?: React.ReactNode;
  /** Action buttons revealed on card hover; clicks do not trigger card onClick. */
  hoverActions?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  className?: string;
}

/**
 * Unified option card used across dropdown pickers (Services, Presentations, Hymnals, Translations).
 */
export const PickerOptionCard: React.FC<PickerOptionCardProps> = React.memo(({
  title,
  titleTooltip,
  subtitle,
  leading,
  leadingBleed = false,
  isActive = false,
  titleBadges,
  footer,
  trailing,
  hoverActions,
  onClick,
  onContextMenu,
  draggable,
  onDragStart,
  className,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      onContextMenu={onContextMenu}
      className={cn(
        'group w-full flex items-center justify-between p-2 rounded-xl transition-all text-left border cursor-pointer apple-press',
        isActive
          ? 'bg-stone-800/80 border-accent/40'
          : 'bg-transparent border-transparent hover:bg-stone-800/50 hover:border-white/[0.06]',
        className
      )}
    >
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors overflow-hidden',
            leadingBleed
              ? 'border border-white/10 bg-stone-800'
              : isActive
                ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/15'
                : 'bg-stone-800/80 text-stone-400 border border-white/[0.06] group-hover:text-stone-200'
          )}
        >
          {leading}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              title={titleTooltip ?? (typeof title === 'string' ? title : undefined)}
              className={cn(
                'text-xs font-bold truncate transition-colors',
                isActive ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'
              )}
            >
              {title}
            </span>
            {titleBadges}
          </div>

          {subtitle !== undefined && subtitle !== null && (
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider leading-none mt-1 truncate tabular-nums">
              {subtitle}
            </span>
          )}

          {footer}
        </div>
      </div>

      {(trailing || hoverActions) && (
        <div
          className="flex items-center gap-1 shrink-0 ml-2"
          onClick={(e) => e.stopPropagation()}
        >
          {trailing}
          {hoverActions && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {hoverActions}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PickerOptionCard.displayName = 'PickerOptionCard';
