#!/usr/bin/env node
/**
 * Encrypts hymnal audio pack folders into AES-256-GCM `.mrta` containers
 * matching `electron/ipc/mrtaCrypto.ts` byte-for-byte.
 * Automatically splits any pack exceeding MAX_PART_BYTES (1.75 GB) into
 * `-part1.mrta`, `-part2.mrta`, ... so every file fits under GitHub Releases' 2 GB limit.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const PACKS_ROOT = '/Users/borissmiyan/Documents/Mirato Audio Packs';
const MRTA_OUT = path.join(PACKS_ROOT, 'mrta');
const MAX_PART_BYTES = Math.floor(1.75 * 1024 * 1024 * 1024); // 1.75 GB safe cap (< 2 GB GitHub limit)

const MRTA_MAGIC = Buffer.from('MRTA');
const KEY = crypto.createHash('sha256').update('mirato-hymnal-audio-pack-v1::mirato-audio-salt-2026').digest();

fs.mkdirSync(MRTA_OUT, { recursive: true });

function encryptZipToMrta(zipPath, mrtaPath) {
    return new Promise((resolve, reject) => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
        const hash = crypto.createHash('sha256');
        const out = fs.createWriteStream(mrtaPath);

        const header = Buffer.concat([MRTA_MAGIC, Buffer.from([0x01]), iv]);
        out.write(header);
        hash.update(header);

        const inp = fs.createReadStream(zipPath, { highWaterMark: 1024 * 1024 });
        inp.on('error', reject);
        cipher.on('error', reject);
        out.on('error', reject);

        inp.on('data', (chunk) => {
            const enc = cipher.update(chunk);
            if (enc.length > 0) {
                hash.update(enc);
                if (!out.write(enc)) {
                    inp.pause();
                    out.once('drain', () => inp.resume());
                }
            }
        });

        inp.on('end', () => {
            const finalBuf = cipher.final();
            if (finalBuf.length > 0) {
                hash.update(finalBuf);
                out.write(finalBuf);
            }
            const tag = cipher.getAuthTag();
            hash.update(tag);
            out.end(tag, () => {
                resolve({
                    sizeBytes: fs.statSync(mrtaPath).size,
                    sha256: hash.digest('hex'),
                });
            });
        });
    });
}

function createStoredZipFromFiles(dirPath, fileNames, outZipPath) {
    if (fs.existsSync(outZipPath)) fs.unlinkSync(outZipPath);
    // Use native `zip -0 -q` (store only, already Opus-compressed) via stdin file list
    execFileSync('zip', ['-0', '-q', outZipPath, '-@'], {
        cwd: dirPath,
        input: fileNames.join('\n') + '\n',
    });
}

async function main() {
    const dirs = fs.readdirSync(PACKS_ROOT, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'mrta')
        .map(d => d.name)
        .sort();

    const manifest = [];

    for (const dirName of dirs) {
        const fullDir = path.join(PACKS_ROOT, dirName);
        const isPlus = dirName.endsWith('__plus');
        const hymnalId = isPlus ? dirName.slice(0, -'__plus'.length) : dirName;
        const variant = isPlus ? 'plus' : 'minus';
        const baseName = `${hymnalId}-${variant}`;

        const oggs = fs.readdirSync(fullDir)
            .filter(fn => fn.endsWith('.ogg') || fn.endsWith('.mp3') || fn.endsWith('.m4a'))
            .sort()
            .map(fn => ({ fn, size: fs.statSync(path.join(fullDir, fn)).size }));

        if (oggs.length === 0) continue;

        const totalRaw = oggs.reduce((s, x) => s + x.size, 0);
        // Partition files into chunks <= MAX_PART_BYTES
        const chunks = [];
        let cur = [];
        let curBytes = 0;
        for (const item of oggs) {
            if (cur.length > 0 && curBytes + item.size > MAX_PART_BYTES) {
                chunks.push(cur);
                cur = [];
                curBytes = 0;
            }
            cur.push(item.fn);
            curBytes += item.size;
        }
        if (cur.length > 0) chunks.push(cur);

        const parts = [];
        for (let i = 0; i < chunks.length; i++) {
            const partSuffix = chunks.length > 1 ? `-part${i + 1}` : '';
            const mrtaFile = `${baseName}${partSuffix}.mrta`;
            const mrtaPath = path.join(MRTA_OUT, mrtaFile);
            const tmpZip = path.join(MRTA_OUT, `.tmp-${baseName}${partSuffix}.zip`);

            createStoredZipFromFiles(fullDir, chunks[i], tmpZip);
            const { sizeBytes, sha256 } = await encryptZipToMrta(tmpZip, mrtaPath);
            fs.unlinkSync(tmpZip);

            parts.push({
                file: mrtaFile,
                trackCount: chunks[i].length,
                sizeBytes,
                sha256,
            });
            console.log(`  MRTA: ${mrtaFile} (${chunks[i].length} tracks, ${(sizeBytes / 1024 / 1024).toFixed(1)} MB) sha256=${sha256.slice(0, 12)}...`);
        }

        manifest.push({
            hymnalId,
            variant,
            trackCount: oggs.length,
            totalBytes: parts.reduce((s, p) => s + p.sizeBytes, 0),
            rawBytes: totalRaw,
            parts,
        });
    }

    const outJson = path.join(MRTA_OUT, 'mrta-manifest.json');
    fs.writeFileSync(outJson, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\nDone! Generated ${manifest.length} packs -> ${outJson}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
