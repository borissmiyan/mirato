/**
 * Content-based hashing utility for blobs.
 * Optimized for large files: If file > 20MB, hashes a sample (head + mid + tail + size)
 * for near-instant deduplication without reading the whole file into RAM.
 */
export async function sha256(blob: Blob): Promise<string> {
    const SIZE_LIMIT = 20 * 1024 * 1024; // 20MB
    const SAMPLE_SIZE = 1 * 1024 * 1024; // 1MB
    
    let content: Blob;
    if (blob.size <= SIZE_LIMIT) {
        content = blob;
    } else {
        // Sampled hashing for massive files (Video/Large Audio)
        const head = blob.slice(0, SAMPLE_SIZE);
        const mid = blob.slice(Math.floor(blob.size / 2), Math.floor(blob.size / 2) + SAMPLE_SIZE);
        const tail = blob.slice(blob.size - SAMPLE_SIZE);
        const meta = new Blob([
            blob.size.toString(), 
            blob.type, 
            head, 
            mid, 
            tail
        ]);
        content = meta;
    }

    const buffer = await content.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

