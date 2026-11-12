import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRemoteCastListener } from './useRemoteCastListener';
import { IpcService } from '@/core/services/ipcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useRelayStore } from '@/core/store/relayStore';
import { db } from '@/core/db';
import { IPresentationFile } from '@/core/types';

vi.mock('@/core/db', () => ({
    db: {
        presentationFiles: {
            put: vi.fn().mockResolvedValue('pres-1'),
            get: vi.fn(),
            update: vi.fn(),
            add: vi.fn(),
            toArray: vi.fn().mockResolvedValue([]),
        },
        serviceFiles: {
            get: vi.fn(),
            update: vi.fn(),
            add: vi.fn(),
            toArray: vi.fn().mockResolvedValue([]),
        }
    }
}));

describe('useRemoteCastListener', () => {
    const listeners: Record<string, (payload?: any, ...args: any[]) => void> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        useRelayStore.getState().reset();
        usePresentationStore.setState({
            activePresentation: null,
            activePresentationId: null,
            liveSlideId: null,
            previewSlideId: null
        });

        vi.spyOn(IpcService, 'isElectron').mockReturnValue(true);
        vi.spyOn(IpcService, 'on').mockImplementation((channel: string, callback: any) => {
            listeners[channel] = callback;
            return () => {
                delete listeners[channel];
            };
        });
        vi.spyOn(LiveSyncService, 'showAppMode').mockImplementation(vi.fn());
        vi.spyOn(LiveSyncService, 'showSlide').mockImplementation(vi.fn());
        vi.spyOn(LiveSyncService, 'clear').mockImplementation(vi.fn());
    });

    it('registers IPC listeners when in electron', () => {
        const openProjector = vi.fn();
        const { unmount } = renderHook(() => useRemoteCastListener(openProjector));

        expect(listeners['remote:speaker-connected']).toBeDefined();
        expect(listeners['remote:client-disconnected']).toBeDefined();
        expect(listeners['remote:set-privacy']).toBeDefined();
        expect(listeners['remote:command-received']).toBeDefined();

        unmount();
        expect(listeners['remote:speaker-connected']).toBeUndefined();
    });

    it('handles remote:set-privacy event', () => {
        const openProjector = vi.fn();
        renderHook(() => useRemoteCastListener(openProjector));

        listeners['remote:set-privacy'](true);
        expect(useRelayStore.getState().isPrivacyActive).toBe(true);

        listeners['remote:set-privacy'](false);
        expect(useRelayStore.getState().isPrivacyActive).toBe(false);
    });

    it('handles CAST_PRESENTATION command with privacy mode', async () => {
        const openProjector = vi.fn().mockResolvedValue(true);
        renderHook(() => useRemoteCastListener(openProjector));

        const mockPres: IPresentationFile = {
            id: 'p-cast-1',
            name: 'Speaker Sermon',
            isMaster: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastOpened: new Date(),
            slides: [
                { id: 's1', content: 'Slide 1' } as any,
                { id: 's2', content: 'Slide 2' } as any
            ]
        };

        (db.presentationFiles.get as any).mockResolvedValue(mockPres);

        await listeners['remote:command-received']('CAST_PRESENTATION', {
            presentation: mockPres,
            startSlideIndex: 0,
            isPrivacy: true
        });

        expect(db.presentationFiles.put).toHaveBeenCalledWith(mockPres);
        expect(useRelayStore.getState().isPrivacyActive).toBe(true);
        expect(useRelayStore.getState().streamMode).toBe('slide');
        expect(usePresentationStore.getState().activePresentationId).toBe('p-cast-1');
        expect(usePresentationStore.getState().liveSlideId).toBe('s1');
        expect(openProjector).toHaveBeenCalled();
        expect(LiveSyncService.showSlide).toHaveBeenCalledWith(mockPres.slides[0], 'p-cast-1');
    });

    it('handles CAST_STOP command', async () => {
        const openProjector = vi.fn();
        renderHook(() => useRemoteCastListener(openProjector));

        useRelayStore.getState().setPrivacyMode(true);
        usePresentationStore.setState({ liveSlideId: 's1' });

        await listeners['remote:command-received']('CAST_STOP');

        expect(useRelayStore.getState().isPrivacyActive).toBe(false);
        expect(useRelayStore.getState().streamMode).toBe('idle');
        expect(usePresentationStore.getState().liveSlideId).toBeNull();
        expect(LiveSyncService.clear).toHaveBeenCalled();
    });

    it('handles remote:projector-command by opening projector and setting stream mode', async () => {
        const openProjector = vi.fn().mockResolvedValue(true);
        renderHook(() => useRemoteCastListener(openProjector));

        await listeners['remote:projector-command']('show-slide', { slide: { id: 's-live-1' } });

        expect(openProjector).toHaveBeenCalled();
        expect(useRelayStore.getState().streamMode).toBe('slide');
    });
});
