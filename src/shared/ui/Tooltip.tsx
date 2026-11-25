import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/core/utils/cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

const GAP_PX = 8;

/**
 * macOS / Apple HIG Micro-Tooltip Component (rendered via Portal into document.body
 * so it is never clipped by overflow-hidden containers such as timeline tiles or scroll areas).
 * Features:
 * - Spring fade-in with subtle zoom
 * - Solid opaque surface (bg-stone-900)
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idRef = useRef(`tooltip-${Math.random().toString(36).substring(2, 9)}`);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    switch (position) {
      case 'bottom':
        setCoords({ top: rect.bottom + GAP_PX, left: rect.left + rect.width / 2 });
        break;
      case 'left':
        setCoords({ top: rect.top + rect.height / 2, left: rect.left - GAP_PX });
        break;
      case 'right':
        setCoords({ top: rect.top + rect.height / 2, left: rect.right + GAP_PX });
        break;
      case 'top':
      default:
        setCoords({ top: rect.top - GAP_PX, left: rect.left + rect.width / 2 });
        break;
    }
  }, [position]);

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      updatePosition();
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

  const transformClass = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  }[position];

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      aria-describedby={isVisible ? idRef.current : undefined}
    >
      {children}
      {isVisible && !disabled && content && coords && typeof document !== 'undefined' &&
        createPortal(
          <div
            id={idRef.current}
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={cn(
              'fixed z-[10050] pointer-events-none w-max max-w-[260px] whitespace-normal text-left leading-snug select-none',
              'px-2.5 py-1.5 text-[11px] font-medium text-stone-200',
              'bg-stone-900 border border-white/15 rounded-xl shadow-2xl',
              'animate-in fade-in zoom-in-95 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
              transformClass,
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
