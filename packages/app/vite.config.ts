import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Single consolidated Vite configuration.
// Using port 8080 to match previous python static server for minimal test disruption.
export default defineConfig({
  root: '.',
  publicDir: 'public', // Vite will copy this entire directory to dist/
  server: {
    port: 4000,
    strictPort: true,
  },
  preview: {
    port: 4000,
    strictPort: true,
  },
  define: {
    // Inject BASE from environment so runtime-config.ts can access it
    'window.BASE': JSON.stringify(process.env.BASE || ''),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        callback: 'callback.html',
        leaderboards: 'leaderboards.html',
        setup: 'setup.html',
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    assetsInlineLimit: 0,
  },
});
