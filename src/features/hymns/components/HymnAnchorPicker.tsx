import React from 'react';
import { TextAnchor } from '@/core/types/hymn';

interface HymnAnchorPickerProps {
    value?: TextAnchor;
    onChange: (anchor: TextAnchor) => void;
    disabled?: boolean;
}

const ANCHOR_GRID: { id: TextAnchor; label: string }[][] = [
    [
        { id: 'top-left', label: '↖' },
        { id: 'top-center', label: '↑' },
        { id: 'top-right', label: '↗' },
    ],
    [
        { id: 'center-left', label: '←' },
        { id: 'center', label: '•' },
        { id: 'center-right', label: '→' },
    ],
    [
        { id: 'bottom-left', label: '↙' },
        { id: 'bottom-center', label: '↓' },
        { id: 'bottom-right', label: '↘' },
    ],
];

export const HymnAnchorPicker: React.FC<HymnAnchorPickerProps> = ({
    value = 'center',
    onChange,
    disabled = false,
}) => {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Text Position
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-900/80 rounded-xl border border-white/10 w-28 h-28">
                {ANCHOR_GRID.map((row, rIdx) =>
                    row.map((cell) => {
                        const isSelected = value === cell.id;
                        return (
                            <button
                                key={cell.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => onChange(cell.id)}
                                className={`flex items-center justify-center rounded transition-all text-xs font-semibold apple-press ${
                                    isSelected
                                        ? 'bg-accent text-accent-foreground shadow-sm scale-105'
                                        : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={cell.id}
                            >
                                {cell.label}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};
