import { useState, useCallback, useMemo } from 'react';

interface EyeDropperOpenOptions {
    signal?: AbortSignal;
}

interface EyeDropperResult {
    sRGBHex: string;
}

interface IEyeDropper {
    open: (options?: EyeDropperOpenOptions) => Promise<EyeDropperResult>;
}

interface EyeDropperConstructor {
    new (): IEyeDropper;
}

declare global {
    interface Window {
        EyeDropper?: EyeDropperConstructor;
    }
}

export interface UseEyeDropperReturn {
    isSupported: boolean;
    openEyeDropper: () => Promise<string | null>;
}

/**
 * Hook to interact with the native Screen/Canvas EyeDropper API (Chromium / Electron).
 * Allows sampling colors from any pixel on the screen.
 */
export function useEyeDropper(): UseEyeDropperReturn {
    const isSupported = useMemo(() => {
        return typeof window !== 'undefined' && 'EyeDropper' in window;
    }, []);

    const openEyeDropper = useCallback(async (): Promise<string | null> => {
        if (!isSupported || !window.EyeDropper) {
            return null;
        }

        try {
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            if (result?.sRGBHex) {
                return result.sRGBHex.toUpperCase();
            }
            return null;
        } catch (err: unknown) {
            // User aborted the eyedropper by pressing Escape or clicking away
            if (err instanceof DOMException && err.name === 'AbortError') {
                return null;
            }
            // Other non-fatal cancellations
            return null;
        }
    }, [isSupported]);

    return {
        isSupported,
        openEyeDropper,
    };
}

