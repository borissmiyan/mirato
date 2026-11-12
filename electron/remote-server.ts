import express from 'express';
import { WebSocket } from 'ws';
import { networkInterfaces } from 'os';
import * as http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserWindow, ipcMain } from 'electron';
import { selectBestLocalIp, getAvailableLocalIps } from '../src/core/utils/networkIpUtils';
import { UdpDiscoveryService } from './remote/UdpDiscoveryService';
import { MediaProxyHandler } from './remote/MediaProxyHandler';
import { RemoteAuthManager } from './remote/RemoteAuthManager';
import { WebSocketRelayHandler } from './remote/WebSocketRelayHandler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RemoteServer {
    private app = express();
    private server: http.Server | null = null;
    private lastStatePayload: unknown = null;
    
    private port = 3211;
    private currentIp = '127.0.0.1';
    private selectedIp: string | null = null;

    private mainWindow: BrowserWindow | null = null;
    private isExpressSetup = false;
    private isIpcSetup = false;

    private authManager: RemoteAuthManager;
    private mediaProxy: MediaProxyHandler;
    private wsHandler: WebSocketRelayHandler;
    private udpDiscovery: UdpDiscoveryService;

    constructor() {
        this.authManager = new RemoteAuthManager();
        this.mediaProxy = new MediaProxyHandler(
            () => this.mainWindow,
            (msg: object) => this.broadcast(msg),
            (): number => this.wsHandler ? this.wsHandler.clientCount : 0
        );
        this.wsHandler = new WebSocketRelayHandler(
            this.authManager,
            this.mediaProxy,
            () => this.mainWindow,
            () => this.lastStatePayload
        );
        this.udpDiscovery = new UdpDiscoveryService(() => ({
            ip: this.currentIp,
            port: this.getDisplayPort()
        }));
    }

    public get currentPin(): string {
        return this.authManager.currentPin;
    }

    public getLocalIp(): string {
        const available = getAvailableLocalIps(networkInterfaces());
        if (this.selectedIp && available.some(a => a.ip === this.selectedIp)) {
            return this.selectedIp;
        }
        return selectBestLocalIp(networkInterfaces());
    }

    public setSelectedIp(ip: string) {
        this.selectedIp = ip;
        this.currentIp = ip;
        this.generateNewPin();
        this.disconnectClients();
        return this.getInfo();
    }

    private setupExpress(): void {
        this.app.use(express.json());
        this.app.use((_req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        this.app.get('/airdeck/health', (_req, res) => {
            res.json({
                service: 'deck-ce-airdeck',
                status: 'ok',
                ip: this.currentIp,
                port: this.getDisplayPort()
            });
        });

        this.app.get('/media/:id', (req, res) => {
            this.mediaProxy.handleRoute(req, res);
        });

        // audit-ignore: Node.js main process environment
        const viteDevUrl = process.env['VITE_DEV_SERVER_URL'];
        if (viteDevUrl) {
            console.log('[RemoteServer] Dev mode — redirecting HTTP to Vite server');
            this.app.use((req, res) => {
                try {
                    const url = new URL(viteDevUrl);
                    const targetPort = url.port || 3210;
                    res.redirect(`http://${this.currentIp}:${targetPort}${req.url}`);
                } catch {
                    res.status(500).send('Vite Dev URL error');
                }
            });
        } else {
            // audit-ignore: Node.js main process environment
            const publicPath = path.join(process.env.DIST || path.join(__dirname, '../dist'));
            console.log(`[RemoteServer] Production mode — serving from ${publicPath}`);
            this.app.use(express.static(publicPath));
            this.app.use((_req, res) => {
                res.sendFile(path.join(publicPath, 'remote.html'));
            });
        }
    }

    private setupIpcListeners(): void {
        ipcMain.on('remote:update-state', (_e, payload) => {
            this.lastStatePayload = payload;
            this.broadcast({ type: 'STATE_UPDATE', payload });
        });
        ipcMain.on('remote:send-relay-signal', (_e, signal) => this.broadcast({ type: 'RELAY_SIGNAL', signal }));
        ipcMain.on('remote:bible-results', (_e, { requestId, results }) => this.broadcast({ type: 'BIBLE_RESULTS', requestId, results }));
        ipcMain.on('remote:hymn-results', (_e, { requestId, results }) => this.broadcast({ type: 'HYMN_RESULTS', requestId, results }));
        ipcMain.on('remote:media-response', (_e, { requestId, data, mimeType, error }) => {
            this.mediaProxy.handleResponse(requestId, data ? Buffer.from(data) : null, mimeType, error, false);
        });
    }

    public broadcast(message: object): void {
        this.wsHandler.broadcast(message);
    }

    public broadcastExcept(excludeWs: WebSocket, message: object): void {
        this.wsHandler.broadcastExcept(excludeWs, message);
    }

    public getDisplayPort(): number {
        // audit-ignore: Node.js main process environment
        const viteDevUrl = process.env['VITE_DEV_SERVER_URL'];
        if (viteDevUrl) {
            try { return parseInt(new URL(viteDevUrl).port) || 80; } catch { }
        }
        return this.port;
    }

    public generateNewPin(): string {
        return this.authManager.generateNewPin();
    }

    public disconnectClients(): void {
        this.wsHandler.disconnectClients();
    }

    public getInfo() {
        const detectedIp = this.getLocalIp();
        if (detectedIp !== this.currentIp && this.server) {
            this.currentIp = detectedIp;
            this.generateNewPin();
            this.disconnectClients();
        }
        return {
            success: this.server !== null && this.currentPin !== '0000',
            ip: this.currentIp,
            port: this.getDisplayPort(),
            pin: this.currentPin,
            availableIps: getAvailableLocalIps(networkInterfaces())
        };
    }

    public async refresh(mainWindow?: BrowserWindow) {
        if (mainWindow) this.mainWindow = mainWindow;
        this.selectedIp = null;
        this.currentIp = this.getLocalIp();
        this.generateNewPin();
        this.disconnectClients();

        if (!this.server && this.mainWindow) {
            const startRes = await this.start(this.mainWindow);
            return { success: true, ...startRes, availableIps: getAvailableLocalIps(networkInterfaces()) };
        }
        return {
            success: true,
            ip: this.currentIp,
            port: this.getDisplayPort(),
            pin: this.currentPin,
            availableIps: getAvailableLocalIps(networkInterfaces())
        };
    }

    public start(mainWindow: BrowserWindow): Promise<{ ip: string; port: number; pin: string; availableIps: Array<{ name: string; ip: string }> }> {
        return new Promise((resolve, reject) => {
            this.mainWindow = mainWindow;
            const detectedIp = this.getLocalIp();
            if (this.server) {
                if (detectedIp !== this.currentIp) {
                    this.currentIp = detectedIp;
                    this.generateNewPin();
                    this.disconnectClients();
                }
                return resolve({ ip: this.currentIp, port: this.getDisplayPort(), pin: this.currentPin, availableIps: getAvailableLocalIps(networkInterfaces()) });
            }
            this.currentIp = detectedIp;
            if (this.currentPin === '0000') this.generateNewPin();
            if (!this.isExpressSetup) { this.setupExpress(); this.isExpressSetup = true; }
            this.server = http.createServer(this.app);
            if (!this.isIpcSetup) { this.setupIpcListeners(); this.isIpcSetup = true; }

            this.server.listen(this.port, '0.0.0.0', () => {
                if (this.server) this.wsHandler.setup(this.server);
                this.udpDiscovery.start();
                resolve({ ip: this.currentIp, port: this.getDisplayPort(), pin: this.currentPin, availableIps: getAvailableLocalIps(networkInterfaces()) });
            });
            this.server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    this.port++;
                    this.server?.listen(this.port, '0.0.0.0');
                } else {
                    reject(err);
                }
            });
        });
    }

    public stop(): void {
        this.udpDiscovery.stop();
        this.wsHandler.stop();
        if (this.server) { this.server.close(); this.server = null; }
        this.mediaProxy.clear();
        this.authManager.clear();
    }
}

export const remoteServerInfo = new RemoteServer();
