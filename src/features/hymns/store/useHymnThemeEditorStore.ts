import { create } from 'zustand';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import { hymnThemeService, DEFAULT_HYMN_THEME } from '../services/hymnThemeService';
import { IStyleLayer } from '@/core/types';
import { ICanvasItemText } from '@/core/types/canvas';
import { db } from '@/core/db';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

interface HymnThemeEditorState {
    draftTheme: IHymnTheme | null;
    loadedThemeId: string | null;
    isDirty: boolean;
    isSharedEdit: boolean;
    contextPresentationId: string | null;
    contextSlideId: string | null;
    
    // Actions
    loadTheme: (themeId: string, options?: { isSharedEdit?: boolean; presentationId?: string; slideId?: string }) => Promise<void>;
    saveTheme: (options?: { skipUsageConfirmation?: boolean; updateAllReferences?: boolean }) => Promise<{ requiresUsageConfirmation?: boolean; usageCount?: number }>;
    confirmAndSaveTheme: () => Promise<void>;
    resetTheme: () => void;
    forceCustomizeThisSlideOnly: () => void;
    
    // Updates
    updateBackground: (background: IStyleLayer[]) => void;
    updateTextStyle: (textStyle: Partial<ICanvasItemText>) => void;
    updateMetadata: (name?: string, isDefault?: boolean) => void;
}

function forkThemeIfNeeded(theme: IHymnTheme, nameOverride?: string): IHymnTheme {
    if (theme.isBuiltIn) {
        return {
            ...theme,
            id: crypto.randomUUID(),
            isBuiltIn: false,
            isDefault: false,
            name: nameOverride || `${theme.name} (Copy)`
        };
    }
    return theme;
}

/**
 * A thin, isolated store dedicated exclusively to editing Hymn Themes.
 * It manages the transient 'draftTheme' state until the user explicitly saves it.
 */
export const useHymnThemeEditorStore = create<HymnThemeEditorState>((set, get) => ({
    draftTheme: null,
    loadedThemeId: null,
    isDirty: false,
    isSharedEdit: false,
    contextPresentationId: null,
    contextSlideId: null,

    loadTheme: async (themeId: string, options) => {
        let theme = await hymnThemeService.getTheme(themeId);
        if (!theme) {
            theme = { ...DEFAULT_HYMN_THEME };
        }
        set({ 
            draftTheme: JSON.parse(JSON.stringify(theme)), 
            loadedThemeId: theme.id, 
            isDirty: false, 
            isSharedEdit: options?.isSharedEdit ?? false,
            contextPresentationId: options?.presentationId ?? null,
            contextSlideId: options?.slideId ?? null
        });
    },

    forceCustomizeThisSlideOnly: () => {
        const { draftTheme } = get();
        if (!draftTheme) return;

        const forked: IHymnTheme = {
            ...draftTheme,
            id: crypto.randomUUID(),
            isBuiltIn: false,
            isDefault: false,
            name: `${draftTheme.name} (Copy)`,
            updatedAt: Date.now()
        };

        set({ draftTheme: forked, isDirty: true, isSharedEdit: false });
    },

    saveTheme: async (options = {}) => {
        const { draftTheme, isDirty, loadedThemeId, contextPresentationId, contextSlideId } = get();
        if (!draftTheme || !isDirty) return { requiresUsageConfirmation: false };

        const isForked = loadedThemeId && loadedThemeId !== draftTheme.id;

        // Shared edit warning check for non-forked existing theme with multiple usages
        if (!isForked && !options.skipUsageConfirmation && loadedThemeId) {
            const usage = await hymnThemeService.getThemeUsageCount(loadedThemeId);
            if (usage.total > 1) {
                return { requiresUsageConfirmation: true, usageCount: usage.total };
            }
        }

        if (isForked) {
            await db.hymnThemes.put(draftTheme);
            if (options.updateAllReferences && loadedThemeId) {
                // Explicit "Update all existing hymns" choice
                await hymnThemeService.updateThemeReferences(loadedThemeId, draftTheme.id);
            } else if (contextPresentationId && contextSlideId) {
                // Targeted single-slide update: only update this specific hymn slide's themeId!
                await usePresentationStore.getState().updateHymnSlideTheme(contextPresentationId, contextSlideId, draftTheme.id);
            }
        } else {
            await hymnThemeService.updateTheme(draftTheme.id, draftTheme);
        }

        set({ isDirty: false, loadedThemeId: draftTheme.id, isSharedEdit: false });
        return { requiresUsageConfirmation: false };
    },

    confirmAndSaveTheme: async () => {
        await get().saveTheme({ skipUsageConfirmation: true, updateAllReferences: true });
    },

    resetTheme: () => {
        set({ 
            draftTheme: null, 
            loadedThemeId: null, 
            isDirty: false, 
            isSharedEdit: false,
            contextPresentationId: null,
            contextSlideId: null
        });
    },

    updateBackground: (background: IStyleLayer[]) => {
        set((state) => {
            if (!state.draftTheme) return state;
            const themeToUpdate = forkThemeIfNeeded(state.draftTheme);

            return {
                draftTheme: {
                    ...themeToUpdate,
                    background,
                    updatedAt: Date.now()
                },
                isDirty: true
            };
        });
    },

    updateTextStyle: (textStyleUpdate: Partial<ICanvasItemText>) => {
        set((state) => {
            if (!state.draftTheme) return state;
            const themeToUpdate = forkThemeIfNeeded(state.draftTheme);

            return {
                draftTheme: {
                    ...themeToUpdate,
                    textStyle: {
                        ...themeToUpdate.textStyle,
                        ...textStyleUpdate
                    },
                    updatedAt: Date.now()
                },
                isDirty: true
            };
        });
    },

    updateMetadata: (name?: string, isDefault?: boolean) => {
        set((state) => {
            if (!state.draftTheme) return state;

            let themeToUpdate = forkThemeIfNeeded(state.draftTheme, name);
            if (!state.draftTheme.isBuiltIn) {
                themeToUpdate = {
                    ...themeToUpdate,
                    ...(name !== undefined ? { name } : {}),
                    ...(isDefault !== undefined ? { isDefault } : {})
                };
            }

            return {
                draftTheme: {
                    ...themeToUpdate,
                    updatedAt: Date.now()
                },
                isDirty: true
            };
        });
    },
}));
