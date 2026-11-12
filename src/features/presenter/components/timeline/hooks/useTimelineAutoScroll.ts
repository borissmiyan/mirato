import { useRef, useCallback, useEffect } from 'react';
import { TrackContainerHandle } from '../TrackContainer';

interface UseTimelineAutoScrollProps {
    trackRef: React.RefObject<TrackContainerHandle | null>;
    dragActiveRef: React.MutableRefObject<boolean>;
    disabled?: boolean;
}

/**
 * Hook to provide silky 120Hz ProMotion auto-scrolling during drag operations.
 */
export const useTimelineAutoScroll = ({
    trackRef,
    dragActiveRef,
    disabled = false
}: UseTimelineAutoScrollProps) => {
    const autoScrollRafRef = useRef<number | null>(null);
    const pointerXRef = useRef<number | null>(null);
    const pointerYRef = useRef<number | null>(null);
    const scrollRemainderRef = useRef<number>(0);
    const edgeHoldStartRef = useRef<number | null>(null);

    // Track real physical pointer position regardless of scroll or dnd-kit delta
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            pointerXRef.current = e.clientX;
            pointerYRef.current = e.clientY;
        };
        window.addEventListener('pointermove', handlePointerMove);
        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, []);

    const stopAutoScroll = useCallback(() => {
        if (autoScrollRafRef.current !== null) {
            cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollRafRef.current = null;
        }
        scrollRemainderRef.current = 0;
        edgeHoldStartRef.current = null;
    }, []);

    const startAutoScroll = useCallback(() => {
        if (disabled) return;
        scrollRemainderRef.current = 0;
        edgeHoldStartRef.current = null;

        if (autoScrollRafRef.current === null) {
            let lastTickTime = performance.now();
            const tick = () => {
                if (!dragActiveRef.current) {
                    autoScrollRafRef.current = null;
                    return;
                }

                const scrollEl = trackRef.current?.getScrollElement();
                const pointerX = pointerXRef.current;
                const pointerY = pointerYRef.current;
                
                if (scrollEl && pointerX !== null) {
                    const rect = scrollEl.getBoundingClientRect();

                    // Guard: Only auto-scroll when pointer is vertically near the timeline track
                    if (pointerY !== null && (pointerY < rect.top - 60 || pointerY > rect.bottom + 60)) {
                        lastTickTime = performance.now();
                        scrollRemainderRef.current = 0;
                        edgeHoldStartRef.current = null;
                        autoScrollRafRef.current = requestAnimationFrame(tick);
                        return;
                    }

                    // Symmetrical Apple ProMotion edge acceleration:
                    const EDGE_ZONE = 120;
                    const MIN_SPEED = 1.5;
                    const MAX_SPEED = 24.0;

                    const boundaryRight = Math.min(rect.right, typeof window !== 'undefined' ? window.innerWidth : rect.right);
                    const boundaryLeft = Math.max(rect.left, 0);

                    const rightThreshold = boundaryRight - EDGE_ZONE;
                    const leftThreshold = boundaryLeft + EDGE_ZONE;

                    let targetSpeed = 0;

                    if (pointerX < leftThreshold && scrollEl.scrollLeft > 0) {
                        const penetration = leftThreshold - pointerX;
                        const ratio = Math.max(0, Math.min(penetration / EDGE_ZONE, 1.0));
                        const curve = Math.pow(ratio, 1.4);
                        let speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * curve;

                        if (pointerX < boundaryLeft) {
                            const overdrag = boundaryLeft - pointerX;
                            speed *= (1.0 + Math.min(0.4, (overdrag / 100) * 0.4));
                        }

                        const now = performance.now();
                        if (edgeHoldStartRef.current === null) {
                            edgeHoldStartRef.current = now;
                        }
                        const holdDuration = now - edgeHoldStartRef.current;
                        const timeMultiplier = Math.min(1.6, 1.0 + (holdDuration / 1500) * 0.6);
                        targetSpeed = -(speed * timeMultiplier);
                    } else if (pointerX > rightThreshold && scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth) {
                        const penetration = pointerX - rightThreshold;
                        const ratio = Math.max(0, Math.min(penetration / EDGE_ZONE, 1.0));
                        const curve = Math.pow(ratio, 1.4);
                        let speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * curve;

                        if (pointerX > boundaryRight) {
                            const overdrag = pointerX - boundaryRight;
                            speed *= (1.0 + Math.min(0.4, (overdrag / 100) * 0.4));
                        }

                        const now = performance.now();
                        if (edgeHoldStartRef.current === null) {
                            edgeHoldStartRef.current = now;
                        }
                        const holdDuration = now - edgeHoldStartRef.current;
                        const timeMultiplier = Math.min(1.6, 1.0 + (holdDuration / 1500) * 0.6);
                        targetSpeed = (speed * timeMultiplier);
                    } else {
                        edgeHoldStartRef.current = null;
                    }

                    if (targetSpeed !== 0) {
                        const now = performance.now();
                        const delta = Math.min(Math.max((now - lastTickTime) / 16.67, 0.2), 1.5);
                        lastTickTime = now;

                        const totalDelta = (targetSpeed * delta) + scrollRemainderRef.current;
                        const intDelta = Math.trunc(totalDelta);
                        scrollRemainderRef.current = totalDelta - intDelta;

                        if (intDelta !== 0) {
                            const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
                            scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, scrollEl.scrollLeft + intDelta));
                        }
                    } else {
                        lastTickTime = performance.now();
                        scrollRemainderRef.current = 0;
                    }
                } else {
                    lastTickTime = performance.now();
                    edgeHoldStartRef.current = null;
                }
                
                autoScrollRafRef.current = requestAnimationFrame(tick);
            };
            autoScrollRafRef.current = requestAnimationFrame(tick);
        }
    }, [disabled, dragActiveRef, trackRef]);

    return {
        startAutoScroll,
        stopAutoScroll
    };
};

