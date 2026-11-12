import React from 'react';
import { colorTokens } from '../tokens/designTokens';

export interface SegmentedControlOption<T extends string | number> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  title?: string;
}

export type SegmentedOption<T extends string | number> = SegmentedControlOption<T>;

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'default' | 'accent';
  fullWidth?: boolean;
  className?: string;
}

const sizeConfig = {
  xs: {
    container: 'p-0.5 rounded-xl gap-0.5 h-8',
    item: 'px-2 py-1 text-[11px] rounded-xl gap-1',
    iconSize: 'w-3 h-3',
  },
  sm: {
    container: 'p-1 rounded-xl gap-1 h-10',
    item: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
    iconSize: 'w-3.5 h-3.5',
  },
  md: {
    container: 'p-1 rounded-xl gap-1 h-12',
    item: 'px-4 py-2 text-sm rounded-xl gap-2',
    iconSize: 'w-4 h-4',
  },
};

/**
 * macOS / Apple HIG Segmented Control.
 * Provides unified tab/segment switching with tactile active states, icons, and keyboard accessibility.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'sm',
  variant = 'default',
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  const cfg = sizeConfig[size];

  return (
    <div
      role="radiogroup"
      className={`inline-flex items-center bg-black/40 border border-white/10 backdrop-blur-md ${
        cfg.container
      } ${fullWidth ? 'w-full flex' : ''} ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isDisabled = option.disabled;

        const activeStyles =
          variant === 'accent'
            ? 'bg-accent text-accent-foreground font-semibold shadow-md'
            : 'bg-stone-800 text-white font-medium shadow-sm border border-white/15';

        const inactiveStyles =
          'text-stone-400 hover:text-stone-200 hover:bg-white/5 border border-transparent';

        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isDisabled}
            title={option.title}
            onClick={() => !isDisabled && onChange(option.value)}
            className={`relative flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              fullWidth ? 'flex-1' : ''
            } ${cfg.item} ${
              isSelected ? activeStyles : inactiveStyles
            } ${
              isDisabled
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer active:scale-[0.98]'
            }`}
          >
            {option.icon && (
              <span className={`shrink-0 ${cfg.iconSize}`}>
                {React.isValidElement(option.icon)
                  ? option.icon
                  : typeof option.icon === 'function' || typeof option.icon === 'object'
                  ? React.createElement(option.icon as React.ComponentType<{ className?: string }>, {
                      className: 'w-full h-full',
                    })
                  : (option.icon as React.ReactNode)}
              </span>
            )}
            {option.label && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
