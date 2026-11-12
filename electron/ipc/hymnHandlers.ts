import { dialog, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import JSZip from 'jszip';
import {
    TEMPLATES_DIR,
    HYMNALS_DIR,
    CUSTOM_HYMNALS_DIR,
    BUNDLED_HYMNALS_DIR,
    initHymnDirectoriesAndMigration,
    seedBundledTemplates,
    seedBundledHymnals,
    copyRecursive
} from './hymnDirectories';
import {
    readHymnalManifest,
    readHymnalCover,
    scanHymnals
} from './hymnManifestHelper';

export {
    TEMPLATES_DIR,
    HYMNALS_DIR,
    CUSTOM_HYMNALS_DIR,
    BUNDLED_RUNTIME_HYMNALS_DIR,
    BUNDLED_TEMPLATES_DIR,
    BUNDLED_HYMNALS_DIR,
    initHymnDirectoriesAndMigration,
    seedBundledTemplates,
    seedBundledHymnals,
    copyRecursive
} from './hymnDirectories';

/**
 * Registers IPC handlers for hymnal and template operations.
 */
export function registerHymnHandlers(getMainWindow: () => BrowserWindow | null): void {
    initHymnDirectoriesAndMigration();

    // --- Template Management IPCs ---
    ipcMain.handle('templates:list', async () => {
        try {
            const files = await fs.promises.readdir(TEMPLATES_DIR);
            return files.filter(f => f.endsWith('.ektmp'));
        } catch (error) {
            console.error('Error listing templates:', error);
            return [];
        }
    });

    ipcMain.handle('templates:read', async (_event, filename: string) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            return await fs.promises.readFile(filePath);
        } catch (error) {
            console.error('Error reading template:', error);
            return null;
        }
    });

    ipcMain.handle('templates:write', async (_event, filename: string, data: Uint8Array) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            await fs.promises.writeFile(filePath, Buffer.from(data));
            return true;
        } catch (error) {
            console.error('Error writing template:', error);
            return false;
        }
    });

    ipcMain.handle('templates:delete', async (_event, filename: string) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Error deleting template:', error);
            return false;
        }
    });

    ipcMain.handle('templates:get-path', () => TEMPLATES_DIR);
    ipcMain.handle('hymns:get-path', () => HYMNALS_DIR);

    ipcMain.handle('templates:seed-bundled', () => {
        seedBundledTemplates();
        return true;
    });

    ipcMain.handle('hymns:seed-bundled', async () => {
        await seedBundledHymnals();
        return true;
    });

    ipcMain.handle('hymns:list-hymnals', async (_event, libraryDir: string) => {
        return await scanHymnals(libraryDir, BUNDLED_HYMNALS_DIR);
    });

    ipcMain.handle('hymns:import-custom', async () => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showOpenDialog(mainWindow!, {
                title: 'Выберите папку со сборником',
                properties: ['openDirectory']
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const srcDir = result.filePaths[0];
            const manifestPath = path.join(srcDir, 'hymnal.json');

            if (!fs.existsSync(manifestPath)) {
                return { success: false, error: 'missing_manifest' };
            }

            const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
            let manifest;
            try {
                manifest = JSON.parse(manifestContent);
            } catch {
                return { success: false, error: 'invalid_manifest' };
            }

            if (!manifest.id || !manifest.name || !manifest.language || !manifest.hymns || !Array.isArray(manifest.hymns) || manifest.hymns.length === 0) {
                return { success: false, error: 'invalid_manifest' };
            }

            const dirName = `${path.basename(srcDir)}-${crypto.randomUUID().slice(0, 8)}`;
            const destDir = path.join(CUSTOM_HYMNALS_DIR, dirName);

            await copyRecursive(srcDir, destDir);
            return { success: true, manifest, dirName };
        } catch (error) {
            console.error('Failed to import custom hymnal:', error);
            return { success: false, error: 'import_failed' };
        }
    });

    ipcMain.handle('hymns:remove-custom', async (_event, dirName: string) => {
        try {
            if (!dirName) return false;
            const targetDir = path.join(CUSTOM_HYMNALS_DIR, dirName);
            if (fs.existsSync(targetDir)) {
                await fs.promises.rm(targetDir, { recursive: true, force: true });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to remove custom hymnal:', error);
            return false;
        }
    });

    ipcMain.handle('hymns:generate-template', async () => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showOpenDialog(mainWindow!, {
                title: 'Выберите папку для создания шаблона',
                properties: ['openDirectory'],
                buttonLabel: 'Создать шаблон здесь'
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const targetDir = result.filePaths[0];
            const manifest = {
                id: 'my-custom-hymnal',
                name: 'My Custom Hymnal',
                description: 'A custom collection of hymns',
                language: 'en',
                version: '1.0.0',
                publisher: 'Your Name',
                hymns: [
                    {
                        hymn_id: 'example-1',
                        number: 1,
                        title: 'Amazing Grace',
                        file: '001-example/index.ektp',
                        lyrics: 'Amazing grace! How sweet the sound'
                    }
                ]
            };

            const presentation = {
                id: 'example-1',
                title: 'Amazing Grace',
                slides: [
                    {
                        id: 's1',
                        type: 'text',
                        text: {
                            content: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!'
                        }
                    }
                ]
            };

            await fs.promises.writeFile(
                path.join(targetDir, 'hymnal.json'),
                JSON.stringify(manifest, null, 2)
            );

            const hymnDir = path.join(targetDir, '001-example');
            await fs.promises.mkdir(hymnDir, { recursive: true });

            const zip = new JSZip();
            zip.file('presentation.json', JSON.stringify(presentation, null, 2));
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

            await fs.promises.writeFile(path.join(hymnDir, 'index.ektp'), zipBuffer);
            return { success: true };
        } catch (error) {
            console.error('Failed to generate template:', error);
            return { success: false, error: 'template_generation_failed' };
        }
    });

    ipcMain.handle('hymns:read-cover', async (_event, hymnalDirPath: string) => {
        return await readHymnalCover(hymnalDirPath);
    });

    ipcMain.handle('hymns:read-manifest', async (_event, hymnalDirPath: string) => {
        return await readHymnalManifest(hymnalDirPath);
    });

    ipcMain.handle('hymns:read-ektp', async (_event, hymnalDirPath: string, filename: string) => {
        try {
            const filePath = path.join(hymnalDirPath, filename);
            return await fs.promises.readFile(filePath);
        } catch (e) {
            console.error('IPC: hymns:read-ektp error:', e);
            return null;
        }
    });
}
