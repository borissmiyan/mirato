import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEyeDropper } from './useEyeDropper';

describe('useEyeDropper', () => {
    const originalEyeDropper = (window as unknown as { EyeDropper?: unknown }).EyeDropper;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEyeDropper) {
            (window as unknown as { EyeDropper?: unknown }).EyeDropper = originalEyeDropper;
        } else {
            delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
        }
    });

    it('reports isSupported as false when window.EyeDropper is absent', () => {
        delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
        const { result } = renderHook(() => useEyeDropper());
        expect(result.current.isSupported).toBe(false);
    });

    it('reports isSupported as true when window.EyeDropper is present', () => {
        (window as unknown as { EyeDropper?: unknown }).EyeDropper = vi.fn();
        const { result } = renderHook(() => useEyeDropper());
        expect(result.current.isSupported).toBe(true);
    });

    it('returns hex color when eyeDropper.open succeeds', async () => {
        const mockOpen = vi.fn().mockResolvedValue({ sRGBHex: '#ffaa00' });
        class MockEyeDropper {
            open = mockOpen;
        }
        (window as unknown as { EyeDropper?: unknown }).EyeDropper = MockEyeDropper;

        const { result } = renderHook(() => useEyeDropper());

        let color: string | null = null;
        await act(async () => {
            color = await result.current.openEyeDropper();
        });

        expect(mockOpen).toHaveBeenCalled();
        expect(color).toBe('#FFAA00');
    });

    it('returns null and does not throw when user cancels (AbortError)', async () => {
        const abortError = new DOMException('The user canceled the selection.', 'AbortError');
        const mockOpen = vi.fn().mockRejectedValue(abortError);
        class MockEyeDropper {
            open = mockOpen;
        }
        (window as unknown as { EyeDropper?: unknown }).EyeDropper = MockEyeDropper;

        const { result } = renderHook(() => useEyeDropper());

        let color: string | null = null;
        await act(async () => {
            color = await result.current.openEyeDropper();
        });

        expect(mockOpen).toHaveBeenCalled();
        expect(color).toBeNull();
    });
});
