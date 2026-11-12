import * as fs from 'fs';
import * as path from 'path';

export async function copyRecursive(src: string, dest: string): Promise<void> {
    const stats = await fs.promises.stat(src);
    if (stats.isDirectory()) {
        await fs.promises.mkdir(dest, { recursive: true });
        const entries = await fs.promises.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        if (!fs.existsSync(dest)) {
            await fs.promises.copyFile(src, dest);
        }
    }
}
