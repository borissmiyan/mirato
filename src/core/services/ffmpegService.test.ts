import { describe, it, expect, vi } from 'vitest';
import { ffmpegService } from './ffmpegService';
import { db } from '../db';

describe('FFmpegService', () => {
    it('defines generateProxy and generateProxyById methods', () => {
        expect(ffmpegService.generateProxy).toBeDefined();
        expect(ffmpegService.generateProxyById).toBeDefined();
    });

    it('returns null from generateProxyById when media is not found', async () => {
        vi.spyOn(db.backgrounds, 'get').mockResolvedValue(undefined);
        vi.spyOn(db.mediaPool, 'get').mockResolvedValue(undefined);

        const result = await ffmpegService.generateProxyById('non-existent-id');
        expect(result).toBeNull();
    });
});
