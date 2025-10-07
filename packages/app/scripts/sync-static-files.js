#!/usr/bin/env node
/**
 * Sync static files to public/ directory before Vite build.
 * Vite's publicDir will copy everything from public/ to dist/ during build.
 */

const fs = require('fs');
const path = require('path');

const rootDir = __dirname.replace(/scripts$/, '');
const publicDir = path.join(rootDir, 'public');

// Create public directory structure
const dirs = ['assets/images', 'configs', 'css', 'results'];

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

// Copy results directory (scan results)
const resultsDir = path.join(rootDir, 'results');
if (fs.existsSync(resultsDir)) {
  const copyDirRecursive = (src, dest) => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  copyDirRecursive(resultsDir, path.join(publicDir, 'results'));
  console.log('✓ Copied results/ directory');
}

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
