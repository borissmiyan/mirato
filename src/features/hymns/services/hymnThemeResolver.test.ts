import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveEffectiveThemeId } from './hymnThemeResolver';
import { SOURCE_THEME_ID, IHymnal } from '@/core/types/hymn';

vi.mock('@/core/db', () => ({
    db: {
        hymnThemes: {
            filter: vi.fn(() => ({
                first: vi.fn().mockResolvedValue({ id: 'global-default-theme' }),
            })),
        },
    },
}));

describe('hymnThemeResolver', () => {
    const mockHymnal: IHymnal = {
        id: 'hymnal-1',
        name: 'Test Hymnal',
        language: 'en',
        itemCount: 10,
        defaultThemeId: 'hymnal-default-theme',
    };

    it('should return explicitThemeId when specified, even if it is SOURCE_THEME_ID', async () => {
        const res1 = await resolveEffectiveThemeId(mockHymnal, SOURCE_THEME_ID);
        expect(res1).toBe(SOURCE_THEME_ID);

        const res2 = await resolveEffectiveThemeId(mockHymnal, 'custom-theme-123');
        expect(res2).toBe('custom-theme-123');
    });

    it('should fallback to hymnal.defaultThemeId when explicitThemeId is undefined', async () => {
        const res = await resolveEffectiveThemeId(mockHymnal, undefined);
        expect(res).toBe('hymnal-default-theme');
    });

    it('should fallback to global default theme when explicitThemeId and hymnal.defaultThemeId are undefined', async () => {
        const hymnalWithoutTheme: IHymnal = { ...mockHymnal, defaultThemeId: undefined };
        const res = await resolveEffectiveThemeId(hymnalWithoutTheme, undefined);
        expect(res).toBe('global-default-theme');
    });
});
