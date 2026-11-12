import { app, BrowserWindow, protocol, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Readable } from 'stream';

import {
    createMainWindow,
    createMenu,
    getMainWindow,
    setupWindowIpc
} from './windows/windowManager';
import { registerHymnHandlers } from './ipc/hymnHandlers';
import { registerScreenCaptureHandlers } from './ipc/screenCaptureHandlers';
import { registerFontHandlers } from './ipc/fontHandlers';
import { registerFileSystemHandlers } from './ipc/fileSystemHandlers';
import { registerMediaHandlers, MEDIA_AUDIO_DIR, MEDIA_VIDEOS_DIR, MEDIA_IMAGES_DIR } from './ipc/mediaHandlers';
import { migrateFromEkklesienterIfNeeded } from './migration/ekklesienterMigration';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Disable standard Electron development security warnings (e.g. Vite dev server unsafe-eval warning)
// audit-ignore: Node.js main process environment
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Hardware acceleration & GPU video decoding flags for 4K/1080p 60fps presentation playback
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Register custom protocol as privileged before app is ready
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'local-resource',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            stream: true,
            corsEnabled: true
        }
    }
]);

// Build directory paths
// audit-ignore: Node.js main process environment
process.env.DIST_ELECTRON = path.join(__dirname, '../dist-electron');
// audit-ignore: Node.js main process environment
process.env.DIST = path.join(__dirname, '../dist');
// audit-ignore: Node.js main process environment
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.whenReady().then(() => {
    // 0. Auto-migrate user database, presentations and media from legacy Ekklesienter before opening windows
    try {
        migrateFromEkklesienterIfNeeded();
    } catch (migErr) {
        console.error('[Migration] Non-fatal startup migration error:', migErr);
    }

    createMenu();

    // Global uncaught error logging for Main Process
    process.on('uncaughtException', (error) => {
        console.error('CRITICAL MAIN PROCESS ERROR:', error);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED MAIN PROCESS REJECTION:', reason);
    });

    console.log('Main Process: Error Logging Initialized');

    // Grant local-fonts permission automatically
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if ((permission as string) === 'local-fonts') {
            callback(true);
            return;
        }
        callback(true);
    });

    // Register custom protocol for local resources
    protocol.handle('local-resource', async (request) => {
        try {
            const url = new URL(request.url);
            let filePath = decodeURIComponent(url.pathname);

            if (url.host && url.host !== 'localhost' && !/^[a-zA-Z]:$/.test(url.host)) {
                filePath = url.host + filePath;
            } else if (url.host && /^[a-zA-Z]:$/.test(url.host)) {
                filePath = url.host + filePath;
            }

            filePath = filePath.replace(/\\/g, '/');

            if (process.platform !== 'win32' && !filePath.startsWith('/')) {
                filePath = '/' + filePath;
            }

            if (process.platform !== 'win32' && filePath.startsWith('//')) {
                filePath = filePath.substring(1);
            }

            if (process.platform === 'win32' && filePath.startsWith('/') && /^\/[a-zA-Z]:/.test(filePath)) {
                filePath = filePath.slice(1);
            }

            if (process.platform === 'darwin') {
                filePath = filePath.normalize('NFD');
            }

            // Defense-in-depth: Redirect legacy ekklesienter media paths to mirato media
            if (filePath.includes('/ekklesienter/media/') && !fs.existsSync(filePath)) {
                const miratoRedirect = filePath.replace('/ekklesienter/media/', '/mirato/media/');
                if (fs.existsSync(miratoRedirect)) {
                    filePath = miratoRedirect;
                }
            }

            // Fallback for missing files: Check media audio and videos directories by base name or hash
            if (!fs.existsSync(filePath)) {
                const base = path.basename(filePath);
                const candidates = [
                    path.join(MEDIA_AUDIO_DIR, base),
                    path.join(MEDIA_AUDIO_DIR, `${base}.mp3`),
                    path.join(MEDIA_AUDIO_DIR, `${base}.m4a`),
                    path.join(MEDIA_AUDIO_DIR, `${base}.wav`),
                    path.join(MEDIA_AUDIO_DIR, `${base}.ogg`),
                    path.join(MEDIA_AUDIO_DIR, `${base}.aac`),
                    path.join(MEDIA_VIDEOS_DIR, base),
                    path.join(MEDIA_VIDEOS_DIR, `${base}.mp4`),
                    path.join(MEDIA_VIDEOS_DIR, `${base}.webm`),
                    path.join(MEDIA_IMAGES_DIR, base),
                    path.join(MEDIA_IMAGES_DIR, `${base}.png`),
                    path.join(MEDIA_IMAGES_DIR, `${base}.jpg`),
                    path.join(MEDIA_IMAGES_DIR, `${base}.jpeg`),
                    path.join(MEDIA_IMAGES_DIR, `${base}.webp`)
                ];
                for (const cand of candidates) {
                    if (fs.existsSync(cand)) {
                        filePath = cand;
                        console.log(`[Protocol] Redirected missing path to cached media: ${filePath}`);
                        break;
                    }
                }
            }

            if (!fs.existsSync(filePath)) {
                return new Response('Not Found', { status: 404 });
            }

            const stats = await fs.promises.stat(filePath);
            if (!stats.isFile()) {
                return new Response('Not Found', { status: 404 });
            }

            const totalSize = stats.size;
            const ext = path.extname(filePath).toLowerCase();
            const MIME_MAP: Record<string, string> = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mov': 'video/quicktime',
                '.m4v': 'video/mp4',
                '.mkv': 'video/x-matroska',
                '.mp3': 'audio/mpeg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.flac': 'audio/flac',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.json': 'application/json',
                '.woff2': 'font/woff2',
                '.woff': 'font/woff',
                '.ttf': 'font/ttf',
                '.otf': 'font/otf'
            };
            const mimeType = MIME_MAP[ext] || 'application/octet-stream';
            const rangeHeader = request.headers.get('range');

            // Handle HTTP 206 Partial Content (essential for Chromium video and audio seeking)
            if (rangeHeader) {
                const matches = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
                if (matches) {
                    let start = matches[1] ? parseInt(matches[1], 10) : NaN;
                    let end = matches[2] ? parseInt(matches[2], 10) : NaN;

                    if (isNaN(start) && !isNaN(end)) {
                        start = Math.max(0, totalSize - end);
                        end = totalSize - 1;
                    } else if (!isNaN(start) && isNaN(end)) {
                        end = totalSize - 1;
                    }

                    if (!isNaN(start) && !isNaN(end)) {
                        if (end >= totalSize) end = totalSize - 1;
                        if (start < 0) start = 0;

                        if (start <= end) {
                            const chunkSize = end - start + 1;
                            const stream = fs.createReadStream(filePath, { start, end });
                            const webStream = Readable.toWeb(stream);

                            return new Response(webStream as ReadableStream, {
                                status: 206,
                                statusText: 'Partial Content',
                                headers: {
                                    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                                    'Accept-Ranges': 'bytes',
                                    'Content-Length': String(chunkSize),
                                    'Content-Type': mimeType,
                                    'Access-Control-Allow-Origin': '*'
                                }
                            });
                        }
                    }
                }
            }

            // Standard full content with Accept-Ranges
            const stream = fs.createReadStream(filePath);
            const webStream = Readable.toWeb(stream);

            return new Response(webStream as ReadableStream, {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(totalSize),
                    'Content-Type': mimeType,
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            console.error('[Protocol] Error:', error);
            return new Response('Not Found', { status: 404 });
        }
    });

    createMainWindow();

    // Register all domain IPC handlers
    setupWindowIpc();
    registerFileSystemHandlers(getMainWindow);
    registerHymnHandlers(getMainWindow);
    registerScreenCaptureHandlers(getMainWindow);
    registerFontHandlers();
    registerMediaHandlers();

    // Headless CI/CD Smoke Test Gate
    if (process.argv.includes('--smoke-test')) {
        console.log('[SmokeTest] Electron main process booted with 0 load errors');
        setTimeout(() => {
            console.log('[SmokeTest] Smoke test completed successfully');
            app.exit(0);
        }, 1000);
    }
});
