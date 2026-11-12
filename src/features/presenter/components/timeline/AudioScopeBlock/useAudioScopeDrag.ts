import { useState, useCallback, useRef, useEffect } from 'react';
import { IAudioScope } from '@/core/types';
import { TimelineItem } from '../hooks/useTimelineLayout';
import { useAudioScopeResize, DragState } from './useAudioScopeResize';
export type { DragState };

interface UseAudioScopeDragProps {
    scope: IAudioScope;
    visualTimeline: TimelineItem[];
    startIdx: number;
    endIdx: number;
    left: number;
    width: number;
    selectAudioScope: (id: string) => void;
    updateAudioScopeBoundary: (id: string, startId: string, endId: string) => void;
}

export function useAudioScopeDrag({
    scope,
    visualTimeline,
    startIdx,
    endIdx,
    left,
    width,
    selectAudioScope,
    updateAudioScopeBoundary
}: UseAudioScopeDragProps) {
    const [dragState, setDragState] = useState<DragState | null>(null);

    const visualRef = useRef(visualTimeline);
    const startIdxRef = useRef(startIdx);
    const endIdxRef = useRef(endIdx);
    const scopeRef = useRef(scope);

    useEffect(() => {
        visualRef.current = visualTimeline;
        startIdxRef.current = startIdx;
        endIdxRef.current = endIdx;
        scopeRef.current = scope;
    }, [visualTimeline, startIdx, endIdx, scope]);

    const resolveIdxAtX = useCallback((x: number) => {
        const visual = visualRef.current;
        let bestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < visual.length; i++) {
            const item = visual[i];
            const center = item.x + item.width / 2;
            const diff = Math.abs(x - center);
            if (diff < minDiff) {
                minDiff = diff;
                bestIdx = i;
            }
        }
        return bestIdx;
    }, []);

    const { onLeftHandleDown, onRightHandleDown } = useAudioScopeResize({
        visualRef,
        scopeRef,
        startIdxRef,
        endIdxRef,
        left,
        width,
        resolveIdxAtX,
        setDragState,
        updateAudioScopeBoundary
    });

    const onClipDragDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        selectAudioScope(scopeRef.current.id);

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const initialLeft = left;
        const initialWidth = width;

        // Capture how far into the clip the user clicked so the clip left edge
        // tracks correctly without jumping.
        const pointerOffsetInClip = e.clientX - initialLeft;

        setDragState({ type: 'clip', dx: 0, initialLeft, initialWidth });
        
        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentStartIdx = startIdxRef.current;
        const currentEndIdx = endIdxRef.current;

        const presentationSlideIndices = currentVisual
            .map((item, idx) => item.presentationId === currentScope.presentationId && item.slide ? idx : -1)
            .filter(idx => idx !== -1);
            
        const startPosInPresIdx = presentationSlideIndices.indexOf(currentStartIdx);
        const endPosInPresIdx = presentationSlideIndices.indexOf(currentEndIdx);
        
        if (startPosInPresIdx === -1 || endPosInPresIdx === -1) {
            setDragState(null);
            return;
        }

        const clipSlideCount = endPosInPresIdx - startPosInPresIdx;
        let lastInformedStartIdxInPres = startPosInPresIdx;

        const onPointerMove = (ev: PointerEvent) => {
            const targetX = ev.clientX - pointerOffsetInClip;
            const rawDx = targetX - initialLeft;
            const newTileIdx = resolveIdxAtX(targetX);
            
            if (newTileIdx === -1) {
                setDragState(prev => prev ? { ...prev, dx: rawDx } : null);
                return;
            }

            const freshVisual = visualRef.current;
            const snappedX = freshVisual[newTileIdx].x;
            const dist = Math.abs(targetX - snappedX);
            const visualDx = dist < 20 ? (snappedX - initialLeft) : rawDx;
            
            setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
            
            const presIndices = freshVisual
                .map((item, idx) => item.presentationId === currentScope.presentationId && item.slide ? idx : -1)
                .filter(idx => idx !== -1);

            let nearestPresSlideIdx = -1;
            let minDistance = Infinity;
            
            presIndices.forEach((tileIdx, presIdx) => {
                const diffDist = Math.abs(tileIdx - newTileIdx);
                if (diffDist < minDistance) {
                    minDistance = diffDist;
                    nearestPresSlideIdx = presIdx;
                }
            });

            if (nearestPresSlideIdx !== -1 && nearestPresSlideIdx !== lastInformedStartIdxInPres) {
                const newStartPosInPres = nearestPresSlideIdx;
                const newEndPosInPres = Math.min(presIndices.length - 1, newStartPosInPres + clipSlideCount);
                
                const startSlideId = freshVisual[presIndices[newStartPosInPres]]?.slide?.id;
                const endSlideId = freshVisual[presIndices[newEndPosInPres]]?.slide?.id;
                
                if (startSlideId && endSlideId) {
                    lastInformedStartIdxInPres = newStartPosInPres;
                    updateAudioScopeBoundary(currentScope.id, startSlideId, endSlideId);
                }
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            target.releasePointerCapture(ev.pointerId);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            setDragState(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }, [left, width, resolveIdxAtX, updateAudioScopeBoundary, selectAudioScope]);

    return {
        dragState,
        onClipDragDown,
        onLeftHandleDown,
        onRightHandleDown
    };
}
