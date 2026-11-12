import { ipcMain, powerSaveBlocker } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
let wakeLockId: number | null = null;

export function registerFontHandlers(): void {
    ipcMain.handle('font:install-system', async (_event, { fileName, data, fontName }: { fileName: string; data: number[]; fontName: string }) => {
        try {
            const buffer = Buffer.from(data);
            const ext = path.extname(fileName).toLowerCase() || '.ttf';
            const cleanBase = path.basename(fileName, ext);
            const targetFileName = `${cleanBase}${ext}`;

            if (process.platform === 'win32') {
                // audit-ignore: Node.js main process environment
                const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
                const fontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
                if (!fs.existsSync(fontsDir)) {
                    fs.mkdirSync(fontsDir, { recursive: true });
                }
                const targetPath = path.join(fontsDir, targetFileName);
                await fs.promises.writeFile(targetPath, buffer);

                // Register font in HKCU registry so Windows DirectWrite & GDI recognize it
                const isOtf = ext === '.otf';
                const fontTypeDesc = isOtf ? '(OpenType)' : '(TrueType)';
                const regKeyName = `${fontName || cleanBase} ${fontTypeDesc}`;
                const psCommand = `Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" -Name "${regKeyName}" -Value "${targetPath}" -Type String -Force`;
                try {
                    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand]);
                } catch (regErr) {
                    console.warn('[Font] Failed to register font in Windows Registry:', regErr);
                }

                console.log(`[Font] Installed to Windows user fonts: ${targetPath}`);
                return { success: true, path: targetPath };
            } else if (process.platform === 'darwin') {
                const fontsDir = path.join(os.homedir(), 'Library', 'Fonts');
                if (!fs.existsSync(fontsDir)) {
                    fs.mkdirSync(fontsDir, { recursive: true });
                }
                const targetPath = path.join(fontsDir, targetFileName);
                await fs.promises.writeFile(targetPath, buffer);
                console.log(`[Font] Installed to macOS user fonts: ${targetPath}`);
                return { success: true, path: targetPath };
            } else {
                const fontsDir = path.join(os.homedir(), '.local', 'share', 'fonts');
                if (!fs.existsSync(fontsDir)) {
                    fs.mkdirSync(fontsDir, { recursive: true });
                }
                const targetPath = path.join(fontsDir, targetFileName);
                await fs.promises.writeFile(targetPath, buffer);
                return { success: true, path: targetPath };
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[IPC] font:install-system error:', err);
            return { success: false, error: message };
        }
    });

    ipcMain.handle('power:set-wake-lock', (_event, enabled: boolean) => {
        console.log(`[Power] Set wake lock: ${enabled}`);
        if (enabled) {
            if (wakeLockId === null) {
                wakeLockId = powerSaveBlocker.start('prevent-display-sleep');
                console.log(`[Power] Wake lock started (ID: ${wakeLockId})`);
            }
        } else {
            if (wakeLockId !== null) {
                powerSaveBlocker.stop(wakeLockId);
                console.log(`[Power] Wake lock stopped (ID: ${wakeLockId})`);
                wakeLockId = null;
            }
        }
        return true;
    });
}

