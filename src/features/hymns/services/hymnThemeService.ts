import { db } from '@/core/db';
import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import { IStyleLayer } from '@/core/types/style';
import { IHymnSlide, IPresentationFile, ISlide } from '@/core/types';
import { remoteSyncService } from '@/core/services/remoteSyncService';
import i18n from '@/core/i18n';
import { DEFAULT_HYMN_THEME_ID, DEFAULT_HYMN_THEME } from './hymnThemeConstants';

export { DEFAULT_HYMN_THEME_ID, DEFAULT_HYMN_THEME, SOURCE_THEME_ID };

export const hymnThemeService = {
    async initializeDefaultTheme() {
        const defaultTheme = await db.hymnThemes.get(DEFAULT_HYMN_THEME_ID);
        if (!defaultTheme) {
            await db.hymnThemes.add(DEFAULT_HYMN_THEME);
        } else if (defaultTheme.isBuiltIn && defaultTheme.textStyle?.fontFamily !== 'Trajan Pro') {
            await db.hymnThemes.update(DEFAULT_HYMN_THEME_ID, {
                textStyle: {
                    ...defaultTheme.textStyle,
                    fontFamily: 'Trajan Pro'
                },
                background: DEFAULT_HYMN_THEME.background
            });
        }
    },

    async getThemes(): Promise<IHymnTheme[]> {
        return db.hymnThemes.toArray();
    },

    async getTheme(id: string): Promise<IHymnTheme | undefined> {
        if (id === SOURCE_THEME_ID) return undefined;
        return db.hymnThemes.get(id);
    },

    async createTheme(theme: Omit<IHymnTheme, 'id'>): Promise<IHymnTheme> {
        const newTheme: IHymnTheme = {
            ...theme,
            id: crypto.randomUUID(),
            isDefault: false
        };
        await db.hymnThemes.add(newTheme);
        return newTheme;
    },

    async updateTheme(id: string, updates: Partial<IHymnTheme>): Promise<void> {
        await db.hymnThemes.update(id, updates);
        
        // Notify projector window via remoteSyncService / IPC
        // We trigger a global refresh to ensure the projector re-renders the hymn slides
        if (window.electron) {
            const { usePresentationStore } = await import('@/features/presenter/store/presentationStore');
            const storeState = usePresentationStore.getState();
            const currentPresId = storeState.activePresentationId;
            if (currentPresId) {
                const pres = await db.presentationFiles.get(currentPresId);
                if (pres) {
                    remoteSyncService.updateRemoteState({
                        appMode: 'hymns',
                        activePresentation: { ...pres }, 
                        selectedPresentation: storeState.selectedPresentation,
                        presentationStack: storeState.presentationStack || [],
                        themeAccent: 'hymn-theme-updated',
                        activeVerse: null,
                        projectorIsLive: !!storeState.liveSlideId,
                        liveSlideId: storeState.liveSlideId,
                        previewSlideId: storeState.previewSlideId,
                        lang: i18n.language || 'en',
                        isPlaying: false,
                        activeOverride: null,
                        activeLogo: null,
                        activeLogoUrl: null,
                        settings: {}
                    });
                }
            }
        }
    },

    /**
     * Scans presentations and hymnals to count occurrences of a themeId.
     */
    async getThemeUsageCount(themeId: string): Promise<{ total: number; slidesCount: number; hymnalsCount: number }> {
        let slidesCount = 0;
        let hymnalsCount = 0;

        try {
            const presentations = await db.presentationFiles.toArray();
            for (const p of presentations) {
                for (const slide of p.slides || []) {
                    if (slide.type === 'hymn' && (slide as IHymnSlide).themeId === themeId) {
                        slidesCount++;
                    }
                }
            }

            const hymnals = await db.hymnals.toArray();
            for (const h of hymnals) {
                if (h.defaultThemeId === themeId) {
                    hymnalsCount++;
                }
            }
        } catch (e) {
            console.error('[hymnThemeService] Failed to calculate theme usage count:', e);
        }

        return {
            total: slidesCount + hymnalsCount,
            slidesCount,
            hymnalsCount
        };
    },

    async deleteTheme(id: string, replacementThemeId?: string): Promise<void> {
        const theme = await db.hymnThemes.get(id);
        if (theme?.isDefault) {
            throw new Error('Cannot delete default theme');
        }

        const usage = await this.getThemeUsageCount(id);
        if (usage.total > 0 && !replacementThemeId) {
            throw new Error(`Theme is currently in use across ${usage.total} locations (${usage.slidesCount} slides, ${usage.hymnalsCount} hymnals). Replacement theme selection is required.`);
        }

        if (usage.total > 0 && replacementThemeId) {
            await this.updateThemeReferences(id, replacementThemeId);
        }

        await db.hymnThemes.delete(id);
    },

    /**
     * Updates all presentations that have IHymnSlide referencing oldThemeId
     * to point to newThemeId. Used when auto-forking built-in themes.
     */
    async updateThemeReferences(oldThemeId: string, newThemeId: string): Promise<void> {
        await db.transaction('rw', db.presentationFiles, async () => {
            const presentations = await db.presentationFiles.toArray();
            const toUpdate = [];

            for (const p of presentations) {
                let changed = false;
                for (const slide of p.slides) {
                    if (slide.type === 'hymn') {
                        const hymnSlide = slide as IHymnSlide;
                        if (hymnSlide.themeId === oldThemeId) {
                            hymnSlide.themeId = newThemeId;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    toUpdate.push(p);
                }
            }

            if (toUpdate.length > 0) {
                await db.presentationFiles.bulkPut(toUpdate);
                
                // Trigger global sync for presentation files
                const storeState = (await import('@/features/presenter/store/presentationStore')).usePresentationStore.getState();
                remoteSyncService.updateRemoteState({
                    appMode: 'hymns',
                    activePresentation: storeState.activePresentation,
                    selectedPresentation: storeState.selectedPresentation,
                    presentationStack: storeState.presentationStack || [],
                    projectorIsLive: !!storeState.liveSlideId,
                    liveSlideId: storeState.liveSlideId,
                    previewSlideId: storeState.previewSlideId,
                    activeVerse: null,
                    themeAccent: 'hymn-theme-updated',
                    lang: i18n.language || 'en',
                    isPlaying: false,
                    activeOverride: null,
                    activeLogo: null,
                    activeLogoUrl: null,
                    settings: {}
                });

                // If the active presentation was modified, we must update it in memory 
                // so the projector (and live UI) sees the new themeId immediately.
                const { usePresentationStore } = await import('@/features/presenter/store/presentationStore');
                const store = usePresentationStore.getState();
                
                // Helper to safely patch theme IDs in the store without overwriting local unsaved edits
                const patchStorePresentation = (presentation: IPresentationFile | null | undefined) => {
                    if (!presentation) return presentation;
                    let changed = false;
                    const newSlides = presentation.slides.map((slide: ISlide) => {
                        if (slide.type === 'hymn' && (slide as IHymnSlide).themeId === oldThemeId) {
                            changed = true;
                            return { ...slide, themeId: newThemeId };
                        }
                        return slide;
                    });
                    if (changed) {
                        return { ...presentation, slides: newSlides };
                    }
                    return null;
                };

                if (store.activePresentationId && toUpdate.some(p => p.id === store.activePresentationId)) {
                    const patchedActive = patchStorePresentation(store.activePresentation);
                    if (patchedActive) {
                        usePresentationStore.setState({ activePresentation: patchedActive });
                    }
                }
                
                if (store.selectedPresentationId && store.selectedPresentationId !== store.activePresentationId && toUpdate.some(p => p.id === store.selectedPresentationId)) {
                    const patchedSelected = patchStorePresentation(store.selectedPresentation);
                    if (patchedSelected) {
                        usePresentationStore.setState({ selectedPresentation: patchedSelected });
                    }
                }
            }
        });
    }
};
