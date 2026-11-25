import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type HymnalAudioVariant = 'minus' | 'plus';

export interface DownloadPartSpec {
    url: string;
    sha256?: string;
    sizeBytes?: number;
}

/**
 * Computes SHA-256 hex digest of a file on disk using 1MB streaming chunks.
 */
export function computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const rs = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
        rs.on('data', (chunk) => hash.update(chunk));
        rs.on('error', reject);
        rs.on('end', () => resolve(hash.digest('hex')));
    });
}

/**
 * Downloads a single remote URL to disk (using 8-connection HTTP Range when supported),
 * reporting incremental byte deltas via `onBytes`.
 */
export async function downloadRemoteFile(
    url: string,
    destPath: string,
    expectedBytes: number,
    signal: AbortSignal,
    onBytes: (deltaBytes: number, resolvedTotalBytes?: number) => void
): Promise<number> {
    let finalUrl = url;
    let totalBytes = expectedBytes || 0;
    let supportsRange = false;
    try {
        const headRes = await fetch(url, { method: 'HEAD', signal, redirect: 'follow' });
        if (headRes.ok) {
            if (headRes.url) finalUrl = headRes.url;
            const cl = Number(headRes.headers.get('content-length'));
            if (cl > 0) totalBytes = cl;
            supportsRange = headRes.headers.get('accept-ranges')?.toLowerCase().includes('bytes') === true
                && totalBytes > 4 * 1024 * 1024;
        }
    } catch {
        // Fall back to GET single-stream if HEAD fails
    }

    if (totalBytes > 0) onBytes(0, totalBytes);

    let downloaded = 0;
    if (supportsRange) {
        const CONCURRENCY = 8;
        const chunkSize = Math.ceil(totalBytes / CONCURRENCY);
        const fh = await fs.promises.open(destPath, 'w');
        try {
            const ranges: Array<{ start: number; end: number }> = [];
            for (let i = 0; i < CONCURRENCY; i++) {
                const start = i * chunkSize;
                const end = Math.min(totalBytes - 1, start + chunkSize - 1);
                if (start <= end) ranges.push({ start, end });
            }
            await Promise.all(ranges.map(async ({ start, end }) => {
                const res = await fetch(finalUrl, {
                    headers: { Range: `bytes=${start}-${end}` },
                    signal,
                    redirect: 'follow',
                });
                if (!res.ok || !res.body) {
                    throw new Error(`HTTP ${res.status} on range ${start}-${end}`);
                }
                const reader = res.body.getReader();
                let pos = start;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        await fh.write(value, 0, value.byteLength, pos);
                        pos += value.byteLength;
                        downloaded += value.byteLength;
                        onBytes(value.byteLength);
                    }
                }
            }));
        } finally {
            await fh.close();
        }
        return downloaded;
    }

    const response = await fetch(finalUrl, { signal, redirect: 'follow' });
    if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const cl = Number(response.headers.get('content-length'));
    if (cl > 0) {
        totalBytes = cl;
        onBytes(0, totalBytes);
    }
    const writer = fs.createWriteStream(destPath);
    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                downloaded += value.byteLength;
                if (!writer.write(value)) {
                    await new Promise<void>(resolve => writer.once('drain', resolve));
                }
                onBytes(value.byteLength);
            }
        }
    } finally {
        await new Promise<void>((resolve, reject) => {
            writer.end((err?: Error | null) => (err ? reject(err) : resolve()));
        });
    }
    return downloaded;
}

export function getAudioRootDir(): string {
    const dir = path.join(app.getPath('userData'), 'hymnal-audio');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function normalizeVariant(variant?: string): HymnalAudioVariant {
    return variant === 'plus' ? 'plus' : 'minus';
}

export function resolvePackKey(safeId: string, variant: HymnalAudioVariant): string {
    return variant === 'plus' ? `${safeId}__plus` : safeId;
}

export function parsePackDirName(dirName: string): { hymnalId: string; variant: HymnalAudioVariant; packKey: string } {
    if (dirName.endsWith('__plus')) {
        return {
            hymnalId: dirName.slice(0, -'__plus'.length),
            variant: 'plus',
            packKey: dirName,
        };
    }
    return { hymnalId: dirName, variant: 'minus', packKey: dirName };
}

export function hasTrackInDir(dirPath: string, hymnNumber: number): boolean {
    if (!fs.existsSync(dirPath)) return false;
    const padded = String(Math.max(0, Math.floor(hymnNumber))).padStart(3, '0');
    const plain = String(Math.max(0, Math.floor(hymnNumber)));
    const names = [padded, ...(plain !== padded ? [plain] : [])];
    const exts = ['ogg', 'mp3', 'm4a'];
    for (const n of names) {
        for (const ext of exts) {
            if (fs.existsSync(path.join(dirPath, `${n}.${ext}`))) {
                return true;
            }
        }
    }
    return false;
}

export async function computeDirStats(dirPath: string): Promise<{ bytes: number; oggCount: number }> {
    let bytes = 0;
    let oggCount = 0;
    if (!fs.existsSync(dirPath)) return { bytes, oggCount };
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isFile()) {
            const st = await fs.promises.stat(full);
            bytes += st.size;
            if (entry.name.endsWith('.ogg') || entry.name.endsWith('.mp3') || entry.name.endsWith('.m4a')) {
                oggCount += 1;
            }
        }
    }
    return { bytes, oggCount };
}

/**
 * Unpacks a ZIP archive using native OS tools (unzip on macOS/Linux, tar on Windows 10+)
 * so 500MB audio packs extract in ~1-2 seconds with <15MB RAM.
 */
export async function extractZipStreaming(zipPath: string, destDir: string): Promise<void> {
    await fs.promises.mkdir(destDir, { recursive: true });
    if (process.platform === 'win32') {
        await execFileAsync('tar', ['-xf', zipPath, '-C', destDir]);
    } else {
        await execFileAsync('unzip', ['-oq', zipPath, '-d', destDir]);
    }
}

export async function checkFreeDiskSpace(targetDir: string, requiredBytes: number): Promise<{ ok: boolean; freeBytes: number }> {
    try {
        const statfsFn = (fs.promises as unknown as { statfs?: (p: string) => Promise<{ bavail: number; bsize: number }> }).statfs;
        if (typeof statfsFn === 'function') {
            const stats = await statfsFn(targetDir);
            const freeBytes = Number(stats.bavail) * Number(stats.bsize);
            return { ok: freeBytes >= requiredBytes, freeBytes };
        }
    } catch {
        // Ignore statfs errors on unsupported filesystems
    }
    return { ok: true, freeBytes: Number.MAX_SAFE_INTEGER };
}
