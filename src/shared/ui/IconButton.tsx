import React from 'react';
import { sizeTokens, radiusTokens, colorTokens } from '../tokens/designTokens';
import { cn } from '@/core/utils/cn';

export type IconButtonVariant = 'primary' | 'secondary' | 'surface' | 'ghost' | 'accent' | 'danger' | 'subtle';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode | React.ComponentType<{ className?: string }>;
  label?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  active?: boolean;
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary: 'bg-white text-stone-950 hover:bg-stone-200 border-transparent shadow-sm',
  secondary: 'bg-white/10 text-stone-200 hover:bg-white/15 hover:text-white border-white/10',
  surface: 'bg-stone-900/80 text-stone-300 hover:bg-stone-800 hover:text-white border-white/10',
  ghost: 'bg-transparent text-stone-400 hover:text-white hover:bg-white/10 border-transparent',
  subtle: 'bg-white/5 text-stone-400 hover:text-white hover:bg-white/10 border-transparent',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90 border-accent/30 shadow-md',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border-red-500/20',
};

const activeStyles: Record<IconButtonVariant, string> = {
  primary: 'bg-white text-stone-950 ring-2 ring-white/50',
  secondary: 'bg-white/25 text-white border-white/30 shadow-inner',
  surface: 'bg-stone-700 text-white border-white/25 shadow-inner',
  ghost: 'bg-white/15 text-white border-white/10 shadow-inner',
  subtle: 'bg-white/15 text-white border-white/10 shadow-inner',
  accent: 'bg-accent text-accent-foreground ring-2 ring-accent/50 shadow-lg',
  danger: 'bg-red-600 text-white border-transparent shadow-md',
};

const sizeStyles: Record<IconButtonSize, { box: string; icon: string }> = {
  xs: { box: sizeTokens.xs.square, icon: sizeTokens.xs.icon },
  sm: { box: sizeTokens.sm.square, icon: sizeTokens.sm.icon },
  md: { box: sizeTokens.md.square, icon: sizeTokens.md.icon },
  lg: { box: sizeTokens.lg.square, icon: sizeTokens.lg.icon },
};

/**
 * Standardized Apple-styled Icon Button.
 * Strictly adheres to 4/8 grid dimensions (40/48/56/64px), tactile press mechanics, and a11y.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = 'ghost',
      size = 'sm',
      rounded = 'md',
      active = false,
      disabled = false,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const sStyle = sizeStyles[size];
    const rStyle = radiusTokens[rounded];
    const baseVariant = variantStyles[variant];
    const currentActiveStyle = active ? activeStyles[variant] : '';
    const effectiveLabel = label || rest['aria-label'] || rest.title || '';

    return (
      <button
        ref={ref}
        type={type}
        aria-label={effectiveLabel}
        title={rest.title || effectiveLabel}
        disabled={disabled}
        className={cn(
          'relative inline-flex items-center justify-center shrink-0 border select-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          sStyle.box,
          rStyle,
          active ? currentActiveStyle : baseVariant,
          disabled
            ? 'opacity-40 cursor-not-allowed pointer-events-none'
            : 'cursor-pointer active:scale-[0.97] will-change-transform',
          className
        )}
        {...rest}
      >
        <span className={`shrink-0 flex items-center justify-center ${sStyle.icon}`}>
          {React.isValidElement(icon)
            ? icon
            : typeof icon === 'function' || typeof icon === 'object'
            ? React.createElement(icon as React.ComponentType<{ className?: string }>, {
                className: 'w-full h-full',
              })
            : (icon as React.ReactNode)}
        </span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
