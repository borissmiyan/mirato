/**
 * Canonical Mirato file extensions with full backward compatibility for legacy .ekt* formats.
 * Under the hood, archive formats are 100% identical; legacy extensions are accepted on import
 * and automatically normalized to Mirato extensions on export/save.
 */

export type MiratoFileKind = 'service' | 'presentation' | 'template' | 'gracelib';

export const MIRATO_EXT: Record<MiratoFileKind, string> = {
    service: '.mrt',
    presentation: '.mrtp',
    template: '.mrtmp',
    gracelib: '.mrtgl',
};

export const LEGACY_EXT: Record<MiratoFileKind, string> = {
    service: '.ekt',
    presentation: '.ektp',
    template: '.ektmp',
    gracelib: '.ektgl',
};

export const ACCEPTED_EXT: Record<MiratoFileKind, readonly [string, string]> = {
    service: ['.mrt', '.ekt'],
    presentation: ['.mrtp', '.ektp'],
    template: ['.mrtmp', '.ektmp'],
    gracelib: ['.mrtgl', '.ektgl'],
};

export const ACCEPTED_EXT_BARE: Record<MiratoFileKind, readonly [string, string]> = {
    service: ['mrt', 'ekt'],
    presentation: ['mrtp', 'ektp'],
    template: ['mrtmp', 'ektmp'],
    gracelib: ['mrtgl', 'ektgl'],
};

export function isServiceFilename(filename: string): boolean {
    const low = filename.toLowerCase();
    return low.endsWith('.mrt') || low.endsWith('.ekt');
}

export function isPresentationFilename(filename: string): boolean {
    const low = filename.toLowerCase();
    return low.endsWith('.mrtp') || low.endsWith('.ektp');
}

export function isTemplateFilename(filename: string): boolean {
    const low = filename.toLowerCase();
    return low.endsWith('.mrtmp') || low.endsWith('.ektmp');
}

export function isGraceLibFilename(filename: string): boolean {
    const low = filename.toLowerCase();
    return low.endsWith('.mrtgl') || low.endsWith('.ektgl');
}

/**
 * Strips any known Mirato or legacy extension from a filename.
 */
export function stripMiratoExtension(filename: string): string {
    return filename.replace(/\.(mrtmp|ektmp|mrtgl|ektgl|mrtp|ektp|mrt|ekt)$/i, '');
}

/**
 * Normalizes a filename to the canonical Mirato extension for the given kind,
 * automatically converting legacy .ekt/.ektp/.ektmp/.ektgl names.
 */
export function toMiratoFilename(filename: string, kind: MiratoFileKind): string {
    const targetExt = MIRATO_EXT[kind];
    const base = stripMiratoExtension(filename);
    return `${base}${targetExt}`;
}

/**
 * Yields control back to the browser/Electron event loop so large archive operations
 * (100+ presentations) keep UI responsive and allow GC to reclaim temporary buffers.
 */
export function yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
