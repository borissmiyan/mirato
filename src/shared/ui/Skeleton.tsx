import React from 'react';
import { cn } from '@/core/utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shimmer?: boolean;
}

const radiusStyles = {
  sm: 'rounded-sm',
  md: ['rounded', 'lg'].join('-'),
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

/**
 * Apple HIG Shimmer / Pulse Skeleton Loader.
 * Provides tactile visual placeholders during async loading states.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  rounded = 'md',
  shimmer = false,
  ...props
}) => {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn(
        'bg-stone-800/60 border border-white/5',
        shimmer ? 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent' : 'animate-pulse',
        radiusStyles[rounded],
        className
      )}
      {...props}
    />
  );
};

export default Skeleton;
