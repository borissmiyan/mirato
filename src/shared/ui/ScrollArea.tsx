import React, { useRef, useEffect, useCallback, forwardRef } from 'react';
import { cn } from '@/core/utils/cn';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Classes applied to the outer relative wrapper (controls flex sizing / layout). */
    wrapperClassName?: string;
    /** Vertical inset in px for the overlay scrollbar track. Default: 6. */
    trackInset?: number;
}

const MIN_THUMB_HEIGHT = 32;
const HIDE_DELAY_MS = 850;

/**
 * High-performance scroll container with:
 * - 100% native GPU-compositor scrolling (no JS wheel interception, so macOS native trackpad acceleration & momentum run at 120 FPS).
 * - Zero React re-renders during scroll (scrollbar geometry & visibility updated directly via DOM refs).
 * - Opaque, subtle Mirato-styled overlay scrollbar that auto-hides when idle or when there is no overflow,
 *   and reveals on scroll or when hovering the scrollbar hit-zone.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(({
    className,
    wrapperClassName,
    children,
    trackInset = 6,
    ...rest
}, forwardedRef) => {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const metricsRef = useRef({ hasOverflow: false, thumbHeight: 0, isScrolling: false, isHovered: false, isDragging: false });
    const dragStateRef = useRef<{ startY: number; startScrollTop: number; latestY: number; rafId: number | null } | null>(null);

    // Merge internal ref with forwarded ref
    const setViewportRef = useCallback(
        (node: HTMLDivElement | null) => {
            innerRef.current = node;
            if (typeof forwardedRef === 'function') {
                forwardedRef(node);
            } else if (forwardedRef) {
                (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
        },
        [forwardedRef]
    );

    const syncThumbStyles = useCallback(() => {
        const track = trackRef.current;
        const thumb = thumbRef.current;
        if (!track || !thumb) return;

        const m = metricsRef.current;
        if (!m.hasOverflow) {
            track.style.display = 'none';
            return;
        }
        track.style.display = 'flex';
        const visible = m.isScrolling || m.isHovered || m.isDragging;
        track.style.opacity = visible ? '1' : '0';

        if (m.isDragging) {
            thumb.style.width = '8px';
            thumb.style.backgroundColor = 'var(--color-accent, #f59e0b)';
            thumb.style.borderColor = 'var(--color-accent, #f59e0b)';
        } else if (m.isHovered) {
            thumb.style.width = '8px';
            thumb.style.backgroundColor = '#57534e';
            thumb.style.borderColor = '#78716c';
        } else {
            thumb.style.width = '6px';
            thumb.style.backgroundColor = '#3b3633';
            thumb.style.borderColor = '#4d4743';
        }
    }, []);

    const updateMetrics = useCallback(() => {
        const el = innerRef.current;
        const thumb = thumbRef.current;
        if (!el) return;

        const { scrollTop, scrollHeight, clientHeight } = el;
        const overflow = scrollHeight > clientHeight + 2;
        metricsRef.current.hasOverflow = overflow;

        if (!overflow) {
            metricsRef.current.thumbHeight = 0;
            syncThumbStyles();
            return;
        }

        const trackHeight = Math.max(1, clientHeight - trackInset * 2);
        const rawHeight = (clientHeight / scrollHeight) * trackHeight;
        const clampedHeight = Math.max(MIN_THUMB_HEIGHT, Math.min(trackHeight, rawHeight));
        const maxScroll = Math.max(1, scrollHeight - clientHeight);
        const ratio = Math.max(0, Math.min(1, scrollTop / maxScroll));
        const top = ratio * (trackHeight - clampedHeight);

        metricsRef.current.thumbHeight = clampedHeight;
        if (thumb) {
            thumb.style.height = `${clampedHeight}px`;
            thumb.style.transform = `translate3d(0, ${top}px, 0)`;
        }
        syncThumbStyles();
    }, [trackInset, syncThumbStyles]);

    const bumpScrollVisibility = useCallback(() => {
        if (!metricsRef.current.isScrolling) {
            metricsRef.current.isScrolling = true;
            syncThumbStyles();
        }
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            metricsRef.current.isScrolling = false;
            hideTimerRef.current = null;
            syncThumbStyles();
        }, HIDE_DELAY_MS);
    }, [syncThumbStyles]);

    // Track scroll, resize, and content height changes with zero React re-renders
    useEffect(() => {
        const el = innerRef.current;
        if (!el) return;

        updateMetrics();

        const onScroll = () => {
            updateMetrics();
            bumpScrollVisibility();
        };

        el.addEventListener('scroll', onScroll, { passive: true });

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                updateMetrics();
            });
            resizeObserver.observe(el);
            if (el.firstElementChild) {
                resizeObserver.observe(el.firstElementChild);
            }
        }

        let mutationObserver: MutationObserver | null = null;
        if (typeof MutationObserver !== 'undefined') {
            mutationObserver = new MutationObserver(() => {
                updateMetrics();
                if (resizeObserver && el.firstElementChild) {
                    resizeObserver.observe(el.firstElementChild);
                }
            });
            mutationObserver.observe(el, { childList: true, subtree: false, attributes: false });
        }

        return () => {
            el.removeEventListener('scroll', onScroll);
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
    }, [updateMetrics, bumpScrollVisibility]);

    // Thumb drag interaction (coalesced to 1 update per animation frame for tear-free scrubbing)
    const applyDragScroll = useCallback(() => {
        const el = innerRef.current;
        const drag = dragStateRef.current;
        if (!el || !drag) return;
        drag.rafId = null;
        const trackHeight = Math.max(1, el.clientHeight - trackInset * 2);
        const scrollableThumbRange = Math.max(1, trackHeight - metricsRef.current.thumbHeight);
        const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
        const deltaY = drag.latestY - drag.startY;
        el.scrollTop = drag.startScrollTop + (deltaY / scrollableThumbRange) * maxScroll;
    }, [trackInset]);

    const handlePointerMove = useCallback((e: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag) return;
        drag.latestY = e.clientY;
        if (drag.rafId === null) {
            drag.rafId = requestAnimationFrame(applyDragScroll);
        }
    }, [applyDragScroll]);

    const handlePointerUp = useCallback(() => {
        if (dragStateRef.current?.rafId != null) {
            cancelAnimationFrame(dragStateRef.current.rafId);
        }
        dragStateRef.current = null;
        metricsRef.current.isDragging = false;
        syncThumbStyles();
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove, syncThumbStyles]);

    useEffect(() => {
        return () => {
            if (dragStateRef.current?.rafId != null) {
                cancelAnimationFrame(dragStateRef.current.rafId);
            }
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [handlePointerMove, handlePointerUp]);

    const handleThumbPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const el = innerRef.current;
        if (!el) return;
        dragStateRef.current = {
            startY: e.clientY,
            startScrollTop: el.scrollTop,
            latestY: e.clientY,
            rafId: null,
        };
        metricsRef.current.isDragging = true;
        syncThumbStyles();
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove, handlePointerUp, syncThumbStyles]);

    const handleTrackPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        const el = innerRef.current;
        if (!el) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const thumbH = metricsRef.current.thumbHeight;
        const clickY = e.clientY - rect.top - thumbH / 2;
        const scrollableThumbRange = Math.max(1, rect.height - thumbH);
        const ratio = Math.max(0, Math.min(1, clickY / scrollableThumbRange));
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTo({ top: ratio * maxScroll, behavior: 'smooth' });
    }, []);

    return (
        <div className={cn('relative flex-1 flex flex-col min-h-0 overflow-hidden', wrapperClassName)}>
            <div
                ref={setViewportRef}
                className={cn('flex-1 overflow-y-auto overflow-x-hidden no-scrollbar min-h-0', className)}
                {...rest}
            >
                {children}
            </div>

            <div
                ref={trackRef}
                onMouseEnter={() => {
                    metricsRef.current.isHovered = true;
                    syncThumbStyles();
                }}
                onMouseLeave={() => {
                    metricsRef.current.isHovered = false;
                    syncThumbStyles();
                }}
                onPointerDown={handleTrackPointerDown}
                style={{ top: trackInset, bottom: trackInset, display: 'none', opacity: 0 }}
                className="absolute right-0.5 w-3.5 z-30 justify-end pr-0.5 select-none transition-opacity duration-200"
            >
                <div
                    ref={thumbRef}
                    onPointerDown={handleThumbPointerDown}
                    style={{ width: '6px', backgroundColor: '#3b3633', borderColor: '#4d4743' }}
                    className="rounded-full transition-[width,background-color,border-color] duration-150 cursor-pointer border shadow-sm will-change-transform"
                />
            </div>
        </div>
    );
});

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;
