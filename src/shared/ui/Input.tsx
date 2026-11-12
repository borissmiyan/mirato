import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { sizeTokens, SizeToken, radiusTokens, RadiusToken, colorTokens, spacingTokens } from '@/shared/tokens';

export type InputSize = SizeToken;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Error message string or boolean flag */
  error?: string | boolean;
  /** Explicit error message alternative */
  errorMessage?: string;
  /** Informational helper or hint text shown when no error is present */
  helperText?: React.ReactNode;
  /** Field label placed above the input on the 4/8 grid */
  label?: React.ReactNode;
  /** Appends a required asterisk to the label */
  required?: boolean;
  /** Optional label indicator text (e.g. "Optional") */
  optionalLabel?: string;
  /** Squircles / radius tokens matching buttons */
  rounded?: RadiusToken;
  /** Trigger a horizontal shake animation for immediate user feedback */
  shake?: boolean;
  /** Suppress the automatic AlertCircle right-side error icon */
  hideErrorIcon?: boolean;
}

/**
 * Standardized Input component consuming central design tokens:
 * - Sizing, heights, equal padding strictly synchronized with Button tokens.
 * - Comprehensive error handling: inline status icons, accessible ARIA alert,
 *   subtle dark-red glow, helper text support, and optional shake feedback.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id: explicitId,
  className,
  size = 'md',
  leftIcon,
  rightIcon,
  error,
  errorMessage,
  helperText,
  label,
  required,
  optionalLabel,
  rounded,
  disabled,
  shake,
  hideErrorIcon = false,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = explicitId || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Determine error state and message
  const hasError = Boolean(error || errorMessage);
  const resolvedErrorText = typeof error === 'string' ? error : errorMessage;

  // Design tokens for size
  const token = sizeTokens[size] || sizeTokens.md;

  // Specific left/right padding adjustments when icons are present
  const hasRightSlot = Boolean(rightIcon || (hasError && !hideErrorIcon));
  const iconPaddingClasses = cn(
    leftIcon 
      ? (size === 'xs' ? 'pl-9' : size === 'sm' ? 'pl-11' : size === 'md' ? 'pl-13' : size === 'lg' ? 'pl-15' : 'pl-16') 
      : token.px,
    hasRightSlot 
      ? (size === 'xs' ? 'pr-9' : size === 'sm' ? 'pr-11' : size === 'md' ? 'pr-13' : size === 'lg' ? 'pr-15' : 'pr-16') 
      : token.px,
    token.py
  );

  // Border radius tokens matching buttons (canonical squircle rounded-xl = 8px)
  const radiusClass = rounded 
    ? radiusTokens[rounded]
    : (size === 'xs' ? radiusTokens.sm : radiusTokens.md);

  // Compute aria-describedby for assistive tech
  const computedAriaDescribedBy = [
    ariaDescribedBy,
    hasError && resolvedErrorText ? errorId : null,
    !hasError && helperText ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn("relative w-full flex flex-col", shake && "animate-shake")}>
      {/* Optional Top Label */}
      {label && (
        <div className={cn("flex items-center justify-between mb-2 px-1")}>
          <label
            htmlFor={inputId}
            className={cn(
              "text-xs font-bold tracking-wide uppercase transition-colors",
              hasError ? "text-red-400" : colorTokens.textSecondary,
              disabled && "opacity-50"
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
          {optionalLabel && !required && (
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", colorTokens.textSubtle)}>
              {optionalLabel}
            </span>
          )}
        </div>
      )}

      {/* Input Field with Left/Right Icon slots */}
      <div className="relative w-full flex items-center">
        {leftIcon && (
          <div className={cn(
            'absolute left-0 top-0 bottom-0 flex items-center justify-center pointer-events-none transition-colors',
            hasError ? 'text-red-400' : colorTokens.textSubtle,
            size === 'xs' ? 'w-9' : size === 'sm' ? 'w-11' : size === 'md' ? 'w-13' : size === 'lg' ? 'w-15' : 'w-16'
          )}>
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-errormessage={hasError && resolvedErrorText ? errorId : undefined}
          aria-describedby={computedAriaDescribedBy}
          className={cn(
            'w-full bg-stone-900/60 backdrop-blur-md border text-white font-medium',
            'placeholder:text-stone-500 transition-all duration-150 outline-hidden',
            token.height,
            token.text,
            iconPaddingClasses,
            radiusClass,
            // Error visual states vs Normal visual states using tokens
            hasError
              ? cn(colorTokens.dangerBorder, 'bg-red-500/5', colorTokens.dangerGlow, 'hover:border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 focus:bg-stone-900')
              : cn(colorTokens.border, 'hover:border-white/20', colorTokens.borderFocus, 'focus:ring-2 focus:ring-accent/20 focus:bg-stone-900'),
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none grayscale',
            className
          )}
          {...props}
        />

        {/* Right Icon Slot or Automatic AlertCircle */}
        {hasRightSlot && (
          <div className={cn(
            'absolute right-0 top-0 bottom-0 flex items-center justify-center transition-colors',
            hasError && !rightIcon ? 'text-red-500 pointer-events-none' : colorTokens.textSubtle,
            size === 'xs' ? 'w-9' : size === 'sm' ? 'w-11' : size === 'md' ? 'w-13' : size === 'lg' ? 'w-15' : 'w-16'
          )}>
            {rightIcon ? (
              rightIcon
            ) : (
              <AlertCircle className={cn(token.icon, "animate-in zoom-in-75 duration-150")} aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Error Message with Icon & Animation */}
      {hasError && resolvedErrorText && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2 mt-2 px-1 text-xs font-semibold text-red-400 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="leading-tight">{resolvedErrorText}</span>
        </div>
      )}

      {/* Helper Text (shown only when no active error) */}
      {!hasError && helperText && (
        <div
          id={helperId}
          className={cn("mt-2 px-1 text-xs font-medium leading-relaxed", colorTokens.textMuted)}
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';
