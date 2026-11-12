import React from 'react';
import { cn } from '@/core/utils/cn';
import { spacingTokens, SpacingToken, radiusTokens, RadiusToken, colorTokens } from '@/shared/tokens';

export type CardPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  rounded?: RadiusToken;
  interactive?: boolean;
  selected?: boolean;
}

/**
 * Standardized Card component conforming to centralized design tokens:
 * - padding: none (0), sm (16px = p-4), md (24px = p-6), lg (32px = p-8), xl, 2xl, 3xl
 * - interactive: smooth hover and active scale for clickable tiles
 */
export const Card: React.FC<CardProps> = React.memo(({
  children,
  className,
  padding = 'md',
  rounded = 'lg',
  interactive = false,
  selected = false,
  ...props
}) => {
  const paddingMap: Record<CardPadding, string> = {
    none: spacingTokens.none.class,
    xs: spacingTokens.xs.class,
    sm: spacingTokens.lg.class,   // 16px (p-4)
    md: spacingTokens['2xl'].class, // 24px (p-6)
    lg: spacingTokens['3xl'].class, // 32px (p-8)
    xl: spacingTokens['4xl'].class, // 40px (p-10)
    '2xl': spacingTokens['5xl'].class, // 48px (p-12)
    '3xl': spacingTokens['6xl'].class, // 64px (p-16)
  };

  const radiusClass = radiusTokens[rounded] || radiusTokens.lg;

  return (
    <div
      className={cn(
        colorTokens.surface,
        'border shadow-xl transition-all duration-200',
        colorTokens.border,
        radiusClass,
        paddingMap[padding] || spacingTokens['2xl'].class,
        interactive && cn(
          'hover:border-white/20 hover:bg-stone-900/80 active:scale-[0.99] cursor-pointer select-none'
        ),
        selected && 'border-accent/60 bg-accent/5 ring-1 ring-accent/30 shadow-accent/10',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn('flex items-center justify-between pb-4 border-b border-white/5 shrink-0', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className, ...props }) => (
  <h3 className={cn('text-base font-bold text-white tracking-tight uppercase', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className, ...props }) => (
  <p className={cn('text-xs text-stone-400 font-medium leading-relaxed', className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn('py-2', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn('pt-4 mt-auto border-t border-white/5 flex items-center justify-end gap-3 shrink-0', className)} {...props}>
    {children}
  </div>
);

export default Card;
