import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/core/utils/cn';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ top: y, left: x });
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Slight delay to avoid immediate close from the triggering click
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    React.useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const margin = 16;

            let left = x;
            let top = y;

            // Adjust horizontal
            if (left + rect.width > screenWidth - margin) {
                left = Math.max(margin, screenWidth - rect.width - margin);
            } else if (left < margin) {
                left = margin;
            }

            // Adjust vertical
            if (top + rect.height > screenHeight - margin) {
                top = Math.max(margin, screenHeight - rect.height - margin);
            } else if (top < margin) {
                top = margin;
            }

            setPos({ top, left });
            setIsVisible(true);
        }
    }, [x, y]);

    return createPortal(
        <div
            ref={menuRef}
            className={cn(
                "fixed z-[1000000] min-w-[230px] bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 overflow-hidden transition-opacity duration-200",
                isVisible ? "opacity-100" : "opacity-0",
                "animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150"
            )}
            style={{ top: pos.top, left: pos.left }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-1">
                {children}
            </div>
        </div>,
        document.body
    );
};

export const ContextMenuItem: React.FC<{
    icon?: React.ReactNode;
    label: string;
    onClick: () => void;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    active?: boolean;
    className?: string;
}> = ({ icon, label, onClick, shortcut, danger, disabled, active, className }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onClick();
        }}
        disabled={disabled}
        className={cn(
            "group w-full text-left px-3.5 h-12 min-h-[48px] text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-3 relative overflow-hidden select-none cursor-pointer",
            disabled
                ? "opacity-40 cursor-not-allowed text-stone-500"
                : active
                    ? "text-accent bg-accent/10 pointer-events-auto"
                    : danger
                        ? "text-red-400 hover:bg-red-500/10 hover:text-red-300 pointer-events-auto"
                        : "text-stone-300 hover:bg-white/10 hover:text-white pointer-events-auto",
            className
        )}
    >
        {/* Hover Indicator */}
        {!danger && !disabled && (
            <div className={cn(
                "absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full transition-transform duration-200",
                active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
            )} />
        )}

        {icon && (
            <span className={cn(
                "w-5 h-5 flex items-center justify-center shrink-0 transition-transform duration-200 [&>svg]:w-4 [&>svg]:h-4",
                !disabled && "group-hover:scale-110",
                disabled ? "text-stone-600" : danger ? "text-red-400 opacity-80" : "text-stone-400 group-hover:text-accent"
            )}>
                {icon}
            </span>
        )}
        <span className="flex-1 tracking-wide truncate">{label}</span>
        {shortcut && (
            <span className={cn(
                "text-[10px] font-mono tracking-tight px-1.5 py-0.5 rounded-xl transition-colors",
                disabled
                    ? "text-stone-700 bg-white/5"
                    : "text-stone-500 bg-white/5 group-hover:bg-accent/20 group-hover:text-accent"
            )}>
                {shortcut}
            </span>
        )}
    </button>
);

export default ContextMenu;
