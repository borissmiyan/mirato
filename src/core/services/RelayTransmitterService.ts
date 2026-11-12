import { useRelayStore } from '@/core/store/relayStore';
import { db } from '@/core/db';
import { setRelayCommandForwarder } from './ipcService';

export class RelayTransmitterService {
    private static instance: RelayTransmitterService | null = null;
    private ws: WebSocket | null = null;
    private currentHost: string = '127.0.0.1';
    private currentPin: string = '';
    private connected: boolean = false;
    private isManualDisconnect: boolean = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private listeners: Set<(connected: boolean, error?: string) => void> = new Set();
    private signalListeners: Set<(signal: unknown) => void> = new Set();
    private privacyListeners: Set<(active: boolean) => void> = new Set();
    private pendingSignals: unknown[] = [];
    private pendingCommands: Array<{ command: string; payload?: unknown }> = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                if (!this.isManualDisconnect && this.currentPin && !this.connected) {
                    this.reconnectAttempts = 0;
                    this.connect(this.currentHost, this.currentPin);
                }
            });
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.isManualDisconnect && this.currentPin && !this.connected) {
                    this.reconnectAttempts = 0;
                    this.connect(this.currentHost, this.currentPin);
                }
            });
        }
    }

    public static getInstance(): RelayTransmitterService {
        if (!RelayTransmitterService.instance) {
            RelayTransmitterService.instance = new RelayTransmitterService();
        }
        return RelayTransmitterService.instance;
    }

    public connect(host: string, pin: string): Promise<boolean> {
        this.cleanupHeartbeat();
        this.cleanupReconnect();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.isManualDisconnect = false;
        const sanitized = (host || '127.0.0.1').replace(/^[a-z]+:\/\//i, '').trim();
        const [cleanHost, customPort] = sanitized.split(':');
        const port = customPort || '3211';
        this.currentHost = cleanHost;
        this.currentPin = pin;

        return new Promise((resolve) => {
            try {
                const wsUrl = `ws://${cleanHost}:${port}`;
                const ws = new WebSocket(wsUrl);
                this.ws = ws;

                ws.onopen = () => {
                    this.reconnectAttempts = 0;
                    ws.send(JSON.stringify({
                        type: 'AUTH',
                        pin,
                        role: 'transmitter',
                        speakerName: 'Спикер на сцене'
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'PONG') return;

                        if (data.type === 'AUTH_SUCCESS') {
                            this.connected = true;
                            useRelayStore.getState().setTransmitterConnected(true, this.currentHost);
                            this.notifyListeners(true);

                            // Flush pending signals and commands
                            while (this.pendingSignals.length > 0) {
                                const sig = this.pendingSignals.shift();
                                this.ws?.send(JSON.stringify({ type: 'RELAY_SIGNAL', signal: sig }));
                            }
                            while (this.pendingCommands.length > 0) {
                                const cmd = this.pendingCommands.shift();
                                if (cmd) {
                                    this.ws?.send(JSON.stringify({
                                        type: 'PROJECTOR_COMMAND',
                                        command: cmd.command,
                                        payload: cmd.payload
                                    }));
                                }
                            }

                            this.cleanupHeartbeat();
                            this.heartbeatTimer = setInterval(() => {
                                if (this.ws?.readyState === WebSocket.OPEN) {
                                    this.ws.send(JSON.stringify({ type: 'PING' }));
                                }
                            }, 15000);

                            resolve(true);
                            return;
                        }

                        if (data.type === 'AUTH_ERROR') {
                            this.connected = false;
                            useRelayStore.getState().setTransmitterConnected(false);
                            this.notifyListeners(false, data.message || 'Неверный PIN-код');
                            this.disconnect();
                            resolve(false);
                            return;
                        }

                        if (data.type === 'RELAY_SIGNAL') {
                            this.signalListeners.forEach(fn => fn(data.signal));
                            return;
                        }

                        if (data.type === 'PRIVACY_UPDATE') {
                            this.privacyListeners.forEach(fn => fn(data.active));
                            return;
                        }

                        if (data.type === 'REQUEST_MEDIA' && data.id && data.requestId) {
                            (async () => {
                                try {
                                    const entry = ((await db.backgrounds.get(data.id)) || (await db.mediaPool.get(data.id))) as { data?: Blob | null; path?: string; mimeType?: string } | undefined;
                                    let blob: Blob | null = entry?.data || null;
                                    if (!blob && entry?.path) {
                                        try {
                                            const url = window.electron?.ipcRenderer ? `local-resource://${encodeURI(entry.path)}` : entry.path;
                                            const res = await fetch(url);
                                            if (res.ok) blob = await res.blob();
                                        } catch {}
                                    }
                                    if (blob && this.ws?.readyState === WebSocket.OPEN) {
                                        const mimeType = blob.type || entry?.mimeType || 'video/mp4';
                                        this.ws.send(JSON.stringify({
                                            type: 'MEDIA_META',
                                            requestId: data.requestId,
                                            id: data.id,
                                            mimeType,
                                            size: blob.size
                                        }));
                                        const arrayBuffer = await blob.arrayBuffer();
                                        this.ws.send(arrayBuffer);
                                    }
                                } catch (err) {
                                    console.error('[RelayTransmitter] Error responding to media request:', err);
                                }
                            })();
                            return;
                        }
                    } catch (e) {
                        console.error('[RelayTransmitter] Parse error:', e);
                    }
                };

                ws.onerror = () => {
                    this.connected = false;
                    useRelayStore.getState().setTransmitterConnected(false);
                    this.notifyListeners(false, 'Не удалось подключиться к проектору. Проверьте сеть или статус приёмника.');
                    resolve(false);
                };

                ws.onclose = () => {
                    this.connected = false;
                    useRelayStore.getState().setTransmitterConnected(false);
                    this.cleanupHeartbeat();
                    this.notifyListeners(false);

                    // Auto-reconnect with exponential backoff on unexpected connection loss
                    if (!this.isManualDisconnect && this.currentPin && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = Math.min(10000, 1000 * Math.pow(2, this.reconnectAttempts - 1));
                        this.cleanupReconnect();
                        this.reconnectTimer = setTimeout(() => {
                            if (!this.isManualDisconnect && this.currentPin) {
                                this.connect(this.currentHost, this.currentPin);
                            }
                        }, delay);
                    }
                };
            } catch (err: unknown) {
                this.notifyListeners(false, err instanceof Error ? err.message : 'Ошибка соединения');
                resolve(false);
            }
        });
    }

    public sendProjectorCommand(command: string, payload?: unknown) {
        if (this.ws?.readyState === WebSocket.OPEN && this.connected) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'PROJECTOR_COMMAND',
                    command,
                    payload
                }));
            } catch (e) {
                console.error('[RelayTransmitter] Failed to send projector command:', e);
            }
        } else if (!this.isManualDisconnect && this.currentPin) {
            this.pendingCommands.push({ command, payload });
        }
    }

    public sendSignal(signal: unknown) {
        if (this.ws?.readyState === WebSocket.OPEN && this.connected) {
            this.ws.send(JSON.stringify({ type: 'RELAY_SIGNAL', signal }));
        } else {
            this.pendingSignals.push(signal);
        }
    }

    public setPrivacy(active: boolean) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'SET_PRIVACY', active }));
        }
    }

    public disconnect() {
        this.isManualDisconnect = true;
        this.currentPin = '';
        this.reconnectAttempts = 0;
        this.pendingSignals = [];
        this.pendingCommands = [];
        this.cleanupReconnect();
        this.cleanupHeartbeat();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        useRelayStore.getState().setTransmitterConnected(false);
        this.notifyListeners(false);
    }

    private cleanupReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private cleanupHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    public subscribe(listener: (connected: boolean, error?: string) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public onSignal(listener: (signal: unknown) => void) {
        this.signalListeners.add(listener);
        return () => this.signalListeners.delete(listener);
    }

    public onPrivacy(listener: (active: boolean) => void) {
        this.privacyListeners.add(listener);
        return () => this.privacyListeners.delete(listener);
    }

    private notifyListeners(connected: boolean, error?: string) {
        this.listeners.forEach(fn => fn(connected, error));
    }

    public getIsConnected() {
        return this.connected;
    }

    public getHost() {
        return this.currentHost;
    }

    public getPin() {
        return this.currentPin;
    }
}

export const relayTransmitterService = RelayTransmitterService.getInstance();

// Auto-register projector command forwarding from primitive IPC
setRelayCommandForwarder((cmd, data) => relayTransmitterService.sendProjectorCommand(cmd, data));
