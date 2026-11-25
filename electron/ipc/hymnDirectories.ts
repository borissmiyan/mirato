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

        const bundledFiles = fs.readdirSync(BUNDLED_TEMPLATES_DIR).filter(f => f.endsWith('.mrtmp') || f.endsWith('.ektmp'));
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
 * Checks whether a bundled hymnal directory in userData is already up to date
 * with the app bundle's hymnal.json (same manifestVersion and hymn count).
 */
async function isBundledHymnalUpToDate(srcDir: string, destDir: string): Promise<boolean> {
    try {
        const srcManifestPath = path.join(srcDir, 'hymnal.json');
        const destManifestPath = path.join(destDir, 'hymnal.json');
        if (!fs.existsSync(srcManifestPath) || !fs.existsSync(destManifestPath)) {
            return false;
        }
        const [srcRaw, destRaw] = await Promise.all([
            fs.promises.readFile(srcManifestPath, 'utf-8'),
            fs.promises.readFile(destManifestPath, 'utf-8'),
        ]);
        const srcJson = JSON.parse(srcRaw) as { manifestVersion?: number; hymns?: unknown[] };
        const destJson = JSON.parse(destRaw) as { manifestVersion?: number; hymns?: unknown[] };
        const srcVer = srcJson.manifestVersion ?? 0;
        const destVer = destJson.manifestVersion ?? 0;
        const srcLen = Array.isArray(srcJson.hymns) ? srcJson.hymns.length : 0;
        const destLen = Array.isArray(destJson.hymns) ? destJson.hymns.length : 0;
        return srcVer > 0 && srcVer === destVer && srcLen === destLen;
    } catch {
        return false;
    }
}

/**
 * Seeds bundled hymnals from application bundle into runtime directory.
 * Skips hymnals whose manifestVersion and hymn count already match to avoid
 * scanning/copying thousands of .mrtp files on every launch.
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
                        if (await isBundledHymnalUpToDate(src, dest)) {
                            continue;
                        }
                        await copyRecursive(src, dest);
                        // Prune stale .ektp/.mrtp files from previous bundled versions
                        try {
                            const srcFiles = new Set(await fs.promises.readdir(src));
                            const destFiles = await fs.promises.readdir(dest);
                            for (const df of destFiles) {
                                if ((df.endsWith('.ektp') || df.endsWith('.mrtp')) && !srcFiles.has(df)) {
                                    await fs.promises.unlink(path.join(dest, df)).catch(() => {});
                                }
                            }
                        } catch { /* ignore prune errors */ }
                        console.log(`Seeded bundled hymnal: ${hymnal} (${lang})`);
                    } else if (src.endsWith('.mrtp') || src.endsWith('.ektp')) {
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

