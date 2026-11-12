import { app, dialog, ipcMain, shell, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export function registerFileSystemHandlers(getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('select-file', async (_event, options) => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'] }
                ],
                ...options
            });
            
            if (result.canceled) return null;
            return result.filePaths;
        } catch (error) {
            console.error('IPC: select-file error:', error);
            return null;
        }
    });

    ipcMain.handle('select-folder', async () => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory']
            });
            return result.filePaths[0];
        } catch (error) {
            console.error('IPC: select-folder error:', error);
            return null;
        }
    });

    ipcMain.handle('shell:show-item-in-folder', async (_event, fullPath: string) => {
        try {
            if (fullPath && fs.existsSync(fullPath)) {
                shell.showItemInFolder(fullPath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('IPC: shell:show-item-in-folder error:', error);
            return false;
        }
    });

    ipcMain.handle('read-directory-recursive', async (_event, dirPath, customExtensions?: string[]) => {
        const IGNORED_DIRS = new Set([
            '.git', 'node_modules', '.Spotlight-V100', '.Trashes', '.fseventsd',
            '.DocumentRevisions-V100', '.TemporaryItems', 'Library', '$RECYCLE.BIN',
            'System Volume Information', 'Caches', '.cache'
        ]);

        const validExtensions = (Array.isArray(customExtensions) && customExtensions.length > 0)
            ? customExtensions.map(e => e.toLowerCase())
            : ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

        const results: string[] = [];
        const MAX_FILES = 2500;

        async function walk(dir: string, depth: number) {
            if (depth > 5 || results.length >= MAX_FILES) return;
            try {
                const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const dirent of dirents) {
                    if (results.length >= MAX_FILES) break;
                    if (dirent.name.startsWith('.') || IGNORED_DIRS.has(dirent.name)) continue;

                    const fullPath = path.resolve(dir, dirent.name);
                    if (dirent.isDirectory()) {
                        await walk(fullPath, depth + 1);
                    } else if (dirent.isFile()) {
                        const ext = path.extname(dirent.name).toLowerCase();
                        if (validExtensions.includes(ext) || validExtensions.includes('*')) {
                            results.push(fullPath);
                        }
                    }
                }
            } catch {}
        }

        try {
            await walk(dirPath, 0);
            return results.map(f => ({
                id: crypto.randomUUID(),
                name: path.basename(f),
                url: `local-resource://localhost${f.startsWith('/') ? '' : '/'}${f}`
            }));
        } catch (err) {
            console.error('Error reading directory:', err);
            return [];
        }
    });

    ipcMain.handle('read-file-data', async (_event, filePath: string) => {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap: Record<string, string> = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.mp3': 'audio/mpeg',
                '.aac': 'audio/aac',
                '.wav': 'audio/wav',
                '.m4a': 'audio/mp4',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mov': 'video/quicktime',
                '.ektp': 'application/zip',
                '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            };

            const mimeType = mimeMap[ext];
            if (!mimeType) {
                console.warn(`[IPC:read-file-data] Blocked reading file with unsupported extension: ${ext}`);
                return null;
            }

            const buffer = await fs.promises.readFile(filePath);
            return {
                data: buffer,
                mimeType
            };
        } catch (error) {
            console.error('IPC: read-file-data error:', error);
            return null;
        }
    });

    ipcMain.handle('export:save-file', async (_event, { filename, data, title, filters }) => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: title || 'Save File',
                defaultPath: filename,
                filters: filters || []
            });

            if (!result.canceled && result.filePath) {
                await fs.promises.writeFile(result.filePath, Buffer.from(data));
                return true;
            }
            return false;
        } catch (error) {
            console.error('IPC: export:save-file error:', error);
            return false;
        }
    });

    ipcMain.handle('export:save-collection', async (_event, { folderPath, files }) => {
        try {
            for (const file of files) {
                const filePath = path.join(folderPath, file.filename);
                await fs.promises.writeFile(filePath, Buffer.from(file.data));
            }
            return true;
        } catch (error) {
            console.error('IPC: export:save-collection error:', error);
            return false;
        }
    });

    ipcMain.handle('get-file-stats', async (_event, filePath: string) => {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                mtime: stats.mtimeMs
            };
        } catch {
            return null;
        }
    });

    ipcMain.handle('backup:save-snapshot', async (_event, data: string) => {
        try {
            const backupDir = path.join(app.getPath('userData'), 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `deck-ce-backup-${timestamp}.json`;
            const filePath = path.join(backupDir, filename);
            await fs.promises.writeFile(filePath, data, 'utf8');

            const files = await fs.promises.readdir(backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('deck-ce-backup-') && f.endsWith('.json'))
                .sort()
                .reverse();

            for (let i = 10; i < backupFiles.length; i++) {
                await fs.promises.unlink(path.join(backupDir, backupFiles[i])).catch(() => {});
            }
            return { success: true, path: filePath };
        } catch (err) {
            console.error('IPC: backup:save-snapshot error:', err);
            return { success: false, error: String(err) };
        }
    });
}

