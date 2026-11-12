import { db } from '@/core/db';
import { IPresentationFile } from '@/core/types';
import { IHymnal, IHymnalManifest } from '@/core/types/hymn';

export type OrphanedSlidesResult = {
    serviceCount: number;
    slideCount: number;
    affectedServices: IPresentationFile[];
};

export const hymnCustomManagement = {
    /**
     * Imports a custom hymnal from the file system.
     */
    async importCustomHymnal(onSync: () => Promise<unknown>): Promise<{ status: 'success' | 'collision' | 'error' | 'canceled'; existingId?: string; newDirName?: string; error?: string }> {
        const electron = window.electron;
        const hymnsApi = electron?.ipcRenderer?.hymns;
        if (!hymnsApi) return { status: 'error', error: 'not_electron' };

        const result = await hymnsApi.importCustom();
        if (result.canceled) return { status: 'canceled' };
        if (!result.success) return { status: 'error', error: result.error };

        const { dirName } = result;
        const manifest = result.manifest as IHymnalManifest | undefined;
        if (!manifest?.id) return { status: 'error', error: 'invalid_manifest' };

        // Check for ID collision
        const existingHymnal = await db.hymnals.get(manifest.id);
        if (existingHymnal) {
            if (existingHymnal.isBuiltIn) {
                if (dirName) await hymnsApi.removeCustom(dirName);
                return { status: 'error', error: 'id_occupied_by_builtin' };
            } else {
                return { status: 'collision', existingId: manifest.id, newDirName: dirName };
            }
        }

        await onSync();
        return { status: 'success' };
    },

    /**
     * Checks how many services and slides use the given hymnal.
     */
    async checkOrphanedSlides(hymnalId: string): Promise<OrphanedSlidesResult> {
        const allPresentations = await db.presentationFiles.toArray();
        const affectedServices: IPresentationFile[] = [];
        let slideCount = 0;

        for (const pres of allPresentations) {
            if (pres.metadata?.isHymnLibraryItem) continue;

            let confirmedOrphaned = 0;
            for (const slide of pres.slides || []) {
                if (slide.type === 'hymn' && slide.hymnPresentationId) {
                    const sourcePres = await db.presentationFiles.get(slide.hymnPresentationId);
                    if (sourcePres && sourcePres.hymnalId === hymnalId) {
                        confirmedOrphaned++;
                    }
                }
            }
            if (confirmedOrphaned > 0) {
                affectedServices.push(pres);
                slideCount += confirmedOrphaned;
            }
        }

        return { serviceCount: affectedServices.length, slideCount, affectedServices };
    },

    /**
     * Removes a custom hymnal, detaching any orphaned slides in user services.
     */
    async removeCustomHymnal(
        hymnal: IHymnal,
        skipAudioConfirmation = false,
        precomputedOrphans?: OrphanedSlidesResult,
    ): Promise<boolean> {
        if (hymnal.isBuiltIn) throw new Error('Cannot remove a built-in hymnal');

        const electron = window.electron;
        const hymnsApi = electron?.ipcRenderer?.hymns;
        if (!hymnsApi) return false;

        const { affectedServices } = precomputedOrphans ?? await this.checkOrphanedSlides(hymnal.id);

        if (affectedServices.length > 0) {
            const { usePresentationStore } = await import('@/features/presenter/store/presentationStore');
            const detachHymnSlide = usePresentationStore.getState().detachHymnSlide;

            for (const service of affectedServices) {
                for (const slide of service.slides || []) {
                    if (slide.type === 'hymn' && slide.hymnPresentationId) {
                        const sourcePres = await db.presentationFiles.get(slide.hymnPresentationId);
                        if (sourcePres && sourcePres.hymnalId === hymnal.id) {
                            await detachHymnSlide(service.id, slide.id, skipAudioConfirmation);
                        }
                    }
                }
            }
        }

        // Clean up database
        const presentationsToDelete = await db.presentationFiles.where('hymnalId').equals(hymnal.id).primaryKeys();
        await db.presentationFiles.bulkDelete(presentationsToDelete);
        
        const mapEntriesToDelete = await db.hymnStableIdMap.where('hymnalId').equals(hymnal.id).primaryKeys();
        await db.hymnStableIdMap.bulkDelete(mapEntriesToDelete);

        await db.hymnals.delete(hymnal.id);

        // Remove from file system
        const setting = await db.settings.get('hymnalLibraryDir');
        if (setting?.value) {
            const hymnalDirs = await hymnsApi.listHymnals(setting.value as string);
            for (const dir of hymnalDirs) {
                if (dir.isBundled) continue;
                const manifest = (await hymnsApi.readManifest(dir.path)) as IHymnalManifest | null;
                if (manifest && manifest.id === hymnal.id) {
                    const dirName = dir.path.split(/[\\/]/).pop();
                    if (dirName) await hymnsApi.removeCustom(dirName);
                    break;
                }
            }
        }

        return true;
    }
};

