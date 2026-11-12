import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaPoolData } from './useMediaPoolData';

describe('useMediaPoolData custom hook', () => {
    it('should fetch media pool libraries lists', () => {
        const { result } = renderHook(() => useMediaPoolData('all', null));
        expect(result.current).toBeDefined();
        expect(result.current.allBins).toBeDefined();
        expect(result.current.binPath).toBeDefined();
        expect(Array.isArray(result.current.binPath)).toBe(true);
    });
});
