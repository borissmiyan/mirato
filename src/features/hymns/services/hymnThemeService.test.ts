import { describe, it, expect, vi } from 'vitest';
import { hymnThemeService } from './hymnThemeService';
import { db } from '@/core/db';

vi.mock('@/core/db', () => ({
    db: {
        hymnThemes: {
            get: vi.fn(),
            delete: vi.fn(),
        },
        presentationFiles: {
            toArray: vi.fn().mockResolvedValue([
                {
                    id: 'pres-1',
                    slides: [
                        { type: 'hymn', themeId: 'theme-in-use' }
                    ]
                }
            ]),
            bulkPut: vi.fn(),
        },
        hymnals: {
            toArray: vi.fn().mockResolvedValue([
                { id: 'hymnal-1', defaultThemeId: 'theme-in-use' }
            ]),
        },
        transaction: vi.fn((mode, tables, cb) => cb()),
    },
}));

describe('hymnThemeService', () => {
    it('should calculate correct usage count across slides and hymnals', async () => {
        const usage = await hymnThemeService.getThemeUsageCount('theme-in-use');
        expect(usage.total).toBe(2);
        expect(usage.slidesCount).toBe(1);
        expect(usage.hymnalsCount).toBe(1);
    });

    it('should throw error when deleting in-use theme without replacementThemeId', async () => {
        (db.hymnThemes.get as any).mockResolvedValue({ id: 'theme-in-use', isDefault: false });

        await expect(hymnThemeService.deleteTheme('theme-in-use')).rejects.toThrow(
            /currently in use/
        );
    });

    it('should allow deletion of unused theme without replacementThemeId', async () => {
        (db.hymnThemes.get as any).mockResolvedValue({ id: 'theme-unused', isDefault: false });

        await hymnThemeService.deleteTheme('theme-unused');
        expect(db.hymnThemes.delete).toHaveBeenCalledWith('theme-unused');
    });
});
