import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Presentation, Music } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { AppMode } from '@/core/types';

interface ModePickerProps {
    appMode: AppMode;
    onSetAppMode: (mode: AppMode) => void;
    onClose: () => void;
    triggerRect: DOMRect | null;
}

const ModePicker: React.FC<ModePickerProps> = React.memo(({
    appMode,
    onSetAppMode,
    onClose,
    triggerRect
}) => {
    const { t } = useTranslation();

    // Positioning logic
    const position = useMemo(() => {
        if (!triggerRect) return { top: '16px', left: '16px', width: '208px' };

        const spacing = 8;
        const windowHeight = window.innerHeight;
        const menuHeight = 130; // 3 items * 36px + padding + gaps

        const top = triggerRect.bottom + spacing;
        const left = triggerRect.left;
        const width = Math.max(triggerRect.width, 208);

        // If it overlaps the bottom of the window, flip it to open upwards
        if (top + menuHeight > windowHeight) {
            return {
                bottom: `${windowHeight - triggerRect.top + spacing}px`,
                left: `${left}px`,
                width: `${width}px`
            };
        }

        return { 
            top: `${top}px`, 
            left: `${left}px`, 
            width: `${width}px` 
        };
    }, [triggerRect]);

    const modes: { id: AppMode; label: string; icon: React.ReactNode }[] = [
        { id: 'scripture', label: t('scripture'), icon: <BookOpen className="w-4 h-4" /> },
        { id: 'presentation', label: t('presentation', 'Presentation'), icon: <Presentation className="w-4 h-4" /> },
        { id: 'hymns', label: t('hymns.title', 'Hymns'), icon: <Music className="w-4 h-4" /> }
    ];

    return createPortal(
        <div className="fixed inset-0 z-9999 pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-transparent pointer-events-auto"
                onClick={onClose}
            />

            {/* Dropdown Content - Concentric macOS squircle (12px outer - 6px padding = 6px inner) */}
            <div
                className="absolute bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto flex flex-col gap-0.5"
                style={position}
            >
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => { onSetAppMode(mode.id); onClose(); }}
                        className={cn(
                            "w-full h-9 flex items-center gap-3 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all text-left apple-press cursor-pointer",
                            appMode === mode.id
                                ? "bg-accent/15 text-accent font-bold shadow-xs"
                                : "text-stone-300 hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <span className={cn(
                            "shrink-0",
                            appMode === mode.id ? "text-accent" : "text-stone-400"
                        )}>
                            {mode.icon}
                        </span>
                        <span className="uppercase tracking-wider truncate">{mode.label}</span>
                    </button>
                ))}
            </div>
        </div>,
        document.body
    );
});

ModePicker.displayName = 'ModePicker';

export default ModePicker;
