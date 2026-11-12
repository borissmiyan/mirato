import React, { forwardRef } from 'react';
import { cn } from '@/core/utils/cn';

export type NavigationBadgeVariant = 'accent' | 'muted' | 'outline' | 'custom';

export interface NavigationSelectorCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Primary title text (e.g. "БЫТИЕ", "111", "ГИМНЫ НАДЕЖДЫ", "111 (MASTER)")
   */
  title: string;
  /**
   * Secondary subtitle text (e.g. "ГЛАВА 1", "ЛОКАЛЬНЫЕ", "3 RU", "32 СЛАЙДА")
   */
  subtitle?: React.ReactNode;
  /**
   * Content for the badge box (text abbreviation like "KJV", or Lucide icon like <Workflow />)
   */
  badge?: React.ReactNode;
  /**
   * Optional cover image URL (e.g. for hymnal artwork)
   */
  coverImageUrl?: string | null;
  /**
   * Visual variant of the badge box
   * @default 'accent'
   */
  badgeVariant?: NavigationBadgeVariant;
  /**
   * Optional trailing content (e.g. LIVE badge, HardDrive icon, action buttons)
   */
  trailing?: React.ReactNode;
  /**
   * Indicates whether the attached picker or dropdown is currently open
   */
  isOpen?: boolean;
  /**
   * Render as a dashed placeholder for adding items (e.g. "+ Multi-Translation")
   */
  isDashed?: boolean;
  /**
   * Explicit accessibility label
   */
  ariaLabel?: string;
}

/**
 * Standardized bottom navigation & context selector card conforming to Apple HIG & Deck.CE design tokens:
 * - Fixed height h-14 (56px)
 * - Concentric squircle badge (min-w-10 h-8 rounded-xl)
 * - Standardized typography (text-xs uppercase title, text-[10px] uppercase subtitle)
 * - Unified hover, active, and opened/expanded visual feedback
 */
export const NavigationSelectorCard = React.memo(forwardRef<HTMLButtonElement, NavigationSelectorCardProps>(
  (
    {
      title,
      subtitle,
      badge,
      coverImageUrl,
      badgeVariant = 'accent',
      trailing,
      isOpen = false,
      isDashed = false,
      ariaLabel,
      className,
      disabled,
      children,
      ...buttonProps
    },
    ref
  ) => {
    // ─── Badge Styling ────────────────────────────────────────────────────────
    let badgeBoxContent = badge;
    let badgeBoxClasses = 'min-w-10 h-9 px-2.5 rounded-xl flex items-center justify-center border shrink-0 transition-all select-none overflow-hidden';

    if (coverImageUrl) {
      badgeBoxClasses = cn(badgeBoxClasses, 'p-0 bg-stone-800 border-white/10 shadow-md');
      badgeBoxContent = (
        <img
          src={coverImageUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    } else {
      switch (badgeVariant) {
        case 'accent':
          badgeBoxClasses = cn(
            badgeBoxClasses,
            'bg-accent text-accent-foreground border-accent/20 shadow-lg shadow-accent/10 group-hover:shadow-accent/20'
          );
          break;
        case 'muted':
          badgeBoxClasses = cn(
            badgeBoxClasses,
            'bg-stone-800/80 text-stone-400 border-white/10 group-hover:bg-accent/10 group-hover:border-accent/20 group-hover:text-accent'
          );
          break;
        case 'outline':
          badgeBoxClasses = cn(
            badgeBoxClasses,
            'bg-transparent text-stone-400 border-white/15 group-hover:border-accent/30 group-hover:text-stone-200'
          );
          break;
        case 'custom':
        default:
          break;
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || title}
        aria-expanded={isOpen}
        title={title}
        className={cn(
          'w-full h-14 flex items-center gap-3 p-2.5 rounded-2xl transition-all group apple-press shadow-xl shadow-black/20 cursor-pointer select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          isDashed
            ? 'bg-stone-900/40 border border-dashed border-white/10 hover:border-accent/40 hover:bg-accent/5'
            : cn(
                'bg-stone-900/50 border border-white/10 hover:border-accent/40 hover:bg-stone-800/60',
                isOpen && 'border-accent/60 bg-stone-800/80 shadow-accent/5 ring-1 ring-accent/20'
              ),
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        {...buttonProps}
      >
        {/* Leading Badge Box */}
        {(badgeBoxContent !== undefined || coverImageUrl) && (
          <div className={badgeBoxClasses}>
            {typeof badgeBoxContent === 'string' ? (
              <span className="text-xs font-black uppercase tracking-wider">{badgeBoxContent}</span>
            ) : (
              badgeBoxContent
            )}
          </div>
        )}

        {/* Text Content */}
        <div className="flex flex-col min-w-0 text-left flex-1 justify-center">
          <span
            className={cn(
              'text-xs font-bold uppercase leading-none truncate transition-colors',
              isDashed
                ? 'text-stone-500 group-hover:text-stone-300'
                : 'text-stone-200 group-hover:text-white'
            )}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider mt-1 truncate transition-colors',
                isDashed
                  ? 'text-stone-600 group-hover:text-stone-400'
                  : 'text-stone-500 group-hover:text-stone-400'
              )}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Trailing Slot */}
        {trailing && <div className="shrink-0 flex items-center gap-1.5 ml-auto pl-1">{trailing}</div>}

        {children}
      </button>
    );
  }
));

NavigationSelectorCard.displayName = 'NavigationSelectorCard';

export default NavigationSelectorCard;
