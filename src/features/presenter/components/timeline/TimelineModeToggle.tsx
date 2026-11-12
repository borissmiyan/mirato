import React, { memo, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { PanelBottomClose, Rows2, Rows3 } from 'lucide-react';
import { timelineModeAtom, slideDesignPanelOpenAtom, TimelineMode } from '@/core/store/uiAtoms';
import { cn } from '@/core/utils/cn';

/**
 * Floating single-button toggle in the bottom right corner allowing seamless cyclical
 * switching between timeline modes: 'compact' (144px) -> 'expanded' (300px) -> 'hidden' (0px).
 * Compact 56px footprint eliminates overlap and collisions with the Slide Editor toolbar.
 */
export const TimelineModeToggle: React.FC = memo(() => {
    const { t } = useTranslation();
    const [mode, setMode] = useAtom(timelineModeAtom);
    const designPanelOpen = useAtomValue(slideDesignPanelOpenAtom);

    const bottomOffset = mode === 'expanded'
        ? 'bottom-[316px]'
        : mode === 'compact'
            ? 'bottom-[176px]'
            : 'bottom-4';

    const rightOffset = designPanelOpen ? 'right-[336px]' : 'right-4';

    const handleCycle = useCallback(() => {
        setMode((prev: TimelineMode) => {
            if (prev === 'compact') return 'expanded';
            if (prev === 'expanded') return 'hidden';
            return 'compact';
        });
    }, [setMode]);

    const modeConfig: Record<TimelineMode, { label: string; icon: React.ElementType }> = {
        compact: {
            label: t('timeline_mode_compact', 'Компактный таймлайн (клик: Развернуть)'),
            icon: Rows2,
        },
        expanded: {
            label: t('timeline_mode_expanded', 'Развернутый таймлайн (клик: Скрыть)'),
            icon: Rows3,
        },
        hidden: {
            label: t('timeline_mode_hidden', 'Таймлайн скрыт (клик: Показать)'),
            icon: PanelBottomClose,
        },
    };

    const current = modeConfig[mode];
    const Icon = current.icon;
    const isVisible = mode !== 'hidden';

    return (
        <div
            className={cn(
                'absolute z-40 transition-all duration-300 ease-in-out',
                bottomOffset,
                rightOffset
            )}
        >
            <div
                className={cn(
                    'flex items-center justify-center p-1.5 h-14 w-14 rounded-xl shadow-2xl transition-all duration-300',
                    'bg-stone-900/40 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5',
                    'hover:bg-stone-900/60 hover:border-white/20'
                )}
            >
                <button
                    type="button"
                    onClick={handleCycle}
                    title={current.label}
                    aria-label={current.label}
                    className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer transition-all duration-200 apple-press',
                        isVisible
                            ? 'bg-accent text-accent-foreground font-semibold shadow-md'
                            : 'text-stone-400 hover:text-white hover:bg-white/10'
                    )}
                >
                    <Icon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

TimelineModeToggle.displayName = 'TimelineModeToggle';
export default TimelineModeToggle;
