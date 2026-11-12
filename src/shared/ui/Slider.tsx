import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/core/utils/cn';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  mode?: 'track' | 'block';
  color?: 'accent' | 'amber';
  label?: string;
  unit?: string;
  formatValue?: (val: number) => string;
  defaultValue?: number;
  bufferedFraction?: number;
  className?: string;
  showStops?: boolean;
}

/**
 * Standardized Slider component for Deck.CE:
 * - mode="track": thin ether scrubber for live toolbar, volume, media players. Zero-latency drag, hover-expand.
 * - mode="block": 48px (sm canon) height block slider for slide properties, fonts, opacity, speed.
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  onChangeEnd,
  mode = 'track',
  color = 'accent',
  label,
  unit = '',
  formatValue,
  defaultValue,
  bufferedFraction = 0,
  className,
  showStops = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const fraction = Math.max(0, Math.min(1, (value - min) / ((max - min) || 1)));

  const calculateValue = useCallback((clientX: number) => {
    if (!containerRef.current) return valueRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const rawFraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = min + rawFraction * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    return Math.max(min, Math.min(max, parseFloat(stepped.toFixed(4))));
  }, [min, max, step]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    const newVal = calculateValue(e.clientX);
    onChange(newVal);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      onChange(calculateValue(e.clientX));
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      isDraggingRef.current = false;
      onChangeEnd?.(valueRef.current);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const val = calculateValue(e.clientX);
      onChange(val);
    };

    const onUp = (e: PointerEvent) => {
      const finalVal = calculateValue(e.clientX);
      onChange(finalVal);
      setIsDragging(false);
      isDraggingRef.current = false;
      onChangeEnd?.(finalVal);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging, calculateValue, onChange, onChangeEnd]);

  const fillColor = color === 'amber' ? 'bg-amber-500' : 'bg-accent';
  const percentage = fraction * 100;
  const stops = [0, 20, 40, 60, 80, 100];

  if (mode === 'block') {
    const formatted = formatValue
      ? formatValue(value)
      : unit === '%'
      ? `${Math.round(percentage)}%`
      : `${value}${unit}`;

    return (
      <div className={cn('space-y-2 w-full select-none', className)}>
        {label && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-sans tabular-nums font-bold text-accent">{formatted}</span>
          </div>
        )}

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={() => {
            if (defaultValue !== undefined) {
              onChange(defaultValue);
              onChangeEnd?.(defaultValue);
            }
          }}
          className={cn(
            'relative h-12 w-full bg-black/40 border border-white/10 rounded-xl overflow-hidden cursor-pointer group',
            'transition-all duration-150 active:scale-[0.99]',
            isDragging && 'border-accent/40 ring-1 ring-accent/30'
          )}
        >
          {/* Subtle Track Fill */}
          <div
            className={cn('absolute inset-0 bg-accent/20', !isDragging && 'transition-all duration-150')}
            style={{ width: `${percentage}%` }}
          />

          {/* Main Accent Fill */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 bg-accent shadow-[0_0_20px_rgba(234,179,8,0.25)]',
              !isDragging && 'transition-all duration-150'
            )}
            style={{ width: `${percentage}%` }}
          />

          {/* Stops */}
          {showStops && (
            <div className="absolute inset-0 flex justify-between px-0 pointer-events-none">
              {stops.map((stop) => (
                <div
                  key={stop}
                  className={cn(
                    'h-full w-px transition-colors duration-300',
                    percentage >= stop ? 'bg-stone-900/30' : 'bg-white/10'
                  )}
                  style={{
                    position: 'absolute',
                    left: `${stop}%`,
                    transform: stop === 100 ? 'translateX(-100%)' : stop === 0 ? 'none' : 'translateX(-50%)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Glass Highlight */}
          <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent pointer-events-none" />

          {/* Corner Guides */}
          <div className="absolute inset-x-0 bottom-1 flex justify-between px-3 pointer-events-none opacity-25 group-hover:opacity-60 transition-opacity">
            <span className="text-[10px] font-bold text-white uppercase">0%</span>
            <span className="text-[10px] font-bold text-white uppercase">100%</span>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'track' (Scrubber / volume style)
  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn('group w-full h-full flex items-center cursor-pointer relative select-none', className)}
    >
      <div
        className={cn(
          'w-full bg-white/10 rounded-full relative overflow-visible transition-[height] duration-150',
          isDragging ? 'h-2' : 'h-1.5 group-hover:h-2'
        )}
      >
        {bufferedFraction > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-white/15 rounded-full"
            style={{ width: `${Math.max(0, Math.min(1, bufferedFraction)) * 100}%` }}
          />
        )}
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', fillColor)}
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-lg ring-2 ring-black/40 z-10',
            'transition-[transform,opacity] duration-150',
            fillColor,
            isDragging ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100'
          )}
          style={{ left: `calc(${fraction * 100}% - 8px)` }}
        />
      </div>
    </div>
  );
};

export default Slider;
