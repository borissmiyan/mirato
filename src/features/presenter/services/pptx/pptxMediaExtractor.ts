import JSZip from 'jszip';
import { getAttr } from './pptxXmlUtils';

export interface PptxMediaEntry {
    id: string;
    blob: Blob;
}

/**
 * Pre-processes all media files within the PPTX archive into IndexedDB media assets.
 */
export async function extractMediaBatch(zip: JSZip): Promise<Map<string, PptxMediaEntry>> {
    const mediaFiles = zip.filter((path) => path.startsWith('ppt/media/'));
    const { MediaPersistenceService } = await import('../MediaPersistenceService');

    const batchItems: { file: Blob; path: string; type: 'image' | 'audio' | 'video' }[] = [];

    for (const mediaFile of mediaFiles) {
        const blob = await mediaFile.async('blob');
        const path = mediaFile.name;
        let type: 'image' | 'audio' | 'video' = 'image';
        const ext = path.split('.').pop()?.toLowerCase();
        if (['mp4', 'webm', 'mov'].includes(ext || '')) type = 'video';
        if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) type = 'audio';

        batchItems.push({ file: blob, path, type });
    }

    const mediaMap = new Map<string, PptxMediaEntry>();
    if (batchItems.length > 0) {
        const ids = await MediaPersistenceService.importMediaBatch(
            batchItems.map(b => ({ file: b.file, path: b.path, type: b.type })),
            { forceBackground: true }
        );

        for (let i = 0; i < batchItems.length; i++) {
            const id = ids[i];
            if (id) mediaMap.set(batchItems[i].path, { id, blob: batchItems[i].file });
        }
    }

    return mediaMap;
}

/**
 * Parses a .rels file and returns map of Relationship Id to Target path.
 */
export async function getRels(zip: JSZip, path: string, parser: DOMParser): Promise<Record<string, string>> {
    const parts = path.split('/');
    const fileName = parts.pop();
    const dir = parts.join('/');
    const relPath = `${dir}/_rels/${fileName}.rels`;

    const file = zip.file(relPath);
    const rels: Record<string, string> = {};
    if (file) {
        const content = await file.async('string');
        const doc = parser.parseFromString(content, 'application/xml');
        const relEls = doc.getElementsByTagNameNS('*', 'Relationship');
        for (let r = 0; r < relEls.length; r++) {
            const relId = getAttr(relEls[r], 'Id');
            const target = getAttr(relEls[r], 'Target');
            if (relId && target) {
                rels[relId] = target;
            }
        }
    }
    return rels;
}

/**
 * Resolves relationship target ID to an imported media asset.
 */
export function resolveRel(
    rId: string | null,
    slideRelationships: Record<string, string>,
    layoutRels: Record<string, string>,
    masterRels: Record<string, string>,
    mediaMap: Map<string, PptxMediaEntry>
): PptxMediaEntry | null {
    if (!rId) return null;
    const target = slideRelationships[rId] || layoutRels[rId] || masterRels[rId];
    if (!target) return null;

    const mediaPath = target.startsWith('../media/')
        ? `ppt/media/${target.substring('../media/'.length)}`
        : target.startsWith('..')
            ? `ppt/${target.substring(3)}`
            : `ppt/slides/${target}`;
    if (mediaMap.has(mediaPath)) return mediaMap.get(mediaPath)!;

    const fileName = target.split('/').pop();
    const fallbackPath = `ppt/media/${fileName}`;
    return mediaMap.get(fallbackPath) || null;
}

