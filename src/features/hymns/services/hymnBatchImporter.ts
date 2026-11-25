import { db } from '@/core/db';
import { IAudioScope, ICanvasSlide, IPresentationFile } from '@/core/types';
import { IHymnal, IHymnalManifestEntry } from '@/core/types/hymn';

export interface HymnImportTask {
    entry: IHymnalManifestEntry;
    filename: string;
    hymnNumber: number;
    hymnTitle: string;
    stableId: string;
    previousStableIds: string[];
    oldPresentationId?: string;
    existingPresentationId?: string;
}

export interface BatchImportContext {
    hymnal: IHymnal;
    dirPath: string;
    migrateReferences: (oldId: string, newId: string) => Promise<string[]>;
}

const BATCH_SIZE = 50;
const BATCH_YIELD_MS = 35;

/**
 * Normalizes a fast-unpacked presentation JSON into an IPresentationFile ready for bulkPut.
 */
function buildHymnPresentationRecord(
    raw: Record<string, unknown>,
    hash: string,
    hymnalId: string,
    task: HymnImportTask
): { presentation: IPresentationFile; audioScopes: IAudioScope[] } {
    const newPresentationId = crypto.randomUUID();
    const presentation = { ...raw } as unknown as IPresentationFile;

    presentation.id = newPresentationId;
    presentation.isMaster = false;
    presentation.ektpHash = hash;
    presentation.name = `${task.hymnNumber} — ${task.hymnTitle}`;
    presentation.hymnalId = hymnalId;
    presentation.tags = [`hymnStableId:${task.stableId}`];
    presentation.metadata = {
        isHymnLibraryItem: true,
        hymnTitle: task.hymnTitle,
        hymnOrder: task.hymnNumber,
    };

    delete presentation.serviceId;
    delete presentation.workflowId;
    presentation.binId = undefined;

    if (!Array.isArray(presentation.slides)) {
        presentation.slides = [];
    }
    for (const s of presentation.slides) {
        if (!s.type) s.type = 'normal';
    }
    if (!Array.isArray(presentation.slideIndex)) {
        presentation.slideIndex = presentation.slides.map((s, i) => ({
            id: s.id,
            order: s.order ?? i,
            type: s.type || 'normal',
        }));
    }

    const audioScopes: IAudioScope[] = [];
    if (Array.isArray(presentation.audioScopes)) {
        presentation.audioScopes = presentation.audioScopes.map((scope) => {
            const regenerated: IAudioScope = {
                ...scope,
                id: crypto.randomUUID(),
                presentationId: newPresentationId,
            };
            audioScopes.push(regenerated);
            return regenerated;
        });
    }

    for (const slide of presentation.slides) {
        if ('audioScopes' in slide && Array.isArray((slide as ICanvasSlide).audioScopes)) {
            (slide as ICanvasSlide).audioScopes = ((slide as ICanvasSlide).audioScopes ?? []).map(
                (scope: IAudioScope) => ({
                    ...scope,
                    id: crypto.randomUUID(),
                    presentationId: newPresentationId,
                })
            );
        }
    }

    return { presentation, audioScopes };
}

/**
 * Fallback single-file importer using EktpService.unpack for archives containing
 * embedded media/, nested presentations, preview.png, or split slides, or when
 * running in environments without the batch IPC handler.
 */
async function importSingleViaEktp(
    task: HymnImportTask,
    ctx: BatchImportContext
): Promise<string[]> {
    const hymnsApi = window.electron?.ipcRenderer?.hymns;
    if (!hymnsApi) return [];

    const buffer = await hymnsApi.readEktp(ctx.dirPath, task.filename);
    if (!buffer) return [];

    const { EktpService } = await import('@/features/presenter/services/ektpService');
    const uint8 = new Uint8Array(buffer);
    const blob = new Blob([uint8], { type: 'application/octet-stream' });

    let newPresentationId: string;
    try {
        newPresentationId = await EktpService.unpack(blob, 0, new Set());
    } catch (e) {
        console.error(`Failed to import hymn ektp "${task.filename}":`, e);
        return [];
    }

    if (task.oldPresentationId != null) {
        for (const oldStableId of task.previousStableIds) {
            await db.hymnStableIdMap.delete(oldStableId);
        }
    }

    const orphaned: string[] = [];
    const effectiveOldId = task.oldPresentationId ?? task.existingPresentationId;
    if (effectiveOldId && effectiveOldId !== newPresentationId) {
        const res = await ctx.migrateReferences(effectiveOldId, newPresentationId);
        orphaned.push(...res);
    }

    await db.presentationFiles.update(newPresentationId, {
        name: `${task.hymnNumber} — ${task.hymnTitle}`,
        hymnalId: ctx.hymnal.id,
        isMaster: false,
        tags: [`hymnStableId:${task.stableId}`],
        metadata: {
            isHymnLibraryItem: true,
            hymnTitle: task.hymnTitle,
            hymnOrder: task.hymnNumber,
        },
    });
    await db.hymnStableIdMap.put({
        stableId: task.stableId,
        hymnalId: ctx.hymnal.id,
        presentationId: newPresentationId,
    });

    return orphaned;
}

/**
 * Imports a list of hymns in low-memory batches (50 per Dexie transaction).
 * Uses main-process batch ZIP parsing (`readMrtpBatch`) to keep the renderer
 * UI thread responsive even on 2-4 GB RAM machines.
 */
export async function importHymnsInBatches(
    tasks: HymnImportTask[],
    ctx: BatchImportContext
): Promise<string[]> {
    const orphanedScopeIds: string[] = [];
    const hymnsApi = window.electron?.ipcRenderer?.hymns;
    if (!hymnsApi || tasks.length === 0) return orphanedScopeIds;

    // If batch IPC is unavailable (e.g. unit tests mocking only readEktp), use single fallback
    if (typeof hymnsApi.readMrtpBatch !== 'function') {
        for (let i = 0; i < tasks.length; i++) {
            const res = await importSingleViaEktp(tasks[i], ctx);
            orphanedScopeIds.push(...res);
            if ((i + 1) % 25 === 0) {
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }
        }
        return orphanedScopeIds;
    }

    for (let offset = 0; offset < tasks.length; offset += BATCH_SIZE) {
        const chunk = tasks.slice(offset, offset + BATCH_SIZE);
        const batchResults = await hymnsApi.readMrtpBatch(
            ctx.dirPath,
            chunk.map((t) => t.filename)
        );

        // Deduplicate by ektpHash in one indexed query for the whole batch
        const hashes = batchResults
            .map((r) => r.hash)
            .filter((h): h is string => Boolean(h));
        const existingByHashList =
            hashes.length > 0
                ? await db.presentationFiles.where('ektpHash').anyOf(hashes).toArray()
                : [];
        const existingByHash = new Map<string, IPresentationFile>();
        for (const p of existingByHashList) {
            if (p.ektpHash) existingByHash.set(p.ektpHash, p);
        }

        const presentationsToPut: IPresentationFile[] = [];
        const audioScopesToPut: IAudioScope[] = [];
        const stableMapsToPut: Array<{ stableId: string; hymnalId: string; presentationId: string }> = [];
        const oldStableIdsToDelete: string[] = [];
        const pendingMigrations: Array<{ oldId: string; newId: string }> = [];
        const fallbackTasks: HymnImportTask[] = [];

        for (let i = 0; i < chunk.length; i++) {
            const task = chunk[i];
            const res = batchResults[i];
            if (!res || res.error) continue;

            if (res.needsFullUnpack || !res.presentation || !res.hash) {
                fallbackTasks.push(task);
                continue;
            }

            const existingDedup = existingByHash.get(res.hash);
            let newPresentationId: string;

            if (existingDedup) {
                newPresentationId = existingDedup.id;
                presentationsToPut.push({
                    ...existingDedup,
                    name: `${task.hymnNumber} — ${task.hymnTitle}`,
                    hymnalId: ctx.hymnal.id,
                    isMaster: false,
                    tags: [`hymnStableId:${task.stableId}`],
                    metadata: {
                        isHymnLibraryItem: true,
                        hymnTitle: task.hymnTitle,
                        hymnOrder: task.hymnNumber,
                    },
                });
            } else {
                const { presentation, audioScopes } = buildHymnPresentationRecord(
                    res.presentation,
                    res.hash,
                    ctx.hymnal.id,
                    task
                );
                newPresentationId = presentation.id;
                presentationsToPut.push(presentation);
                audioScopesToPut.push(...audioScopes);
                existingByHash.set(res.hash, presentation);
            }

            if (task.oldPresentationId != null) {
                oldStableIdsToDelete.push(...task.previousStableIds);
            }

            const effectiveOldId = task.oldPresentationId ?? task.existingPresentationId;
            if (effectiveOldId && effectiveOldId !== newPresentationId) {
                pendingMigrations.push({ oldId: effectiveOldId, newId: newPresentationId });
            }

            stableMapsToPut.push({
                stableId: task.stableId,
                hymnalId: ctx.hymnal.id,
                presentationId: newPresentationId,
            });
        }

        // Single Dexie transaction per 50 hymns (instead of 150+ individual writes)
        if (presentationsToPut.length > 0 || stableMapsToPut.length > 0 || oldStableIdsToDelete.length > 0) {
            await db.transaction(
                'rw',
                [db.presentationFiles, db.audioScopes, db.hymnStableIdMap],
                async () => {
                    if (oldStableIdsToDelete.length > 0) {
                        await db.hymnStableIdMap.bulkDelete(oldStableIdsToDelete);
                    }
                    if (presentationsToPut.length > 0) {
                        await db.presentationFiles.bulkPut(presentationsToPut);
                    }
                    if (audioScopesToPut.length > 0) {
                        await db.audioScopes.bulkPut(audioScopesToPut);
                    }
                    if (stableMapsToPut.length > 0) {
                        await db.hymnStableIdMap.bulkPut(stableMapsToPut);
                    }
                }
            );
        }

        // Run any required reference migrations (only on content updates / renames)
        for (const mig of pendingMigrations) {
            const res = await ctx.migrateReferences(mig.oldId, mig.newId);
            orphanedScopeIds.push(...res);
        }

        // Fallback for any complex archives in this chunk
        for (const ft of fallbackTasks) {
            const res = await importSingleViaEktp(ft, ctx);
            orphanedScopeIds.push(...res);
        }

        // Yield to UI event loop & GC between batches so 2-4 GB RAM PCs stay smooth
        if (offset + BATCH_SIZE < tasks.length) {
            await new Promise<void>((resolve) => setTimeout(resolve, BATCH_YIELD_MS));
        }
    }

    return orphanedScopeIds;
}
