#!/usr/bin/env node
/**
 * Sync static files to public/ directory before Vite build.
 * Vite's publicDir will copy everything from public/ to dist/ during build.
 */

const fs = require('fs');
const path = require('path');

const rootDir = __dirname.replace(/scripts$/, '');
const publicDir = path.join(rootDir, 'public');

// Create public directory structure (removed 'results' - now served from database)
const dirs = ['assets/images', 'configs', 'css'];

dirs.forEach((dir) => {
  const targetDir = path.join(publicDir, dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
});

// Copy operations to perform
const copyOps = [];

// Copy HTML files
copyOps.push({ src: 'index.html', dest: 'index.html' });
copyOps.push({ src: 'callback.html', dest: 'callback.html' });
copyOps.push({ src: 'setup.html', dest: 'setup.html' });
copyOps.push({ src: 'leaderboards.html', dest: 'leaderboards.html' });

// Copy assets/images directory
const assetsImagesDir = path.join(rootDir, 'assets', 'images');
if (fs.existsSync(assetsImagesDir)) {
  const imageFiles = fs.readdirSync(assetsImagesDir);
  imageFiles.forEach((file) => {
    copyOps.push({ src: `assets/images/${file}`, dest: `assets/images/${file}` });
  });
}

// Copy CSS files
const cssDir = path.join(rootDir, 'css');
if (fs.existsSync(cssDir)) {
  const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
  cssFiles.forEach((file) => {
    copyOps.push({ src: `css/${file}`, dest: `css/${file}` });
  });
}

// REMOVED: results directory copying - data now served from MongoDB database
// Legacy static results files (results/*) are no longer bundled into the build

// Execute copy operations
copyOps.forEach(({ src, dest }) => {
  const srcPath = path.join(rootDir, src);
  const destPath = path.join(publicDir, dest);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  } else {
    console.warn(`Warning: ${src} not found, skipping`);
  }
});

console.log(`✓ Synced ${copyOps.length} static files to public/`);
