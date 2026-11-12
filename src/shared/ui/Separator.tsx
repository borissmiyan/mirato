import React from 'react';
import { cn } from '@/core/utils/cn';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: React.ReactNode;
}

/**
 * Apple HIG Hairline Separator Component.
 * Supports horizontal or vertical orientation and optional centered text labels.
 */
export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  label,
  className,
  ...props
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch bg-white/10 shrink-0', className)}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn('flex items-center gap-3 w-full my-2', className)}
        {...props}
      >
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-medium text-stone-500 uppercase tracking-widest select-none shrink-0">
          {label}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('h-px w-full bg-white/10 shrink-0 my-1', className)}
      {...props}
    />
  );
};

export default Separator;
