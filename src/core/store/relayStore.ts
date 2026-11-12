import { create } from 'zustand';
// audit-ignore: relay controller delegating to presenter service
import { PresenterService } from '@/features/presenter/services/presenterService';

export interface ConnectedSpeaker {
    name?: string;
    ip?: string;
    connectedAt?: number;
}

export type RelayStreamMode = 'idle' | 'slide' | 'screen-webrtc';

export interface RelayState {
    // Receiver State (ПК у пушки)
    isReceiverActive: boolean;
    pin: string;
    receiverIp?: string;
    receiverPort?: number;
    connectedSpeaker: ConnectedSpeaker | null;
    isPrivacyActive: boolean;
    streamMode: RelayStreamMode;

    // Transmitter State (ПК Спикера)
    isTransmitterConnected: boolean;
    transmitterHost?: string;
    isSharingScreen: boolean;
    activeScreenSourceId: string | null;

    // Actions
    startReceiver: (pin: string, ip?: string, port?: number) => void;
    stopReceiver: () => void;
    setSpeakerConnected: (speaker: ConnectedSpeaker | null) => void;
    setPrivacyMode: (privacy: boolean) => void;
    setStreamMode: (mode: RelayStreamMode) => void;
    setTransmitterConnected: (connected: boolean, host?: string) => void;
    setScreenSharing: (sharing: boolean, sourceId?: string | null) => void;
    reset: () => void;
}

export const useRelayStore = create<RelayState>((set) => ({
    isReceiverActive: false,
    pin: '',
    receiverIp: undefined,
    receiverPort: undefined,
    connectedSpeaker: null,
    isPrivacyActive: false,
    streamMode: 'idle',

    isTransmitterConnected: false,
    transmitterHost: undefined,
    isSharingScreen: false,
    activeScreenSourceId: null,

    startReceiver: (pin: string, ip?: string, port?: number) => {
        try {
            PresenterService.sendCommand({
                type: 'set-relay-pin',
                payload: { pin, ip, port }
            });
        } catch {}
        set({
            isReceiverActive: true,
            pin,
            receiverIp: ip,
            receiverPort: port,
            streamMode: 'idle'
        });
    },

    stopReceiver: () => {
        try {
            PresenterService.sendCommand({
                type: 'set-relay-pin',
                payload: { pin: '' }
            });
        } catch {}
        set({
            isReceiverActive: false,
            pin: '',
            connectedSpeaker: null,
            isPrivacyActive: false,
            streamMode: 'idle'
        });
    },

    setSpeakerConnected: (speaker) => set({
        connectedSpeaker: speaker
    }),

    setPrivacyMode: (isPrivacyActive) => set({
        isPrivacyActive
    }),

    setStreamMode: (streamMode) => set({
        streamMode
    }),

    setTransmitterConnected: (isTransmitterConnected, transmitterHost) => set({
        isTransmitterConnected,
        transmitterHost: isTransmitterConnected ? transmitterHost : undefined
    }),

    setScreenSharing: (isSharingScreen, activeScreenSourceId = null) => set({
        isSharingScreen,
        activeScreenSourceId: isSharingScreen ? activeScreenSourceId : null,
        streamMode: isSharingScreen ? 'screen-webrtc' : 'slide'
    }),

    reset: () => set({
        isReceiverActive: false,
        pin: '',
        receiverIp: undefined,
        receiverPort: undefined,
        connectedSpeaker: null,
        isPrivacyActive: false,
        streamMode: 'idle',
        isTransmitterConnected: false,
        transmitterHost: undefined,
        isSharingScreen: false,
        activeScreenSourceId: null
    })
}));
