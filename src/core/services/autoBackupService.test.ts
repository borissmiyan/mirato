import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoBackupService } from './autoBackupService';
import { IpcService } from './ipcService';

vi.mock('@/core/db', () => ({
    db: {
        serviceFiles: { toArray: vi.fn().mockResolvedValue([{ id: 's1' }]) },
        presentationFiles: { toArray: vi.fn().mockResolvedValue([{ id: 'p1' }]) },
        templates: { toArray: vi.fn().mockResolvedValue([]) },
        logos: { toArray: vi.fn().mockResolvedValue([]) },
        settings: {
            toArray: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(1)
        },
        hymnThemes: { toArray: vi.fn().mockResolvedValue([]) },
        hymnStableIdMap: { toArray: vi.fn().mockResolvedValue([]) },
    }
}));

describe('AutoBackupService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when not running in Electron', async () => {
        vi.spyOn(IpcService, 'isElectron').mockReturnValue(false);
        const result = await AutoBackupService.createSnapshot();
        expect(result).toBe(false);
    });

    it('creates snapshot and invokes IPC in Electron', async () => {
        vi.spyOn(IpcService, 'isElectron').mockReturnValue(true);
        const invokeSpy = vi.spyOn(IpcService, 'invoke').mockResolvedValue({ success: true, path: '/mock/backup.json' });

        const result = await AutoBackupService.createSnapshot();
        expect(result).toBe(true);
        expect(invokeSpy).toHaveBeenCalledWith('backup:save-snapshot', expect.any(String));
    });
});
