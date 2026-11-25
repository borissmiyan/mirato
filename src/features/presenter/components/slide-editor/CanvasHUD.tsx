import React, { memo } from 'react';
import { RotateCw } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { ICanvasItem } from '@/core/types';
import { getItemBounds } from '@/core/utils/canvasDistance';
import { canvasEffectiveScaleAtom } from '@/core/store/uiAtoms';

export interface CanvasHUDProps {
    selectedItems?: ICanvasItem[];
    activeMode: 'move' | 'resize' | 'rotate' | 'radius' | null;
    radius?: number | null;
    label?: string;
    initialPos?: { x: number; y: number } | null;
}

/**
 * Standardized Figma-grade Canvas HUD Badge.
 * Anchored directly below the bottom-right corner of the active object / group bounding box
 * on the canvas, smoothly following the dragged item with scale-invariant crisp typography.
 */
export const CanvasHUD: React.FC<CanvasHUDProps> = memo(({
    selectedItems = [],
    activeMode,
    radius,
    label,
}) => {
    const canvasScale = useAtomValue(canvasEffectiveScaleAtom);

    if (!activeMode || selectedItems.length === 0) return null;

    // Compute union bounding box in canvas % coordinates
    const bounds = selectedItems.map(getItemBounds);
    const minLeft = Math.min(...bounds.map(b => b.left));
    const maxRight = Math.max(...bounds.map(b => b.right));
    const minTop = Math.min(...bounds.map(b => b.top));
    const maxBottom = Math.max(...bounds.map(b => b.bottom));

    // Extract item metrics in 1920x1080 logical pixels
    let pxX = Math.round(minLeft * 19.2);
    let pxY = Math.round(minTop * 10.8);
    let pxW = Math.round((maxRight - minLeft) * 19.2);
    let pxH = Math.round((maxBottom - minTop) * 10.8);
    let rot = 0;

    if (selectedItems.length === 1 && selectedItems[0]) {
        const item = selectedItems[0];
        pxX = Math.round(item.x * 19.2);
        pxY = Math.round(item.y * 10.8);
        pxW = Math.round(item.width * 19.2);
        pxH = Math.round(item.height * 10.8);
        rot = item.rotation || 0;
    }

    const roundedRadius = Math.max(0, Math.round(radius ?? 0));
    const roundedRot = Math.round(rot);
    const rotSign = roundedRot > 0 ? '+' : '';
    const invScale = canvasScale > 0 ? 1 / canvasScale : 1;

    return (
        <div
            className="absolute pointer-events-none z-[1200] select-none will-change-transform"
            style={{
                left: `${maxRight}%`,
                top: `${maxBottom}%`,
                transform: `scale(${invScale}) translate(8px, 8px)`,
                transformOrigin: 'top left',
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
                            <span className="opacity-90">{selectedItems.length} ·</span>
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
        </div>
    );
});

CanvasHUD.displayName = 'CanvasHUD';
export default CanvasHUD;
