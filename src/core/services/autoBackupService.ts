import { db } from '@/core/db';
import { IpcService } from '@/core/services/ipcService';

const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Service to automatically create periodic disaster recovery snapshots of critical IndexedDB tables.
 * Backups are saved to the user's local application data folder (userData/backups/).
 */
export class AutoBackupService {
    private static isRunning = false;

    public static async runScheduledBackup(): Promise<boolean> {
        if (!IpcService.isElectron() || this.isRunning) return false;

        try {
            const lastBackupSetting = await db.settings.get('last_auto_backup_time');
            const lastBackupTime = typeof lastBackupSetting?.value === 'number' ? lastBackupSetting.value : 0;
            const now = Date.now();

            if (now - lastBackupTime < BACKUP_INTERVAL_MS) {
                return false;
            }

            this.isRunning = true;
            return await this.createSnapshot();
        } catch (err) {
            console.warn('[AutoBackupService] Scheduled backup check failed:', err);
            return false;
        } finally {
            this.isRunning = false;
        }
    }

    public static async createSnapshot(): Promise<boolean> {
        if (!IpcService.isElectron()) return false;

        try {
            const [
                services,
                presentations,
                templates,
                logos,
                settings,
                hymnThemes,
                hymnMap
            ] = await Promise.all([
                db.serviceFiles.toArray(),
                db.presentationFiles.toArray(),
                db.templates.toArray(),
                db.logos.toArray(),
                db.settings.toArray(),
                db.hymnThemes.toArray(),
                db.hymnStableIdMap.toArray(),
            ]);

            const payload = {
                version: '2.0',
                createdAt: new Date().toISOString(),
                tables: {
                    serviceFiles: services,
                    presentationFiles: presentations,
                    templates,
                    logos,
                    settings,
                    hymnThemes,
                    hymnStableIdMap: hymnMap
                }
            };

            const json = JSON.stringify(payload);
            const result = await IpcService.invoke<{ success: boolean; path?: string }>('backup:save-snapshot', json);

            if (result?.success) {
                await db.settings.put({ key: 'last_auto_backup_time', value: Date.now() });
                console.log('[AutoBackupService] Backup successfully created at:', result.path);
                return true;
            }

            return false;
        } catch (err) {
            console.error('[AutoBackupService] Backup creation failed:', err);
            return false;
        }
    }
}

