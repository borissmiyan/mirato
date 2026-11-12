import React from 'react';
import { X } from 'lucide-react';

export type BadgeVariant = 'default' | 'accent' | 'secondary' | 'danger' | 'success' | 'outline' | 'neutral';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  dot?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-white/10 text-stone-300 border border-white/10',
    dot: 'bg-stone-400',
  },
  neutral: {
    badge: 'bg-stone-800 text-stone-400 border border-white/5',
    dot: 'bg-stone-500',
  },
  secondary: {
    badge: 'bg-stone-800 text-stone-400 border border-white/5',
    dot: 'bg-stone-500',
  },
  accent: {
    badge: 'bg-accent/20 text-accent border border-accent/30 font-semibold',
    dot: 'bg-accent',
  },
  danger: {
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    dot: 'bg-red-500',
  },
  success: {
    badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  outline: {
    badge: 'bg-transparent text-stone-300 border border-white/20',
    dot: 'bg-stone-400',
  },
};

const sizeStyles: Record<BadgeSize, { badge: string; icon: string; dot: string; removeIcon: string }> = {
  xs: {
    badge: 'px-1.5 py-0.5 text-[9px] gap-1',
    icon: 'w-2.5 h-2.5',
    dot: 'w-1 h-1',
    removeIcon: 'w-2.5 h-2.5',
  },
  sm: {
    badge: 'px-2 py-0.5 text-[10px] gap-1.5',
    icon: 'w-3 h-3',
    dot: 'w-1.5 h-1.5',
    removeIcon: 'w-3 h-3',
  },
  md: {
    badge: 'px-2.5 py-1 text-xs gap-2',
    icon: 'w-3.5 h-3.5',
    dot: 'w-2 h-2',
    removeIcon: 'w-3.5 h-3.5',
  },
};

const radiusStyles = {
  sm: 'rounded',
  md: 'rounded-xl',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

/**
 * Standardized Badge / Tag / Chip Component.
 * Supports colored variants, optional status dots, icons, interactive actions, and dismiss buttons.
 * Defaults to desktop squircle (rounded-xl = 6px).
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  rounded = 'md',
  dot = false,
  icon,
  onClick,
  onRemove,
  removeLabel,
  className = '',
}) => {
  const vStyle = variantStyles[variant];
  const sStyle = sizeStyles[size];
  const rStyle = radiusStyles[rounded];

  const isInteractive = Boolean(onClick);

  return (
    <span
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`inline-flex items-center justify-center font-medium uppercase tracking-wider select-none shrink-0 ${
        vStyle.badge
      } ${sStyle.badge} ${rStyle} ${
        isInteractive
          ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all duration-150 apple-press'
          : ''
      } ${className}`}
    >
      {dot && (
        <span
          className={`rounded-full shrink-0 ${vStyle.dot} ${sStyle.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className={`shrink-0 ${sStyle.icon}`}>{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel || 'Remove'}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-white/20 active:scale-90 transition-all text-current opacity-70 hover:opacity-100 focus:outline-none"
        >
          <X className={sStyle.removeIcon} />
        </button>
      )}
    </span>
  );
};

export default Badge;
