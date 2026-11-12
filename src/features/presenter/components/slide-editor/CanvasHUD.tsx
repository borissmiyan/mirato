import React, { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw } from 'lucide-react';
import { ICanvasItem } from '@/core/types';
import { getItemBounds } from '@/core/utils/canvasDistance';

export interface CanvasHUDProps {
    selectedItems?: ICanvasItem[];
    activeMode: 'move' | 'resize' | 'rotate' | 'radius' | null;
    radius?: number | null;
    label?: string;
    initialPos?: { x: number; y: number } | null;
}

// Global pointer position cache ensures zero-frame lag when HUD mounts on drag start
let globalPointerPos = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', (e) => {
        globalPointerPos = { x: e.clientX, y: e.clientY };
    }, { passive: true });
}

/**
 * Standardized Figma-grade Canvas HUD Badge.
 * Follows the cursor with screen-fixed coordinates (scale-invariant, never flipped/inverted).
 * Operates at 120 FPS via translate3d portal with edge-collision flip.
 */
export const CanvasHUD: React.FC<CanvasHUDProps> = memo(({
    selectedItems = [],
    activeMode,
    radius,
    label,
    initialPos,
}) => {
    const [pos, setPos] = useState(() => initialPos || { ...globalPointerPos });
    const hudRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!activeMode) return;

        const onPointerMove = (e: PointerEvent) => {
            globalPointerPos = { x: e.clientX, y: e.clientY };
            setPos({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        return () => window.removeEventListener('pointermove', onPointerMove);
    }, [activeMode]);

    if (!activeMode) return null;

    // Viewport edge collision check: flip offset to stay within screen boundaries
    const isNearRight = typeof window !== 'undefined' && pos.x + 180 > window.innerWidth;
    const isNearBottom = typeof window !== 'undefined' && pos.y + 60 > window.innerHeight;

    const screenX = isNearRight ? pos.x - 16 : pos.x + 16;
    const screenY = isNearBottom ? pos.y - 16 : pos.y + 16;
    const transformOrigin = `${isNearRight ? 'right' : 'left'} ${isNearBottom ? 'bottom' : 'top'}`;
    const translateOffset = `${isNearRight ? '-100%' : '0'}, ${isNearBottom ? '-100%' : '0'}`;

    // Extract item metrics
    let pxX = 0;
    let pxY = 0;
    let pxW = 0;
    let pxH = 0;
    let rot = 0;

    if (selectedItems.length === 1 && selectedItems[0]) {
        const item = selectedItems[0];
        pxX = Math.round(item.x * 19.2);
        pxY = Math.round(item.y * 10.8);
        pxW = Math.round(item.width * 19.2);
        pxH = Math.round(item.height * 10.8);
        rot = item.rotation || 0;
    } else if (selectedItems.length > 1) {
        const bounds = selectedItems.map(getItemBounds);
        const minLeft = Math.min(...bounds.map(b => b.left));
        const maxRight = Math.max(...bounds.map(b => b.right));
        const minTop = Math.min(...bounds.map(b => b.top));
        const maxBottom = Math.max(...bounds.map(b => b.bottom));
        pxX = Math.round(minLeft * 19.2);
        pxY = Math.round(minTop * 10.8);
        pxW = Math.round((maxRight - minLeft) * 19.2);
        pxH = Math.round((maxBottom - minTop) * 10.8);
    }

    const roundedRadius = Math.max(0, Math.round(radius ?? 0));
    const roundedRot = Math.round(rot);
    const rotSign = roundedRot > 0 ? '+' : '';

    return createPortal(
        <div
            ref={hudRef}
            className="fixed left-0 top-0 pointer-events-none z-[99999] select-none will-change-transform animate-in fade-in zoom-in-95 duration-75"
            style={{
                transform: `translate3d(${screenX}px, ${screenY}px, 0) translate(${translateOffset})`,
                transformOrigin,
            }}
        >
            <div className="rounded-xl px-2.5 py-1 bg-accent text-accent-foreground font-sans tabular-nums font-bold text-xs shadow-xl border border-black/10 flex items-center gap-1.5 whitespace-nowrap">
                {activeMode === 'rotate' && (
                    <>
                        <RotateCw className="w-3.5 h-3.5 text-accent-foreground shrink-0" />
                        <span>{rotSign}{roundedRot}°</span>
                    </>
                )}
                {activeMode === 'resize' && (
                    <>
                        <span>{pxW} × {pxH} px</span>
                    </>
                )}
                {activeMode === 'move' && (
                    <>
                        {selectedItems.length > 1 && (
                            <span className="opacity-90">{selectedItems.length} объекта ·</span>
                        )}
                        <span>X: {pxX}</span>
                        <span className="opacity-30">|</span>
                        <span>Y: {pxY}</span>
                    </>
                )}
                {activeMode === 'radius' && (
                    <>
                        <span>{label ? `${label}: ` : 'R: '}{roundedRadius}px</span>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
});

CanvasHUD.displayName = 'CanvasHUD';
export default CanvasHUD;
