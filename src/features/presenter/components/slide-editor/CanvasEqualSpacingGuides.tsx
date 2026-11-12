import React from 'react';
import { IEqualSpacingMatch } from '@/core/utils/canvasEqualSpacing';

interface CanvasEqualSpacingGuidesProps {
    matches: IEqualSpacingMatch[];
    canvasScale?: number;
}

/**
 * Figma-grade Equal Spacing Guides overlay.
 * Renders distance lines and badges strictly using the user's chosen system theme accent.
 * Scale-invariant: badges scale counter-proportionally to maintain crisp legibility.
 */
export const CanvasEqualSpacingGuides: React.FC<CanvasEqualSpacingGuidesProps> = React.memo(({ matches, canvasScale = 1 }) => {
    if (!matches || matches.length === 0) return null;

    const safeScale = canvasScale > 0 ? canvasScale : 1;
    const counterScale = 1 / safeScale;
    const lineWidth = Math.max(1.5, 1.5 / safeScale);
    const shadowWidth = Math.max(1, 1 / safeScale);
    const tickSpan = Math.max(8, 8 / safeScale);

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {matches.map((match, mIdx) => {
                const isHoriz = match.orientation === 'horizontal';

                return (
                    <React.Fragment key={`match-${mIdx}`}>
                        {match.segments.map((seg, sIdx) => {
                            const left = Math.min(seg.x1, seg.x2);
                            const top = Math.min(seg.y1, seg.y2);
                            const width = Math.max(0.1, Math.abs(seg.x2 - seg.x1));
                            const height = Math.max(0.1, Math.abs(seg.y2 - seg.y1));

                            return (
                                <React.Fragment key={`seg-${mIdx}-${sIdx}`}>
                                    {/* Line */}
                                    <div
                                        className="absolute bg-accent pointer-events-none"
                                        style={{
                                            left: `${left}%`,
                                            top: `${top}%`,
                                            width: isHoriz ? `${width}%` : `${lineWidth}px`,
                                            height: isHoriz ? `${lineWidth}px` : `${height}%`,
                                            transform: isHoriz ? `translateY(-${lineWidth / 2}px)` : `translateX(-${lineWidth / 2}px)`,
                                            boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)`,
                                        }}
                                    >
                                        {/* Ticks */}
                                        {isHoriz ? (
                                            <>
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-accent" style={{ width: `${lineWidth}px`, height: `${tickSpan}px`, boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)` }} />
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-accent" style={{ width: `${lineWidth}px`, height: `${tickSpan}px`, boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)` }} />
                                            </>
                                        ) : (
                                            <>
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-accent" style={{ width: `${tickSpan}px`, height: `${lineWidth}px`, boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)` }} />
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-accent" style={{ width: `${tickSpan}px`, height: `${lineWidth}px`, boxShadow: `0 0 0 ${shadowWidth}px rgba(0,0,0,0.85)` }} />
                                            </>
                                        )}
                                    </div>

                                    {/* Unified Squircle HUD Badge */}
                                    <div
                                        className="absolute rounded-xl px-2.5 py-0.5 bg-accent text-accent-foreground font-sans tabular-nums text-xs font-bold shadow-xl border border-black/10 select-none whitespace-nowrap pointer-events-none"
                                        style={{
                                            left: `${seg.badgeX}%`,
                                            top: `${seg.badgeY}%`,
                                            transform: `translate(-50%, -50%) scale(${counterScale})`,
                                            transformOrigin: 'center center',
                                        }}
                                    >
                                        {match.gapPx}px
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </div>
    );
});

CanvasEqualSpacingGuides.displayName = 'CanvasEqualSpacingGuides';

