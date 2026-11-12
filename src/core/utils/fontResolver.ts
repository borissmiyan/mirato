/**
 * Font Resolver & Name Normalizer
 * Resolves font names across platforms (Windows DirectWrite, macOS CoreText, Web).
 * Normalizes PostScript names, CamelCase names, and embedded weight/style suffixes.
 */

export interface NormalizedFontInfo {
    /** The clean, human-readable family name (e.g. "Trajan Pro 3", "Century Gothic") */
    family: string;
    /** The original raw name from slide or file (e.g. "TrajanPro3-Regular", "CenturyGothic-Bold") */
    rawName: string;
    /** Inferred font weight if embedded in the name (e.g. '700' from '-Bold') */
    inferredWeight?: string;
    /** Inferred font style if embedded in the name (e.g. 'italic') */
    inferredStyle?: 'italic' | 'normal';
    /** Robust CSS font-family string with fallbacks for Windows and macOS */
    cssFontStack: string;
}

const STYLE_SUFFIXES: Record<string, { weight: string; isItalic?: boolean }> = {
    'thin': { weight: '100' },
    'hairline': { weight: '100' },
    'extralight': { weight: '200' },
    'ultralight': { weight: '200' },
    'light': { weight: '300' },
    'regular': { weight: '400' },
    'normal': { weight: '400' },
    'book': { weight: '400' },
    'medium': { weight: '500' },
    'semibold': { weight: '600' },
    'demibold': { weight: '600' },
    'bold': { weight: '700' },
    'extrabold': { weight: '800' },
    'ultrabold': { weight: '800' },
    'black': { weight: '900' },
    'heavy': { weight: '900' },
    'italic': { weight: '400', isItalic: true },
    'oblique': { weight: '400', isItalic: true },
    'bolditalic': { weight: '700', isItalic: true },
};

/**
 * Normalizes a raw font family string into a robust multi-fallback CSS font-family stack.
 */
export function resolveFontFamily(rawName: string | undefined | null): NormalizedFontInfo {
    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return {
            family: 'Inter',
            rawName: 'Inter',
            cssFontStack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        };
    }

    const trimmed = rawName.trim();

    // If it's already a comma-separated font stack, return as-is
    if (trimmed.includes(',')) {
        const primary = trimmed.split(',')[0].replace(/['"]/g, '').trim();
        return {
            family: primary,
            rawName: trimmed,
            cssFontStack: trimmed
        };
    }

    // Strip quotes for parsing
    const clean = trimmed.replace(/^["']|["']$/g, '');

    let detectedWeight: string | undefined;
    let detectedStyle: 'italic' | 'normal' | undefined;

    // 1. Separate by hyphen or underscore (common in PostScript names like Arial-Bold, TrajanPro-Regular)
    const parts = clean.split(/[-_]/);
    let baseName = parts[0];

    if (parts.length > 1) {
        const suffix = parts.slice(1).join('').toLowerCase();
        for (const [key, meta] of Object.entries(STYLE_SUFFIXES)) {
            if (suffix.includes(key)) {
                detectedWeight = meta.weight;
                if (meta.isItalic) detectedStyle = 'italic';
                break;
            }
        }
    }

    // Remove technical font suffixes (PSMT, MT, Pro, etc. when trailing)
    let spacedName = baseName
        .replace(/([a-z])([A-Z0-9])/g, '$1 $2') // CamelCase to space: CenturyGothic -> Century Gothic
        .replace(/([0-9]+)/g, ' $1')          // Trajan3 -> Trajan 3
        .replace(/\s+/g, ' ')
        .trim();

    // Check if whole clean name ended in style words without hyphen (e.g. "Century Gothic Bold")
    for (const [key, meta] of Object.entries(STYLE_SUFFIXES)) {
        const re = new RegExp(`\\b${key}\\b`, 'i');
        if (re.test(spacedName)) {
            if (!detectedWeight) detectedWeight = meta.weight;
            if (meta.isItalic) detectedStyle = 'italic';
            spacedName = spacedName.replace(re, '').replace(/\s+/g, ' ').trim();
        }
    }

    // Generic fallback category
    const lower = clean.toLowerCase();
    let genericFallback = 'sans-serif';
    if (lower.includes('serif') || lower.includes('roman') || lower.includes('trajan') || lower.includes('garamond') || lower.includes('minion')) {
        genericFallback = 'serif';
    } else if (lower.includes('mono') || lower.includes('code') || lower.includes('console')) {
        genericFallback = 'monospace';
    } else if (lower.includes('script') || lower.includes('hand') || lower.includes('caveat') || lower.includes('lobster')) {
        genericFallback = 'cursive';
    }

    // Assemble unique candidates for the CSS font stack
    const candidates = new Set<string>();

    if (spacedName) candidates.add(spacedName);
    if (baseName && baseName !== spacedName) candidates.add(baseName);
    if (clean && clean !== spacedName && clean !== baseName) candidates.add(clean);

    // Common system equivalents
    if (spacedName.toLowerCase().includes('trajan')) {
        candidates.add('Trajan Pro 3');
        candidates.add('Trajan Pro');
        candidates.add('TrajanPro3-Regular');
    }

    const quotedCandidates = Array.from(candidates).map(name => `"${name}"`);
    quotedCandidates.push(genericFallback);

    return {
        family: spacedName || clean,
        rawName: clean,
        inferredWeight: detectedWeight,
        inferredStyle: detectedStyle,
        cssFontStack: quotedCandidates.join(', ')
    };
}
