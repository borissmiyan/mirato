import React, { useRef } from 'react';
import { cn } from '@/core/utils/cn';

export interface PinInputProps {
    value: string;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    length?: number;
    autoFocus?: boolean;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    boxClassName?: string;
    'aria-label'?: string;
}

export const PinInput: React.FC<PinInputProps> = React.memo(({
    value,
    onChange,
    onComplete,
    length = 4,
    autoFocus = false,
    disabled = false,
    error = false,
    className,
    boxClassName,
    'aria-label': ariaLabel = 'PIN Code Input'
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = e.target.value.replace(/\D/g, '').slice(0, length);
        onChange(sanitized);
        if (sanitized.length === length && onComplete) {
            onComplete(sanitized);
        }
    };

    return (
        <div className={cn("flex justify-between gap-3 relative group select-none", className)}>
            {Array.from({ length }, (_, i) => {
                const char = value[i];
                const isCurrent = value.length === i;

                return (
                    <div
                        key={i}
                        data-testid={`pin-slot-${i}`}
                        className={cn(
                            "w-14 h-20 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all duration-300 font-mono",
                            error
                                ? "border-red-500/50 bg-red-500/10 text-red-200"
                                : char
                                    ? "border-accent/40 bg-stone-950/60 text-white shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                                    : "border-white/5 bg-stone-950/20 text-stone-700",
                            isCurrent && !error && "border-accent/60 bg-stone-900/40 scale-105",
                            disabled && "opacity-50 cursor-not-allowed",
                            boxClassName
                        )}
                    >
                        {char || '•'}
                    </div>
                );
            })}
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={length}
                value={value}
                autoFocus={autoFocus}
                disabled={disabled}
                aria-label={ariaLabel}
                onChange={handleChange}
                className="absolute inset-0 opacity-0 cursor-pointer caret-transparent disabled:cursor-not-allowed"
            />
        </div>
    );
});

PinInput.displayName = 'PinInput';
