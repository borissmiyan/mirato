import { WebSocketServer, WebSocket, RawData } from 'ws';
import * as http from 'http';
import { BrowserWindow } from 'electron';
import crypto from 'crypto';
import { RemoteAuthManager } from './RemoteAuthManager';
import { MediaProxyHandler } from './MediaProxyHandler';

export class WebSocketRelayHandler {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();

    constructor(
        private authManager: RemoteAuthManager,
        private mediaProxy: MediaProxyHandler,
        private getMainWindow: () => BrowserWindow | null,
        private getLastState: () => unknown
    ) {}

    public get clientCount(): number {
        return this.clients.size;
    }

    public setup(server: http.Server): void {
        this.wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 * 1024 });

        this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
            let isAuthenticated = false;
            let currentMediaMeta: { requestId: string; mimeType: string } | null = null;

            ws.on('message', (message: RawData, isBinary: boolean) => {
                try {
                    if (isBinary) {
                        const buf = Buffer.isBuffer(message) ? message : Buffer.from(message as ArrayBuffer);
                        if (currentMediaMeta) {
                            this.mediaProxy.handleResponse(currentMediaMeta.requestId, buf, currentMediaMeta.mimeType, undefined, true);
                            currentMediaMeta = null;
                        }
                        return;
                    }

                    const data = JSON.parse(message.toString());
                    if (data.type === 'MEDIA_META') {
                        currentMediaMeta = { requestId: data.requestId, mimeType: data.mimeType };
                        return;
                    }
                    if (data.type === 'PING') {
                        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
                        return;
                    }
                    if (data.type === 'AUTH') {
                        const clientIp = req.socket.remoteAddress || 'unknown';
                        const authRes = this.authManager.validateAttempt(clientIp, data.pin);
                        if (authRes.success) {
                            isAuthenticated = true;
                            this.clients.add(ws);
                            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', token: crypto.randomUUID(), role: data.role || 'remote' }));
                            const mainWindow = this.getMainWindow();
                            if (data.role === 'transmitter' && mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('remote:speaker-connected', {
                                    name: data.speakerName || 'Спикер',
                                    ip: req.socket.remoteAddress,
                                    connectedAt: Date.now()
                                });
                            }
                            const lastState = this.getLastState();
                            if (lastState) {
                                ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: lastState }));
                            }
                        } else {
                            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: authRes.error }));
                            ws.close();
                        }
                        return;
                    }
                    if (!isAuthenticated) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Not authenticated' }));
                        return;
                    }
                    this.handleAuthenticatedMessage(ws, data);
                } catch (err) {
                    console.error('[RemoteServer] WS Message Error:', err);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                if (this.clients.size === 0) {
                    BrowserWindow.getAllWindows().forEach(win => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('remote:client-disconnected');
                            win.webContents.send('projector-command', 'stop-relay');
                        }
                    });
                }
            });
        });
    }

    private handleAuthenticatedMessage(ws: WebSocket, data: Record<string, unknown>): void {
        const mainWindow = this.getMainWindow();
        if (data.type === 'RELAY_SIGNAL') {
            BrowserWindow.getAllWindows().forEach(win => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('remote:relay-signal', data.signal);
                    win.webContents.send('projector-command', 'relay-signal', data.signal);
                }
            });
            this.broadcastExcept(ws, { type: 'RELAY_SIGNAL', signal: data.signal });
        } else if (data.type === 'SET_PRIVACY') {
            const isPrivacy = Boolean(data.active);
            BrowserWindow.getAllWindows().forEach(win => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('remote:set-privacy', isPrivacy);
                    win.webContents.send('projector-command', 'set-privacy', isPrivacy);
                }
            });
            this.broadcast({ type: 'PRIVACY_UPDATE', active: isPrivacy });
        } else if (data.type === 'PROJECTOR_COMMAND') {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('remote:projector-command', data.command, data.payload);
            }
            BrowserWindow.getAllWindows().forEach(win => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('projector-command', data.command, data.payload);
                }
            });
        } else if (data.type === 'MEDIA_DATA') {
            const buf = data.data ? Buffer.from(data.data as string, 'base64') : null;
            this.mediaProxy.handleResponse(data.requestId as string, buf, data.mimeType as string, data.error as string, true);
        } else if (data.type === 'COMMAND') {
            const lastState = this.getLastState();
            if (data.command === 'GET_STATE' && lastState) {
                ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: lastState }));
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('remote:command-received', data.command, data.payload);
            }
        }
    }

    public broadcast(message: object): void {
        const msgStr = JSON.stringify(message);
        this.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msgStr); });
    }

    public broadcastExcept(excludeWs: WebSocket, message: object): void {
        const msgStr = JSON.stringify(message);
        this.clients.forEach(c => { if (c !== excludeWs && c.readyState === WebSocket.OPEN) c.send(msgStr); });
    }

    public disconnectClients(): void {
        this.clients.forEach(c => { try { if (c.readyState === WebSocket.OPEN) c.close(1000, 'Network or PIN refreshed'); } catch { } });
        this.clients.clear();
    }

    public stop(): void {
        if (this.wss) {
            this.wss.clients.forEach(c => c.close());
            this.wss.close();
            this.wss = null;
        }
        this.clients.clear();
    }
}

