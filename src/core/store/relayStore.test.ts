import { describe, it, expect, beforeEach } from 'vitest';
import { useRelayStore } from './relayStore';

describe('RelayStore', () => {
    beforeEach(() => {
        useRelayStore.setState({
            isReceiverActive: false,
            pin: '',
            connectedSpeaker: null,
            isPrivacyActive: false,
            streamMode: 'idle',
            isTransmitterConnected: false
        });
    });

    it('initializes with default idle state', () => {
        const state = useRelayStore.getState();
        expect(state.isReceiverActive).toBe(false);
        expect(state.pin).toBe('');
        expect(state.connectedSpeaker).toBeNull();
        expect(state.isPrivacyActive).toBe(false);
    });

    it('starts receiver session with generated PIN', () => {
        useRelayStore.getState().startReceiver('4821');
        const state = useRelayStore.getState();
        expect(state.isReceiverActive).toBe(true);
        expect(state.pin).toBe('4821');
    });

    it('stops receiver session and clears connection', () => {
        useRelayStore.getState().startReceiver('4821');
        useRelayStore.getState().setSpeakerConnected({ name: 'MacBook Preacher', ip: '192.168.1.50' });
        useRelayStore.getState().stopReceiver();

        const state = useRelayStore.getState();
        expect(state.isReceiverActive).toBe(false);
        expect(state.pin).toBe('');
        expect(state.connectedSpeaker).toBeNull();
        expect(state.isPrivacyActive).toBe(false);
    });

    it('updates privacy mode remotely', () => {
        useRelayStore.getState().setPrivacyMode(true);
        expect(useRelayStore.getState().isPrivacyActive).toBe(true);

        useRelayStore.getState().setPrivacyMode(false);
        expect(useRelayStore.getState().isPrivacyActive).toBe(false);
    });
});
