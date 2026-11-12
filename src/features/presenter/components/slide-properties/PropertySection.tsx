import React, { useState } from 'react';
import {
    ChevronDown,
    AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
    AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
} from 'lucide-react';
import { cn } from '@/core/utils/cn';

// ─── Alignment Tools ───────────────────────────────────────────────────
interface IAlignmentToolsProps {
    onAlign: (type: 'left' | 'h-center' | 'right' | 'top' | 'v-middle' | 'bottom' | 'distribute-h' | 'distribute-v') => void;
    canDistribute?: boolean;
}

export const AlignmentTools: React.FC<IAlignmentToolsProps> = ({ onAlign, canDistribute }) => {
    const tools = [
        { type: 'left' as const, icon: AlignHorizontalJustifyStart, label: 'Left' },
        { type: 'h-center' as const, icon: AlignHorizontalJustifyCenter, label: 'H-Center' },
        { type: 'right' as const, icon: AlignHorizontalJustifyEnd, label: 'H-Right' },
        { type: 'top' as const, icon: AlignVerticalJustifyStart, label: 'Top' },
        { type: 'v-middle' as const, icon: AlignVerticalJustifyCenter, label: 'V-Middle' },
        { type: 'bottom' as const, icon: AlignVerticalJustifyEnd, label: 'Bottom' },
    ];

    const distributeTools = [
        { type: 'distribute-h' as const, icon: AlignHorizontalDistributeCenter, label: 'Distribute Horizontally' },
        { type: 'distribute-v' as const, icon: AlignVerticalDistributeCenter, label: 'Distribute Vertically' },
    ];

    return (
        <div className="h-9 flex gap-1 bg-black/40 px-1 rounded-xl border border-white/10 items-center">
            {tools.map(({ type, icon: Icon, label }) => (
                <button
                    key={type}
                    type="button"
                    onClick={() => onAlign(type)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex-1 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-stone-400 hover:text-stone-100 transition-all cursor-pointer group apple-press"
                    title={`Align ${label}`}
                    aria-label={`Align ${label}`}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            ))}

            {canDistribute && (
                <>
                    <div className="w-px h-4 bg-white/10 mx-0.5" />
                    {distributeTools.map(({ type, icon: Icon, label }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => onAlign(type)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="flex-1 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-accent/80 hover:text-accent transition-all cursor-pointer group apple-press"
                            title={label}
                            aria-label={label}
                        >
                            <Icon className="w-3.5 h-3.5" />
                        </button>
                    ))}
                </>
            )}
        </div>
    );
};

// ─── Property Section (Accordion) ──────────────────────────────────────
interface IPropertySectionProps {
    title?: string;
    label?: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
    extra?: React.ReactNode;
}

export const PropertySection: React.FC<IPropertySectionProps> = ({ 
    title, label, icon: Icon, children, defaultOpen = true, extra 
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const displayTitle = title || label || '';

    return (
        <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden transition-colors hover:border-white/10 shadow-sm">
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full flex items-center justify-between px-3 py-2.5 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer group outline-none"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-stone-400 group-hover:text-accent transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 group-hover:text-stone-200 transition-colors">{displayTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* audit-ignore: event propagation boundary */}
                    {extra && <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{extra}</div>}
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "" : "-rotate-90 opacity-40")} />
                </div>
            </div>
            <div className={cn(
                "px-3 pb-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top overflow-hidden",
                isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="pt-1 space-y-3">
                    {children}
                </div>
            </div>
        </div>
    );
};
