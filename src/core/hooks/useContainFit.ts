import { useState, useLayoutEffect, useRef, useCallback, RefObject } from 'react';

interface ContainFitResult {
    /** Computed width in px, or `undefined` before first measurement */
    width: number | undefined;
    /** Computed height in px, or `undefined` before first measurement */
    height: number | undefined;
    /** Ref to attach to the parent container */
    containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Computes the largest width × height that fits within the parent container
 * while maintaining the given aspect ratio, with fixed pixel margins.
 *
 * Works like `object-fit: contain` but for regular DOM elements.
 * Returns `undefined` dimensions until the first measurement is ready.
 */
export function useContainFit(
    aspectRatio: number,
    margin: number = 24
): ContainFitResult {
    const [targetElement, setTargetElement] = useState<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number | undefined; height: number | undefined }>({
        width: undefined,
        height: undefined
    });

    const callbackRef = useCallback((el: HTMLDivElement | null) => {
        containerRef.current = el;
        setTargetElement(el);
    }, []);

    useLayoutEffect(() => {
        const el = targetElement || containerRef.current;
        if (!el) return;

        const compute = () => {
            const style = window.getComputedStyle(el);
            const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
            const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);

            const availW = el.clientWidth - paddingX - margin * 2;
            const availH = el.clientHeight - paddingY - margin * 2;

            if (availW <= 0 || availH <= 0) return;

            let w: number;
            let h: number;

            if (availW / availH > aspectRatio) {
                // Parent is wider than needed — height-constrained
                h = availH;
                w = h * aspectRatio;
            } else {
                // Parent is taller than needed — width-constrained
                w = availW;
                h = w / aspectRatio;
            }

            setDimensions({ width: Math.floor(w), height: Math.floor(h) });
        };

        compute();

        const observer = new ResizeObserver(() => compute());
        observer.observe(el);
        window.addEventListener('resize', compute);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', compute);
        };
    }, [aspectRatio, margin, targetElement]);

    // Create a combined ref that can be passed directly as ref={containerRef}
    const combinedRef = useRef<HTMLDivElement | null>(null);
    combinedRef.current = targetElement || containerRef.current;
    
    // Assign callback function properties so it supports both ref={containerRef} as a RefObject or callback
    const refObject = useRef<HTMLDivElement | null>(null);
    Object.defineProperty(refObject, 'current', {
        get: () => containerRef.current,
        set: (el: HTMLDivElement | null) => callbackRef(el),
        configurable: true
    });

    return { ...dimensions, containerRef: refObject as RefObject<HTMLDivElement | null> };
}

