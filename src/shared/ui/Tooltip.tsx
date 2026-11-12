import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/core/utils/cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * macOS / Apple HIG Micro-Tooltip Component.
 * Features:
 * - Spring fade-in with subtle zoom
 * - Glassmorphism surface (backdrop-blur-md bg-stone-900/95)
 * - Configurable delay and 4 directional positions
 * - Full accessibility with role="tooltip" and aria-describedby
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idRef = useRef(`tooltip-${Math.random().toString(36).substring(2, 9)}`);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsVisible(false);
  };

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      aria-describedby={isVisible ? idRef.current : undefined}
    >
      {children}
      {isVisible && !disabled && content && (
        <div
          id={idRef.current}
          role="tooltip"
          className={cn(
            'absolute z-50 pointer-events-none whitespace-nowrap select-none',
            'px-2.5 py-1 text-[11px] font-medium text-stone-200',
            'bg-stone-900/95 border border-white/15 rounded-xl shadow-xl backdrop-blur-md',
            'animate-in fade-in zoom-in-95 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
            positionStyles,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
