import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelayTransmitterService } from './RelayTransmitterService';
import { useRelayStore } from '@/core/store/relayStore';

describe('RelayTransmitterService', () => {
    let mockWs: any;
    let service: RelayTransmitterService;

    beforeEach(() => {
        vi.useFakeTimers();
        useRelayStore.getState().reset();

        mockWs = {
            readyState: 1, // WebSocket.OPEN
            send: vi.fn(),
            close: vi.fn(),
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
        };

        const MockWebSocket = vi.fn(function (this: any, url: string) {
            return mockWs;
        });
        (MockWebSocket as any).OPEN = 1;
        (MockWebSocket as any).CLOSED = 3;
        (global as any).WebSocket = MockWebSocket;

        service = RelayTransmitterService.getInstance();
    });

    afterEach(() => {
        service.disconnect();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('returns a singleton instance', () => {
        const instance1 = RelayTransmitterService.getInstance();
        const instance2 = RelayTransmitterService.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('connects and sends AUTH payload on socket open', async () => {
        const connectPromise = service.connect('192.168.1.50', '4321');

        expect((global as any).WebSocket).toHaveBeenCalledWith('ws://192.168.1.50:3211');

        // Trigger open
        mockWs.onopen?.();

        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'AUTH',
            pin: '4321',
            role: 'transmitter',
            speakerName: 'Спикер на сцене'
        }));

        // Simulate AUTH_SUCCESS response
        mockWs.onmessage?.({
            data: JSON.stringify({ type: 'AUTH_SUCCESS', token: 'token-123' })
        });

        const success = await connectPromise;
        expect(success).toBe(true);
        expect(service.getIsConnected()).toBe(true);
        expect(useRelayStore.getState().isTransmitterConnected).toBe(true);
        expect(useRelayStore.getState().transmitterHost).toBe('192.168.1.50');
    });

    it('handles AUTH_ERROR and sets state to disconnected', async () => {
        const connectPromise = service.connect('192.168.1.50', '0000');
        mockWs.onopen?.();

        // Simulate AUTH_ERROR response
        mockWs.onmessage?.({
            data: JSON.stringify({ type: 'AUTH_ERROR', message: 'Неверный PIN-код' })
        });

        const success = await connectPromise;
        expect(success).toBe(false);
        expect(service.getIsConnected()).toBe(false);
        expect(useRelayStore.getState().isTransmitterConnected).toBe(false);
    });

    it('sends projector commands when connected', async () => {
        const connectPromise = service.connect('127.0.0.1', '1111');
        mockWs.onopen?.();
        mockWs.onmessage?.({ data: JSON.stringify({ type: 'AUTH_SUCCESS' }) });
        await connectPromise;

        service.sendProjectorCommand('show-slide', { slideId: 'slide-123' });

        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'PROJECTOR_COMMAND',
            command: 'show-slide',
            payload: { slideId: 'slide-123' }
        }));
    });

    it('sends privacy updates over socket', async () => {
        const connectPromise = service.connect('127.0.0.1', '1111');
        mockWs.onopen?.();
        mockWs.onmessage?.({ data: JSON.stringify({ type: 'AUTH_SUCCESS' }) });
        await connectPromise;

        service.setPrivacy(true);

        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'SET_PRIVACY',
            active: true
        }));
    });

    it('disconnects and resets store connection state', async () => {
        const connectPromise = service.connect('127.0.0.1', '1111');
        mockWs.onopen?.();
        mockWs.onmessage?.({ data: JSON.stringify({ type: 'AUTH_SUCCESS' }) });
        await connectPromise;

        expect(service.getIsConnected()).toBe(true);

        service.disconnect();

        expect(service.getIsConnected()).toBe(false);
        expect(useRelayStore.getState().isTransmitterConnected).toBe(false);
        expect(mockWs.close).toHaveBeenCalled();
    });

    it('attempts auto-reconnection with backoff when socket closes unexpectedly', async () => {
        const connectPromise = service.connect('127.0.0.1', '5555');
        mockWs.onopen?.();
        mockWs.onmessage?.({ data: JSON.stringify({ type: 'AUTH_SUCCESS' }) });
        await connectPromise;

        expect(service.getIsConnected()).toBe(true);

        // Simulate unexpected network drop
        mockWs.onclose?.();

        expect(service.getIsConnected()).toBe(false);
        expect(useRelayStore.getState().isTransmitterConnected).toBe(false);

        // Advance timers by backoff delay (1000ms)
        vi.advanceTimersByTime(1000);

        // Verify WebSocket was instantiated again for reconnection
        expect((global as any).WebSocket).toHaveBeenCalledTimes(2);
    });
});
