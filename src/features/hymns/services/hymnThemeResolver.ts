import { IHymnal } from '@/core/types/hymn';
import { db } from '@/core/db';

/**
 * Resolves the effective theme ID for a hymn using 3-tier cascade logic:
 * 1. Operator explicit selection (wins unconditionally, including SOURCE_THEME_ID)
 * 2. Hymnal-level default theme ID
 * 3. Global default theme in DB (or builtin-default fallback)
 */
export async function resolveEffectiveThemeId(
    hymnal: IHymnal | undefined,
    explicitThemeId?: string
): Promise<string> {
    // 1. Operator explicit choice (including SOURCE_THEME_ID) ALWAYS wins unconditionally
    if (explicitThemeId !== undefined) {
        return explicitThemeId;
    }

    // 2. Hymnal level default theme
    if (hymnal?.defaultThemeId) {
        return hymnal.defaultThemeId;
    }

    // 3. Global default theme from Dexie DB
    try {
        const defaultTheme = await db.hymnThemes.filter(t => !!t.isDefault).first();
        if (defaultTheme) {
            return defaultTheme.id;
        }
    } catch (e) {
        // DB error or fallback
    }

    return 'builtin-default';
}
