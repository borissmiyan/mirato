import React from 'react';
import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignVerticalJustifyStart,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    AlignHorizontalDistributeCenter,
    AlignVerticalDistributeCenter,
    FlipHorizontal,
    FlipVertical,
    Group,
    Ungroup,
    Blend,
    Combine,
    Scissors,
    SquaresIntersect,
    Diff,
    Sparkles,
} from 'lucide-react';
import { ICanvasItem } from '@/core/types';
import { CanvasAlignMode } from '@/core/utils/canvasDistribution';
import { getItemBounds } from '@/core/utils/canvasDistance';
import { IBooleanOperation } from '@/core/utils/canvasBooleanGroups';
import { cn } from '@/core/utils/cn';

interface CanvasFloatingToolbarProps {
    selectedItems: ICanvasItem[];
    onAlign: (mode: CanvasAlignMode, isShiftHeld?: boolean) => void;
    onDistribute: (axis: 'horizontal' | 'vertical') => void;
    onFlipH: () => void;
    onFlipV: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    onToggleMask?: () => void;
    onBooleanOp?: (op: IBooleanOperation) => void;
    onTidyUp?: () => void;
    canvasScale?: number;
}

export const CanvasFloatingToolbar: React.FC<CanvasFloatingToolbarProps> = React.memo(({
    selectedItems,
    onAlign,
    onDistribute,
    onFlipH,
    onFlipV,
    onGroup,
    onUngroup,
    onToggleMask,
    onBooleanOp,
    onTidyUp,
    canvasScale = 1,
}) => {
    if (selectedItems.length < 2) return null;

    const isGrouped = selectedItems.some(i => !!i.groupId);
    const hasMask = selectedItems.some(i => i.isMask);

    const bounds = selectedItems.map(getItemBounds);
    const minLeft = Math.min(...bounds.map(b => b.left));
    const maxRight = Math.max(...bounds.map(b => b.right));
    const minTop = Math.min(...bounds.map(b => b.top));
    const maxBottom = Math.max(...bounds.map(b => b.bottom));

    const centerX = (minLeft + maxRight) / 2;
    // Clamping center prevents toolbar from extending beyond left/right viewport boundaries
    const clampedCenterX = Math.max(16, Math.min(84, centerX));

    const safeScale = canvasScale > 0 ? canvasScale : 1;
    // Invariant counterScale keeps toolbar at exact 1:1 physical screen pixel size regardless of canvas zoom
    const counterScale = 1 / safeScale;

    // Position toolbar above selection, or below if too close to top
    const isNearTop = minTop < 8;
    const anchorY = isNearTop ? maxBottom : minTop;

    const btnClass = "w-7 h-7 flex items-center justify-center rounded-lg text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all";

    return (
        <div
            className={cn(
                "absolute -translate-x-1/2 flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-stone-900/90 backdrop-blur-md border border-white/10 shadow-2xl z-50 pointer-events-auto select-none",
                isNearTop ? "origin-top" : "origin-bottom"
            )}
            style={{
                left: `${clampedCenterX}%`,
                top: `${anchorY}%`,
                transform: isNearTop 
                    ? `translate(-50%, 14px) scale(${counterScale})`
                    : `translate(-50%, calc(-100% - 14px)) scale(${counterScale})`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Horizontal Align */}
            <button type="button" className={btnClass} onClick={(e) => onAlign('left', e.shiftKey)} title="Align Left (Shift for canvas)">
                <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={(e) => onAlign('center-h', e.shiftKey)} title="Align Center Horizontal (Shift for canvas)">
                <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={(e) => onAlign('right', e.shiftKey)} title="Align Right (Shift for canvas)">
                <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {/* Vertical Align */}
            <button type="button" className={btnClass} onClick={(e) => onAlign('top', e.shiftKey)} title="Align Top (Shift for canvas)">
                <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={(e) => onAlign('middle-v', e.shiftKey)} title="Align Middle Vertical (Shift for canvas)">
                <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={(e) => onAlign('bottom', e.shiftKey)} title="Align Bottom (Shift for canvas)">
                <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {/* Distribute & Tidy Up */}
            <button type="button" className={btnClass} onClick={() => onDistribute('horizontal')} title="Distribute Horizontally">
                <AlignHorizontalDistributeCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={() => onDistribute('vertical')} title="Distribute Vertically">
                <AlignVerticalDistributeCenter className="w-3.5 h-3.5" />
            </button>
            {onTidyUp && (
                <button type="button" className={cn(btnClass, "text-pink-400 hover:text-pink-300")} onClick={onTidyUp} title="Tidy Up (Упорядочить с равными отступами) (⌥⇧⌘T)">
                    <Sparkles className="w-3.5 h-3.5" />
                </button>
            )}

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {/* Flip */}
            <button type="button" className={btnClass} onClick={onFlipH} title="Flip Horizontal (Shift+H)">
                <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button type="button" className={btnClass} onClick={onFlipV} title="Flip Vertical (Shift+V)">
                <FlipVertical className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {/* Group / Ungroup */}
            {onGroup && (
                <button
                    type="button"
                    className={btnClass}
                    onClick={isGrouped ? onUngroup : onGroup}
                    title={isGrouped ? "Ungroup (⇧⌘G)" : "Group (⌘G)"}
                >
                    {isGrouped ? <Ungroup className="w-3.5 h-3.5" /> : <Group className="w-3.5 h-3.5" />}
                </button>
            )}

            {/* Mask */}
            {onToggleMask && (
                <button
                    type="button"
                    className={cn(btnClass, hasMask && "text-accent bg-accent/15")}
                    onClick={onToggleMask}
                    title={hasMask ? "Unmask (^⌘M)" : "Use as mask (^⌘M)"}
                >
                    <Blend className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Boolean Operations (Union, Subtract, Intersect, Exclude) */}
            {onBooleanOp && (
                <>
                    <div className="w-px h-4 bg-white/10 mx-0.5" />
                    <button type="button" className={btnClass} onClick={() => onBooleanOp('union')} title="Union selection (Объединить)">
                        <Combine className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className={btnClass} onClick={() => onBooleanOp('subtract')} title="Subtract selection (Вычесть)">
                        <Scissors className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className={btnClass} onClick={() => onBooleanOp('intersect')} title="Intersect selection (Пересечение)">
                        <SquaresIntersect className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className={btnClass} onClick={() => onBooleanOp('exclude')} title="Exclude selection (Исключить)">
                        <Diff className="w-3.5 h-3.5" />
                    </button>
                </>
            )}
        </div>
    );
});

CanvasFloatingToolbar.displayName = 'CanvasFloatingToolbar';

