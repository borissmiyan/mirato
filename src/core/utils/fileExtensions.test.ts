import { describe, it, expect } from 'vitest';
import {
    isServiceFilename,
    isPresentationFilename,
    isTemplateFilename,
    isGraceLibFilename,
    stripMiratoExtension,
    toMiratoFilename,
} from './fileExtensions';

describe('fileExtensions Mirato & legacy compatibility', () => {
    it('recognizes both canonical Mirato and legacy .ekt* extensions', () => {
        expect(isServiceFilename('sunday.mrt')).toBe(true);
        expect(isServiceFilename('sunday.ekt')).toBe(true);
        expect(isServiceFilename('sunday.mrtp')).toBe(false);

        expect(isPresentationFilename('hymn.mrtp')).toBe(true);
        expect(isPresentationFilename('hymn.ektp')).toBe(true);
        expect(isPresentationFilename('hymn.MRTP')).toBe(true);

        expect(isTemplateFilename('dark.mrtmp')).toBe(true);
        expect(isTemplateFilename('dark.ektmp')).toBe(true);

        expect(isGraceLibFilename('backup.mrtgl')).toBe(true);
        expect(isGraceLibFilename('backup.ektgl')).toBe(true);
    });

    it('auto-converts legacy .ekt* filenames to canonical Mirato extensions', () => {
        expect(toMiratoFilename('Service.ekt', 'service')).toBe('Service.mrt');
        expect(toMiratoFilename('Service.mrt', 'service')).toBe('Service.mrt');
        expect(toMiratoFilename('Service', 'service')).toBe('Service.mrt');

        expect(toMiratoFilename('67. Hymn.ektp', 'presentation')).toBe('67. Hymn.mrtp');
        expect(toMiratoFilename('Template.ektmp', 'template')).toBe('Template.mrtmp');
        expect(toMiratoFilename('GraceLib.ektgl', 'gracelib')).toBe('GraceLib.mrtgl');
    });

    it('strips both Mirato and legacy extensions cleanly', () => {
        expect(stripMiratoExtension('master.ektp')).toBe('master');
        expect(stripMiratoExtension('master.mrtp')).toBe('master');
        expect(stripMiratoExtension('theme.ektmp')).toBe('theme');
        expect(stripMiratoExtension('theme.mrtmp')).toBe('theme');
    });
});
