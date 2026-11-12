import { db } from '@/core/db';
import { IPresentationFile, ICanvasSlide } from '@/core/types';
import { ipcService } from '@/core/services/ipcService';
import { loadFontOffline } from '@/core/utils/fontLoader';
import { resolveFontFamily } from '@/core/utils/fontResolver';

class FontInstallerService {
    private registeredFonts = new Set<string>();

    /**
     * Dynamically registers a font in the browser's Document FontFaceSet on the fly.
     * This makes the font immediately active in the current window without restarting.
     */
    async registerFontFace(
        family: string, 
        data: ArrayBuffer | Uint8Array | Blob, 
        weight: string = '400', 
        style: string = 'normal'
    ): Promise<boolean> {
        try {
            let buffer: ArrayBuffer;
            if (data instanceof Blob) {
                buffer = await data.arrayBuffer();
            } else if (data instanceof Uint8Array) {
                buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
            } else {
                buffer = data;
            }

            const fontFace = new FontFace(family, buffer, { weight, style });
            await fontFace.load();
            document.fonts.add(fontFace);
            this.registeredFonts.add(family.toLowerCase());
            console.log(`[FontInstaller] Successfully registered FontFace for "${family}" (${weight})`);
            return true;
        } catch (error) {
            console.warn(`[FontInstaller] Failed to register FontFace for "${family}":`, error);
            return false;
        }
    }

    /**
     * Installs font permanently to the operating system via Electron IPC.
     * - Windows: %LOCALAPPDATA%\Microsoft\Windows\Fonts + HKCU Registry
     * - macOS: ~/Library/Fonts/
     */
    async installFontToSystem(
        fileName: string, 
        data: ArrayBuffer | Uint8Array | Blob, 
        fontName: string
    ): Promise<{ success: boolean; path?: string; error?: string }> {
        if (!ipcService.isElectron()) {
            return { success: false, error: 'Not in Electron environment' };
        }

        try {
            let array: number[];
            if (data instanceof Blob) {
                const buf = await data.arrayBuffer();
                array = Array.from(new Uint8Array(buf));
            } else if (data instanceof Uint8Array) {
                array = Array.from(data);
            } else {
                array = Array.from(new Uint8Array(data));
            }

            const result = await ipcService.invoke<{ success: boolean; path?: string; error?: string }>(
                'font:install-system', 
                { fileName, data: array, fontName }
            );
            return result;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[FontInstaller] Failed to install font to system "${fontName}":`, error);
            return { success: false, error: message };
        }
    }

    /**
     * Ensures all fonts referenced in the presentation are loaded:
     * 1. Offline-loads standard bundled fonts via fontLoader
     * 2. Searches db.mediaPool for custom fonts matching family name
     * 3. Registers them on the fly in document.fonts
     * 4. Triggers background installation to the OS
     */
    async ensurePresentationFonts(presentation: IPresentationFile): Promise<void> {
        if (!presentation || !presentation.slides) return;

        const fontsInSlides = new Set<string>();

        // Collect all font families used across slides
        for (const slide of presentation.slides) {
            if (slide.type === 'normal') {
                const s = slide as ICanvasSlide;
                if (s.content?.canvasItems) {
                    for (const item of s.content.canvasItems) {
                        if (item.type === 'text' && item.text?.fontFamily) {
                            fontsInSlides.add(item.text.fontFamily);
                        }
                    }
                }
            }
        }

        for (const rawFont of fontsInSlides) {
            const { family, rawName } = resolveFontFamily(rawFont);

            // 1. Try bundled fonts loader
            await loadFontOffline(family);
            if (rawName !== family) {
                await loadFontOffline(rawName);
            }

            // 2. Check if font is already active in document
            if (document.fonts.check(`12px "${family}"`)) {
                continue;
            }

            // 3. Look for custom font binary in db.mediaPool
            try {
                const fontItem = await db.mediaPool
                    .filter(item => {
                        const name = item.name.toLowerCase();
                        const fam = family.toLowerCase();
                        const raw = rawName.toLowerCase();
                        const isFontExt = name.endsWith('.ttf') || name.endsWith('.otf') || name.endsWith('.woff') || name.endsWith('.woff2');
                        return (name.includes(fam) || name.includes(raw) || item.path?.includes('fonts')) && (isFontExt || item.type === 'font');
                    })
                    .first();

                if (fontItem && fontItem.data) {
                    await this.registerFontFace(family, fontItem.data);
                    // Also register under rawName if different
                    if (rawName !== family) {
                        await this.registerFontFace(rawName, fontItem.data);
                    }

                    // Install to OS in background
                    this.installFontToSystem(fontItem.name, fontItem.data, family).catch(() => {});
                }
            } catch (err) {
                console.warn(`[FontInstaller] Error searching media pool for font "${family}":`, err);
            }
        }
    }
}

export const fontInstallerService = new FontInstallerService();
