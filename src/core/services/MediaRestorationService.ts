import { db } from '@/core/db';
import { IpcService } from '@/core/services/ipcService';
import { mediaCache } from '@/core/utils/mediaCache';
import { StorageOptimizationService } from './StorageOptimizationService';
import JSZip from 'jszip';
import { sha256 } from '@/core/utils/hashUtils';

/**
 * Service to locate and restore missing media assets across local directories,
 * EKTP archives, and presentation packages.
 */
export class MediaRestorationService {
    /**
     * Inspects magic bytes of a Blob to accurately determine its MIME type.
     */
    private static async detectMimeType(blob: Blob, fileName?: string): Promise<string> {
        if (blob.type && blob.type !== 'application/octet-stream') {
            return blob.type;
        }

        try {
            const buffer = await blob.slice(0, 16).arrayBuffer();
            const bytes = new Uint8Array(buffer);

            // PNG: 89 50 4E 47
            if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
                return 'image/png';
            }
            // JPEG: FF D8 FF
            if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
                return 'image/jpeg';
            }
            // WEBP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
            if (
                bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
            ) {
                return 'image/webp';
            }
            // GIF: GIF8
            if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
                return 'image/gif';
            }
            // MP3: ID3 or FF FB
            if (
                (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
                (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
            ) {
                return 'audio/mpeg';
            }
        } catch {
            // Fall through to extension-based fallback
        }

        if (fileName) {
            const ext = fileName.split('.').pop()?.toLowerCase();
            if (ext === 'png') return 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
            if (ext === 'webp') return 'image/webp';
            if (ext === 'svg') return 'image/svg+xml';
            if (ext === 'mp3') return 'audio/mpeg';
            if (ext === 'aac') return 'audio/aac';
            if (ext === 'wav') return 'audio/wav';
        }

        return 'image/png';
    }

    /**
     * Converts a local file URL or path into an absolute file system path.
     */
    private static cleanPath(urlOrPath: string): string {
        return decodeURIComponent(
            urlOrPath.replace('local-resource://localhost', '').replace('file://', '')
        );
    }

    /**
     * Identifies all missing media referenced by presentations, templates, and hymn themes,
     * and automatically scans user archives (.ektp), loose media files, and PPTX presentations
     * to reconstruct missing IndexedDB backgrounds.
     */
    static async restoreMissingMedia(
        folderPath?: string,
        onProgress?: (status: string, current: number, total: number) => void
    ): Promise<{ restored: number; missing: number }> {
        // 1. Identify missing media IDs actively referenced by database content
        const referencedIds = await StorageOptimizationService.collectReferencedMediaIds();
        const missingIds = new Set<string>();
        const missingFileNames = new Map<string, string>(); // lowercase name -> targetId

        const allScopes = await db.audioScopes.toArray();
        for (const scp of allScopes) {
            if (scp.fileName) {
                const pool = scp.fileId ? await db.mediaPool.get(scp.fileId) : null;
                let isMissing = !pool || pool.isMissing;
                if (pool?.path && !pool.data && IpcService.isElectron()) {
                    const stats = await IpcService.invoke('get-file-stats', pool.path).catch(() => null);
                    if (!stats) isMissing = true;
                }
                if (isMissing) {
                    missingFileNames.set(scp.fileName.toLowerCase(), scp.fileId || scp.id);
                    if (scp.fileId) missingIds.add(scp.fileId);
                }
            }
        }

        for (const id of referencedIds) {
            const bg = await db.backgrounds.get(id);
            if (!bg) {
                const pool = await db.mediaPool.get(id);
                if (!pool || (!pool.data && !pool.path) || pool.isMissing) {
                    missingIds.add(id);
                }
            }
        }

        if (missingIds.size === 0 && missingFileNames.size === 0) {
            return { restored: 0, missing: 0 };
        }

        const totalToFind = missingIds.size + missingFileNames.size;
        let restoredCount = 0;

        if (!IpcService.isElectron()) {
            return { restored: 0, missing: totalToFind };
        }

        // 2. Discover mounted external volumes (USB drives, external HDDs in /Volumes)
        let externalVolumes: string[] = [];
        if (IpcService.isElectron()) {
            externalVolumes = await IpcService.invoke<string[]>('system:get-external-volumes').catch(() => []) || [];
        }

        // Build prioritized candidate directories for media recovery
        const candidateRoots = [
            folderPath,
            ...externalVolumes,
            '/Users/borissmiyan/Library/Application Support/mirato/media/audio',
            '/Users/borissmiyan/Library/Application Support/mirato/media/videos',
            '/Users/borissmiyan/Library/Application Support/mirato/Hymnals',
            '/Users/borissmiyan/Library/Application Support/ekklesienter/media/audio',
            '/Users/borissmiyan/Library/Application Support/ekklesienter/media/videos',
            '/Users/borissmiyan/Library/Application Support/ekklesienter/Hymnals',
            '/Users/borissmiyan/Work/AppDev/ekklesienter/bundled-hymnals',
            '/Users/borissmiyan/Work/AppDev/ekklesienter/scratch/idb_copy'
        ].filter(Boolean) as string[];

        // Deduplicate roots
        const searchDirs = Array.from(new Set(candidateRoots));

        // ─── STEP 1: Scan EKTP Archives ──────────────────────────────────────────
        for (const dir of searchDirs) {
            if (missingIds.size === 0 && missingFileNames.size === 0) break;
            onProgress?.(`Сканирование EKTP архивов в ${dir.split('/').pop()}...`, restoredCount, totalToFind);

            try {
                const ektpFiles = await IpcService.invoke<{ id: string; name: string; url: string }[]>(
                    'read-directory-recursive',
                    dir,
                    ['.ektp']
                );

                if (Array.isArray(ektpFiles)) {
                    for (const ef of ektpFiles) {
                        if (missingIds.size === 0 && missingFileNames.size === 0) break;
                        onProgress?.(`Чтение архива ${ef.name}...`, restoredCount, totalToFind);

                        const filePath = this.cleanPath(ef.url);
                        const fileData = await IpcService.invoke<{ data: Uint8Array } | null>('read-file-data', filePath);
                        if (!fileData?.data) continue;

                        try {
                            const zip = await JSZip.loadAsync(fileData.data);
                            const mediaEntries = zip.filter(p => p.startsWith('media/') && !p.endsWith('/'));

                            for (const entry of mediaEntries) {
                                if (missingIds.size === 0 && missingFileNames.size === 0) break;
                                const blob = await entry.async('blob');
                                const hash = await sha256(blob);
                                const filename = entry.name.split('/').pop() || 'media';
                                const baseName = filename.replace(/\.[^/.]+$/, '');

                                // Match either by sha256 hash or by original filename / UUID
                                const candidates = [hash, baseName, filename];
                                let targetId: string | null = null;
                                for (const candidate of candidates) {
                                    if (missingIds.has(candidate)) {
                                        targetId = candidate;
                                        break;
                                    }
                                }
                                if (!targetId && missingFileNames.has(filename.toLowerCase())) {
                                    targetId = missingFileNames.get(filename.toLowerCase())!;
                                }

                                if (targetId) {
                                    const mimeType = await this.detectMimeType(blob, filename);
                                    await db.backgrounds.put({
                                        id: targetId,
                                        name: filename,
                                        data: blob,
                                        mimeType
                                    });
                                    if (mimeType.startsWith('audio/')) {
                                        await db.mediaPool.put({
                                            id: hash,
                                            name: filename,
                                            path: filePath || filename,
                                            type: 'audio',
                                            data: blob,
                                            createdAt: Date.now()
                                        });
                                        if (targetId !== hash) {
                                            await db.mediaPool.put({
                                                id: targetId,
                                                name: filename,
                                                path: filePath || filename,
                                                type: 'audio',
                                                data: blob,
                                                createdAt: Date.now()
                                            });
                                        }
                                        // Connect audioScopes
                                        for (const scp of allScopes) {
                                            if (scp.fileName?.toLowerCase() === filename.toLowerCase() || scp.fileId === targetId) {
                                                await db.audioScopes.update(scp.id, {
                                                    fileId: hash,
                                                    volume: (scp.volume === 0 || scp.volume === undefined) ? 1.0 : scp.volume
                                                });
                                            }
                                        }
                                    }
                                    missingIds.delete(targetId);
                                    missingFileNames.delete(filename.toLowerCase());
                                    restoredCount++;
                                }
                            }
                        } catch (zipErr) {
                            console.warn(`[RestoreMedia] Failed reading EKTP ${filePath}:`, zipErr);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[RestoreMedia] Could not scan ${dir} for EKTP:`, err);
            }
        }

        // ─── STEP 2: Scan Loose Media Files ──────────────────────────────────────
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp3', '.aac', '.m4a', '.wav'];
        for (const dir of searchDirs) {
            if (missingIds.size === 0 && missingFileNames.size === 0) break;
            onProgress?.(`Поиск файлов в ${dir.split('/').pop()}...`, restoredCount, totalToFind);

            try {
                const files = await IpcService.invoke<{ id: string; name: string; url: string }[]>(
                    'read-directory-recursive',
                    dir,
                    mediaExtensions
                );

                if (Array.isArray(files)) {
                    for (const item of files) {
                        if (missingIds.size === 0 && missingFileNames.size === 0) break;

                        // Fast metadata check: Skip file immediately if neither filename nor baseName matches missing media
                        const baseName = item.name.replace(/\.[^/.]+$/, '');
                        const nameLower = item.name.toLowerCase();

                        let targetId: string | null = null;
                        if (missingIds.has(item.name)) {
                            targetId = item.name;
                        } else if (missingIds.has(baseName)) {
                            targetId = baseName;
                        } else if (missingFileNames.has(nameLower)) {
                            targetId = missingFileNames.get(nameLower)!;
                        }

                        // If not a candidate by filename/id, do NOT load binary data into RAM
                        if (!targetId) {
                            continue;
                        }

                        const rawPath = this.cleanPath(item.url);

                        try {
                            const fileData = await IpcService.invoke<{ data: Uint8Array; mimeType: string } | null>(
                                'read-file-data',
                                rawPath
                            );

                            if (fileData?.data) {
                                const uint8 = new Uint8Array(fileData.data);
                                const blob = new Blob([uint8], { type: fileData.mimeType });
                                const hash = await sha256(blob);

                                if (targetId) {
                                    const mimeType = await this.detectMimeType(blob, item.name);
                                    await db.backgrounds.put({
                                        id: targetId,
                                        name: item.name,
                                        data: blob,
                                        mimeType
                                    });
                                    if (mimeType.startsWith('audio/') || ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'].some(e => item.name.toLowerCase().endsWith(e))) {
                                        let localAudioPath = rawPath;
                                        if (IpcService.isElectron()) {
                                            const saved = await IpcService.invoke<string>('media:save-audio-blob', {
                                                hash,
                                                ext: item.name.split('.').pop() || 'mp3',
                                                buffer: fileData.data
                                            });
                                            if (saved) localAudioPath = saved;
                                        }

                                        await db.mediaPool.put({
                                            id: hash,
                                            name: item.name,
                                            path: localAudioPath,
                                            type: 'audio',
                                            createdAt: Date.now()
                                        });
                                        if (targetId !== hash) {
                                            await db.mediaPool.put({
                                                id: targetId,
                                                name: item.name,
                                                path: localAudioPath,
                                                type: 'audio',
                                                createdAt: Date.now()
                                            });
                                        }

                                        // Connect audioScopes and set valid volume
                                        for (const scp of allScopes) {
                                            if (scp.fileName?.toLowerCase() === item.name.toLowerCase() || scp.fileId === targetId) {
                                                await db.audioScopes.update(scp.id, {
                                                    fileId: hash,
                                                    volume: (scp.volume === 0 || scp.volume === undefined) ? 1.0 : scp.volume
                                                });
                                            }
                                        }
                                    }
                                    missingIds.delete(targetId);
                                    missingFileNames.delete(item.name.toLowerCase());
                                    restoredCount++;
                                }
                            }
                        } catch (readErr) {
                            console.warn(`[RestoreMedia] Failed reading ${rawPath}:`, readErr);
                        }
                    }
                }
            } catch (scanErr) {
                console.warn(`[RestoreMedia] Could not scan ${dir} for media:`, scanErr);
            }
        }

        // ─── STEP 3: Scan PPTX Presentation Archives ─────────────────────────────
        for (const dir of searchDirs) {
            if (missingIds.size === 0) break;
            onProgress?.(`Проверка презентаций PPTX в ${dir.split('/').pop()}...`, restoredCount, totalToFind);

            try {
                const pptxFiles = await IpcService.invoke<{ id: string; name: string; url: string }[]>(
                    'read-directory-recursive',
                    dir,
                    ['.pptx']
                );

                if (Array.isArray(pptxFiles)) {
                    for (const pf of pptxFiles) {
                        if (missingIds.size === 0) break;
                        if (pf.name.startsWith('~$')) continue;

                        const filePath = this.cleanPath(pf.url);
                        const fileData = await IpcService.invoke<{ data: Uint8Array } | null>('read-file-data', filePath);
                        if (!fileData?.data) continue;

                        try {
                            const zip = await JSZip.loadAsync(fileData.data);
                            const mediaEntries = zip.filter(p => p.startsWith('ppt/media/') && !p.endsWith('/'));

                            for (const entry of mediaEntries) {
                                if (missingIds.size === 0) break;
                                const blob = await entry.async('blob');
                                const hash = await sha256(blob);
                                const filename = entry.name.split('/').pop() || 'slide-image';
                                const baseName = filename.replace(/\.[^/.]+$/, '');

                                const candidates = [hash, baseName, filename];
                                for (const candidate of candidates) {
                                    if (missingIds.has(candidate)) {
                                        const mimeType = await this.detectMimeType(blob, filename);
                                        await db.backgrounds.put({
                                            id: candidate,
                                            name: filename,
                                            data: blob,
                                            mimeType
                                        });
                                        missingIds.delete(candidate);
                                        restoredCount++;
                                    }
                                }
                            }
                        } catch (pptxErr) {
                            console.warn(`[RestoreMedia] Failed reading PPTX ${filePath}:`, pptxErr);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[RestoreMedia] Could not scan ${dir} for PPTX:`, err);
            }
        }

        // 4. Invalidate media cache to trigger instant UI re-render on active screens
        mediaCache.clear();
        onProgress?.('Восстановление завершено!', restoredCount, totalToFind);

        return {
            restored: restoredCount,
            missing: missingIds.size
        };
    }
}
