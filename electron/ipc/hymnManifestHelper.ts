import path from 'path';
import fs from 'fs';

export interface HymnEntry {
    id: string;
    stableHymnId?: string;
    hymnNumber: number;
    number?: number;
    title: string;
    file?: string;
}

export interface HymnalManifest {
    id: string;
    name: string;
    hymns: HymnEntry[];
}

export interface HymnalScanResult {
    path: string;
    languageFolder?: string;
    isBundled: boolean;
    ektpFileMtimes: Record<string, string>;
}

/**
 * Reads and normalizes a hymnal manifest from directory or generates one from .ektp files.
 */
export async function readHymnalManifest(hymnalDirPath: string): Promise<HymnalManifest> {
    const manifestPath = path.join(hymnalDirPath, 'hymnal.json');
    let manifest: HymnalManifest | null = null;
    try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(raw);
    } catch {
        manifest = {
            id: path.basename(hymnalDirPath).toLowerCase().replace(/\s+/g, '-'),
            name: path.basename(hymnalDirPath),
            hymns: []
        };
    }

    if (!manifest || !manifest.hymns || manifest.hymns.length === 0) {
        if (!manifest) {
            manifest = {
                id: path.basename(hymnalDirPath).toLowerCase().replace(/\s+/g, '-'),
                name: path.basename(hymnalDirPath),
                hymns: []
            };
        }
        try {
            const files = await fs.promises.readdir(hymnalDirPath);
            const ektpFiles = files.filter(f => f.endsWith('.ektp'));

            manifest.hymns = ektpFiles.map(file => {
                const match = file.match(/^(\d+)[-.\s]*(.+)\.ektp$/);
                const numberStr = match ? match[1] : '';
                const title = match ? match[2].trim() : file.replace('.ektp', '');
                const stableId = file.replace('.ektp', '').toLowerCase().replace(/\s+/g, '_');

                return {
                    id: stableId,
                    stableHymnId: `${manifest?.id || ''}_${stableId}`,
                    hymnNumber: parseInt(numberStr, 10) || 0,
                    title,
                    file
                };
            });

            manifest.hymns.sort((a, b) => a.hymnNumber - b.hymnNumber);
        } catch (e) {
            console.error('Failed to read hymnal directory for .ektp files:', e);
            manifest.hymns = [];
        }
    } else {
        let diskFiles: string[] = [];
        try {
            diskFiles = await fs.promises.readdir(hymnalDirPath);
        } catch { }

        manifest.hymns = manifest.hymns.map((h: HymnEntry) => {
            const safeId = (h.id || h.title || '').toString().toLowerCase().replace(/\s+/g, '_');
            const num = h.hymnNumber || h.number || 0;

            let file = h.file;
            if (!file) {
                const match = diskFiles.find(f => f.startsWith(`${num}`) && f.endsWith('.ektp'));
                file = match || `${num} - ${h.title}.ektp`;
            }

            return {
                ...h,
                hymnNumber: num,
                stableHymnId: h.stableHymnId || `${manifest?.id || 'hymnal'}_${safeId}`,
                file
            };
        });
    }

    return manifest;
}

/**
 * Reads the cover image for a hymnal directory and returns base64 data URI.
 */
export async function readHymnalCover(hymnalDirPath: string): Promise<string | null> {
    const candidates = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'];
    for (const filename of candidates) {
        const coverPath = path.join(hymnalDirPath, filename);
        try {
            const data = await fs.promises.readFile(coverPath);
            const ext = path.extname(filename).slice(1).replace('jpg', 'jpeg');
            return `data:image/${ext};base64,${data.toString('base64')}`;
        } catch { }
    }
    return null;
}

/**
 * Recursively scans directory trees to locate custom and bundled hymnal packages.
 */
export async function scanHymnals(libraryDir: string, bundledDir: string): Promise<HymnalScanResult[]> {
    const searchRoots = [
        { dirPath: path.join(libraryDir, 'custom'), isBundled: false },
        { dirPath: path.join(libraryDir, 'bundled'), isBundled: true }
    ];
    if (bundledDir !== libraryDir && fs.existsSync(bundledDir)) {
        searchRoots.push({ dirPath: bundledDir, isBundled: true });
    }
    const results: HymnalScanResult[] = [];
    const seenDirs = new Set<string>();

    async function search(dir: string, depth: number, isBundledRoot: boolean) {
        if (depth > 3) return;
        try {
            const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
            let isHymnalDir = false;

            for (const dirent of dirents) {
                const fullPath = path.join(dir, dirent.name);
                if (dirent.isDirectory()) {
                    await search(fullPath, depth + 1, isBundledRoot);
                } else if (dirent.name === 'hymnal.json' || dirent.name.endsWith('.ektp')) {
                    isHymnalDir = true;
                }
            }

            if (isHymnalDir && !seenDirs.has(dir)) {
                seenDirs.add(dir);
                let languageFolder: string | undefined = undefined;
                const parent = path.dirname(dir);
                const maybeLanguage = path.basename(parent);
                if (['en', 'ru', 'de', 'es', 'uk', 'pl'].includes(maybeLanguage)) {
                    languageFolder = maybeLanguage;
                }

                const ektpFileMtimes: Record<string, string> = {};
                async function collectMtimes(scanDir: string, relBase: string) {
                    try {
                        const entries = await fs.promises.readdir(scanDir, { withFileTypes: true });
                        for (const entry of entries) {
                            const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
                            const fullEntryPath = path.join(scanDir, entry.name);
                            if (entry.isDirectory()) {
                                await collectMtimes(fullEntryPath, relPath);
                            } else if (entry.name.endsWith('.ektp')) {
                                const stat = await fs.promises.stat(fullEntryPath);
                                ektpFileMtimes[relPath] = `${Math.floor(stat.mtimeMs)}_${stat.size}`;
                            }
                        }
                    } catch { }
                }
                await collectMtimes(dir, '');
                results.push({ path: dir, languageFolder, isBundled: isBundledRoot, ektpFileMtimes });
            }
        } catch { }
    }

    for (const root of searchRoots) {
        if (fs.existsSync(root.dirPath)) {
            await search(root.dirPath, 0, root.isBundled);
        }
    }
    return results;
}

