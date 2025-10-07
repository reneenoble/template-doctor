#!/usr/bin/env node
/*
 Simple esbuild bundler for analyzer TypeScript source.
 Outputs: js/analyzer.bundle.js (replaces legacy analyzer.js usage when adopted).
*/
const esbuild = require('esbuild');
const path = require('path');

async function run() {
  const analyzerEntry = path.resolve(__dirname, 'src/scripts/analyzer.ts');
  const analyzerOutFile = path.resolve(__dirname, 'js/analyzer.bundle.js');
  const apiClientEntry = path.resolve(__dirname, 'src/scripts/api-client.ts');
  const apiClientOutFile = path.resolve(__dirname, 'js/api-client.bundle.js');
  try {
    await esbuild.build({
      entryPoints: [analyzerEntry],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      sourcemap: true,
      target: ['es2020'],
      outfile: analyzerOutFile,
      define: { 'process.env.NODE_ENV': '"production"' },
      logLevel: 'info',
    });
    console.log('[analyzer-bundler] Built', analyzerOutFile);

    // Build api-client if TS source exists
    await esbuild
      .build({
        entryPoints: [apiClientEntry],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        sourcemap: true,
        target: ['es2020'],
        outfile: apiClientOutFile,
        define: { 'process.env.NODE_ENV': '"production"' },
        logLevel: 'info',
      })
      .catch((e) => {
        console.warn('[analyzer-bundler] api-client build skipped/failed:', e.message);
      });
  } catch (e) {
    console.error('[analyzer-bundler] Failed', e);
    process.exit(1);
  }
}
run();
