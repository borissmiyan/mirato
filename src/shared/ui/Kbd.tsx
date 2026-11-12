import React from 'react';
import { radiusTokens } from '../tokens/designTokens';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
}

const sizeConfig = {
  xs: 'px-1.5 py-0.5 text-[9px] min-w-[18px] min-h-[18px]',
  sm: 'px-2 py-0.5 text-[10px] min-w-[22px] min-h-[22px]',
  md: 'px-2.5 py-1 text-xs min-w-[26px] min-h-[26px]',
};

/**
 * Standardized Apple-styled Keyboard Shortcut Indicator (`<kbd>`).
 * Styled with subtle bevel, border-white/10, shadow-xs, and crisp typography.
 */
export const Kbd: React.FC<KbdProps> = ({
  children,
  size = 'sm',
  className = '',
  ...rest
}) => {
  return (
    <kbd
      className={`inline-flex items-center justify-center font-bold tracking-wider select-none bg-stone-900/90 text-stone-300 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
        radiusTokens.sm
      } ${sizeConfig[size]} ${className}`}
      {...rest}
    >
      {children}
    </kbd>
  );
};

export default Kbd;
