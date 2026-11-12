import React, { memo } from 'react';
import { ICanvasItem } from '@/core/types';
import { ResizeHandle, PivotHandle } from './CanvasHandles';
import { CanvasCornerRadiusHandles } from './CanvasCornerRadiusHandles';
import { CanvasLineHandles } from './CanvasLineHandles';

interface CanvasItemControlsProps {
    item: ICanvasItem;
    slideId: string;
    canvasScale: number;
    dragActive: boolean;
    dragActiveMode: 'move' | 'resize' | 'rotate' | null;
    isAltHeld?: boolean;
    onResizeStart: (e: React.MouseEvent, pos: string) => void;
    onRotateStart: (e: React.MouseEvent, pos: string) => void;
    onRotateHover: (angle: number | null) => void;
    onPivotStart: (e: React.MouseEvent) => void;
    onDoubleClickHandle: (pos: string) => void;
}

const HANDLE_POSITIONS = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
] as const;

/**
 * Standardized controls layer for an active canvas item.
 * Renders dimension tooltips, 8 scale-invariant resize handles, rotation triggers,
 * the pivot handle, and corner radius handles.
 */
export const CanvasItemControls: React.FC<CanvasItemControlsProps> = memo(({
    item,
    slideId,
    canvasScale,
    dragActive,
    dragActiveMode,
    isAltHeld = false,
    onResizeStart,
    onRotateStart,
    onRotateHover,
    onPivotStart,
    onDoubleClickHandle,
}) => {
    // When Alt is held, suppress bounding resize and pivot handles for distance inspection,
    // but keep corner radius handles alive so user can Alt-drag to adjust an individual corner radius.
    if (isAltHeld) {
        return (
            <CanvasCornerRadiusHandles
                item={item}
                slideId={slideId}
                itemScale={item.scale || 1}
                canvasScale={canvasScale}
            />
        );
    }

    // Vector line primitive uses dedicated 2-point controls
    if (item.type === 'stroke') {
        return (
            <CanvasLineHandles
                item={item}
                slideId={slideId}
                canvasScale={canvasScale}
            />
        );
    }

    return (
        <>
            {HANDLE_POSITIONS.map(pos => {
                const isCorner = (pos.includes('-left') || pos.includes('-right')) && !pos.includes('middle');
                return (
                    <ResizeHandle
                        key={pos}
                        pos={pos}
                        itemRotation={item.rotation || 0}
                        itemScale={item.scale || 1}
                        canvasScale={canvasScale}
                        onMouseDown={(e) => onResizeStart(e, pos)}
                        onDoubleClick={() => onDoubleClickHandle(pos)}
                        onRotateMouseDown={isCorner ? (e) => onRotateStart(e, pos) : undefined}
                        onRotateHover={onRotateHover}
                    />
                );
            })}

            <PivotHandle
                x={item.pivotX ?? 50}
                y={item.pivotY ?? 50}
                itemRotation={item.rotation || 0}
                itemScale={item.scale || 1}
                canvasScale={canvasScale}
                onMouseDown={onPivotStart}
            />

            <CanvasCornerRadiusHandles
                item={item}
                slideId={slideId}
                itemScale={item.scale || 1}
                canvasScale={canvasScale}
            />
        </>
    );
});

CanvasItemControls.displayName = 'CanvasItemControls';
export default CanvasItemControls;
