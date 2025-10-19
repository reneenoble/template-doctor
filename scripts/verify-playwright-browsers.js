#!/usr/bin/env node
/*
 Fail-fast guard for Playwright browser availability.

 Rationale: In CI a mistakenly set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 will
 prevent browsers from being downloaded; tests then fail later with a
 confusing executable-missing error. This script performs an early, explicit
 check and exits non‑zero with actionable guidance.

 Policy:
 1. If PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 (or 'true') AND no Chromium binary
    exists in the Playwright cache, abort with instructions to run
    `npx playwright install` or unset the var.
 2. If browsers are missing entirely, emit guidance even if the env var is
    not set (rare case of cache purge).
 3. Allow override with PLAYWRIGHT_ALLOW_MISSING=1 (intended for pipelines
    that only run unit tests without e2e). Use sparingly.

 This script is fast (filesystem checks only) and safe to include in pretest.
*/

import fs from 'fs';
import path from 'path';
import os from 'os';

function log(msg) { process.stdout.write(`[playwright-verify] ${msg}\n`); }
function fail(msg, code = 1) {
  process.stderr.write(`\n[playwright-verify] FAILURE: ${msg}\n\n`);
  process.exit(code);
}

const allowMissing = /^(1|true|yes)$/i.test(process.env.PLAYWRIGHT_ALLOW_MISSING || '');
const skipDownload = /^(1|true|yes)$/i.test(process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || '');

// Playwright default cache directory per docs
// Respect PLAYWRIGHT_BROWSERS_PATH if user has customized it.
const customPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
let baseDir;
if (customPath) {
  baseDir = customPath;
} else {
  const platform = os.platform();
  if (platform === 'darwin' || platform === 'linux') {
    baseDir = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
    // On Linux the actual is ~/.cache/ms-playwright, but we check both.
    if (platform === 'linux') {
      const linuxPath = path.join(os.homedir(), '.cache', 'ms-playwright');
      if (fs.existsSync(linuxPath)) baseDir = linuxPath;
    }
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    baseDir = path.join(localAppData, 'ms-playwright');
  } else {
    baseDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  }
}

// Heuristic: presence of a chromium-* folder or chromium_headless_shell-* folder
// indicates Chromium installed.
function chromiumInstalled(dir) {
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir);
  return entries.some(e => /^chromium(-|_headless_shell-)/.test(e));
}

const hasChromium = chromiumInstalled(baseDir);

if (hasChromium) {
  log(`Chromium found in cache (${baseDir}).`);
  process.exit(0);
}

if (allowMissing) {
  log('Chromium missing but PLAYWRIGHT_ALLOW_MISSING is set; proceeding (tests may skip e2e).');
  process.exit(0);
}

if (skipDownload) {
  fail(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set but no Chromium binary found in: \n  ${baseDir}\n\nRemediation:\n  1. Remove the env var OR set it only for non-e2e pipelines.\n  2. Ensure a prior caching step restores the ms-playwright directory.\n  3. Or run: npx playwright install chromium\n\nTo bypass intentionally (NOT recommended for e2e), set PLAYWRIGHT_ALLOW_MISSING=1.`);
}

// General missing browsers case
fail(`No Chromium browser installation detected at: \n  ${baseDir}\n\nRun: npx playwright install chromium\nIf running unit-only tests, you can set PLAYWRIGHT_ALLOW_MISSING=1 to bypass.`);
