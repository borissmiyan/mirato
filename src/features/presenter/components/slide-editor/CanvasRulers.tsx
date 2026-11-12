import React, { useCallback, useRef, useState } from 'react';
import { ICustomGuide } from '@/core/types';
import { cn } from '@/core/utils/cn';

interface CanvasRulersProps {
    isVisible: boolean;
    customGuides: ICustomGuide[];
    onAddGuide: (guide: ICustomGuide) => void;
    onUpdateGuide: (id: string, positionPct: number) => void;
    onRemoveGuide: (id: string) => void;
    getContainerRect: () => DOMRect | { left: number; top: number; width: number; height: number };
}

// Generate static tick arrays for 1920x1080 logical resolution
const HORIZONTAL_TICKS: number[] = [];
for (let px = 0; px <= 1920; px += 20) HORIZONTAL_TICKS.push(px);

const VERTICAL_TICKS: number[] = [];
for (let px = 0; px <= 1080; px += 20) VERTICAL_TICKS.push(px);

/**
 * Figma-grade Rulers & Custom User Guides overlay.
 * Supports Shift+R toggle, ruler drag-out to create guide lines,
 * and snap guide repositioning.
 */
export const CanvasRulers: React.FC<CanvasRulersProps> = React.memo(({
    isVisible,
    customGuides,
    onAddGuide,
    onUpdateGuide,
    onRemoveGuide,
    getContainerRect,
}) => {
    const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null);
    const [hoveredGuideId, setHoveredGuideId] = useState<string | null>(null);
    const activeDragRef = useRef<{ id: string; orientation: 'horizontal' | 'vertical' } | null>(null);

    // Start dragging a new guide out from the top ruler (horizontal)
    const handleTopRulerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = getContainerRect();
        const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        const newGuide: ICustomGuide = {
            id: crypto.randomUUID(),
            orientation: 'horizontal',
            positionPct: yPct,
        };
        onAddGuide(newGuide);
        setDraggingGuideId(newGuide.id);
        activeDragRef.current = { id: newGuide.id, orientation: 'horizontal' };

        const handlePointerMove = (me: PointerEvent) => {
            const curYPct = ((me.clientY - rect.top) / rect.height) * 100;
            onUpdateGuide(newGuide.id, Math.round(curYPct * 10) / 10);
        };

        const handlePointerUp = (ue: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            const curYPct = ((ue.clientY - rect.top) / rect.height) * 100;
            if (curYPct < 1 || curYPct > 99) {
                onRemoveGuide(newGuide.id);
            }
            setDraggingGuideId(null);
            activeDragRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }, [getContainerRect, onAddGuide, onUpdateGuide, onRemoveGuide]);

    // Start dragging a new guide out from the left ruler (vertical)
    const handleLeftRulerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = getContainerRect();
        const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const newGuide: ICustomGuide = {
            id: crypto.randomUUID(),
            orientation: 'vertical',
            positionPct: xPct,
        };
        onAddGuide(newGuide);
        setDraggingGuideId(newGuide.id);
        activeDragRef.current = { id: newGuide.id, orientation: 'vertical' };

        const handlePointerMove = (me: PointerEvent) => {
            const curXPct = ((me.clientX - rect.left) / rect.width) * 100;
            onUpdateGuide(newGuide.id, Math.round(curXPct * 10) / 10);
        };

        const handlePointerUp = (ue: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            const curXPct = ((ue.clientX - rect.left) / rect.width) * 100;
            if (curXPct < 1 || curXPct > 99) {
                onRemoveGuide(newGuide.id);
            }
            setDraggingGuideId(null);
            activeDragRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }, [getContainerRect, onAddGuide, onUpdateGuide, onRemoveGuide]);

    // Reposition existing guide
    const handleGuideDown = useCallback((e: React.PointerEvent, guide: ICustomGuide) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = getContainerRect();
        setDraggingGuideId(guide.id);
        activeDragRef.current = { id: guide.id, orientation: guide.orientation };

        const handlePointerMove = (me: PointerEvent) => {
            if (guide.orientation === 'horizontal') {
                const curYPct = ((me.clientY - rect.top) / rect.height) * 100;
                onUpdateGuide(guide.id, Math.round(curYPct * 10) / 10);
            } else {
                const curXPct = ((me.clientX - rect.left) / rect.width) * 100;
                onUpdateGuide(guide.id, Math.round(curXPct * 10) / 10);
            }
        };

        const handlePointerUp = (ue: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);

            const posPct = guide.orientation === 'horizontal'
                ? ((ue.clientY - rect.top) / rect.height) * 100
                : ((ue.clientX - rect.left) / rect.width) * 100;

            if (posPct < 1 || posPct > 99) {
                onRemoveGuide(guide.id);
            }
            setDraggingGuideId(null);
            activeDragRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }, [getContainerRect, onUpdateGuide, onRemoveGuide]);

    return (
        <>
            {/* Custom Guide Lines on Canvas */}
            {customGuides.map((guide) => {
                const isHoriz = guide.orientation === 'horizontal';
                const isHovered = hoveredGuideId === guide.id;
                const isDragging = draggingGuideId === guide.id;
                const pixelValue = Math.round(guide.positionPct * (isHoriz ? 10.8 : 19.2));

                return (
                    <div
                        key={guide.id}
                        className={cn(
                            "absolute pointer-events-auto transition-colors group select-none",
                            isHoriz
                                ? "left-0 right-0 h-3 -translate-y-1/2 cursor-ns-resize flex items-center"
                                : "top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize flex justify-center"
                        )}
                        style={{
                            left: isHoriz ? 0 : `${guide.positionPct}%`,
                            top: isHoriz ? `${guide.positionPct}%` : 0,
                            zIndex: isDragging ? 55 : 35,
                        }}
                        onPointerEnter={() => setHoveredGuideId(guide.id)}
                        onPointerLeave={() => setHoveredGuideId(prev => prev === guide.id ? null : prev)}
                        onPointerDown={(e) => handleGuideDown(e, guide)}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            onRemoveGuide(guide.id);
                        }}
                    >
                        {/* The guide line */}
                        <div
                            className={cn(
                                "bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)] transition-all",
                                isHoriz ? "w-full" : "h-full",
                                (isHovered || isDragging)
                                    ? (isHoriz ? "h-[2px] bg-cyan-300" : "w-[2px] bg-cyan-300")
                                    : (isHoriz ? "h-px" : "w-px")
                            )}
                        />

                        {/* Pixel coordinate badge on hover or drag */}
                        {(isHovered || isDragging) && (
                            <div
                                className={cn(
                                    "absolute px-1.5 py-0.5 rounded bg-cyan-600 text-white font-mono text-[10px] font-bold shadow-md shadow-cyan-950/40 pointer-events-none whitespace-nowrap",
                                    isHoriz ? "left-6" : "top-6"
                                )}
                            >
                                {isHoriz ? `Y: ${pixelValue}px` : `X: ${pixelValue}px`}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Rulers (visible when Shift+R is active) */}
            {isVisible && (
                <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                    {/* Top-Left Corner Box */}
                    <div className="absolute top-0 left-0 w-[18px] h-[18px] bg-stone-900 border-r border-b border-white/10 z-20 pointer-events-auto" />

                    {/* Top Ruler (Horizontal) */}
                    <div
                        className="absolute top-0 left-[18px] right-0 h-[18px] bg-stone-900/90 backdrop-blur-xs border-b border-white/10 cursor-ns-resize pointer-events-auto select-none overflow-hidden"
                        onPointerDown={handleTopRulerDown}
                        title="Click and drag down to create a Horizontal Guide"
                    >
                        {HORIZONTAL_TICKS.map((px) => {
                            const isMajor = px % 100 === 0;
                            const isLabeled = px % 200 === 0;
                            const leftPct = (px / 1920) * 100;

                            return (
                                <div
                                    key={`th-${px}`}
                                    className="absolute bottom-0"
                                    style={{ left: `${leftPct}%` }}
                                >
                                    <div
                                        className={cn(
                                            "w-px bg-white/30",
                                            isMajor ? "h-2 bg-white/60" : "h-1"
                                        )}
                                    />
                                    {isLabeled && (
                                        <span className="absolute left-1 bottom-1 text-[8px] font-mono text-stone-400 select-none">
                                            {px}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Left Ruler (Vertical) */}
                    <div
                        className="absolute top-[18px] left-0 bottom-0 w-[18px] bg-stone-900/90 backdrop-blur-xs border-r border-white/10 cursor-ew-resize pointer-events-auto select-none overflow-hidden"
                        onPointerDown={handleLeftRulerDown}
                        title="Click and drag right to create a Vertical Guide"
                    >
                        {VERTICAL_TICKS.map((px) => {
                            const isMajor = px % 100 === 0;
                            const isLabeled = px % 200 === 0;
                            const topPct = (px / 1080) * 100;

                            return (
                                <div
                                    key={`tv-${px}`}
                                    className="absolute right-0"
                                    style={{ top: `${topPct}%` }}
                                >
                                    <div
                                        className={cn(
                                            "h-px bg-white/30",
                                            isMajor ? "w-2 bg-white/60" : "w-1"
                                        )}
                                    />
                                    {isLabeled && (
                                        <span
                                            className="absolute right-1 top-1 text-[8px] font-mono text-stone-400 select-none"
                                            style={{
                                                writingMode: 'vertical-rl',
                                                transform: 'rotate(180deg)',
                                            }}
                                        >
                                            {px}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
});

CanvasRulers.displayName = 'CanvasRulers';

