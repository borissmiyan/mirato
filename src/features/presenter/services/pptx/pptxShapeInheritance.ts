/**
 * Searches a slide layout or master document for matching placeholder shape by idx or type.
 */
export function getInheritedShape(
    phType: string | null | undefined,
    phIdx: string | null | undefined,
    doc: Document | null
): Element | null {
    if (!doc) return null;
    const shapes = [
        ...Array.from(doc.getElementsByTagNameNS('*', 'sp')),
        ...Array.from(doc.getElementsByTagNameNS('*', 'pic'))
    ];

    // 1. Precise match: match index if provided, or exact type
    for (const shape of shapes) {
        const ph = shape.getElementsByTagNameNS('*', 'ph')[0];
        if (ph) {
            const pType = ph.getAttribute('type');
            const pIdx = ph.getAttribute('idx');
            if (phIdx && pIdx === phIdx) return shape;
            if (phType && pType && pType.toLowerCase() === phType.toLowerCase()) return shape;
        }
    }

    // 2. Loose fallback: if looking for 'body' or 'title' or 'subTitle', maps to 'obj' placeholder types
    const normalizedType = phType?.toLowerCase();
    if (normalizedType && ['body', 'title', 'subtitle', 'ctrtitle'].includes(normalizedType)) {
        for (const shape of shapes) {
            const ph = shape.getElementsByTagNameNS('*', 'ph')[0];
            if (ph) {
                const pType = ph.getAttribute('type')?.toLowerCase();
                if (pType === 'obj' || pType === 'body') return shape;
            }
        }
    }

    return null;
}

