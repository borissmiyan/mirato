import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { sizeTokens, SizeToken, radiusTokens, RadiusToken, colorTokens, motionTokens } from '@/shared/tokens';

export type ButtonSize = SizeToken;
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'accent' | 'surface';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  square?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  rounded?: RadiusToken;
}

/**
 * Standardized button component adhering to Deck.CE design tokens:
 * - xs: 40px (h-10), equal padding (p-2)
 * - sm: 48px (h-12), equal padding (p-3)
 * - md: 56px (h-14), equal padding (p-4)
 * - lg: 64px (h-16), equal padding (p-5)
 * - xl: 72px (h-18), equal padding (p-6)
 * - square option creates 1:1 aspect ratio icon button (w-12 h-12, etc.)
 * - Apple HIG spring motion: active:scale-[0.97] and cubic-bezier(0.2, 0.8, 0.2, 1)
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  className,
  size = 'md',
  variant = 'secondary',
  square = false,
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  rounded,
  type = 'button',
  ...props
}, ref) => {
  const token = sizeTokens[size] || sizeTokens.md;

  // Height & equal padding derived from centralized tokens
  const sizeClasses = square
    ? cn(token.square, token.padding, token.text)
    : cn(token.height, token.padding, token.text);

  // Border radius derived from centralized squircle tokens (rounded-xl = 8px canonical squircle)
  const radiusClass = rounded
    ? radiusTokens[rounded]
    : (size === 'xs' ? radiusTokens.sm : radiusTokens.md);

  // Visual variant tokens with Apple HIG tactile press & hover states
  const variantClasses = {
    primary: cn(
      colorTokens.accent,
      'font-bold shadow-lg shadow-accent/20 hover:brightness-110 active:scale-[0.97]'
    ),
    accent: cn(
      colorTokens.accent,
      'font-bold shadow-lg shadow-accent/20 hover:brightness-110 active:scale-[0.97]'
    ),
    secondary: cn(
      'bg-stone-900 border text-stone-200 active:scale-[0.97]',
      colorTokens.border,
      'hover:bg-stone-800 hover:border-white/20 hover:text-white'
    ),
    surface: cn(
      'bg-stone-900 border text-stone-200 active:scale-[0.97]',
      colorTokens.border,
      'hover:bg-stone-800 hover:border-white/20 hover:text-white'
    ),
    ghost: cn(
      'bg-transparent text-stone-400 hover:text-white hover:bg-white/10 active:scale-[0.97]'
    ),
    outline: cn(
      'bg-transparent border text-stone-300 active:scale-[0.97]',
      colorTokens.border,
      'hover:border-white/30 hover:text-white hover:bg-white/5'
    ),
    danger: cn(
      colorTokens.danger,
      'font-bold shadow-lg shadow-red-500/20 active:scale-[0.97]'
    ),
  }[variant];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold cursor-pointer select-none',
        'active:scale-[0.97] transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform',
        'outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30',
        sizeClasses,
        radiusClass,
        variantClasses,
        (disabled || loading) && 'opacity-40 cursor-not-allowed pointer-events-none active:scale-100 will-change-auto',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn('animate-spin shrink-0', token.icon)} />
      ) : (
        <>
          {leftIcon && <span className={cn('shrink-0 flex items-center justify-center', children ? 'mr-2' : '')}>{leftIcon}</span>}
          {children}
          {rightIcon && <span className={cn('shrink-0 flex items-center justify-center', children ? 'ml-2' : '')}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
