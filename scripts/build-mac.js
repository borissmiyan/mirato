import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const mode = process.argv[2]; // 'modern' | 'legacy'
const requestedArch = process.argv[3]; // optional: 'arm64' | 'x64' | 'both'

if (!mode || (mode !== 'modern' && mode !== 'legacy')) {
  console.error('Usage: node scripts/build-mac.js <modern|legacy> [arm64|x64|both]');
  process.exit(1);
}

const config = {
  modern: {
    electronVersion: '40.1.0',
    minSystem: '12.0.0',      // Monterey
    suffix: 'macOS12+',
  },
  legacy: {
    electronVersion: '28.3.0',
    minSystem: '11.0.0',      // Big Sur
    suffix: 'macOS11-legacy',
  },
};

const { electronVersion, minSystem, suffix } = config[mode];
const targetArchs = requestedArch && requestedArch !== 'both' ? [requestedArch] : ['arm64', 'x64'];

console.log(`🚀 Starting ${mode} build for macOS [${targetArchs.join(', ')}] (Electron v${electronVersion}, min OS v${minSystem})...`);

// Read package.json
const pkgPath = path.resolve('package.json');
const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
const pkg = JSON.parse(pkgContent);

// Patch on the fly
pkg.devDependencies.electron = `^${electronVersion}`;
pkg.build.electronLanguages = ['en', 'ru', 'de', 'uk'];
if (!pkg.build.mac) pkg.build.mac = {};
pkg.build.mac.extendInfo = { 
  ...pkg.build.mac.extendInfo,
  LSMinimumSystemVersion: minSystem 
};
pkg.build.mac.target = [
  {
    target: 'dmg',
    arch: targetArchs
  }
];
pkg.build.dmg = {
  contents: [
    { x: 130, y: 220 },
    { x: 410, y: 220, type: 'link', path: '/Applications' },
    { x: 270, y: 120, type: 'file', path: 'build/Команда_для_Терминала.txt' }
  ]
};
pkg.build.directories.output = `release/${mode}`;
pkg.build.artifactName = `Mirato-\${version}-${suffix}-\${arch}.\${ext}`;

// Write temporary package.json
const tempPkgPath = path.resolve('package.json');
fs.writeFileSync(tempPkgPath, JSON.stringify(pkg, null, 2));

try {
  // Only reinstall electron if the version differs from current package.json
  const currentElectron = pkg.devDependencies?.electron || '';
  if (!currentElectron.includes(electronVersion)) {
    console.log(`📦 Installing electron@${electronVersion}...`);
    execSync(`npm install electron@${electronVersion} --no-save`, { stdio: 'inherit' });
  }
  
  console.log(`🏗️ Building...`);
  const archFlags = targetArchs.map(a => `--${a}`).join(' ');
  execSync(`CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:renderer && electron-builder --mac ${archFlags}`, { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
} finally {
  console.log(`🧹 Restoring original package.json...`);
  fs.writeFileSync(tempPkgPath, pkgContent);
}

