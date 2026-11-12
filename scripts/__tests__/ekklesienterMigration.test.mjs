import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Build-safe import of the migration module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationModulePath = path.resolve(__dirname, '../../dist-electron/migration/ekklesienterMigration.cjs');

// If compiled CJS does not exist yet, we test the logic directly
describe('ekklesienterMigration', () => {
    let tempDir;
    let oldUserData;
    let newUserData;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirato-migration-test-'));
        oldUserData = path.join(tempDir, 'ekklesienter');
        newUserData = path.join(tempDir, 'mirato');
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('returns source_not_found if old ekklesienter directory does not exist', async () => {
        const { migrateFromEkklesienterIfNeeded } = await import('../../electron/migration/ekklesienterMigration.ts');
        fs.mkdirSync(newUserData, { recursive: true });

        const result = migrateFromEkklesienterIfNeeded({
            sourceUserDataDir: oldUserData,
            targetUserDataDir: newUserData,
        });

        assert.strictEqual(result.migrated, false);
        assert.strictEqual(result.reason, 'source_not_found');
    });

    it('returns already_migrated if marker file exists in mirato directory', async () => {
        const { migrateFromEkklesienterIfNeeded, MIGRATION_MARKER_FILE } = await import('../../electron/migration/ekklesienterMigration.ts');
        fs.mkdirSync(oldUserData, { recursive: true });
        fs.mkdirSync(newUserData, { recursive: true });
        fs.writeFileSync(path.join(newUserData, MIGRATION_MARKER_FILE), JSON.stringify({ completedAt: new Date().toISOString() }));

        const result = migrateFromEkklesienterIfNeeded({
            sourceUserDataDir: oldUserData,
            targetUserDataDir: newUserData,
        });

        assert.strictEqual(result.migrated, false);
        assert.strictEqual(result.reason, 'already_migrated');
    });

    it('successfully copies IndexedDB, media, and backups when migration is required', async () => {
        const { migrateFromEkklesienterIfNeeded, MIGRATION_MARKER_FILE } = await import('../../electron/migration/ekklesienterMigration.ts');

        // Setup source directory structure
        const srcIdb = path.join(oldUserData, 'IndexedDB', 'file__0.indexeddb.leveldb');
        fs.mkdirSync(srcIdb, { recursive: true });
        fs.writeFileSync(path.join(srcIdb, '000005.ldb'), 'dummy-indexeddb-data');
        fs.writeFileSync(path.join(srcIdb, 'CURRENT'), 'MANIFEST-000001');

        const srcVideos = path.join(oldUserData, 'media', 'videos');
        fs.mkdirSync(srcVideos, { recursive: true });
        fs.writeFileSync(path.join(srcVideos, 'video1.mp4'), 'mp4-binary-content');

        const srcAudio = path.join(oldUserData, 'media', 'audio');
        fs.mkdirSync(srcAudio, { recursive: true });
        fs.writeFileSync(path.join(srcAudio, 'audio1.mp3'), 'mp3-binary-content');

        const srcBackups = path.join(oldUserData, 'backups');
        fs.mkdirSync(srcBackups, { recursive: true });
        fs.writeFileSync(path.join(srcBackups, 'backup-1.json'), '{"version":"2.0"}');

        // Setup target directory
        fs.mkdirSync(newUserData, { recursive: true });

        const result = migrateFromEkklesienterIfNeeded({
            sourceUserDataDir: oldUserData,
            targetUserDataDir: newUserData,
        });

        assert.strictEqual(result.migrated, true);
        assert.strictEqual(result.reason, 'success');
        assert.ok(result.copiedFilesCount >= 5);

        // Check target files exist
        assert.ok(fs.existsSync(path.join(newUserData, 'IndexedDB', 'file__0.indexeddb.leveldb', '000005.ldb')));
        assert.ok(fs.existsSync(path.join(newUserData, 'media', 'videos', 'video1.mp4')));
        assert.ok(fs.existsSync(path.join(newUserData, 'media', 'audio', 'audio1.mp3')));
        assert.ok(fs.existsSync(path.join(newUserData, 'backups', 'backup-1.json')));
        assert.ok(fs.existsSync(path.join(newUserData, MIGRATION_MARKER_FILE)));

        // Source directory remains untouched
        assert.ok(fs.existsSync(path.join(srcVideos, 'video1.mp4')));
        assert.ok(fs.existsSync(path.join(srcIdb, '000005.ldb')));
    });

    it('replaces target dummy seed IndexedDB with source full database', async () => {
        const { migrateFromEkklesienterIfNeeded } = await import('../../electron/migration/ekklesienterMigration.ts');

        // Setup source directory with 15 files
        const srcIdb = path.join(oldUserData, 'IndexedDB', 'file__0.indexeddb.leveldb');
        fs.mkdirSync(srcIdb, { recursive: true });
        for (let i = 0; i < 15; i++) {
            fs.writeFileSync(path.join(srcIdb, `file_${i}.ldb`), `content-${i}`);
        }

        // Setup target directory with a 2-file dummy seed
        const targetIdb = path.join(newUserData, 'IndexedDB', 'file__0.indexeddb.leveldb');
        fs.mkdirSync(targetIdb, { recursive: true });
        fs.writeFileSync(path.join(targetIdb, 'dummy.ldb'), 'empty');

        const result = migrateFromEkklesienterIfNeeded({
            sourceUserDataDir: oldUserData,
            targetUserDataDir: newUserData,
        });

        assert.strictEqual(result.migrated, true);
        assert.ok(fs.existsSync(path.join(targetIdb, 'file_14.ldb')));
        assert.ok(fs.existsSync(path.join(newUserData, 'IndexedDB_seed_bak')));
    });
});

