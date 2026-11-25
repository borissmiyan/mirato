import { db } from '@/core/db';
import { IHymnSlide, ICanvasSlide, ICanvasItem, SlideType, ISlide, IPresentationFile } from '@/core/types';
import { IHymnTheme, SOURCE_THEME_ID, IHymnal, IHymnalManifest, IHymnalManifestEntry } from '@/core/types/hymn';
import { DEFAULT_HYMN_THEME } from './hymnThemeConstants';
import { materializeTheme } from './hymnThemeMaterializer';
import { CanvasService } from '@/features/presenter/services/CanvasService';
import { buildSlidePositionMap, getOrderedHymnSlides } from './hymnMigrationUtils';
import { hymnCustomManagement, OrphanedSlidesResult } from './hymnCustomManagement';
import { importHymnsInBatches, HymnImportTask } from './hymnBatchImporter';
import { invalidateHymnIndexCache } from './hymnIndexCache';

export type { OrphanedSlidesResult };

let activeSyncPromise: Promise<{ orphanScopeIds: string[] }> | null = null;

/**
 * Service for managing hymnals, synchronizing with the file system,
 * and handling the materialization of hymns into presentations.
 */
export const hymnLibraryService = {
    
    /**
     * Forks a hymn from the library into a concrete IHymnSlide for a presentation.
     * Note: This does NOT copy the slides. It creates a reference slide (`type: 'hymn'`).
     */
    createHymnReferenceSlide(
        hymnPresentationId: string, 
        sourceSlideId: string, 
        themeId: string = 'default'
    ): IHymnSlide {
        return {
            id: crypto.randomUUID(),
            type: 'hymn',
            order: 0, // Will be set by timeline operations
            blockId: 'default',
            templateId: '',
            hymnPresentationId,
            sourceSlideId,
            themeId,
            duration: 0,
            transition: { type: 'none', duration: 0.5 }
        };
    },

    /**
     * Pure helper to construct reference slides for all verses of a hymn presentation in logical order.
     * Has no side effects and does not depend on React or Zustand stores.
     */
    async buildHymnSlides(
        hymnPresentationId: string, 
        themeId: string = 'default'
    ): Promise<IHymnSlide[]> {
        const hymnPres = await db.presentationFiles.get(hymnPresentationId);
        if (!hymnPres) return [];

        const orderedSlides = getOrderedHymnSlides(hymnPres);
        return orderedSlides.map(slide => 
            this.createHymnReferenceSlide(hymnPresentationId, slide.id, themeId)
        );
    },

    /**
     * Materializes an IHymnTheme onto a source ICanvasSlide to produce
     * a fully styled array of ICanvasItems.
     * This is used dynamically by HymnSlideRenderer.
     * 
     * Rule: First slide of a hymn is ALWAYS bold ('700'), while subsequent
     * slides are regular ('400') across all custom and default themes.
     */
    materializeTheme(sourceSlide: ICanvasSlide, theme: IHymnTheme, slideOrder?: number) {
        return materializeTheme(sourceSlide, theme, slideOrder);
    },

    /**
     * Migrates all IHymnSlide references (and IAudioScope entries) from an old
     * hymn presentationId to a new one, using positional slide mapping.
     *
     * The entire migration for a single hymn is wrapped in a Dexie transaction
     * (atomic). The syncedManifestVersion update is intentionally OUTSIDE the
     * transaction and serves as a commit-flag: if the transaction aborts, the
     * version remains at its old value and the migration will retry on the next
     * app launch.
     *
     * IMPORTANT: Do NOT call Zustand store methods (e.g. detachHymnSlide) inside
     * this method. Only raw Dexie calls are allowed so the transaction context
     * stays clean and does not prematurely commit via non-Dexie async paths.
     */
    async migrateHymnReferences(
        oldPresentationId: string,
        newPresentationId: string,
    ): Promise<string[]> {
        const oldPresentation = await db.presentationFiles.get(oldPresentationId);
        const newPresentation = await db.presentationFiles.get(newPresentationId);
        if (!oldPresentation || !newPresentation) return [];

        const slidePositionMap = buildSlidePositionMap(oldPresentation, newPresentation);
        const newlyOrphanedScopeIds: string[] = [];

        // All writes are inside one Dexie transaction: all-or-nothing.
        await db.transaction(
            'rw',
            [db.presentationFiles, db.audioScopes, db.hymnStableIdMap],
            async () => {
                // --- Step 2: Migrate IHymnSlide references in all service presentations ---
                const allPresentations = await db.presentationFiles.toArray();
                for (const pres of allPresentations) {
                    if (pres.metadata?.isHymnLibraryItem) continue;

                    const hadMatch = (pres.slides || []).some(
                        (s) => s.type === 'hymn' && (s as IHymnSlide).hymnPresentationId === oldPresentationId,
                    );
                    if (!hadMatch) continue;

                    const updatedSlides = (pres.slides || []).flatMap((slide): ISlide[] => {
                        if (slide.type !== 'hymn') return [slide];
                        const hymnSlide = slide as IHymnSlide;
                        if (hymnSlide.hymnPresentationId !== oldPresentationId) return [slide];

                        const newSourceSlideId = slidePositionMap.get(hymnSlide.sourceSlideId);
                        if (newSourceSlideId === undefined) {
                            // Verse was removed from the new version — detach (don't keep broken ref).
                            console.warn(
                                `[HymnMigration] sourceSlide "${hymnSlide.sourceSlideId}" has no ` +
                                `positional match in updated hymn "${newPresentationId}". ` +
                                `Detaching slide "${slide.id}" from service "${pres.id}".`,
                            );
                            return []; // flatMap removes the entry
                        }
                        return [{ ...hymnSlide, hymnPresentationId: newPresentationId, sourceSlideId: newSourceSlideId }];
                    });

                    await db.presentationFiles.update(pres.id, { slides: updatedSlides as ISlide[] });
                }

                // --- Step 3: Softly migrate or replace IAudioScope entries without conflict modals ---
                const scopesToMigrate = await db.audioScopes
                    .where('presentationId')
                    .equals(oldPresentationId)
                    .toArray();

                const newDbScopesCount = await db.audioScopes
                    .where('presentationId')
                    .equals(newPresentationId)
                    .count();
                const newHasOwnScopes = newDbScopesCount > 0 || (newPresentation.audioScopes?.length ?? 0) > 0;
                const newOrderedSlides = getOrderedHymnSlides(newPresentation);
                const fallbackStartId = newOrderedSlides[0]?.id;
                const fallbackEndId = newOrderedSlides[newOrderedSlides.length - 1]?.id;

                for (const scope of scopesToMigrate) {
                    // If the updated .mrtp already carries its own fresh audioScopes, silently drop the legacy scope
                    if (newHasOwnScopes) {
                        await db.audioScopes.delete(scope.id);
                        continue;
                    }

                    const newStartSlideId = slidePositionMap.get(scope.startSlideId) ?? fallbackStartId;
                    const newEndSlideId = slidePositionMap.get(scope.endSlideId) ?? fallbackEndId;

                    if (newStartSlideId && newEndSlideId) {
                        await db.audioScopes.update(scope.id, {
                            presentationId: newPresentationId,
                            startSlideId: newStartSlideId,
                            endSlideId: newEndSlideId,
                            needsManualReview: false,
                        });
                    } else {
                        await db.audioScopes.delete(scope.id);
                    }
                }

                // --- Step 4: Clean up old presentation if no longer referenced ---
                await this.cleanupUnreferencedPresentation(oldPresentationId);
            },
        );
        
        return newlyOrphanedScopeIds;
    },

    /**
     * Checks if a presentation is still referenced by any service slides or orphan audio scopes.
     * If not, deletes it. Should be called inside or outside a transaction.
     */
    async cleanupUnreferencedPresentation(presentationId: string): Promise<void> {
        const allPresentations = await db.presentationFiles.toArray();
        const slideStillReferenced = allPresentations.some((p) =>
            !p.metadata?.isHymnLibraryItem &&
            (p.slides || []).some(
                (s) => s.type === 'hymn' && (s as IHymnSlide).hymnPresentationId === presentationId,
            ),
        );
        
        // Do not delete if there are orphaned audio scopes still referencing this presentation for context
        const orphanCount = await db.audioScopes.where('presentationId').equals(presentationId).count();
        const stillReferenced = slideStillReferenced || orphanCount > 0;
        
        if (!stillReferenced) {
            await db.presentationFiles.delete(presentationId);
        }
    },

    /**
     * Synchronizes the hymnals directory with the database on startup.
     * On first import, unpacks every .ektp file and registers it in the DB.
     * On subsequent launches, skips unchanged hymns using manifestVersion or mtime.
     * When a stableHymnId is renamed (via previousStableIds), runs full link migration.
     */
    async syncFileSystemHymnals(): Promise<{ orphanScopeIds: string[] }> {
        if (activeSyncPromise) return activeSyncPromise;
        activeSyncPromise = this._performSyncFileSystemHymnals().finally(() => {
            activeSyncPromise = null;
        });
        return activeSyncPromise;
    },

    async _performSyncFileSystemHymnals(): Promise<{ orphanScopeIds: string[] }> {
        const electron = window.electron;
        const hymnsApi = electron?.ipcRenderer?.hymns;
        if (!hymnsApi) return { orphanScopeIds: [] }; // Not in Electron context

        // Read the root hymnal library path from settings
        const setting = await db.settings.get('hymnalLibraryDir');
        let libraryDir = setting?.value as string | undefined;
        if (!libraryDir) {
            libraryDir = await hymnsApi.getPath();
            if (libraryDir) {
                await db.settings.put({ key: 'hymnalLibraryDir', value: libraryDir });
            }
        }
        if (!libraryDir) return { orphanScopeIds: [] };

        // Seed bundled hymnals into userData (always overwrites hymnal.json to pick up updates)
        await hymnsApi.seedBundled();

        // Get all hymnals (scans both userData dir AND bundled-hymnals dir).
        // The IPC handler now also returns ektpFileMtimes for mtime-based change detection.
        let hymnalDirs: Array<{
            path: string;
            languageFolder?: string;
            isBundled?: boolean;
            ektpFileMtimes?: Record<string, string>;
        }> = [];
        try {
            hymnalDirs = await hymnsApi.listHymnals(libraryDir);
        } catch (e) {
            console.error('Failed to list hymnals', e);
            return { orphanScopeIds: [] };
        }

        const newlyOrphanedScopeIds: string[] = [];

        // Pre-upsert deduplication: Group directories by manifest ID before writing to Dexie.
        // Guarantees isBundled = true entries take precedence over seeded userData duplicates.
        const hymnalMap = new Map<string, { dir: typeof hymnalDirs[number]; manifest: IHymnalManifest; coverImageUrl: string | null }>();
        for (const dir of hymnalDirs) {
            const manifest = (await hymnsApi.readManifest(dir.path)) as IHymnalManifest | null;
            if (!manifest || !manifest.id || !manifest.hymns) continue;

            const coverImageUrl: string | null = await hymnsApi.readCover(dir.path);
            const existing = hymnalMap.get(manifest.id);
            const existingVer = existing?.manifest.manifestVersion ?? 0;
            const incomingVer = manifest.manifestVersion ?? 0;
            const isFresher =
                !existing ||
                (!existing.dir.isBundled && dir.isBundled) ||
                incomingVer > existingVer ||
                (incomingVer === existingVer && manifest.hymns.length > existing.manifest.hymns.length);
            if (isFresher) {
                hymnalMap.set(manifest.id, { dir, manifest, coverImageUrl });
            }
        }

        // Remove stale built-in hymnal records in Dexie that no longer exist on disk (prevents duplicate entries)
        const existingDbHymnals = await db.hymnals.toArray();
        for (const dbH of existingDbHymnals) {
            if (dbH.isBuiltIn && !hymnalMap.has(dbH.id)) {
                await db.hymnals.delete(dbH.id);
            }
        }

        for (const { dir, manifest, coverImageUrl } of hymnalMap.values()) {
            // Upsert IHymnal record (preserve synced* fields from existing record if present)
            const existingHymnal = await db.hymnals.get(manifest.id);
            const hymnal: IHymnal = {
                id: manifest.id,
                name: manifest.name,
                language: manifest.language ?? dir.languageFolder ?? 'ru',
                publisher: manifest.publisher,
                year: manifest.year,
                description: manifest.description,
                itemCount: manifest.hymns.length,
                coverImageUrl: coverImageUrl ?? undefined,
                isBuiltIn: dir.isBundled ?? false,
                isDisabled: existingHymnal?.isDisabled,
                customDirName: dir.isBundled ? undefined : dir.path.split(/[\\/]/).pop(),
                defaultThemeId: manifest.defaultThemeId,
                thematicIndex: manifest.thematicIndex,
                // Preserve tracking fields from previous sync
                syncedManifestVersion: existingHymnal?.syncedManifestVersion,
                syncedMtimeHash: existingHymnal?.syncedMtimeHash,
            };
            await db.hymnals.put(hymnal);

            // Compute mtime hash for this hymnal (for sborniki without manifestVersion)
            const newMtimeHash = dir.ektpFileMtimes
                ? Object.entries(dir.ektpFileMtimes)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, v]) => `${k}:${v}`)
                      .join('|')
                : undefined;

            // Determine if this hymnal's content might have changed since last sync.
            const incomingManifestVersion: number = manifest.manifestVersion ?? 0;
            const syncedVersion: number = hymnal.syncedManifestVersion ?? -1;

            // needsContentSync is a per-hymnal flag for version bump detection.
            // Bundled hymnals with manifestVersion > 0 rely solely on versionBumped (no mtime churn).
            const versionBumped = incomingManifestVersion > syncedVersion;
            const mtimeChanged =
                !(dir.isBundled && incomingManifestVersion > 0) &&
                newMtimeHash !== undefined &&
                newMtimeHash !== hymnal.syncedMtimeHash;
            const hymnalNeedsCheck = versionBumped || mtimeChanged;

            // Pre-load the stableIdMap entries for this hymnal
            const existingMaps = await db.hymnStableIdMap
                .where('hymnalId')
                .equals(hymnal.id)
                .toArray();
            const stableIdMapByStableId = new Map(existingMaps.map((m) => [m.stableId, m]));

            // Fast O(1) skip for unchanged hymnals already fully synced into Dexie
            if (!hymnalNeedsCheck && existingMaps.length >= manifest.hymns.length) {
                const existingPresCount = await db.presentationFiles
                    .where('hymnalId')
                    .equals(hymnal.id)
                    .count();
                if (existingPresCount >= manifest.hymns.length) {
                    continue;
                }
            }

            // Pre-load existing presentation IDs for this hymnal in one query (avoids 5,000+ sequential gets)
            const existingPresIds = new Set(
                await db.presentationFiles.where('hymnalId').equals(hymnal.id).primaryKeys()
            );

            // Collect only hymns that actually need importing/updating
            const importTasks: HymnImportTask[] = [];
            for (const h of manifest.hymns) {
                const filename: string = h.file;
                if (!filename) continue;

                const hymnNumber: number = h.hymnNumber || h.number || 0;
                const hymnTitle: string = h.title || filename.replace(/\.(mrtp|ektp)$/i, '');
                const stableId: string = h.stableHymnId || h.id || filename.replace(/\.(mrtp|ektp)$/i, '');
                const previousStableIds: string[] = h.previousStableIds ?? [];

                let oldPresentationId: string | undefined;
                for (const oldStableId of previousStableIds) {
                    const oldEntry = stableIdMapByStableId.get(oldStableId);
                    if (oldEntry?.presentationId) {
                        oldPresentationId = oldEntry.presentationId;
                        break;
                    }
                }

                const existingEntry = stableIdMapByStableId.get(stableId);
                const hasExistingPresentation = Boolean(
                    existingEntry?.presentationId && existingPresIds.has(existingEntry.presentationId)
                );

                const needsReimport =
                    oldPresentationId != null || // ID was renamed
                    !hasExistingPresentation ||  // No DB record yet
                    hymnalNeedsCheck;            // Version/mtime bump — content may have changed

                if (!needsReimport) continue;

                importTasks.push({
                    entry: h,
                    filename,
                    hymnNumber,
                    hymnTitle,
                    stableId,
                    previousStableIds,
                    oldPresentationId,
                    existingPresentationId: existingEntry?.presentationId,
                });
            }

            if (importTasks.length > 0) {
                const batchOrphans = await importHymnsInBatches(importTasks, {
                    hymnal,
                    dirPath: dir.path,
                    migrateReferences: (oldId, newId) => this.migrateHymnReferences(oldId, newId),
                });
                newlyOrphanedScopeIds.push(...batchOrphans);
                invalidateHymnIndexCache();
            }

            // Prune any duplicate/orphaned presentationFiles for this hymnal not referenced by hymnStableIdMap
            const validMaps = await db.hymnStableIdMap.where('hymnalId').equals(hymnal.id).toArray();
            const validPresIds = new Set(validMaps.map(m => m.presentationId));
            const allHymnalPres = await db.presentationFiles.where('hymnalId').equals(hymnal.id).toArray();
            for (const p of allHymnalPres) {
                if (!validPresIds.has(p.id)) {
                    await db.audioScopes.where('presentationId').equals(p.id).delete().catch(() => {});
                    await db.presentationFiles.delete(p.id).catch(() => {});
                }
            }

            // Silently clean up any leftover needsManualReview scopes from older versions
            const staleReviewScopes = await db.audioScopes.filter(s => s.needsManualReview === true).toArray();
            for (const s of staleReviewScopes) {
                await db.audioScopes.delete(s.id).catch(() => {});
            }

            // Update the commit-flag fields AFTER all hymns in this hymnal are processed.
            // If any hymn migration transaction aborted, the manifest version stays at its
            // old value → the migration retries on the next app launch.
            await db.hymnals.update(hymnal.id, {
                syncedManifestVersion: manifest.manifestVersion ?? 0,
                syncedMtimeHash: newMtimeHash,
            });
        }
        
        return { orphanScopeIds: newlyOrphanedScopeIds };
    },

    /**
     * Imports a custom hymnal from the file system.
     */
    async importCustomHymnal(): Promise<{ status: 'success' | 'collision' | 'error' | 'canceled'; existingId?: string; newDirName?: string; error?: string }> {
        return hymnCustomManagement.importCustomHymnal(() => this.syncFileSystemHymnals());
    },

    /**
     * Checks how many services and slides use the given hymnal.
     */
    async checkOrphanedSlides(hymnalId: string): Promise<OrphanedSlidesResult> {
        return hymnCustomManagement.checkOrphanedSlides(hymnalId);
    },

    /**
     * Removes a custom hymnal, detaching any orphaned slides in user services.
     */
    async removeCustomHymnal(
        hymnal: IHymnal,
        skipAudioConfirmation = false,
        precomputedOrphans?: OrphanedSlidesResult,
    ): Promise<boolean> {
        const removed = await hymnCustomManagement.removeCustomHymnal(hymnal, skipAudioConfirmation, precomputedOrphans);
        if (removed) invalidateHymnIndexCache();
        return removed;
    }
};
