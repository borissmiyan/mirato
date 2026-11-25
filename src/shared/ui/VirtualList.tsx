import React, { useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { flushSync } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ScrollArea } from './ScrollArea';
import { cn } from '@/core/utils/cn';

export interface VirtualListHandle {
    scrollToIndex: (index: number, align?: 'start' | 'center' | 'end', behavior?: 'auto' | 'smooth') => void;
    scrollToTop: () => void;
    getScrollElement: () => HTMLDivElement | null;
}

export interface VirtualListProps<T> {
    items: readonly T[];
    getItemKey: (item: T, index: number) => string | number;
    renderItem: (item: T, index: number) => React.ReactNode;
    /** Fixed row height in px (including gap). Enables ultra-fast O(1) GPU-composited windowing. */
    itemHeight?: number;
    /** Dynamic row height estimator for variable-height rows (e.g. wrapped Bible verses). */
    estimateItemHeight?: (index: number) => number;
    /** Bottom padding in px applied to each row wrapper. Default: 0. */
    gap?: number;
    /** Extra rows rendered above and below viewport. Default: 14. */
    overscan?: number;
    /** Resets scroll to top when this value changes (e.g. hymnalId or searchQuery). */
    resetKey?: string;
    /** Content rendered when items is empty. */
    emptyState?: React.ReactNode;
    /** Classes applied to the scrollable viewport. */
    className?: string;
    /** Classes applied to the outer wrapper. */
    wrapperClassName?: string;
    /** Imperative handle for scrollToIndex / scrollToTop. */
    listRef?: React.Ref<VirtualListHandle>;
}

const DEFAULT_VIEWPORT_HEIGHT = 600;

/**
 * Fixed-height inner engine using native GPU-composited `position: absolute; top`
 * with hysteresis overscan so scrolling runs at 120Hz on the compositor thread
 * while React only re-renders when the viewport nears the edge of the buffered slice.
 */
function FixedVirtualListInner<T>({
    items,
    getItemKey,
    renderItem,
    itemHeight,
    gap = 0,
    overscan = 14,
    resetKey,
    emptyState,
    className,
    wrapperClassName,
    listRef,
}: Required<Pick<VirtualListProps<T>, 'items' | 'getItemKey' | 'renderItem' | 'itemHeight'>> &
    Pick<VirtualListProps<T>, 'gap' | 'overscan' | 'resetKey' | 'emptyState' | 'className' | 'wrapperClassName' | 'listRef'>) {
    const scrollElRef = useRef<HTMLDivElement | null>(null);
    const lastScrollTopRef = useRef(0);
    const count = items.length;
    const aheadOverscan = Math.max(overscan, 26);
    const behindOverscan = Math.max(8, Math.floor(overscan * 0.7));
    const hysteresisMargin = Math.max(6, Math.floor(aheadOverscan / 3));

    const computeRange = useCallback(
        (scrollTop: number, clientHeight: number, direction: 1 | -1 | 0 = 0) => {
            const vh = clientHeight > 0 ? clientHeight : DEFAULT_VIEWPORT_HEIGHT;
            const visStart = Math.max(0, Math.floor(scrollTop / itemHeight));
            const visEnd = Math.min(count, Math.ceil((scrollTop + vh) / itemHeight));
            const topBuf = direction < 0 ? aheadOverscan : direction > 0 ? behindOverscan : overscan;
            const bottomBuf = direction > 0 ? aheadOverscan : direction < 0 ? behindOverscan : overscan;
            const start = Math.max(0, visStart - topBuf);
            const end = Math.min(count, visEnd + bottomBuf);
            return { start, end, visStart, visEnd };
        },
        [count, itemHeight, overscan, aheadOverscan, behindOverscan]
    );

    const [range, setRange] = useState(() => {
        const { start, end } = computeRange(0, DEFAULT_VIEWPORT_HEIGHT, 0);
        return { start, end };
    });

    const rangeRef = useRef(range);
    rangeRef.current = range;

    // Reset scroll to top on resetKey change
    useEffect(() => {
        const el = scrollElRef.current;
        if (el) el.scrollTop = 0;
        lastScrollTopRef.current = 0;
        const { start, end } = computeRange(0, el?.clientHeight ?? DEFAULT_VIEWPORT_HEIGHT, 0);
        setRange({ start, end });
    }, [resetKey, computeRange]);

    // Sync range when count or itemHeight changes
    useEffect(() => {
        const el = scrollElRef.current;
        const { start, end } = computeRange(el?.scrollTop ?? 0, el?.clientHeight ?? DEFAULT_VIEWPORT_HEIGHT, 0);
        setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    }, [count, itemHeight, computeRange]);

    // Passive scroll listener with directional look-ahead and proactive flushSync on fast scroll
    useEffect(() => {
        const el = scrollElRef.current;
        if (!el) return;

        const onScrollOrResize = () => {
            const scrollTop = el.scrollTop;
            const delta = scrollTop - lastScrollTopRef.current;
            lastScrollTopRef.current = scrollTop;
            const direction: 1 | -1 | 0 = delta > 0 ? 1 : delta < 0 ? -1 : 0;
            const isFastScroll = Math.abs(delta) > itemHeight * 2.5;

            const cur = rangeRef.current;
            const { start, end, visStart, visEnd } = computeRange(scrollTop, el.clientHeight, direction);
            const jumpedOutsideBuffer = visStart < cur.start || visEnd > cur.end;
            const nearTop = visStart < cur.start + hysteresisMargin && cur.start > 0;
            const nearBottom = visEnd > cur.end - hysteresisMargin && cur.end < count;
            const outOfBounds = cur.end > count || cur.start > count;

            if (jumpedOutsideBuffer || (isFastScroll && (nearTop || nearBottom))) {
                // Commit synchronously BEFORE the viewport reaches the buffer edge on rapid scroll/drag
                flushSync(() => {
                    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
                });
            } else if (nearTop || nearBottom || outOfBounds) {
                setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
            }
        };

        onScrollOrResize();
        el.addEventListener('scroll', onScrollOrResize, { passive: true });

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(onScrollOrResize);
            observer.observe(el);
        }

        return () => {
            el.removeEventListener('scroll', onScrollOrResize);
            observer?.disconnect();
        };
    }, [count, itemHeight, hysteresisMargin, computeRange]);

    useImperativeHandle(listRef, () => ({
        scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'center', behavior: 'auto' | 'smooth' = 'auto') {
            const el = scrollElRef.current;
            if (!el) return;
            const vh = el.clientHeight > 0 ? el.clientHeight : DEFAULT_VIEWPORT_HEIGHT;
            let target = index * itemHeight;
            if (align === 'center') target = Math.max(0, target - vh / 2 + itemHeight / 2);
            else if (align === 'end') target = Math.max(0, target - vh + itemHeight);
            el.scrollTo({ top: target, behavior });
            const { start, end } = computeRange(target, vh);
            setRange({ start, end });
        },
        scrollToTop() {
            if (scrollElRef.current) scrollElRef.current.scrollTop = 0;
        },
        getScrollElement: () => scrollElRef.current,
    }), [itemHeight, computeRange]);

    const safeStart = Math.min(range.start, count);
    const safeEnd = Math.min(range.end, count);
    const totalHeight = count * itemHeight;

    return (
        <ScrollArea ref={scrollElRef} className={className} wrapperClassName={wrapperClassName}>
            {count === 0 ? (
                emptyState ?? null
            ) : (
                <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
                    {items.slice(safeStart, safeEnd).map((item, offset) => {
                        const index = safeStart + offset;
                        return (
                            <div
                                key={getItemKey(item, index)}
                                style={{
                                    position: 'absolute',
                                    top: `${index * itemHeight}px`,
                                    left: 0,
                                    width: '100%',
                                    height: `${itemHeight}px`,
                                    paddingBottom: gap > 0 ? `${gap}px` : undefined,
                                }}
                            >
                                {renderItem(item, index)}
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollArea>
    );
}

/**
 * Variable-height inner engine using @tanstack/react-virtual with useFlushSync: false
 * and ResizeObserver width re-measurement (ideal for wrapped Bible verses).
 */
function DynamicVirtualListInner<T>({
    items,
    getItemKey,
    renderItem,
    estimateItemHeight,
    gap = 0,
    overscan = 10,
    resetKey,
    emptyState,
    className,
    wrapperClassName,
    listRef,
}: Required<Pick<VirtualListProps<T>, 'items' | 'getItemKey' | 'renderItem' | 'estimateItemHeight'>> &
    Pick<VirtualListProps<T>, 'gap' | 'overscan' | 'resetKey' | 'emptyState' | 'className' | 'wrapperClassName' | 'listRef'>) {
    const scrollElRef = useRef<HTMLDivElement | null>(null);

    const stableGetItemKey = useCallback(
        (index: number) => {
            const item = items[index];
            return item !== undefined ? getItemKey(item, index) : index;
        },
        [items, getItemKey]
    );

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollElRef.current,
        getItemKey: stableGetItemKey,
        estimateSize: estimateItemHeight,
        overscan,
        useFlushSync: false,
    });

    useEffect(() => {
        if (resetKey !== undefined && scrollElRef.current) {
            scrollElRef.current.scrollTop = 0;
        }
        virtualizer.measure?.();
    }, [resetKey, items.length, virtualizer]);

    useEffect(() => {
        const el = scrollElRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        let lastWidth = el.clientWidth;
        const observer = new ResizeObserver((entries) => {
            const nextWidth = entries[0]?.contentRect.width ?? el.clientWidth;
            if (Math.abs(nextWidth - lastWidth) > 1) {
                lastWidth = nextWidth;
                virtualizer.measure?.();
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [virtualizer]);

    useImperativeHandle(listRef, () => ({
        scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'center', behavior: 'auto' | 'smooth' = 'auto') {
            virtualizer.scrollToIndex(index, { align, behavior });
        },
        scrollToTop() {
            if (scrollElRef.current) scrollElRef.current.scrollTop = 0;
        },
        getScrollElement: () => scrollElRef.current,
    }), [virtualizer]);

    return (
        <ScrollArea ref={scrollElRef} className={cn('relative', className)} wrapperClassName={wrapperClassName}>
            {items.length === 0 ? (
                emptyState ?? null
            ) : (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((vRow) => {
                        const item = items[vRow.index];
                        if (item === undefined) return null;
                        return (
                            <div
                                key={vRow.key}
                                data-index={vRow.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: `${vRow.start}px`,
                                    left: 0,
                                    width: '100%',
                                    paddingBottom: gap > 0 ? `${gap}px` : undefined,
                                }}
                            >
                                {renderItem(item, vRow.index)}
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollArea>
    );
}

/**
 * Unified virtualized list component for Hymns, Bible Verses, Bible Books, Presentations, and Services.
 * Combines ScrollArea (opaque auto-hiding Mirato scrollbar + 120Hz native scrolling) with
 * fixed-height O(1) windowing or variable-height dynamic measurement.
 */
export function VirtualList<T>(props: VirtualListProps<T>) {
    if (props.itemHeight !== undefined) {
        return <FixedVirtualListInner {...props} itemHeight={props.itemHeight} />;
    }
    return (
        <DynamicVirtualListInner
            {...props}
            estimateItemHeight={props.estimateItemHeight ?? (() => 48)}
        />
    );
}

export default VirtualList;
