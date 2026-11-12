import { db } from '@/core/db';
import { IHymnSlide, ICanvasSlide, ICanvasItem, SlideType, ISlide, IPresentationFile } from '@/core/types';
import { IHymnTheme, SOURCE_THEME_ID, IHymnal, IHymnalManifest, IHymnalManifestEntry } from '@/core/types/hymn';
import { DEFAULT_HYMN_THEME } from './hymnThemeConstants';
import { materializeTheme } from './hymnThemeMaterializer';
import { CanvasService } from '@/features/presenter/services/CanvasService';
import { buildSlidePositionMap, getOrderedHymnSlides } from './hymnMigrationUtils';
import { hymnCustomManagement, OrphanedSlidesResult } from './hymnCustomManagement';

export type { OrphanedSlidesResult };

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

                // --- Step 3: Migrate IAudioScope entries ---
                const scopesToMigrate = await db.audioScopes
                    .where('presentationId')
                    .equals(oldPresentationId)
                    .toArray();

                for (const scope of scopesToMigrate) {
                    const newStartSlideId = slidePositionMap.get(scope.startSlideId);
                    const newEndSlideId = slidePositionMap.get(scope.endSlideId);

                    if (newStartSlideId === undefined || newEndSlideId === undefined) {
                        // One or both boundaries are out-of-range in the new version.
                        // We do NOT auto-migrate with a wide fallback — that would silently
                        // extend the audio range in a way the operator never intended.
                        // The scope remains bound to oldPresentationId (tightly inactive for
                        // the new presentationId), which is the safest failure mode.
                        // Phase 4.2 will surface this in the UI.
                        console.warn(
                            `[HymnMigration] AudioScope "${scope.id}" has unmappable boundaries ` +
                            `(startSlideId: ${scope.startSlideId} → ${newStartSlideId}, ` +
                            `endSlideId: ${scope.endSlideId} → ${newEndSlideId}). ` +
                            `Leaving scope as-is. Requires manual review.`,
                        );
                        await db.audioScopes.update(scope.id, { needsManualReview: true });
                        newlyOrphanedScopeIds.push(scope.id);
                        continue;
                    }

                    await db.audioScopes.update(scope.id, {
                        presentationId: newPresentationId,
                        startSlideId: newStartSlideId,
                        endSlideId: newEndSlideId,
                    });
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

        // Lazy-import EktpService to avoid circular dep at module load time
        const { EktpService } = await import('@/features/presenter/services/ektpService');

        // Pre-upsert deduplication: Group directories by manifest ID before writing to Dexie.
        // Guarantees isBundled = true entries take precedence over seeded userData duplicates.
        const hymnalMap = new Map<string, { dir: typeof hymnalDirs[number]; manifest: IHymnalManifest; coverImageUrl: string | null }>();
        for (const dir of hymnalDirs) {
            const manifest = (await hymnsApi.readManifest(dir.path)) as IHymnalManifest | null;
            if (!manifest || !manifest.id || !manifest.hymns) continue;

            const coverImageUrl: string | null = await hymnsApi.readCover(dir.path);
            const existing = hymnalMap.get(manifest.id);
            if (!existing || (!existing.dir.isBundled && dir.isBundled)) {
                hymnalMap.set(manifest.id, { dir, manifest, coverImageUrl });
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
            // Per-hymn needsReimport (below) is gated further by mtime changes.
            const versionBumped = incomingManifestVersion > syncedVersion;
            const mtimeChanged = newMtimeHash !== undefined && newMtimeHash !== hymnal.syncedMtimeHash;
            const hymnalNeedsCheck = versionBumped || mtimeChanged;

            // Pre-load the stableIdMap entries for this hymnal
            const existingMaps = await db.hymnStableIdMap
                .where('hymnalId')
                .equals(hymnal.id)
                .toArray();
            const stableIdMapByStableId = new Map(existingMaps.map((m) => [m.stableId, m]));

            // Import each hymn's .ektp file into presentationFiles.
            for (const h of manifest.hymns) {
                const filename: string = h.file;
                if (!filename) continue;

                const hymnNumber: number = h.hymnNumber || h.number || 0;
                const hymnTitle: string = h.title || filename.replace('.ektp', '');
                const stableId: string = h.stableHymnId || h.id || filename.replace('.ektp', '');
                const previousStableIds: string[] = h.previousStableIds ?? [];

                // Check if this stableId was previously known under a different name.
                // If so, we need to find the old presentationId so we can migrate refs.
                let oldPresentationId: string | undefined;
                for (const oldStableId of previousStableIds) {
                    const oldEntry = stableIdMapByStableId.get(oldStableId);
                    if (oldEntry?.presentationId) {
                        oldPresentationId = oldEntry.presentationId;
                        break; // Use the first match found
                    }
                }

                const existingEntry = stableIdMapByStableId.get(stableId);

                // Determine if we need to unpack this specific hymn's .ektp.
                // We must unpack if:
                //   a) No existing map entry exists (first import)
                //   b) The stableId was renamed (previousStableIds matched) — we need new presentationId
                //   c) The hymnal's version or mtime changed (content may have been updated)
                const existingPresentation = existingEntry?.presentationId
                    ? await db.presentationFiles.get(existingEntry.presentationId)
                    : undefined;

                const needsReimport =
                    oldPresentationId != null || // ID was renamed
                    !existingPresentation ||       // No DB record yet
                    hymnalNeedsCheck;              // Version/mtime bump — content may have changed

                if (!needsReimport) continue;

                // Read raw binary from disk via IPC
                const buffer = await hymnsApi.readEktp(dir.path, filename);
                if (!buffer) continue;

                // Convert Node.js Buffer → Uint8Array → Blob
                const uint8 = new Uint8Array(buffer);
                const blob = new Blob([uint8], { type: 'application/octet-stream' });

                let newPresentationId: string;
                try {
                    // EktpService.unpack handles deduplication by ektpHash automatically.
                    // If content is unchanged, it returns the SAME presentationId → migration is a no-op.
                    newPresentationId = await EktpService.unpack(blob, 0, new Set());
                } catch (e) {
                    console.error(`Failed to import hymn ektp "${filename}":`, e);
                    continue;
                }

                // If oldPresentationId is set from previousStableIds, we need to remove
                // that old entry from the map atomically inside migrateHymnReferences.
                // We handle that by deleting it here before the migration transaction starts.
                // Note: this delete is outside the transaction deliberately — if migration
                // fails, the old stableId record is gone, but oldPresentationId is still in DB.
                // The syncedManifestVersion will NOT be updated (see below), so the next launch
                // will detect that migration is still needed via hymnalNeedsCheck.
                if (oldPresentationId != null) {
                    for (const oldStableId of previousStableIds) {
                        await db.hymnStableIdMap.delete(oldStableId);
                    }
                }

                // Run reference migration if the presentation actually changed (different ID after unpack)
                const effectiveOldId = oldPresentationId ?? existingEntry?.presentationId;
                if (effectiveOldId && effectiveOldId !== newPresentationId) {
                    const orphaned = await this.migrateHymnReferences(effectiveOldId, newPresentationId);
                    newlyOrphanedScopeIds.push(...orphaned);
                }

                // Mark as hymn library item and link to this hymnal
                const hymnName = `${hymnNumber} — ${hymnTitle}`;
                await db.presentationFiles.update(newPresentationId, {
                    name: hymnName,
                    hymnalId: hymnal.id,
                    isMaster: false,
                    tags: [`hymnStableId:${stableId}`],
                    metadata: {
                        isHymnLibraryItem: true,
                        hymnTitle,
                        hymnOrder: hymnNumber,
                    },
                });

                // Upsert stableIdMap for the new stableId → newPresentationId
                await db.hymnStableIdMap.put({ stableId, hymnalId: hymnal.id, presentationId: newPresentationId });
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
        return hymnCustomManagement.removeCustomHymnal(hymnal, skipAudioConfirmation, precomputedOrphans);
    }
};
