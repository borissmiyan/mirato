import { describe, it, expect } from 'vitest';
import { resolveFontFamily } from './fontResolver';

describe('fontResolver', () => {
    it('should return default Inter stack for null or empty input', () => {
        const result = resolveFontFamily(null);
        expect(result.family).toBe('Inter');
        expect(result.cssFontStack).toContain('"Inter"');
        expect(result.cssFontStack).toContain('sans-serif');
    });

    it('should preserve comma-separated custom font stacks', () => {
        const input = '"Custom Font", Arial, sans-serif';
        const result = resolveFontFamily(input);
        expect(result.cssFontStack).toBe(input);
        expect(result.family).toBe('Custom Font');
    });

    it('should normalize PostScript names like TrajanPro3-Regular', () => {
        const result = resolveFontFamily('TrajanPro3-Regular');
        expect(result.family).toBe('Trajan Pro 3');
        expect(result.inferredWeight).toBe('400');
        expect(result.cssFontStack).toContain('"Trajan Pro 3"');
        expect(result.cssFontStack).toContain('"TrajanPro3-Regular"');
        expect(result.cssFontStack).toContain('serif');
    });

    it('should normalize hyphenated bold font names like CenturyGothic-Bold', () => {
        const result = resolveFontFamily('CenturyGothic-Bold');
        expect(result.family).toBe('Century Gothic');
        expect(result.inferredWeight).toBe('700');
        expect(result.cssFontStack).toContain('"Century Gothic"');
        expect(result.cssFontStack).toContain('sans-serif');
    });

    it('should detect monospace and cursive generic fallbacks', () => {
        const mono = resolveFontFamily('FiraCode-Regular');
        expect(mono.cssFontStack).toContain('monospace');

        const script = resolveFontFamily('DancingScript');
        expect(script.cssFontStack).toContain('cursive');
    });
});
