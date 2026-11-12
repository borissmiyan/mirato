/**
 * Perform a deep equality check between two values for the purposes of property panels.
 * This replaces JSON.stringify() === JSON.stringify() which is slow and memory intensive.
 */
export function isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
        return false;
    }

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !isEqual(objA[key], objB[key])) {
            return false;
        }
    }

    return true;
}
