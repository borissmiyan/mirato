import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Cast, Monitor, Tv, X } from 'lucide-react';
import { useRelayStore, ConnectedSpeaker } from '@/core/store/relayStore';
import { ScreenCaptureService, DesktopCaptureSource } from '@/core/services/ScreenCaptureService';
import { useRemoteSocket } from '@/remote/hooks/useRemoteSocket';
import { WebRtcRelayService } from '@/core/services/WebRtcRelayService';
import { relayTransmitterService } from '@/core/services/RelayTransmitterService';
import { ReceiverTab } from './ReceiverTab';
import { TransmitterTab } from './TransmitterTab';
import { DeckCastTab } from './DeckCastTab';
import { WirelessRelaySidebar, RelayTabType } from './WirelessRelaySidebar';
import { IconButton } from '@/shared/ui/IconButton';

export interface WirelessRelayModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'receiver' | 'transmitter' | 'deck_cast' | 'screen_stream';
}

export const WirelessRelayModal: React.FC<WirelessRelayModalProps> = React.memo(({
    isOpen,
    onClose,
    initialTab = 'receiver'
}) => {
    const { t } = useTranslation();

    // Map initialTab to RelayTabType
    const resolveTab = (tab: string): RelayTabType => {
        if (tab === 'receiver') return 'receiver';
        return 'transmitter';
    };

    const [activeTab, setActiveTab] = useState<RelayTabType>(() => resolveTab(initialTab));

    // Store State
    const isReceiverActive = useRelayStore((s) => s.isReceiverActive);
    const pin = useRelayStore((s) => s.pin);
    const receiverIp = useRelayStore((s) => s.receiverIp);
    const connectedSpeaker = useRelayStore((s) => s.connectedSpeaker);
    const isPrivacyActive = useRelayStore((s) => s.isPrivacyActive);
    const isTransmitterConnected = useRelayStore((s) => s.isTransmitterConnected);
    const isSharingScreen = useRelayStore((s) => s.isSharingScreen);
    const startReceiver = useRelayStore((s) => s.startReceiver);
    const stopReceiver = useRelayStore((s) => s.stopReceiver);
    const setPrivacyMode = useRelayStore((s) => s.setPrivacyMode);
    const setScreenSharing = useRelayStore((s) => s.setScreenSharing);

    // Transmitter Local State & WebRTC Refs
    const [enteredPin, setEnteredPin] = useState('');
    const [receiverHost, setReceiverHost] = useState(() => {
        try {
            return localStorage.getItem('deck_ce_relay_host') || '127.0.0.1';
        } catch {
            return '127.0.0.1';
        }
    });
    const [discoveryState, setDiscoveryState] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
    const [sources, setSources] = useState<DesktopCaptureSource[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    const [isLoadingSources, setIsLoadingSources] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const webRtcSenderRef = useRef<WebRtcRelayService | null>(null);
    const activeStreamRef = useRef<MediaStream | null>(null);
    const wasConnectingRef = useRef(false);

    // Auto-discover receiver on local network via UDP broadcast & fast health check
    const handleDiscover = useCallback(async () => {
        setDiscoveryState('searching');

        if (window.electron?.ipcRenderer?.remote?.discoverReceiver) {
            try {
                const res = await window.electron.ipcRenderer.remote.discoverReceiver();
                if (res?.found && res?.ip) {
                    setReceiverHost(res.ip);
                    try { localStorage.setItem('deck_ce_relay_host', res.ip); } catch {}
                    setDiscoveryState('found');
                    return;
                }
            } catch (e) {
                console.warn('[AirDeck] UDP discovery error:', e);
            }
        }

        const candidates = Array.from(new Set([receiverHost, '127.0.0.1'].filter(Boolean)));
        for (const host of candidates) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 600);
                const resp = await fetch(`http://${host}:3211/airdeck/health`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.service === 'deck-ce-airdeck') {
                        setReceiverHost(host);
                        try { localStorage.setItem('deck_ce_relay_host', host); } catch {}
                        setDiscoveryState('found');
                        return;
                    }
                }
            } catch {}
        }

        setDiscoveryState('not_found');
    }, [receiverHost]);

    // Socket client for transmitter & Deck Cast
    const socket = useRemoteSocket({
        host: receiverHost || '127.0.0.1',
        role: 'transmitter',
        speakerName: 'Спикер на сцене',
        onSignal: (signal) => {
            webRtcSenderRef.current?.handleSignal(signal);
        },
        onPrivacyChange: (active) => {
            setPrivacyMode(active);
        }
    });

    // Reset connecting spinner on socket resolution
    useEffect(() => {
        if (socket.connected || socket.authError) {
            setIsConnecting(false);
        }
    }, [socket.connected, socket.authError]);

    // Auto-close modal on Speaker PC when transmitter connects to receiver
    useEffect(() => {
        if (!isOpen) return;
        if (wasConnectingRef.current && (isTransmitterConnected || socket.connected)) {
            wasConnectingRef.current = false;
            setIsConnecting(false);
            const timer = setTimeout(() => {
                onClose();
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isTransmitterConnected, socket.connected, onClose]);

    // Auto-close modal on Projector PC (Receiver) when speaker connects
    const previousSpeakerRef = useRef<ConnectedSpeaker | null>(null);
    useEffect(() => {
        if (!isOpen || activeTab !== 'receiver') {
            previousSpeakerRef.current = connectedSpeaker;
            return;
        }
        if (connectedSpeaker && !previousSpeakerRef.current) {
            previousSpeakerRef.current = connectedSpeaker;
            const timer = setTimeout(() => {
                onClose();
            }, 350);
            return () => clearTimeout(timer);
        }
        previousSpeakerRef.current = connectedSpeaker;
    }, [isOpen, activeTab, connectedSpeaker, onClose]);

    // Update active tab if initialTab changes
    useEffect(() => {
        if (isOpen) {
            setActiveTab(resolveTab(initialTab));
        }
    }, [isOpen, initialTab]);

    // Auto-discover receiver when modal is opened on transmitter tab
    useEffect(() => {
        if (isOpen && activeTab !== 'receiver') {
            handleDiscover();
        }
    }, [isOpen, activeTab, handleDiscover]);

    // Ensure receiver IP & PIN are in sync when modal opens on receiver tab
    useEffect(() => {
        if (isOpen && activeTab === 'receiver' && window.electron?.ipcRenderer?.remote) {
            window.electron.ipcRenderer.remote.getInfo().then((info) => {
                if (info?.success && info?.pin) {
                    startReceiver(info.pin, info.ip, info.port);
                }
            }).catch(() => {});
        }
    }, [isOpen, activeTab, startReceiver]);

    const handleRefreshSources = useCallback(() => {
        setIsLoadingSources(true);
        ScreenCaptureService.getSources()
            .then((res) => {
                setSources(res);
                setSelectedSourceId((prev) => (res.length > 0 && !prev ? res[0].id : prev));
            })
            .catch((err) => {
                console.error('[AirDeck] Failed to fetch sources:', err);
            })
            .finally(() => setIsLoadingSources(false));
    }, []);

    useEffect(() => {
        if (isOpen) {
            handleRefreshSources();
        }
    }, [isOpen, handleRefreshSources]);

    const handleToggleReceiver = useCallback(async () => {
        if (isReceiverActive) {
            if (window.electron?.ipcRenderer?.remote) {
                try {
                    await window.electron.ipcRenderer.remote.stop();
                } catch (e) {
                    console.error('Failed to stop remote via electron:', e);
                }
            }
            stopReceiver();
        } else {
            if (window.electron?.ipcRenderer?.remote) {
                try {
                    const info = await window.electron.ipcRenderer.remote.start();
                    if (info?.success) {
                        startReceiver(info.pin, info.ip, info.port);
                        return;
                    }
                } catch (e) {
                    console.error('Failed to start remote via electron:', e);
                }
            }
            const generated = Math.floor(1000 + Math.random() * 9000).toString();
            startReceiver(generated);
        }
    }, [isReceiverActive, startReceiver, stopReceiver]);

    const handleStopScreenShare = useCallback(() => {
        if (activeStreamRef.current) {
            ScreenCaptureService.stopStream(activeStreamRef.current);
            activeStreamRef.current = null;
        }
        if (webRtcSenderRef.current) {
            webRtcSenderRef.current.cleanup();
            webRtcSenderRef.current = null;
        }
        setScreenSharing(false);
        socket.sendCommand('stop-relay');
        relayTransmitterService.sendProjectorCommand('stop-relay', null);
    }, [socket, setScreenSharing]);

    const handleStartScreenShare = useCallback(async () => {
        try {
            const stream = await ScreenCaptureService.startCapture(selectedSourceId || undefined);
            activeStreamRef.current = stream;

            stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                handleStopScreenShare();
            });

            const webRtc = new WebRtcRelayService();
            webRtcSenderRef.current = webRtc;
            const offer = await webRtc.initSender(stream, (sig) => {
                socket.sendSignal(sig);
            });

            socket.sendSignal({ type: 'offer', sdp: offer.sdp });
            setScreenSharing(true);
        } catch (err) {
            console.error('[AirDeck] Screen share start failed:', err);
            handleStopScreenShare();
        }
    }, [selectedSourceId, socket, setScreenSharing, handleStopScreenShare]);

    const handleToggleScreenShare = useCallback(() => {
        if (isSharingScreen) {
            handleStopScreenShare();
        } else {
            handleStartScreenShare();
        }
    }, [isSharingScreen, handleStartScreenShare, handleStopScreenShare]);

    const handleConnectTransmitter = useCallback(() => {
        if (enteredPin.length !== 4) return;
        wasConnectingRef.current = true;
        setIsConnecting(true);
        socket.connect(enteredPin);
        relayTransmitterService.connect(receiverHost || '127.0.0.1', enteredPin);
    }, [enteredPin, receiverHost, socket]);

    const handleDisconnectTransmitter = useCallback(() => {
        handleStopScreenShare();
        socket.sendCommand('CAST_STOP');
        socket.disconnect();
        relayTransmitterService.disconnect();
        useRelayStore.getState().setTransmitterConnected(false);
        setEnteredPin('');
        setIsConnecting(false);
    }, [socket, handleStopScreenShare]);

    const handleTogglePrivacy = useCallback(() => {
        const next = !isPrivacyActive;
        setPrivacyMode(next);
        socket.setPrivacy(next);
        relayTransmitterService.setPrivacy(next);
    }, [isPrivacyActive, setPrivacyMode, socket]);

    const handleHostChange = useCallback((host: string) => {
        setReceiverHost(host);
        try {
            localStorage.setItem('deck_ce_relay_host', host);
        } catch {}
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-stone-950/80 backdrop-blur-2xl apple-backdrop p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-[1000px] h-full max-h-[750px] bg-stone-950/90 border border-white/10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] flex overflow-hidden ring-1 ring-white/5 relative group/modal apple-modal">
                <div className="absolute inset-0 bg-linear-to-b from-white/2 to-transparent pointer-events-none" />
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

                {/* Left Sidebar */}
                <WirelessRelaySidebar activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative z-10 bg-black/20 overflow-hidden">
                    {/* Integrated Header */}
                    <div className="h-24 px-8 flex items-center justify-between border-b border-white/5 bg-stone-950/20 backdrop-blur-md relative overflow-hidden group/header shrink-0">
                        <div className="absolute -top-10 left-10 w-40 h-20 bg-accent/10 blur-[60px] rounded-full pointer-events-none" />

                        <div className="relative z-10 flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
                                <div className="relative w-12 h-12 rounded-2xl bg-stone-900 border border-white/10 flex items-center justify-center shadow-2xl">
                                    {activeTab === 'receiver' ? (
                                        <Monitor className="w-6 h-6 text-accent animate-in zoom-in duration-300" />
                                    ) : (
                                        <Cast className="w-6 h-6 text-accent animate-in zoom-in duration-300" />
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.3em]">
                                        AirDeck
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-stone-800" />
                                    <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">
                                        {activeTab === 'receiver' ? t('tab_receiver', 'Приёмник') : t('tab_transmitter', 'Трансляция')}
                                    </span>
                                </div>
                                <h2 className="text-xl font-black text-white tracking-tight">
                                    {activeTab === 'receiver' 
                                        ? t('receiver_modal_title', 'Приём трансляций') 
                                        : t('transmitter_modal_title', 'Трансляция презентации и экрана')}
                                </h2>
                            </div>
                        </div>

                        <IconButton
                            icon={<X className="w-5 h-5 text-stone-400" />}
                            label={t('close', 'Close')}
                            variant="surface"
                            size="xs"
                            onClick={onClose}
                        />
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {activeTab === 'receiver' ? (
                            <ReceiverTab
                                isReceiverActive={isReceiverActive}
                                pin={pin}
                                receiverIp={receiverIp || null}
                                connectedSpeaker={connectedSpeaker}
                                onToggleReceiver={handleToggleReceiver}
                            />
                        ) : (
                            <DeckCastTab
                                isConnected={isTransmitterConnected || socket.connected}
                                isConnecting={isConnecting}
                                authError={socket.authError}
                                enteredPin={enteredPin}
                                onPinChange={setEnteredPin}
                                receiverHost={receiverHost}
                                onHostChange={handleHostChange}
                                discoveryState={discoveryState}
                                onRefreshDiscovery={handleDiscover}
                                onConnect={handleConnectTransmitter}
                                onDisconnect={handleDisconnectTransmitter}
                                onCloseModal={onClose}
                                isPrivacyActive={isPrivacyActive}
                                onTogglePrivacy={handleTogglePrivacy}
                                sendCommand={socket.sendCommand}
                                isScreenSharing={isSharingScreen}
                                onToggleScreenShare={handleToggleScreenShare}
                                sources={sources}
                                selectedSourceId={selectedSourceId}
                                onSelectSourceId={setSelectedSourceId}
                                onRefreshSources={handleRefreshSources}
                                isLoadingSources={isLoadingSources}
                            />
                        )}
                    </div>

                    <div className="h-6 bg-linear-to-t from-stone-950/40 to-transparent pointer-events-none shrink-0" />
                </div>
            </div>

            <button
                type="button"
                aria-label={t('close', 'Close')}
                className="absolute inset-0 -z-10 w-full h-full cursor-default bg-transparent"
                onClick={onClose}
            />
        </div>
    );
});

WirelessRelayModal.displayName = 'WirelessRelayModal';
