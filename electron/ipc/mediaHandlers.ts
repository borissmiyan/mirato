import { app, ipcMain, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';

export const MEDIA_VIDEOS_DIR = path.join(app.getPath('userData'), 'media', 'videos');
export const MEDIA_AUDIO_DIR = path.join(app.getPath('userData'), 'media', 'audio');
export const MEDIA_IMAGES_DIR = path.join(app.getPath('userData'), 'media', 'images');

export function initMediaDirectories(): void {
    if (!fs.existsSync(MEDIA_VIDEOS_DIR)) {
        try { fs.mkdirSync(MEDIA_VIDEOS_DIR, { recursive: true }); } catch { }
    }
    if (!fs.existsSync(MEDIA_AUDIO_DIR)) {
        try { fs.mkdirSync(MEDIA_AUDIO_DIR, { recursive: true }); } catch { }
    }
    if (!fs.existsSync(MEDIA_IMAGES_DIR)) {
        try { fs.mkdirSync(MEDIA_IMAGES_DIR, { recursive: true }); } catch { }
    }
}

export function registerMediaHandlers(): void {
    initMediaDirectories();

    ipcMain.handle('media:save-video-blob', async (_event, { hash, ext, buffer }: { hash: string; ext: string; buffer: ArrayBuffer }) => {
        try {
            if (!fs.existsSync(MEDIA_VIDEOS_DIR)) {
                fs.mkdirSync(MEDIA_VIDEOS_DIR, { recursive: true });
            }
            const cleanExt = (ext || 'mp4').replace(/^\./, '');
            const targetPath = path.join(MEDIA_VIDEOS_DIR, `${hash}.${cleanExt}`);
            await fs.promises.writeFile(targetPath, Buffer.from(buffer));
            return targetPath;
        } catch (err) {
            console.error('[IPC] media:save-video-blob error:', err);
            return null;
        }
    });

    ipcMain.handle('media:delete-video-file', async (_event, filePath: string) => {
        try {
            if (filePath && filePath.startsWith(MEDIA_VIDEOS_DIR) && fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[IPC] media:delete-video-file error:', err);
            return false;
        }
    });

    ipcMain.handle('media:compress-video', async (_event, { inputPath, targetResolution = '1080p' }: { inputPath: string; targetResolution?: string }) => {
        try {
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file does not exist: ${inputPath}`);
            }

            const inputStats = await fs.promises.stat(inputPath);
            const originalSize = inputStats.size;

            if (!fs.existsSync(MEDIA_VIDEOS_DIR)) {
                fs.mkdirSync(MEDIA_VIDEOS_DIR, { recursive: true });
            }

            const parsed = path.parse(inputPath);
            const outputPath = path.join(MEDIA_VIDEOS_DIR, `${parsed.name}_compressed_${Date.now()}.mp4`);

            if (process.platform === 'darwin' && fs.existsSync('/usr/bin/avconvert')) {
                const preset = targetResolution === '720p' ? 'Preset1280x720' : 'Preset1920x1080';
                await new Promise<void>((resolve, reject) => {
                    const proc = spawn('/usr/bin/avconvert', ['-p', preset, '-s', inputPath, '-o', outputPath]);
                    let stderr = '';
                    proc.stderr.on('data', (d) => { stderr += d.toString(); });
                    proc.on('close', (code) => {
                        if (code === 0 && fs.existsSync(outputPath)) {
                            resolve();
                        } else {
                            reject(new Error(`avconvert failed with code ${code}: ${stderr}`));
                        }
                    });
                    proc.on('error', reject);
                });
            } else {
                await fs.promises.copyFile(inputPath, outputPath);
            }

            const outputStats = await fs.promises.stat(outputPath);
            return {
                success: true,
                outputPath,
                originalSize,
                compressedSize: outputStats.size
            };
        } catch (err: unknown) {
            console.error('[IPC] media:compress-video error:', err);
            return {
                success: false,
                outputPath: inputPath,
                originalSize: 0,
                compressedSize: 0,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });

    ipcMain.handle('media:save-audio-blob', async (_event, { hash, ext, buffer }: { hash: string; ext: string; buffer: ArrayBuffer }) => {
        try {
            if (!fs.existsSync(MEDIA_AUDIO_DIR)) {
                fs.mkdirSync(MEDIA_AUDIO_DIR, { recursive: true });
            }
            const cleanExt = (ext || 'mp3').replace(/^\./, '');
            const targetPath = path.join(MEDIA_AUDIO_DIR, `${hash}.${cleanExt}`);
            await fs.promises.writeFile(targetPath, Buffer.from(buffer));
            return targetPath;
        } catch (err) {
            console.error('[IPC] media:save-audio-blob error:', err);
            return null;
        }
    });

    ipcMain.handle('media:delete-audio-file', async (_event, filePath: string) => {
        try {
            if (filePath && filePath.startsWith(MEDIA_AUDIO_DIR) && fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[IPC] media:delete-audio-file error:', err);
            return false;
        }
    });

    ipcMain.handle('media:resolve-audio-path', async (_event, { fileId, fileName }: { fileId?: string; fileName?: string }) => {
        try {
            if (!fileId && !fileName) return null;

            if (fileId) {
                const candidates = [
                    path.join(MEDIA_AUDIO_DIR, fileId),
                    path.join(MEDIA_AUDIO_DIR, `${fileId}.mp3`),
                    path.join(MEDIA_AUDIO_DIR, `${fileId}.m4a`),
                    path.join(MEDIA_AUDIO_DIR, `${fileId}.wav`),
                    path.join(MEDIA_AUDIO_DIR, `${fileId}.ogg`),
                    path.join(MEDIA_AUDIO_DIR, `${fileId}.aac`)
                ];
                for (const c of candidates) {
                    if (fs.existsSync(c)) return c;
                }
            }

            if (fileName) {
                const byName = path.join(MEDIA_AUDIO_DIR, fileName);
                if (fs.existsSync(byName)) return byName;
            }

            const home = app.getPath('home');
            const musicRoots = [
                path.join(home, 'Music'),
                path.join(home, 'Music', 'Music', 'Media.localized', 'Music')
            ];

            const findInTree = (dir: string, targetName: string, depth = 0): string | null => {
                if (depth > 6 || !fs.existsSync(dir)) return null;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const full = path.join(dir, entry.name);
                        if (entry.isFile() && (entry.name === targetName || entry.name.toLowerCase() === targetName.toLowerCase())) {
                            return full;
                        }
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            const match = findInTree(full, targetName, depth + 1);
                            if (match) return match;
                        }
                    }
                } catch { }
                return null;
            };

            if (fileName) {
                for (const mr of musicRoots) {
                    const found = findInTree(mr, fileName);
                    if (found) return found;
                }
            }

            return null;
        } catch (err) {
            console.error('[IPC] media:resolve-audio-path error:', err);
            return null;
        }
    });

    ipcMain.handle('system:get-external-volumes', async () => {
        try {
            if (process.platform === 'darwin' && fs.existsSync('/Volumes')) {
                const entries = await fs.promises.readdir('/Volumes');
                const volumes: string[] = [];
                for (const entry of entries) {
                    if (entry === 'Macintosh HD' || entry === 'Recovery' || entry.startsWith('.')) continue;
                    const full = path.join('/Volumes', entry);
                    try {
                        const st = await fs.promises.stat(full);
                        if (st.isDirectory()) {
                            volumes.push(full);
                        }
                    } catch { }
                }
                return volumes;
            }
            return [];
        } catch {
            return [];
        }
    });

    ipcMain.handle('media:compress-audio', async (_event, { inputPath, bitrate = '160000' }: { inputPath: string; bitrate?: string }) => {
        try {
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file does not exist: ${inputPath}`);
            }

            const inputStats = await fs.promises.stat(inputPath);
            const originalSize = inputStats.size;

            if (!fs.existsSync(MEDIA_AUDIO_DIR)) {
                fs.mkdirSync(MEDIA_AUDIO_DIR, { recursive: true });
            }

            const parsed = path.parse(inputPath);
            const outputPath = path.join(MEDIA_AUDIO_DIR, `${parsed.name}_compressed_${Date.now()}.m4a`);

            if (process.platform === 'darwin' && fs.existsSync('/usr/bin/afconvert')) {
                await new Promise<void>((resolve, reject) => {
                    const proc = spawn('/usr/bin/afconvert', [
                        '-f', 'm4af',
                        '-d', 'aac',
                        '-b', String(bitrate),
                        inputPath,
                        outputPath
                    ]);
                    let stderr = '';
                    proc.stderr.on('data', (d) => { stderr += d.toString(); });
                    proc.on('close', (code) => {
                        if (code === 0 && fs.existsSync(outputPath)) {
                            resolve();
                        } else {
                            reject(new Error(`afconvert failed with code ${code}: ${stderr}`));
                        }
                    });
                    proc.on('error', reject);
                });
            } else {
                await fs.promises.copyFile(inputPath, outputPath);
            }

            const outputStats = await fs.promises.stat(outputPath);
            return {
                success: true,
                outputPath,
                originalSize,
                compressedSize: outputStats.size
            };
        } catch (err: unknown) {
            console.error('[IPC] media:compress-audio error:', err);
            return {
                success: false,
                outputPath: inputPath,
                originalSize: 0,
                compressedSize: 0,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });

    ipcMain.handle('cache:clear', async () => {
        try {
            const ses = session.defaultSession;
            if (ses) {
                await ses.clearCache();
                await ses.clearCodeCaches({});
                return { success: true };
            }
            return { success: false, error: 'Session not found' };
        } catch (err: unknown) {
            console.error('[IPC] cache:clear error:', err);
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    ipcMain.handle('cache:get-size', async () => {
        try {
            const ses = session.defaultSession;
            if (ses && typeof ses.getCacheSize === 'function') {
                const bytes = await ses.getCacheSize();
                return { success: true, bytes };
            }
            return { success: false, bytes: 0 };
        } catch (err: unknown) {
            return { success: false, bytes: 0, error: err instanceof Error ? err.message : String(err) };
        }
    });

    ipcMain.handle('media:trim', async (_event, { inputPath, start, end, type = 'video' }: { inputPath: string; start: number; end: number; type?: 'video' | 'audio' }) => {
        try {
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file does not exist: ${inputPath}`);
            }

            const duration = Math.max(0.05, end - start);
            const targetDir = type === 'audio' ? MEDIA_AUDIO_DIR : MEDIA_VIDEOS_DIR;
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const ext = type === 'audio' ? 'm4a' : 'mp4';
            const outputPath = path.join(targetDir, `trimmed_${Date.now()}.${ext}`);

            if (process.platform === 'darwin' && fs.existsSync('/usr/bin/avconvert')) {
                const runConvert = (preset: string) => new Promise<void>((resolve, reject) => {
                    const proc = spawn('/usr/bin/avconvert', [
                        '-s', inputPath,
                        '-o', outputPath,
                        '-p', preset,
                        '--start', String(start),
                        '--duration', String(duration),
                        '--replace'
                    ]);
                    let stderr = '';
                    proc.stderr.on('data', (d) => { stderr += d.toString(); });
                    proc.on('close', (code) => {
                        if (code === 0 && fs.existsSync(outputPath)) {
                            resolve();
                        } else {
                            reject(new Error(`avconvert (${preset}) failed with code ${code}: ${stderr}`));
                        }
                    });
                    proc.on('error', reject);
                });

                try {
                    await runConvert('PresetPassthrough');
                } catch (passErr) {
                    console.warn('[IPC] PresetPassthrough trim fallback to re-encode:', passErr);
                    const fallbackPreset = type === 'audio' ? 'PresetAppleM4A' : 'Preset1920x1080';
                    await runConvert(fallbackPreset);
                }
            } else {
                throw new Error('Native trim is currently only supported on macOS');
            }

            const fileBuffer = await fs.promises.readFile(outputPath);
            return {
                success: true,
                outputPath,
                buffer: fileBuffer.buffer
            };
        } catch (err: unknown) {
            console.error('[IPC] media:trim error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });

    ipcMain.handle('media:proxy', async (_event, { inputPath }: { inputPath: string }) => {
        try {
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file does not exist: ${inputPath}`);
            }

            if (!fs.existsSync(MEDIA_VIDEOS_DIR)) {
                fs.mkdirSync(MEDIA_VIDEOS_DIR, { recursive: true });
            }

            const hash = crypto.createHash('md5').update(inputPath).digest('hex');
            const outputPath = path.join(MEDIA_VIDEOS_DIR, `proxy_${hash}.mp4`);

            if (fs.existsSync(outputPath)) {
                const fileBuffer = await fs.promises.readFile(outputPath);
                return { success: true, outputPath, buffer: fileBuffer.buffer };
            }

            if (process.platform === 'darwin' && fs.existsSync('/usr/bin/avconvert')) {
                await new Promise<void>((resolve, reject) => {
                    const proc = spawn('/usr/bin/avconvert', [
                        '-s', inputPath,
                        '-o', outputPath,
                        '-p', 'Preset960x540',
                        '--replace'
                    ]);
                    let stderr = '';
                    proc.stderr.on('data', (d) => { stderr += d.toString(); });
                    proc.on('close', (code) => {
                        if (code === 0 && fs.existsSync(outputPath)) resolve();
                        else reject(new Error(`avconvert failed with code ${code}: ${stderr}`));
                    });
                    proc.on('error', reject);
                });
            } else {
                throw new Error('Native proxy is currently only supported on macOS');
            }

            const fileBuffer = await fs.promises.readFile(outputPath);
            return {
                success: true,
                outputPath,
                buffer: fileBuffer.buffer
            };
        } catch (err: unknown) {
            console.error('[IPC] media:proxy error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });
}
