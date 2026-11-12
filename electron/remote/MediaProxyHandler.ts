import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { BrowserWindow } from 'electron';

export class MediaProxyHandler {
    private pendingMediaRequests: Map<string, express.Response> = new Map();

    constructor(
        private getMainWindow: () => BrowserWindow | null,
        private broadcast: (message: object) => void,
        private getClientsCount: () => number
    ) {}

    public handleRoute(req: express.Request, res: express.Response): void {
        const rawId = req.params.id;
        const mediaId = path.basename(Array.isArray(rawId) ? rawId[0] : (rawId || ''));
        if (!mediaId || !/^[a-zA-Z0-9_\-.]+$/.test(mediaId)) {
            res.status(400).send('Invalid media ID');
            return;
        }
        const cacheFile = path.join(os.tmpdir(), 'deck-ce-media', mediaId);
        if (fs.existsSync(cacheFile)) {
            res.sendFile(cacheFile);
            return;
        }

        const requestId = crypto.randomUUID();
        this.pendingMediaRequests.set(requestId, res);

        const mainWindow = this.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('remote:request-media', { id: mediaId, requestId });
        }
        this.broadcast({ type: 'REQUEST_MEDIA', id: mediaId, requestId });

        if ((!mainWindow || mainWindow.isDestroyed()) && this.getClientsCount() === 0) {
            this.pendingMediaRequests.delete(requestId);
            res.status(404).send('No media sources available');
            return;
        }

        setTimeout(() => {
            if (this.pendingMediaRequests.has(requestId)) {
                this.pendingMediaRequests.get(requestId)?.status(408).send('Media request timeout');
                this.pendingMediaRequests.delete(requestId);
            }
        }, 60000);
    }

    public handleResponse(
        requestId: string,
        buffer: Buffer | null,
        mimeType?: string,
        error?: string,
        fromWs = false
    ): void {
        const res = this.pendingMediaRequests.get(requestId);
        if (!res) return;

        if (buffer && buffer.length > 0) {
            try {
                const cacheDir = path.join(os.tmpdir(), 'deck-ce-media');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                const rawMediaId = res.req?.params?.id;
                const rawStr = Array.isArray(rawMediaId) ? rawMediaId[0] : (rawMediaId || '');
                const mediaId = path.basename(rawStr);
                if (mediaId && /^[a-zA-Z0-9_\-.]+$/.test(mediaId)) {
                    fs.writeFileSync(path.join(cacheDir, mediaId), buffer);
                }
            } catch { }
            if (mimeType) res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Accept-Ranges', 'bytes');
            const range = res.req.headers.range;
            if (range) {
                const total = buffer.length;
                const [sStr, eStr] = range.replace(/bytes=/, '').split('-');
                const s = parseInt(sStr, 10);
                const e = eStr ? parseInt(eStr, 10) : total - 1;
                res.status(206).set({ 'Content-Range': `bytes ${s}-${e}/${total}`, 'Content-Length': e - s + 1 });
                res.send(buffer.slice(s, e + 1));
            } else {
                res.setHeader('Content-Length', buffer.length);
                res.send(buffer);
            }
            this.pendingMediaRequests.delete(requestId);
            return;
        }

        if (error && !fromWs && this.getClientsCount() > 0) return;
        res.status(404).send(error || 'Not found');
        this.pendingMediaRequests.delete(requestId);
    }

    public clear(): void {
        this.pendingMediaRequests.clear();
    }
}

