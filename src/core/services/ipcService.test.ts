import { describe, it, expect } from 'vitest';
import { ipcService } from './ipcService';

describe('ipcService renderer-main bridge', () => {
    it('should offer callback bindings safely', () => {
        expect(ipcService.on).toBeDefined();
    });

    it('should offer showItemInFolder safely', async () => {
        expect(ipcService.showItemInFolder).toBeDefined();
        (window.electron.ipcRenderer.invoke as any).mockResolvedValue(true);
        const res = await ipcService.showItemInFolder('/test/path');
        expect(res).toBe(true);
    });
});
