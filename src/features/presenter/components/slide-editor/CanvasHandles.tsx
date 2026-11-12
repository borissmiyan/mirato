import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/core/utils/cn';
import { getCursorForCorner, getRotateAngle } from '@/core/utils/canvasMath';

interface ResizeHandleProps {
    pos: string;
    itemRotation: number;
    itemScale?: number;
    canvasScale?: number;
    onMouseDown: (e: React.MouseEvent) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    onRotateMouseDown?: (e: React.MouseEvent) => void;
    onRotateHover?: (angle: number | null) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ 
    pos, 
    itemRotation, 
    itemScale = 1,
    canvasScale = 1,
    onMouseDown, 
    onDoubleClick,
    onRotateMouseDown, 
    onRotateHover 
}) => {
    const classes: Record<string, string> = {
        'top-left': 'top-0 left-0',
        'top-center': 'top-0 left-1/2',
        'top-right': 'top-0 left-full',
        'middle-left': 'top-1/2 left-0',
        'middle-right': 'top-1/2 left-full',
        'bottom-left': 'top-full left-0',
        'bottom-center': 'top-full left-1/2',
        'bottom-right': 'top-full left-full',
    };

    const isCorner = (pos.includes('-left') || pos.includes('-right')) && !pos.includes('middle');
    const resizeCursor = getCursorForCorner(pos, itemRotation);
    const rotateAngle = getRotateAngle(pos, itemRotation);

    // Rotation zone: 16px outward from the corner, positioned OUTSIDE the element.
    const rotateZoneOffsets: Record<string, React.CSSProperties> = {
        'top-left': { top: -14, left: -14, width: 24, height: 24 },
        'top-right': { top: -14, right: -14, width: 24, height: 24 },
        'bottom-left': { bottom: -14, left: -14, width: 24, height: 24 },
        'bottom-right': { bottom: -14, right: -14, width: 24, height: 24 },
    };

    const effectiveTotalScale = (itemScale || 1) * (canvasScale || 1);
    const counterScale = effectiveTotalScale > 0 ? 1 / effectiveTotalScale : 1;

    return (
        <div 
            className={cn("absolute z-50", classes[pos])} 
            style={{ transform: `translate(-50%, -50%) scale(${counterScale})` }}
        >
            {/* Rotation Hit Zone — 16px outward from corner, hides system cursor */}
            {isCorner && onRotateMouseDown && (
                <div
                    className="absolute"
                    style={{ cursor: 'none', ...rotateZoneOffsets[pos] }}
                    onMouseEnter={() => onRotateHover?.(rotateAngle)}
                    onMouseLeave={() => onRotateHover?.(null)}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onRotateMouseDown(e);
                    }}
                />
            )}
            {/* The visible square handle — resize (on top of rotation zone) */}
            <div
                className="relative z-10 w-2 h-2 bg-accent border border-black/50 shadow-xs"
                style={{ cursor: resizeCursor }}
                onMouseEnter={() => onRotateHover?.(null)}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onMouseDown(e);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDoubleClick?.(e);
                }}
            />
        </div>
    );
};

export const PivotHandle: React.FC<{
    x: number;
    y: number;
    itemRotation?: number;
    itemScale?: number;
    canvasScale?: number;
    onMouseDown: (e: React.MouseEvent) => void;
}> = ({ x, y, itemRotation = 0, itemScale = 1, canvasScale = 1, onMouseDown }) => {
    const effectiveTotalScale = (itemScale || 1) * (canvasScale || 1);
    const counterScale = effectiveTotalScale > 0 ? 1 / effectiveTotalScale : 1;

    return (
        <div
            className="absolute z-60 cursor-crosshair group/pivot w-3 h-3"
            style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(-${itemRotation}deg) scale(${counterScale})`,
                transformOrigin: 'center center',
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e);
            }}
        >
            {/* The visual crosshair center */}
            <div className="w-full h-full rounded-full border border-accent bg-accent/20 flex items-center justify-center shadow-xs">
                <div className="w-1 h-1 bg-accent rounded-full" />
                {/* Visual lines */}
                <div className="absolute w-4 h-px bg-accent/60" />
                <div className="absolute w-px h-4 bg-accent/60" />
            </div>
            {/* Label on hover */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-accent px-1.5 py-0.5 rounded text-[8px] font-bold text-accent-foreground opacity-0 group-hover/pivot:opacity-100 transition-opacity whitespace-nowrap">
                PIVOT
            </div>
        </div>
    );
};

export const RotateCursor: React.FC<{ angle: number }> = ({ angle }) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    return createPortal(
        <div
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                transform: `translate3d(${pos.x - 14}px, ${pos.y - 14}px, 0)`,
                zIndex: 99999,
            }}
        >
            <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ transform: `rotate(${angle}deg)`, display: 'block' }}
            >
                <path
                    d="M 8 7 A 7.5 7.5 0 0 1 20 7"
                    stroke="white"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                />
                <polygon points="5,5 9,7 6,10" fill="white" />
                <polygon points="23,5 19,7 22,10" fill="white" />

                <path
                    d="M 8 7 A 7.5 7.5 0 0 1 20 7"
                    stroke="black"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                />
                <polygon points="5,5 9,7 6,10" fill="black" />
                <polygon points="23,5 19,7 22,10" fill="black" />
            </svg>
        </div>,
        document.body
    );
};
