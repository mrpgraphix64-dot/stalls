import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

if (!fs.existsSync(distDir)) {
  console.error('dist/ does not exist. Run vite build first.');
  process.exit(1);
}

// 1. Copy index.dev.html or index.html from dist to root index.html
const distHtml = fs.existsSync(path.join(distDir, 'index.html'))
  ? path.join(distDir, 'index.html')
  : path.join(distDir, 'index.dev.html');

if (fs.existsSync(distHtml)) {
  fs.copyFileSync(distHtml, path.join(rootDir, 'index.html'));
  console.log('✓ Copied production compiled HTML to root index.html');
}

// 2. Helper to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy assets & images to root
if (fs.existsSync(path.join(distDir, 'assets'))) {
  const rootAssets = path.join(rootDir, 'assets');
  const distAssets = path.join(distDir, 'assets');
  if (fs.existsSync(rootAssets)) {
    const distFiles = new Set(fs.readdirSync(distAssets));
    for (const f of fs.readdirSync(rootAssets)) {
      if (!distFiles.has(f)) {
        try { fs.unlinkSync(path.join(rootAssets, f)); } catch (e) {}
      }
    }
  }
  copyDir(distAssets, rootAssets);
  console.log('✓ Synced assets/ to root');
}

if (fs.existsSync(path.join(distDir, 'images'))) {
  copyDir(path.join(distDir, 'images'), path.join(rootDir, 'images'));
  console.log('✓ Synced images/ to root');
}

if (fs.existsSync(path.join(distDir, 'manage'))) {
  copyDir(path.join(distDir, 'manage'), path.join(rootDir, 'manage'));
  console.log('✓ Synced manage/ to root');
}

if (fs.existsSync(path.join(distDir, 'floorplans'))) {
  copyDir(path.join(distDir, 'floorplans'), path.join(rootDir, 'floorplans'));
  console.log('✓ Synced floorplans/ to root');
}

// 4. Copy root files from dist (favicon, manifest, etc.)
for (const file of fs.readdirSync(distDir)) {
  const full = path.join(distDir, file);
  if (fs.statSync(full).isFile() && file !== 'index.dev.html') {
    fs.copyFileSync(full, path.join(rootDir, file));
  }
}

console.log('✓ All production static assets synced to repository root for direct Git deployment!');
