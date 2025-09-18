#!/usr/bin/env node
/**
 * Generates a consolidated backfill meta file for existing scan results so the index page can show historical scans
 * without needing individual scan-meta-<ts>.js files per scan yet.
 *
 * Output: packages/app/results/scan-meta-backfill.js
 * Each entry conforms to the dynamic meta ingestion format expected by index-data.js
 */
const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, '..', 'packages', 'app', 'results');
const outFile = path.join(resultsDir, 'scan-meta-backfill.js');

function findRepoDirs(base) {
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    // exclude non-repo utility folders
    .filter(name => !['assets'].includes(name) && !name.startsWith('.'));
}

function buildMetaForRepo(slug) {
  const repoPath = path.join(resultsDir, slug);
  const latestPath = path.join(repoPath, 'latest.json');
  if (!fs.existsSync(latestPath)) {
    // Fallback: derive from newest *-data.js if present
    const files = fs.readdirSync(repoPath).filter(f => /-data\.js$/.test(f));
    if (!files.length) return null;
    const sorted = files.sort((a,b)=>{
      const ta = parseInt(a.split('-')[0],10); const tb = parseInt(b.split('-')[0],10); return tb-ta; });
    const newestData = sorted[0];
    // Attempt to read file and extract minimal meta by regex (since it's a JS assignment)
    const raw = fs.readFileSync(path.join(repoPath, newestData), 'utf8');
    // Look for repoUrl, ruleSet, timestamp, compliance summary percentage
    const repoUrlMatch = raw.match(/"repoUrl"\s*:\s*"([^"]+)"/);
    const ruleSetMatch = raw.match(/"ruleSet"\s*:\s*"([^"]+)"/);
    const timestampMatch = raw.match(/"timestamp"\s*:\s*"([^"]+)"/);
    // Try to find compliance percentage pattern
    const percentageMatch = raw.match(/"percentage"\s*:\s*(\d+)/) || raw.match(/"percentageCompliant"\s*:\s*(\d+)/);
    if(!(repoUrlMatch && timestampMatch)) return null;
    const repoUrl = repoUrlMatch[1];
    const ruleSet = ruleSetMatch ? ruleSetMatch[1] : 'dod';
    const timestamp = timestampMatch[1];
    const percentage = percentageMatch ? parseInt(percentageMatch[1],10) : 0;
    const dashboardPath = newestData.replace('-data.js','-dashboard.html');
    return {
      timestamp,
      repoUrl,
      ruleSet,
      dashboardPath,
      dataPath: newestData,
      compliance: { percentage, issues: 0, passed: 0 },
      relativePath: `${slug}/${dashboardPath}`
    };
  }
  try {
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    const { timestamp, dashboardPath, dataPath, repoUrl, ruleSet, compliance } = latest;
    if (!timestamp || !dashboardPath || !dataPath || !repoUrl || !compliance) return null; // ruleSet can be synthesized
    if (typeof compliance.percentage !== 'number') return null;
    // Ensure minimal shape
    const meta = {
      timestamp,
      repoUrl,
      ruleSet: ruleSet || 'dod',
      dashboardPath, // full filename
      dataPath,      // full filename
      compliance: {
        percentage: compliance.percentage,
        issues: compliance.issues ?? 0,
        passed: compliance.passed ?? 0
      },
      // relative path from template-index.html to dashboard
      relativePath: `${slug}/${dashboardPath}`
    };
    if (!ruleSet) {
      console.warn('[backfill] ruleSet missing in latest.json for', slug, 'defaulted to dod');
    }
    return meta;
  } catch (e) {
    console.error('Failed parsing latest.json for', slug, e);
    return null;
  }
}

const repoDirs = findRepoDirs(resultsDir);
const entries = [];
for (const dir of repoDirs) {
  const meta = buildMetaForRepo(dir);
  if (meta) entries.push(meta);
}

entries.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));

let output = 'window.__TD_DYNAMIC_RESULTS = window.__TD_DYNAMIC_RESULTS || [];\n';
for (const e of entries) {
  output += `window.__TD_DYNAMIC_RESULTS.push(${JSON.stringify(e)});\n`;
}
output += 'console.log("[scan-meta-backfill] Loaded backfill meta entries:", window.__TD_DYNAMIC_RESULTS.length);\n';

fs.writeFileSync(outFile, output, 'utf8');
console.log('Wrote backfill meta file with', entries.length, 'entries to', path.relative(process.cwd(), outFile));
