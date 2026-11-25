import { describe, it, expect } from 'vitest';
import {
    getAudioPackStorageKey,
    buildHymnalAudioFileId,
    parseHymnalAudioFileId,
    rewriteHymnalAudioFileIdVariant,
    formatBytesMb,
    formatTrackCount,
} from './hymnalAudioCatalog';

describe('hymnalAudioCatalog minus/plus helpers', () => {
    it('computes backward-compatible storage keys for minus and plus packs', () => {
        expect(getAudioPackStorageKey('hymns-of-hope-ru')).toBe('hymns-of-hope-ru');
        expect(getAudioPackStorageKey('hymns-of-hope-ru', 'minus')).toBe('hymns-of-hope-ru');
        expect(getAudioPackStorageKey('hymns-of-hope-ru', 'plus')).toBe('hymns-of-hope-ru__plus');
    });

    it('builds deterministic hymnal-audio:// fileIds for minus and plus variants', () => {
        expect(buildHymnalAudioFileId('psalmy-siona-ru', 7, 'minus')).toBe('hymnal-audio://psalmy-siona-ru/007.ogg');
        expect(buildHymnalAudioFileId('psalmy-siona-ru', 7, 'plus')).toBe('hymnal-audio://psalmy-siona-ru/plus/007.ogg');
        expect(buildHymnalAudioFileId('pesn-vozrozhdeniya-3300-ru', 1425, 'plus')).toBe('hymnal-audio://pesn-vozrozhdeniya-3300-ru/plus/1425.ogg');
    });

    it('parses both minus and plus hymnal-audio:// fileIds and ignores regular fileIds', () => {
        expect(parseHymnalAudioFileId('hymnal-audio://hymns-of-hope-ru/001.ogg')).toEqual({
            hymnalId: 'hymns-of-hope-ru',
            variant: 'minus',
            trackFile: '001.ogg',
            hymnNumber: 1,
        });
        expect(parseHymnalAudioFileId('hymnal-audio://hymns-of-hope-ru/plus/042.ogg')).toEqual({
            hymnalId: 'hymns-of-hope-ru',
            variant: 'plus',
            trackFile: '042.ogg',
            hymnNumber: 42,
        });
        expect(parseHymnalAudioFileId('media-pool-uuid-123')).toBeNull();
        expect(parseHymnalAudioFileId(undefined)).toBeNull();
    });

    it('rewrites hymnal-audio:// fileIds cleanly between minus and plus', () => {
        expect(rewriteHymnalAudioFileIdVariant('hymnal-audio://hymns-of-hope-ru/005.ogg', 'plus'))
            .toBe('hymnal-audio://hymns-of-hope-ru/plus/005.ogg');
        expect(rewriteHymnalAudioFileIdVariant('hymnal-audio://hymns-of-hope-ru/plus/005.ogg', 'minus'))
            .toBe('hymnal-audio://hymns-of-hope-ru/005.ogg');
        expect(rewriteHymnalAudioFileIdVariant('regular-audio-id', 'plus')).toBe('regular-audio-id');
    });

    it('formats byte sizes (MB / GB) and Russian track counts accurately', () => {
        expect(formatBytesMb(197833981)).toBe('188.7 МБ');
        expect(formatBytesMb(4570238938)).toBe('4.3 ГБ');
        expect(formatTrackCount(1)).toBe('1 мелодия');
        expect(formatTrackCount(2)).toBe('2 мелодии');
        expect(formatTrackCount(5)).toBe('5 мелодий');
        expect(formatTrackCount(21)).toBe('21 мелодия');
        expect(formatTrackCount(2126)).toBe('2126 мелодий');
    });
});
