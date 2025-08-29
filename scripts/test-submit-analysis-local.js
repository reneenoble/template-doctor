#!/usr/bin/env node
/*
 Local harness to run the submit analysis action logic without GitHub Actions.
 It simulates @actions/core by providing getInput/setOutput/logging shims.

 Usage:
   node scripts/test-submit-analysis-local.js \
     --repo-url https://github.com/owner/repo \
     --rule-set dod \
     --username yourname \
     --timestamp 2025-08-29T12:00:00Z \
     --analysis-file ./analysis.json \
     [--upstream owner/repo]
*/

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv);

function requireArg(name) {
  if (!args[name]) {
    console.error(`Missing required arg --${name}`);
    process.exit(1);
  }
  return args[name];
}

const repoUrl = requireArg('repo-url');
const ruleSet = requireArg('rule-set');
const username = requireArg('username');
const timestamp = requireArg('timestamp');
const analysisFile = requireArg('analysis-file');
const upstream = args['upstream'] || '';

let analysisRaw = '';
try {
  analysisRaw = fs.readFileSync(path.resolve(analysisFile), 'utf8');
} catch (e) {
  console.error(`Failed to read analysis-file: ${e.message}`);
  process.exit(1);
}

// Minimal shim of @actions/core used by scripts/action.js
const coreShim = {
  getInput(name) {
    switch (name) {
      case 'repo-url': return repoUrl;
      case 'rule-set': return ruleSet;
      case 'username': return username;
      case 'timestamp': return timestamp;
      case 'analysis-data': return analysisRaw;
      case 'upstream': return upstream;
      case 'origin-upstream': return '';
      default: return '';
    }
  },
  info: console.log,
  warning: (m) => console.warn('warning:', m),
  setFailed: (m) => { console.error('FAILED:', m); process.exitCode = 1; },
  setOutput: (k, v) => console.log(`OUTPUT ${k}: ${v}`)
};

// Monkey-patch require to return our shim when '@actions/core' is required
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@actions/core') {
    return coreShim;
  }
  return originalLoad(request, parent, isMain);
};

(async () => {
  try {
    await require('./action');
    console.log('Local harness finished. Check packages/app/results for output.');
  } catch (e) {
    console.error('Harness error:', e);
    process.exit(1);
  }
})();
