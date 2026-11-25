import fs from 'fs';
import crypto from 'crypto';

const MRTA_MAGIC = Buffer.from('MRTA');
const MRTA_HEADER_LEN = 17; // 4 bytes magic + 1 byte version + 12 bytes IV
const MRTA_TAG_LEN = 16;

function getMrtaKey(): Buffer {
    return crypto.createHash('sha256').update('mirato-hymnal-audio-pack-v1::mirato-audio-salt-2026').digest();
}

export async function isMrtaContainer(filePath: string): Promise<boolean> {
    const fh = await fs.promises.open(filePath, 'r');
    try {
        const buf = Buffer.alloc(4);
        const { bytesRead } = await fh.read(buf, 0, 4, 0);
        return bytesRead === 4 && buf.equals(MRTA_MAGIC);
    } finally {
        await fh.close();
    }
}

/**
 * Streams an AES-256-GCM encrypted .mrta container into a temporary .zip file with minimal RAM usage.
 */
export async function decryptMrtaToZip(mrtaPath: string, destZipPath: string): Promise<void> {
    const stat = await fs.promises.stat(mrtaPath);
    if (stat.size <= MRTA_HEADER_LEN + MRTA_TAG_LEN) {
        throw new Error('Invalid .mrta archive (file too small)');
    }

    const fh = await fs.promises.open(mrtaPath, 'r');
    const header = Buffer.alloc(MRTA_HEADER_LEN);
    const authTag = Buffer.alloc(MRTA_TAG_LEN);
    try {
        await fh.read(header, 0, MRTA_HEADER_LEN, 0);
        await fh.read(authTag, 0, MRTA_TAG_LEN, stat.size - MRTA_TAG_LEN);
    } finally {
        await fh.close();
    }

    if (!header.subarray(0, 4).equals(MRTA_MAGIC) || header[4] !== 0x01) {
        throw new Error('Unsupported .mrta container version');
    }

    const iv = header.subarray(5, 17);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getMrtaKey(), iv);
    decipher.setAuthTag(authTag);

    await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(mrtaPath, {
            start: MRTA_HEADER_LEN,
            end: stat.size - MRTA_TAG_LEN - 1,
            highWaterMark: 1024 * 1024,
        });
        const writeStream = fs.createWriteStream(destZipPath);
        readStream.on('error', reject);
        decipher.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        readStream.pipe(decipher).pipe(writeStream);
    });
}
