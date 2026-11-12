import path from 'path';
import fs from 'fs';
import electron from 'electron';

export const MIGRATION_MARKER_FILE = '.migrated_from_ekklesienter.json';

// In Electron runtime, electron.app provides app paths. In test/mock environments, options can be supplied directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronApp = typeof electron === 'object' && electron && 'app' in electron ? (electron as any).app : null;

export interface MigrationOptions {
    sourceUserDataDir?: string;
    targetUserDataDir?: string;
}

export interface MigrationResult {
    migrated: boolean;
    reason: 'already_migrated' | 'source_not_found' | 'success' | 'error';
    copiedFilesCount: number;
    copiedBytes: number;
    error?: string;
}

/**
 * Safely copies a single file using APFS copy-on-write clone if available,
 * falling back gracefully to standard byte-by-byte copy.
 */
function safeCopyFileSync(src: string, dest: string): number {
    const stat = fs.statSync(src);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    try {
        // Try APFS / Btrfs copy-on-write clone first (instantaneous, 0 extra disk bytes)
        fs.copyFileSync(src, dest, fs.constants.COPYFILE_FICLONE);
    } catch {
        // Fallback to standard copy for filesystems without clone support (NTFS, FAT32, ext4)
        fs.copyFileSync(src, dest);
    }

    return stat.size;
}

/**
 * Recursively copies all files from srcDir to destDir.
 */
function copyDirectoryRecursiveSync(srcDir: string, destDir: string): { count: number; bytes: number } {
    let count = 0;
    let bytes = 0;

    if (!fs.existsSync(srcDir)) return { count, bytes };

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            const sub = copyDirectoryRecursiveSync(srcPath, destPath);
            count += sub.count;
            bytes += sub.bytes;
        } else if (entry.isFile()) {
            // Only copy if destination doesn't exist or size is different
            let shouldCopy = true;
            if (fs.existsSync(destPath)) {
                try {
                    const srcStat = fs.statSync(srcPath);
                    const destStat = fs.statSync(destPath);
                    if (srcStat.size === destStat.size) {
                        shouldCopy = false;
                    }
                } catch {
                    shouldCopy = true;
                }
            }

            if (shouldCopy) {
                const b = safeCopyFileSync(srcPath, destPath);
                count++;
                bytes += b;
            }
        }
    }

    return { count, bytes };
}

/**
 * Counts total files in a directory recursively.
 */
function countFilesRecursive(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                count += countFilesRecursive(path.join(dir, entry.name));
            } else if (entry.isFile()) {
                count++;
            }
        }
    } catch {
        return 0;
    }
    return count;
}

/**
 * Migrates presentations, media files, hymnals, and settings from the legacy
 * Ekklesienter userData directory into the new Mirato userData directory.
 *
 * Runs synchronously before Chromium/BrowserWindow initializes IndexedDB.
 */
export function migrateFromEkklesienterIfNeeded(options?: MigrationOptions): MigrationResult {
    const targetDir = options?.targetUserDataDir || (electronApp?.getPath ? electronApp.getPath('userData') : '');
    const sourceDir = options?.sourceUserDataDir || (targetDir ? path.join(path.dirname(targetDir), 'ekklesienter') : '');

    if (!targetDir || !sourceDir) {
        return { migrated: false, reason: 'source_not_found', copiedFilesCount: 0, copiedBytes: 0 };
    }

    const markerPath = path.join(targetDir, MIGRATION_MARKER_FILE);
    if (fs.existsSync(markerPath)) {
        return { migrated: false, reason: 'already_migrated', copiedFilesCount: 0, copiedBytes: 0 };
    }

    if (!fs.existsSync(sourceDir)) {
        return { migrated: false, reason: 'source_not_found', copiedFilesCount: 0, copiedBytes: 0 };
    }

    console.log(`[Migration] Starting legacy migration from "${sourceDir}" to "${targetDir}"...`);

    let totalFiles = 0;
    let totalBytes = 0;

    try {
        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 1. IndexedDB Migration
        const srcIdb = path.join(sourceDir, 'IndexedDB');
        const targetIdb = path.join(targetDir, 'IndexedDB');
        if (fs.existsSync(srcIdb)) {
            const srcFilesCount = countFilesRecursive(srcIdb);
            const targetFilesCount = countFilesRecursive(targetIdb);

            // If target already has a small default seed (< 10 files) and source has real data (> 10 files)
            if (targetFilesCount > 0 && targetFilesCount < 10 && srcFilesCount > 10) {
                const backupTargetIdb = path.join(targetDir, 'IndexedDB_seed_bak');
                if (fs.existsSync(backupTargetIdb)) {
                    fs.rmSync(backupTargetIdb, { recursive: true, force: true });
                }
                fs.renameSync(targetIdb, backupTargetIdb);
                console.log(`[Migration] Backed up initial target seed (${targetFilesCount} files) to IndexedDB_seed_bak`);
            }

            const idbStats = copyDirectoryRecursiveSync(srcIdb, targetIdb);
            totalFiles += idbStats.count;
            totalBytes += idbStats.bytes;
            console.log(`[Migration] Copied IndexedDB: ${idbStats.count} files (${(idbStats.bytes / 1024 / 1024).toFixed(1)} MB)`);
        }

        // 2. Additional Essential Directories
        const directoriesToMigrate = [
            'blob_storage',
            'media',
            'Hymnals',
            'backups',
            'templates',
            'Local Storage'
        ];

        for (const dirName of directoriesToMigrate) {
            const srcPath = path.join(sourceDir, dirName);
            const destPath = path.join(targetDir, dirName);
            if (fs.existsSync(srcPath)) {
                const stats = copyDirectoryRecursiveSync(srcPath, destPath);
                totalFiles += stats.count;
                totalBytes += stats.bytes;
                if (stats.count > 0) {
                    console.log(`[Migration] Copied ${dirName}: ${stats.count} files (${(stats.bytes / 1024 / 1024).toFixed(1)} MB)`);
                }
            }
        }

        // 3. Write completion marker only after all files are copied
        const markerData = {
            completedAt: new Date().toISOString(),
            sourceDir,
            targetDir,
            copiedFilesCount: totalFiles,
            copiedBytes: totalBytes,
            version: 1
        };
        fs.writeFileSync(markerPath, JSON.stringify(markerData, null, 2), 'utf-8');

        console.log(`[Migration] Successfully migrated ${totalFiles} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB) from Ekklesienter to Mirato.`);
        return {
            migrated: true,
            reason: 'success',
            copiedFilesCount: totalFiles,
            copiedBytes: totalBytes
        };
    } catch (err) {
        console.error('[Migration] Failed to migrate from Ekklesienter:', err);
        return {
            migrated: false,
            reason: 'error',
            copiedFilesCount: totalFiles,
            copiedBytes: totalBytes,
            error: String(err)
        };
    }
}
