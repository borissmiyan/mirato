/**
 * Tokenizes text into a normalized array of words for indexing and search.
 * Removes punctuation, normalizes to lowercase.
 */
export function extractWords(text: string): string[] {
    if (!text) return [];
    
    // Normalize: lowercase, remove special characters (keep Cyrillic and Latin chars, numbers)
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0);
}

