import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATES_DIR = path.join(app.getPath('userData'), 'templates');
export const HYMNALS_DIR = path.join(app.getPath('userData'), 'Hymnals');
export const CUSTOM_HYMNALS_DIR = path.join(HYMNALS_DIR, 'custom');
export const BUNDLED_RUNTIME_HYMNALS_DIR = path.join(HYMNALS_DIR, 'bundled');

const resolveBundledDir = (name: string): string => {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, name);
    }
    const devPath = path.join(__dirname, '..', name);
    if (fs.existsSync(devPath)) return devPath;
    const appPath = path.join(app.getAppPath(), name);
    if (fs.existsSync(appPath)) return appPath;
    return path.join(__dirname, '../../', name);
};

export const BUNDLED_TEMPLATES_DIR = resolveBundledDir('bundled-templates');
export const BUNDLED_HYMNALS_DIR = resolveBundledDir('bundled-hymnals');

/**
 * Initializes required directories and migrates legacy hymnals to custom/ subfolder.
 */
export function initHymnDirectoriesAndMigration(): void {
    const dirs = [TEMPLATES_DIR, HYMNALS_DIR, CUSTOM_HYMNALS_DIR, BUNDLED_RUNTIME_HYMNALS_DIR];
    for (const d of dirs) {
        if (!fs.existsSync(d)) {
            try { fs.mkdirSync(d, { recursive: true }); } catch { }
        }
    }

    try {
        const rootItems = fs.readdirSync(HYMNALS_DIR, { withFileTypes: true });
        for (const item of rootItems) {
            if (item.name === 'custom' || item.name === 'bundled' || !item.isDirectory()) {
                continue;
            }
            const srcPath = path.join(HYMNALS_DIR, item.name);
            const destPath = path.join(CUSTOM_HYMNALS_DIR, item.name);
            try {
                if (fs.existsSync(destPath)) {
                    const uniqueDest = path.join(CUSTOM_HYMNALS_DIR, `${item.name}-${Date.now()}`);
                    fs.renameSync(srcPath, uniqueDest);
                    console.log(`Migrated legacy hymnal folder '${item.name}' to custom/ (renamed to avoid collision)`);
                } else {
                    fs.renameSync(srcPath, destPath);
                    console.log(`Migrated legacy hymnal folder '${item.name}' to custom/`);
                }
            } catch (innerError) {
                console.error(`Failed to migrate folder '${item.name}':`, innerError);
            }
        }
    } catch (e) {
        console.error('Migration to custom/ failed:', e);
    }
}

/**
 * Seeds bundled templates into the user's template folder if not already present.
 */
export function seedBundledTemplates(): void {
    try {
        if (!fs.existsSync(BUNDLED_TEMPLATES_DIR)) {
            console.log('No bundled-templates directory found, skipping seed.');
            return;
        }

        const bundledFiles = fs.readdirSync(BUNDLED_TEMPLATES_DIR).filter(f => f.endsWith('.ektmp'));
        if (bundledFiles.length === 0) return;

        for (const file of bundledFiles) {
            const dest = path.join(TEMPLATES_DIR, file);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(path.join(BUNDLED_TEMPLATES_DIR, file), dest);
                console.log(`Seeded bundled template: ${file}`);
            }
        }
    } catch (error) {
        console.error('Failed to seed bundled templates:', error);
    }
}

/**
 * Recursively copies a folder or file.
 */
export async function copyRecursive(src: string, dest: string): Promise<void> {
    const stats = await fs.promises.stat(src);
    if (stats.isDirectory()) {
        await fs.promises.mkdir(dest, { recursive: true });
        const entries = await fs.promises.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        const shouldOverwrite = path.basename(src) === 'hymnal.json' || !fs.existsSync(dest);
        if (shouldOverwrite) {
            await fs.promises.copyFile(src, dest);
        }
    }
}

/**
 * Seeds bundled hymnals from application bundle into runtime directory.
 */
export async function seedBundledHymnals(): Promise<void> {
    try {
        if (!fs.existsSync(BUNDLED_HYMNALS_DIR)) {
            console.log('No bundled-hymnals directory found, skipping seed.');
            return;
        }

        const langs = await fs.promises.readdir(BUNDLED_HYMNALS_DIR);
        for (const lang of langs) {
            const langPath = path.join(BUNDLED_HYMNALS_DIR, lang);
            const stat = await fs.promises.stat(langPath);
            if (stat.isDirectory()) {
                const hymnals = await fs.promises.readdir(langPath);
                for (const hymnal of hymnals) {
                    const src = path.join(langPath, hymnal);
                    const hymnalStat = await fs.promises.stat(src);
                    if (hymnalStat.isDirectory()) {
                        const dest = path.join(BUNDLED_RUNTIME_HYMNALS_DIR, lang, hymnal);
                        await copyRecursive(src, dest);
                        console.log(`Seeded bundled hymnal: ${hymnal} (${lang})`);
                    } else if (src.endsWith('.ektp')) {
                        const dest = path.join(BUNDLED_RUNTIME_HYMNALS_DIR, lang, hymnal);
                        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
                        if (!fs.existsSync(dest)) {
                            await fs.promises.copyFile(src, dest);
                            console.log(`Seeded bundled hymnal package: ${hymnal} (${lang})`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to seed bundled hymnals:', error);
    }
}

