#!/usr/bin/env node

// analyze.js - CLI entry point for Template Doctor analysis
// Usage: node scripts/analyze.js <repo_url> [--security-scan] [--skip-resources] [...other options]

const path = require('path');
const { execSync } = require('child_process');

function printUsageAndExit() {
  console.error('Usage: npm run analyze -- <repo_url> [--security-scan] [--skip-resources]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('-')) {
  printUsageAndExit();
}

const repoUrl = args[0];
const extraArgs = args.slice(1).join(' ');

// Call the main analysis logic (assume browserified analyzer.js or a Node-compatible version)
// For now, we shell out to the existing browser-based analyzer via a Node wrapper
// (You may want to replace this with a direct require if analyzer.js is Node-compatible)

try {
  // Invoke the Node-compatible analyzer entrypoint that wraps the browser analyzer logic
  // Note: scripts/analyzer-node.js handles polyfills and emits report/meta artifacts
  execSync(`node ./scripts/analyzer-node.js "${repoUrl}" ${extraArgs}`, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}
