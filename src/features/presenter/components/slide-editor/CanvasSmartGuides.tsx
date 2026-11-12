import React, { memo } from 'react';
import { ISnapGuide } from '@/core/utils/canvasMath';
import { cn } from '@/core/utils/cn';

interface CanvasSmartGuidesProps {
    guides: ISnapGuide[];
}

/**
 * Figma-like Smart Guides overlay.
 * Renders alignment lines dynamically styled using the application's active theme accent color (bg-accent),
 * with a dark dual-shadow ring for guaranteed high contrast across light, dark, and video backgrounds.
 */
export const CanvasSmartGuides: React.FC<CanvasSmartGuidesProps> = memo(({ guides }) => {
    if (!guides || guides.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-visible">
            {guides.map((guide) => {
                const isVertical = guide.orientation === 'vertical';

                return (
                    <div
                        key={guide.id}
                        className={cn(
                            'absolute transition-opacity duration-150',
                            isVertical
                                ? 'top-0 bottom-0 w-[1px] -translate-x-1/2'
                                : 'left-0 right-0 h-[1px] -translate-y-1/2',
                            'bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_0_6px_var(--accent-glow,rgba(var(--accent-rgb),0.6))]'
                        )}
                        style={
                            isVertical
                                ? { left: `${guide.positionPct}%` }
                                : { top: `${guide.positionPct}%` }
                        }
                    >
                        {/* Center Indicator Pip */}
                        {guide.type === 'slide-center' && (
                            <div
                                className={cn(
                                    'absolute w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-black/80 shadow-md',
                                    'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
});

CanvasSmartGuides.displayName = 'CanvasSmartGuides';
export default CanvasSmartGuides;



