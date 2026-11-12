import { desktopCapturer, ipcMain, BrowserWindow } from 'electron';
import dgram from 'dgram';
import os from 'os';
import { remoteServerInfo } from '../remote-server';
import { calculateBroadcastAddress } from '../../src/core/utils/networkIpUtils';

let activeCapturerPromise: Promise<unknown> | null = null;

export function registerScreenCaptureHandlers(getMainWindow: () => BrowserWindow | null): void {
    // --- Remote Server IPCs ---
    ipcMain.handle('remote:start', async () => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return { error: 'Main window not ready' };
        try {
            const info = await remoteServerInfo.start(mainWindow);
            return { success: true, ...info };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message || 'Failed to start remote server' };
        }
    });

    ipcMain.handle('remote:stop', () => {
        remoteServerInfo.stop();
        return true;
    });

    ipcMain.handle('remote:refresh', async () => {
        try {
            const mainWindow = getMainWindow();
            const info = await remoteServerInfo.refresh(mainWindow || undefined);
            return info;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message || 'Failed to refresh remote server' };
        }
    });

    ipcMain.handle('remote:get-info', () => {
        return remoteServerInfo.getInfo();
    });

    ipcMain.handle('remote:select-ip', (_event, ip: string) => {
        return remoteServerInfo.setSelectedIp(ip);
    });

    ipcMain.handle('remote:discover-receiver', async () => {
        const localInfo = remoteServerInfo.getInfo();
        if (localInfo.success && localInfo.ip && localInfo.port) {
            return { found: true, ip: localInfo.ip, port: localInfo.port, isLocal: true };
        }

        return new Promise<{ found: boolean; ip?: string; port?: number }>((resolve) => {
            let resolved = false;
            let client: dgram.Socket | null = null;
            let timeoutId: NodeJS.Timeout | null = null;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (client) {
                    try { client.close(); } catch {}
                    client = null;
                }
            };

            const finish = (result: { found: boolean; ip?: string; port?: number }) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(result);
            };

            try {
                client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
                client.on('error', (err) => {
                    console.warn('[Discovery] UDP client error:', err.message);
                    finish({ found: false });
                });

                client.on('message', (msg, rinfo) => {
                    try {
                        const data = JSON.parse(msg.toString());
                        if (data.service === 'deck-ce-airdeck') {
                            const ip = data.ip || rinfo.address;
                            const port = data.port || 3211;
                            finish({ found: true, ip, port });
                        }
                    } catch {}
                });

                client.bind(0, () => {
                    try { client?.setBroadcast(true); } catch {}
                    const message = Buffer.from('AIRDECK_DISCOVER');
                    try { client?.send(message, 3212, '255.255.255.255'); } catch {}

                    const ifaces = os.networkInterfaces();
                    for (const netList of Object.values(ifaces)) {
                        if (!netList) continue;
                        for (const net of netList) {
                            if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
                                const bcast = calculateBroadcastAddress(net.address, net.netmask);
                                try { client?.send(message, 3212, bcast); } catch {}
                            }
                        }
                    }
                });

                timeoutId = setTimeout(() => {
                    finish({ found: false });
                }, 1200);
            } catch (err) {
                console.warn('[Discovery] Failed to initiate UDP discovery:', err);
                finish({ found: false });
            }
        });
    });

    // --- Desktop Capturer IPC ---
    ipcMain.handle('desktop-capturer:get-sources', async (_event, options) => {
        while (activeCapturerPromise) {
            try {
                await activeCapturerPromise;
            } catch {
                break;
            }
        }

        const captureTask = (async () => {
            try {
                const sources = await desktopCapturer.getSources({
                    types: options?.types || ['window', 'screen'],
                    thumbnailSize: options?.thumbnailSize || { width: 320, height: 180 },
                    fetchWindowIcons: false
                });
                return sources.map(source => {
                    let thumbnail = '';
                    try {
                        if (source.thumbnail && !source.thumbnail.isEmpty()) {
                            thumbnail = source.thumbnail.toDataURL();
                        }
                    } catch {
                        thumbnail = '';
                    }
                    return {
                        id: source.id,
                        name: source.name,
                        thumbnail,
                        appIcon: null,
                    };
                });
            } catch (err: unknown) {
                console.error('[Main] Failed to get desktop sources:', err);
                return [];
            }
        })();

        activeCapturerPromise = captureTask;
        try {
            return await captureTask;
        } finally {
            if (activeCapturerPromise === captureTask) {
                activeCapturerPromise = null;
            }
        }
    });
}

