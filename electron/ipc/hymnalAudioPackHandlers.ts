import { dialog, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { isMrtaContainer, decryptMrtaToZip } from './mrtaCrypto';
import {
    HymnalAudioVariant,
    DownloadPartSpec,
    getAudioRootDir,
    sanitizeId,
    normalizeVariant,
    resolvePackKey,
    parsePackDirName,
    hasTrackInDir,
    computeDirStats,
    extractZipStreaming,
    checkFreeDiskSpace,
    computeFileSha256,
    downloadRemoteFile,
} from './hymnalAudioPackUtils';

export type { HymnalAudioVariant };

export interface InstalledAudioPackInfo {
    hymnalId: string;
    variant: HymnalAudioVariant;
    packKey: string;
    version: number;
    trackCount: number;
    bytesOnDisk: number;
    installedAt?: string;
}

export interface AudioPackProgressEvent {
    hymnalId: string;
    variant: HymnalAudioVariant;
    packKey: string;
    phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error' | 'canceled';
    percent: number;
    bytesReceived: number;
    totalBytes: number;
    speedBytesPerSec?: number;
    error?: string;
}

const activeDownloads = new Map<string, AbortController>();

function emitProgress(getMainWindow: () => BrowserWindow | null, payload: AudioPackProgressEvent): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.send('hymnal-audio:progress', payload);
    }
}

async function installArchivesAtomically(
    hymnalId: string,
    archivePaths: string[],
    version: number,
    getMainWindow: () => BrowserWindow | null,
    variant: HymnalAudioVariant = 'minus'
): Promise<{ success: boolean; info?: InstalledAudioPackInfo; error?: string }> {
    const safeId = sanitizeId(hymnalId);
    const packKey = resolvePackKey(safeId, variant);
    const rootDir = getAudioRootDir();
    const tmpDir = path.join(rootDir, `${packKey}.tmp-${Date.now()}`);
    const finalDir = path.join(rootDir, packKey);
    const backupDir = path.join(rootDir, `${packKey}.bak-${Date.now()}`);
    const decryptedTmpPaths: string[] = [];

    try {
        emitProgress(getMainWindow, {
            hymnalId: safeId,
            variant,
            packKey,
            phase: 'extracting',
            percent: 95,
            bytesReceived: 0,
            totalBytes: 0,
        });

        for (let i = 0; i < archivePaths.length; i++) {
            const archivePath = archivePaths[i];
            let zipToExtract = archivePath;
            if (await isMrtaContainer(archivePath)) {
                const decPath = path.join(rootDir, `${packKey}.dec-${Date.now()}-${i}.zip`);
                decryptedTmpPaths.push(decPath);
                await decryptMrtaToZip(archivePath, decPath);
                zipToExtract = decPath;
            }
            await extractZipStreaming(zipToExtract, tmpDir);
        }

        const { bytes, oggCount } = await computeDirStats(tmpDir);
        if (oggCount === 0) {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
            return { success: false, error: 'Archive contains no audio files (.ogg/.mp3)' };
        }

        const meta = {
            hymnalId: safeId,
            variant,
            packKey,
            version,
            trackCount: oggCount,
            installedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(path.join(tmpDir, 'pack-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

        if (fs.existsSync(finalDir)) {
            await fs.promises.rename(finalDir, backupDir);
        }
        await fs.promises.rename(tmpDir, finalDir);
        if (fs.existsSync(backupDir)) {
            await fs.promises.rm(backupDir, { recursive: true, force: true }).catch(() => {});
        }

        const info: InstalledAudioPackInfo = {
            hymnalId: safeId,
            variant,
            packKey,
            version,
            trackCount: oggCount,
            bytesOnDisk: bytes,
            installedAt: meta.installedAt,
        };
        emitProgress(getMainWindow, {
            hymnalId: safeId,
            variant,
            packKey,
            phase: 'done',
            percent: 100,
            bytesReceived: bytes,
            totalBytes: bytes,
        });
        return { success: true, info };
    } catch (err) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        if (!fs.existsSync(finalDir) && fs.existsSync(backupDir)) {
            await fs.promises.rename(backupDir, finalDir).catch(() => {});
        }
        const message = err instanceof Error ? err.message : String(err);
        emitProgress(getMainWindow, {
            hymnalId: safeId,
            variant,
            packKey,
            phase: 'error',
            percent: 0,
            bytesReceived: 0,
            totalBytes: 0,
            error: message,
        });
        return { success: false, error: message };
    } finally {
        for (const p of decryptedTmpPaths) {
            await fs.promises.unlink(p).catch(() => {});
        }
    }
}

export function registerHymnalAudioPackHandlers(getMainWindow: () => BrowserWindow | null): void {
    ipcMain.handle('hymnal-audio:list-installed', async (): Promise<InstalledAudioPackInfo[]> => {
        try {
            const rootDir = getAudioRootDir();
            const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
            const result: InstalledAudioPackInfo[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.includes('.tmp-') || entry.name.includes('.bak-')) continue;
                const dirPath = path.join(rootDir, entry.name);
                const { bytes, oggCount } = await computeDirStats(dirPath);
                if (oggCount === 0) continue;

                const parsed = parsePackDirName(entry.name);
                let version = 1;
                let installedAt: string | undefined;
                const metaPath = path.join(dirPath, 'pack-meta.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
                        if (typeof meta.version === 'number') version = meta.version;
                        if (typeof meta.installedAt === 'string') installedAt = meta.installedAt;
                    } catch { /* ignore malformed meta */ }
                }

                result.push({
                    hymnalId: parsed.hymnalId,
                    variant: parsed.variant,
                    packKey: parsed.packKey,
                    version,
                    trackCount: oggCount,
                    bytesOnDisk: bytes,
                    installedAt,
                });
            }
            return result;
        } catch (err) {
            console.error('[IPC] hymnal-audio:list-installed error:', err);
            return [];
        }
    });

    ipcMain.handle('hymnal-audio:is-installed', async (_event, hymnalId: string, variant?: HymnalAudioVariant): Promise<boolean> => {
        try {
            const safeId = sanitizeId(hymnalId);
            if (!safeId) return false;
            const rootDir = getAudioRootDir();
            if (variant) {
                const { oggCount } = await computeDirStats(path.join(rootDir, resolvePackKey(safeId, normalizeVariant(variant))));
                return oggCount > 0;
            }
            const minusStats = await computeDirStats(path.join(rootDir, safeId));
            if (minusStats.oggCount > 0) return true;
            const plusStats = await computeDirStats(path.join(rootDir, `${safeId}__plus`));
            return plusStats.oggCount > 0;
        } catch {
            return false;
        }
    });

    ipcMain.handle('hymnal-audio:get-available-variants', async (
        _event,
        hymnalId: string,
        hymnNumber: number
    ): Promise<{ minus: boolean; plus: boolean }> => {
        try {
            const safeId = sanitizeId(hymnalId);
            if (!safeId || !Number.isFinite(hymnNumber)) return { minus: false, plus: false };
            const rootDir = getAudioRootDir();
            const minus = hasTrackInDir(path.join(rootDir, safeId), hymnNumber);
            const plus = hasTrackInDir(path.join(rootDir, `${safeId}__plus`), hymnNumber)
                || hasTrackInDir(path.join(rootDir, safeId, 'plus'), hymnNumber);
            return { minus, plus };
        } catch {
            return { minus: false, plus: false };
        }
    });

    ipcMain.handle('hymnal-audio:download-pack', async (
        _event,
        params: {
            hymnalId: string;
            variant?: HymnalAudioVariant;
            url?: string;
            version?: number;
            expectedSha256?: string;
            expectedBytes?: number;
            parts?: DownloadPartSpec[];
        }
    ) => {
        const safeId = sanitizeId(params.hymnalId);
        const variant = normalizeVariant(params.variant);
        const packKey = resolvePackKey(safeId, variant);
        const parts: DownloadPartSpec[] = (params.parts && params.parts.length > 0)
            ? params.parts
            : (params.url ? [{ url: params.url, sha256: params.expectedSha256, sizeBytes: params.expectedBytes }] : []);

        if (!safeId || parts.length === 0) return { success: false, error: 'Invalid parameters' };
        if (activeDownloads.has(packKey)) return { success: false, error: 'Download already in progress' };

        const rootDir = getAudioRootDir();
        const totalExpectedBytes = parts.reduce((sum, p) => sum + (p.sizeBytes || 0), 0) || params.expectedBytes || 0;
        const requiredBytes = Math.max(totalExpectedBytes || 550 * 1024 * 1024, 50 * 1024 * 1024) * 2;
        const space = await checkFreeDiskSpace(rootDir, requiredBytes);
        if (!space.ok) {
            const needGb = (requiredBytes / (1024 * 1024 * 1024)).toFixed(1);
            return { success: false, error: `Insufficient disk space (need ~${needGb} GB free)` };
        }

        const partFiles: string[] = [];
        const controller = new AbortController();
        activeDownloads.set(packKey, controller);

        try {
            let totalBytes = totalExpectedBytes;
            let bytesReceived = 0;
            let lastEmit = Date.now();
            let lastEmitBytes = 0;

            const emitDownloadProgress = () => {
                const now = Date.now();
                const dtMs = now - lastEmit;
                if (dtMs >= 200) {
                    const speedBytesPerSec = Math.round(((bytesReceived - lastEmitBytes) * 1000) / Math.max(1, dtMs));
                    lastEmit = now;
                    lastEmitBytes = bytesReceived;
                    const percent = totalBytes > 0 ? Math.min(90, Math.round((bytesReceived / totalBytes) * 90)) : 0;
                    emitProgress(getMainWindow, {
                        hymnalId: safeId,
                        variant,
                        packKey,
                        phase: 'downloading',
                        percent,
                        bytesReceived,
                        totalBytes,
                        speedBytesPerSec,
                    });
                }
            };

            for (let i = 0; i < parts.length; i++) {
                const spec = parts[i];
                const partPath = path.join(rootDir, `${packKey}.part${i + 1}.mrta.part`);
                partFiles.push(partPath);
                await downloadRemoteFile(
                    spec.url,
                    partPath,
                    spec.sizeBytes || 0,
                    controller.signal,
                    (delta, resolvedSize) => {
                        if (resolvedSize && parts.length === 1 && resolvedSize > totalBytes) {
                            totalBytes = resolvedSize;
                        }
                        bytesReceived += delta;
                        emitDownloadProgress();
                    }
                );

                if (spec.sha256) {
                    emitProgress(getMainWindow, {
                        hymnalId: safeId,
                        variant,
                        packKey,
                        phase: 'verifying',
                        percent: Math.min(94, 90 + Math.round(((i + 1) / parts.length) * 4)),
                        bytesReceived,
                        totalBytes,
                    });
                    const actualSha = await computeFileSha256(partPath);
                    if (actualSha.toLowerCase() !== spec.sha256.toLowerCase()) {
                        throw new Error(`Checksum mismatch on part ${i + 1} (archive corrupted during download)`);
                    }
                }
            }

            return await installArchivesAtomically(safeId, partFiles, params.version ?? 1, getMainWindow, variant);
        } catch (err) {
            const isAbort = err instanceof Error && err.name === 'AbortError';
            const message = isAbort ? 'Canceled' : (err instanceof Error ? err.message : String(err));
            emitProgress(getMainWindow, {
                hymnalId: safeId,
                variant,
                packKey,
                phase: isAbort ? 'canceled' : 'error',
                percent: 0,
                bytesReceived: 0,
                totalBytes: 0,
                error: isAbort ? undefined : message,
            });
            return { success: false, canceled: isAbort, error: isAbort ? undefined : message };
        } finally {
            activeDownloads.delete(packKey);
            for (const pf of partFiles) {
                await fs.promises.unlink(pf).catch(() => {});
            }
        }
    });

    ipcMain.handle('hymnal-audio:cancel-download', (_event, hymnalId: string, variant?: HymnalAudioVariant) => {
        const safeId = sanitizeId(hymnalId);
        const packKey = resolvePackKey(safeId, normalizeVariant(variant));
        const controller = activeDownloads.get(packKey);
        if (controller) {
            controller.abort();
            return true;
        }
        return false;
    });

    ipcMain.handle('hymnal-audio:install-from-file', async (
        _event,
        hymnalId: string,
        version: number = 1,
        variant?: HymnalAudioVariant
    ) => {
        const safeId = sanitizeId(hymnalId);
        if (!safeId) return { success: false, error: 'Invalid hymnalId' };
        const normVariant = normalizeVariant(variant);

        const win = getMainWindow();
        const picked = await dialog.showOpenDialog(win!, {
            title: normVariant === 'plus'
                ? 'Выберите пакет плюсовок (.mrta / .zip)'
                : 'Выберите пакет минусовок (.mrta / .zip)',
            filters: [{ name: 'Mirato Audio Pack', extensions: ['mrta', 'zip'] }],
            properties: ['openFile', 'multiSelections'],
        });
        if (picked.canceled || picked.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        let totalSize = 0;
        for (const fp of picked.filePaths) {
            const st = await fs.promises.stat(fp);
            totalSize += st.size;
        }
        const space = await checkFreeDiskSpace(getAudioRootDir(), totalSize * 1.2);
        if (!space.ok) {
            return { success: false, error: 'Insufficient disk space to extract audio pack' };
        }

        return await installArchivesAtomically(safeId, picked.filePaths, version, getMainWindow, normVariant);
    });

    ipcMain.handle('hymnal-audio:remove-pack', async (_event, hymnalId: string, variant?: HymnalAudioVariant) => {
        try {
            const safeId = sanitizeId(hymnalId);
            if (!safeId) return { success: false };
            const packKey = resolvePackKey(safeId, normalizeVariant(variant));
            const dirPath = path.join(getAudioRootDir(), packKey);
            if (fs.existsSync(dirPath)) {
                await fs.promises.rm(dirPath, { recursive: true, force: true });
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
}
