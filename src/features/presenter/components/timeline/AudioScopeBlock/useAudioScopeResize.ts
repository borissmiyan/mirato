import { useCallback } from 'react';
import { IAudioScope } from '@/core/types';
import { TimelineItem } from '../hooks/useTimelineLayout';

export interface DragState {
    type: 'clip' | 'left' | 'right';
    dx: number;
    initialLeft: number;
    initialWidth: number;
}

interface UseAudioScopeResizeProps {
    visualRef: React.MutableRefObject<TimelineItem[]>;
    scopeRef: React.MutableRefObject<IAudioScope>;
    startIdxRef: React.MutableRefObject<number>;
    endIdxRef: React.MutableRefObject<number>;
    left: number;
    width: number;
    resolveIdxAtX: (x: number) => number;
    setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
    updateAudioScopeBoundary: (id: string, startId: string, endId: string) => void;
}

/**
 * Hook to handle boundary handle dragging (left and right edges) for AudioScope.
 */
export function useAudioScopeResize({
    visualRef,
    scopeRef,
    startIdxRef,
    endIdxRef,
    left,
    width,
    resolveIdxAtX,
    setDragState,
    updateAudioScopeBoundary
}: UseAudioScopeResizeProps) {

    const onLeftHandleDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentEndIdx = endIdxRef.current;
        const endSlideIdVal = currentVisual[currentEndIdx]?.slide?.id;
        
        if (!endSlideIdVal) return;
        
        let lastInformedStartIdx = startIdxRef.current;
        const initialLeft = left;
        const initialWidth = width;
        const pointerOffsetFromLeftEdge = e.clientX - initialLeft;

        setDragState({ type: 'left', dx: 0, initialLeft, initialWidth });

        const onPointerMove = (ev: PointerEvent) => {
            const freshVisual = visualRef.current;
            const targetX = ev.clientX - pointerOffsetFromLeftEdge;
            const rawDx = targetX - initialLeft;
            const newIdx = resolveIdxAtX(targetX);
            
            if (newIdx !== -1 && newIdx <= currentEndIdx) {
                const snappedX = freshVisual[newIdx].x;
                const dist = Math.abs(targetX - snappedX);
                const visualDx = dist < 20 ? (snappedX - initialLeft) : rawDx;
                
                setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
                
                let snappedIdx = newIdx;
                while (snappedIdx < freshVisual.length && snappedIdx >= 0 && 
                      (!freshVisual[snappedIdx]?.slide || freshVisual[snappedIdx]?.presentationId !== currentScope.presentationId) && 
                      snappedIdx <= currentEndIdx) {
                    snappedIdx++;
                }
                const targetSlide = freshVisual[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedStartIdx) {
                    lastInformedStartIdx = snappedIdx;
                    updateAudioScopeBoundary(currentScope.id, targetSlide.id, endSlideIdVal);
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
    }, [left, width, visualRef, scopeRef, endIdxRef, startIdxRef, resolveIdxAtX, setDragState, updateAudioScopeBoundary]);

    const onRightHandleDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const currentVisual = visualRef.current;
        const currentScope = scopeRef.current;
        const currentStartIdx = startIdxRef.current;
        const startSlideIdVal = currentVisual[currentStartIdx]?.slide?.id;
        
        if (!startSlideIdVal) return;
        
        let lastInformedEndIdx = endIdxRef.current;
        const initialLeft = left;
        const initialWidth = width;
        const initialRightEdge = initialLeft + initialWidth;
        const pointerOffsetFromRightEdge = e.clientX - initialRightEdge;

        setDragState({ type: 'right', dx: 0, initialLeft, initialWidth });

        const onPointerMove = (ev: PointerEvent) => {
            const freshVisual = visualRef.current;
            const targetX = ev.clientX - pointerOffsetFromRightEdge;
            const rawDx = targetX - initialRightEdge;
            const newIdx = resolveIdxAtX(targetX);
            
            if (newIdx !== -1 && newIdx >= currentStartIdx) {
                const snappedX = freshVisual[newIdx].x + freshVisual[newIdx].width;
                const dist = Math.abs(targetX - snappedX);
                const visualDx = dist < 20 ? (snappedX - initialRightEdge) : rawDx;
                
                setDragState(prev => prev ? { ...prev, dx: visualDx } : null);
                
                let snappedIdx = newIdx;
                while (snappedIdx >= 0 && 
                      (!freshVisual[snappedIdx]?.slide || freshVisual[snappedIdx]?.presentationId !== currentScope.presentationId) && 
                      snappedIdx >= currentStartIdx) {
                    snappedIdx--;
                }
                const targetSlide = freshVisual[snappedIdx]?.slide;
                if (targetSlide && snappedIdx !== lastInformedEndIdx) {
                    lastInformedEndIdx = snappedIdx;
                    updateAudioScopeBoundary(currentScope.id, startSlideIdVal, targetSlide.id);
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
    }, [left, width, visualRef, scopeRef, startIdxRef, endIdxRef, resolveIdxAtX, setDragState, updateAudioScopeBoundary]);

    return {
        onLeftHandleDown,
        onRightHandleDown
    };
}

