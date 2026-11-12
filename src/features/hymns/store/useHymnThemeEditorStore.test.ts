import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHymnThemeEditorStore } from './useHymnThemeEditorStore';
import { IHymnTheme } from '@/core/types/hymn';

vi.mock('@/core/db', () => ({
    db: {
        hymnThemes: {
            put: vi.fn(),
            get: vi.fn(),
        },
        presentationFiles: {
            get: vi.fn().mockResolvedValue({ id: 'pres-10', slides: [{ id: 'slide-20', type: 'hymn' }] }),
            put: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('../services/hymnThemeService', () => ({
    hymnThemeService: {
        getTheme: vi.fn(),
        updateTheme: vi.fn(),
        updateThemeReferences: vi.fn(),
        getThemeUsageCount: vi.fn().mockResolvedValue({ total: 1, slidesCount: 1, hymnalsCount: 0 }),
    },
    DEFAULT_HYMN_THEME: {
        id: 'builtin-default',
        name: 'Default Theme',
        isBuiltIn: true,
        background: [],
        textStyle: {},
    },
}));

const mockUpdateHymnSlideTheme = vi.fn();
vi.mock('@/features/presenter/store/presentationStore', () => ({
    usePresentationStore: {
        getState: () => ({
            updateHymnSlideTheme: mockUpdateHymnSlideTheme,
        }),
    },
}));

describe('useHymnThemeEditorStore', () => {
    beforeEach(() => {
        useHymnThemeEditorStore.getState().resetTheme();
    });

    it('should fork built-in theme on background update', () => {
        const store = useHymnThemeEditorStore.getState();
        store.updateBackground([{ type: 'color', color: '#000000', id: '1', visible: true, opacity: 100, blendMode: 'normal' }]);

        // draftTheme was null initially
        expect(store.draftTheme).toBeNull();

        // Load built-in theme
        useHymnThemeEditorStore.setState({
            draftTheme: {
                id: 'builtin-1',
                name: 'Built-in',
                isBuiltIn: true,
                background: [],
                textStyle: {},
            },
            loadedThemeId: 'builtin-1',
        });

        useHymnThemeEditorStore.getState().updateBackground([{ type: 'color', color: '#ffffff', id: '1', visible: true, opacity: 100, blendMode: 'normal' }]);
        const updated = useHymnThemeEditorStore.getState().draftTheme;

        expect(updated).not.toBeNull();
        expect(updated?.isBuiltIn).toBe(false);
        expect(updated?.id).not.toBe('builtin-1');
        expect(updated?.name).toBe('Built-in (Copy)');
    });

    it('should maintain immutable metadata updates for custom themes', () => {
        useHymnThemeEditorStore.setState({
            draftTheme: {
                id: 'custom-1',
                name: 'Custom',
                isBuiltIn: false,
                background: [],
                textStyle: {},
            },
            loadedThemeId: 'custom-1',
        });

        useHymnThemeEditorStore.getState().updateMetadata('Renamed Custom', true);
        const updated = useHymnThemeEditorStore.getState().draftTheme;

        expect(updated?.name).toBe('Renamed Custom');
        expect(updated?.isDefault).toBe(true);
        expect(updated?.id).toBe('custom-1');
    });

    it('should explicitly fork theme on forceCustomizeThisSlideOnly', () => {
        useHymnThemeEditorStore.setState({
            draftTheme: {
                id: 'custom-shared-1',
                name: 'Shared Theme',
                isBuiltIn: false,
                background: [],
                textStyle: {},
            },
            loadedThemeId: 'custom-shared-1',
        });

        useHymnThemeEditorStore.getState().forceCustomizeThisSlideOnly();
        const updated = useHymnThemeEditorStore.getState().draftTheme;

        expect(updated?.id).not.toBe('custom-shared-1');
        expect(updated?.name).toBe('Shared Theme (Copy)');
        expect(useHymnThemeEditorStore.getState().isDirty).toBe(true);
    });

    it('should signal requiresUsageConfirmation when saving a shared theme with total usage > 1', async () => {
        useHymnThemeEditorStore.setState({
            draftTheme: {
                id: 'shared-theme-123',
                name: 'Shared Theme',
                isBuiltIn: false,
                background: [],
                textStyle: {},
            },
            loadedThemeId: 'shared-theme-123',
            isDirty: true,
        });

        const { hymnThemeService } = await import('../services/hymnThemeService');
        vi.mocked(hymnThemeService.getThemeUsageCount).mockResolvedValueOnce({
            total: 3,
            slidesCount: 2,
            hymnalsCount: 1,
        });

        const res = await useHymnThemeEditorStore.getState().saveTheme();
        expect(res.requiresUsageConfirmation).toBe(true);
        expect(res.usageCount).toBe(3);
    });

    it('should update only target slide when forking theme with contextSlideId', async () => {
        const { hymnThemeService } = await import('../services/hymnThemeService');
        mockUpdateHymnSlideTheme.mockClear();
        vi.mocked(hymnThemeService.updateThemeReferences).mockClear();

        useHymnThemeEditorStore.setState({
            draftTheme: {
                id: 'forked-theme-999',
                name: 'Shared Theme (Copy)',
                isBuiltIn: false,
                background: [],
                textStyle: {},
            },
            loadedThemeId: 'shared-theme-123',
            contextPresentationId: 'pres-10',
            contextSlideId: 'slide-20',
            isDirty: true,
        });

        await useHymnThemeEditorStore.getState().saveTheme();

        expect(mockUpdateHymnSlideTheme).toHaveBeenCalledWith('pres-10', 'slide-20', 'forked-theme-999');
        expect(hymnThemeService.updateThemeReferences).not.toHaveBeenCalled();
    });
});
