import React, { useState, useRef, useMemo, useEffect } from 'react';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { cn } from '@/core/utils/cn';

interface IScrubbableInputProps {
    label?: React.ReactNode;
    value: number | 'mixed';
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    max?: number;
    formatter?: (v: number) => number | string;
    className?: string;
    name?: string;
    suffix?: string;
    variant?: 'default' | 'minimal';
    onMouseDown?: (e: React.MouseEvent) => void;
}

export const ScrubbableInput: React.FC<IScrubbableInputProps> = React.memo(({
    label,
    value,
    onChange,
    step = 1,
    min = -9999,
    max = 9999,
    formatter = (v: number) => Math.round(v * 10) / 10,
    className,
    name,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value === 'mixed' ? 'Mixed' : formatter(value).toString());

    // Refs for stable callbacks inside pointer handlers
    const formatterRef = useRef(formatter);
    const onChangeRef = useRef(onChange);
    const dragStateRef = useRef<{
        startX: number;
        startVal: number;
        isScrubbing: boolean;
        pointerId: number;
    } | null>(null);

    useEffect(() => {
        formatterRef.current = formatter;
        onChangeRef.current = onChange;
    }, [formatter, onChange]);

    const inputId = useMemo(() => {
        if (name) return `scrubber-${name}`;
        if (typeof label === 'string') return `scrubber-${label}`;
        return `scrubber-${Math.random().toString(36).substring(2, 9)}`;
    }, [name, label]);

    // Global cleanup on unmount in case pointer release was interrupted
    useEffect(() => {
        return () => {
            if (dragStateRef.current?.isScrubbing) {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
    }, []);

    // Track previous prop value to sync localValue only when external prop changes
    const prevPropValueRef = useRef(value);
    useEffect(() => {
        if (prevPropValueRef.current !== value) {
            prevPropValueRef.current = value;
            if (!dragStateRef.current?.isScrubbing) {
                setLocalValue(value === 'mixed' ? 'Mixed' : formatterRef.current(value).toString());
            }
        }
    }, [value]);

    const takeSnapshot = usePresentationStore(s => s.takeSnapshot);
    const previewSlideId = usePresentationStore(s => s.previewSlideId);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (value === 'mixed') return;

        // If the user is already focused on the text input and clicking inside it, allow caret positioning
        if (document.activeElement === inputRef.current && e.target === inputRef.current) {
            return;
        }

        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        dragStateRef.current = {
            startX: e.clientX,
            startVal: typeof value === 'number' ? value : 0,
            isScrubbing: false,
            pointerId: e.pointerId,
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state) return;

        const diffX = e.clientX - state.startX;

        if (!state.isScrubbing) {
            if (Math.abs(diffX) >= 3) {
                state.isScrubbing = true;
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
                if (previewSlideId) {
                    takeSnapshot(previewSlideId);
                }
            } else {
                return;
            }
        }

        const effectiveStep = e.shiftKey ? step * 10 : (e.altKey ? step * 0.1 : step);
        let newVal = state.startVal + (diffX * effectiveStep);
        newVal = Math.max(min, Math.min(max, newVal));
        const inv = 1.0 / (e.altKey ? step * 0.1 : step);
        newVal = Math.round(newVal * inv) / inv;

        setLocalValue(formatterRef.current(newVal).toString());
        onChangeRef.current(newVal);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state) return;

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Safe fallback if capture already detached
        }

        if (state.isScrubbing) {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } else {
            // Movement < 3px is a click: immediately focus and select all text for replacement
            inputRef.current?.focus();
            inputRef.current?.select();
        }

        dragStateRef.current = null;
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // Safe fallback
        }

        if (dragStateRef.current?.isScrubbing) {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        dragStateRef.current = null;
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const valToParse = e.target.value;
        let parsed = parseFloat(valToParse);
        if (isNaN(parsed)) {
            setLocalValue(value === 'mixed' ? 'Mixed' : formatterRef.current(typeof value === 'number' ? value : 0).toString());
            return;
        }
        parsed = Math.max(min, Math.min(max, parsed));
        setLocalValue(formatterRef.current(parsed).toString());
        onChangeRef.current(parsed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div
            className={cn(
                "h-9 px-2.5 flex items-center gap-2 rounded-xl border transition-all",
                "bg-stone-900/60 hover:bg-stone-900/90 border-white/10 hover:border-white/20",
                "focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/25",
                "flex-1 min-w-0 group select-none touch-none",
                className
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{ cursor: value === 'mixed' ? 'default' : 'ew-resize' }}
            title={value === 'mixed' ? 'Multiple values' : 'Drag horizontally to adjust (Shift: ×10, Alt: 0.1×), or click to type'}
        >
            {label && (
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider min-w-[14px] shrink-0 select-none pointer-events-none group-hover:text-stone-200 transition-colors flex items-center justify-center">
                    {label}
                </span>
            )}
            <input
                ref={inputRef}
                id={inputId}
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onFocus={async (e) => {
                    if (previewSlideId) await takeSnapshot(previewSlideId);
                    if (value === 'mixed') e.target.select();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={cn(
                    "w-full bg-transparent text-xs text-white font-sans tabular-nums font-semibold focus:outline-none min-w-0 text-right selection:bg-accent/30",
                    value === 'mixed' && "text-stone-500 italic"
                )}
                style={{ cursor: 'text' }}
            />
        </div>
    );
});

ScrubbableInput.displayName = 'ScrubbableInput';
