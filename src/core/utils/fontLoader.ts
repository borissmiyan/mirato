/**
 * Font Loader Utility
 * Handles lazy loading of @fontsource packages to ensure offline availability
 * without bloating the initial bundle.
 */

const FONT_MAP: Record<string, () => Promise<unknown>> = {
    'alice': () => import('@fontsource/alice/400.css'),
    'caveat': () => import('@fontsource/caveat/400.css'),
    'comfortaa': () => import('@fontsource/comfortaa/400.css'),
    'cormorant-garamond': () => import('@fontsource/cormorant-garamond/400.css'),
    'dancing-script': () => import('@fontsource/dancing-script/400.css'),
    'fira-sans': () => import('@fontsource/fira-sans/400.css'),
    'inter': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'lobster': () => import('@fontsource/lobster/400.css'),
    'lora': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'merriweather': () => import('@fontsource/merriweather/400.css'),
    'montserrat': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'nunito': () => import('@fontsource/nunito/400.css'),
    'open-sans': () => import('@fontsource/open-sans/400.css'),
    'oswald': () => import('@fontsource/oswald/400.css'),
    'playfair-display': () => import('@fontsource/playfair-display/400.css'),
    'pt-sans': () => import('@fontsource/pt-sans/400.css'),
    'pt-serif': () => import('@fontsource/pt-serif/400.css'),
    'raleway': () => import('@fontsource/raleway/400.css'),
    'roboto': () => import('@fontsource/roboto/400.css'),
    'ubuntu': () => import('@fontsource/ubuntu/400.css'),
    'crimson-pro': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'trajan-pro': () => Promise.resolve(),
    'trajan-pro-3': () => Promise.resolve(),
};

const BOLD_FONT_MAP: Record<string, () => Promise<unknown>> = {
    'inter': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'montserrat': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'lora': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'crimson-pro': () => Promise.resolve(), // Pre-loaded statically in fonts.ts
    'trajan-pro': () => Promise.resolve(),
    'trajan-pro-3': () => Promise.resolve(),
};

const ITALIC_FONT_MAP: Record<string, () => Promise<unknown>> = {
    'crimson-pro': () => import('@fontsource/crimson-pro/400-italic.css'),
};

const loadedFonts = new Set<string>();

export async function loadFontOffline(family: string, weight: string = '400', style: string = 'normal'): Promise<void> {
    if (!family) return;

    const pkgName = family.toLowerCase().replace(/\s+/g, '-');
    const cacheKey = `${pkgName}-${weight}-${style}`;

    if (loadedFonts.has(cacheKey)) return;

    try {
        if (style === 'italic' && ITALIC_FONT_MAP[pkgName]) {
            await ITALIC_FONT_MAP[pkgName]();
        } else if (weight === '700' && BOLD_FONT_MAP[pkgName]) {
            await BOLD_FONT_MAP[pkgName]();
        } else if (FONT_MAP[pkgName]) {
            await FONT_MAP[pkgName]();
        }
        loadedFonts.add(cacheKey);
    } catch (error) {
        console.warn(`Failed to load font locally: ${family}`, error);
        // Fallback: If we can't load locally (e.g. package missing), we could fallback to CDN
        // but the goal is offline, so we just log it.
    }
};
