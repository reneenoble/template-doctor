import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const analyzerSource = fs.readFileSync(path.join(process.cwd(), 'packages/app/js/analyzer.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(process.cwd(), 'packages/app/js/github-client-new.js'), 'utf8');

let TemplateAnalyzer;
let GitHubClient;

function loadClasses() {
  // Minimal window + NotificationSystem
  global.window = global.window || {};
  global.window.NotificationSystem = { showInfo: () => {}, showWarning: () => {}, showError: () => {} };
  global.document = {
    getElementById: (id) => ({ style: {}, scrollIntoView: () => {}, textContent: '' }),
    addEventListener: () => {},
    dispatchEvent: () => {},
    readyState: 'complete'
  };
  global.window.GitHubAuth = {
    getAccessToken: () => 'TOKEN',
    isAuthenticated: () => true,
    getUsername: () => 'testuser'
  };
  // Provide stub fetch before loading sources (analyzer & client expect it during initialization)
  if (!global.fetch) {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) }));
  }
  // Stub TemplateAnalyzerDocs used inside analyzer load
  global.TemplateAnalyzerDocs = function() {};
  global.TemplateAnalyzerDocs.prototype.getConfig = async () => ({ requiredFiles: [] });
  // Provide minimal console stubs for debug()
  global.window.TemplateDoctorConfig = {};
  // eslint-disable-next-line no-eval
  eval(clientSource); // builds window.GitHubClient instance
  // eslint-disable-next-line no-eval
  eval(analyzerSource); // defines TemplateAnalyzer constructor
  TemplateAnalyzer = global.TemplateAnalyzer || global.window.TemplateAnalyzer;
  GitHubClient = global.window.GitHubClient;
}

describe('Analyzer main branch fallback', () => {
  beforeEach(() => {
    delete global.window;
    delete global.document;
    delete global.fetch;
    loadClasses();
  });

  it('falls back when main missing', async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (/git\/trees\/main/.test(url)) {
        return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({ message: 'Not Found' }) };
      }
      if (/git\/trees\/default/.test(url)) {
        return { ok: true, json: async () => ({ tree: [{ path: 'README.md', type: 'blob' }] }) };
      }
      if (/\/repos\/testuser\/sample$/.test(url)) {
        return { ok: true, json: async () => ({ name: 'sample', fork: true, owner: { login: 'testuser' }, default_branch: 'default' }) };
      }
      if (/merge-upstream/.test(url)) {
        return { ok: true, json: async () => ({ merged: true }) };
      }
      if (/\/repos\/SomeOrg\/sample\/forks$/.test(url)) {
        return { ok: true, status: 202, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });

  const client = GitHubClient; // already instantiated
    // Stub fetch for rule configs BEFORE constructing analyzer instance (will override inside scenario later)
    global.fetch = vi.fn(async (url) => {
      // Track all network calls for later assertions
      calls.push(url);
      if (/dod-config\.json/.test(url)) return { ok: true, json: async () => ({ requiredFiles: [] }) };
      if (/partner-config\.json/.test(url)) return { ok: true, json: async () => ({ requiredFiles: [] }) };
      if (/custom-config\.json/.test(url)) return { ok: true, json: async () => ({ requiredFiles: [] }) };
      // Used by branch file tree calls in this test
      if (/git\/trees\/main/.test(url)) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({ message: 'Not Found' }) };
      if (/git\/trees\/default/.test(url)) return { ok: true, json: async () => ({ tree: [{ path: 'README.md', type: 'blob' }] }) };
      if (/\/repos\/testuser\/sample$/.test(url)) return { ok: true, json: async () => ({ name: 'sample', fork: true, owner: { login: 'testuser' }, default_branch: 'default' }) };
      if (/merge-upstream/.test(url)) return { ok: true, json: async () => ({ merged: true }) };
      if (/\/repos\/SomeOrg\/sample\/forks$/.test(url)) return { ok: true, status: 202, json: async () => ({}) };
      return { ok: true, json: async () => ({}) };
    });
    const analyzer = window.TemplateAnalyzer || new TemplateAnalyzer();
    // Provide minimal expected config shape to avoid iteration errors
    if (analyzer && analyzer.ruleSetConfigs) {
      analyzer.ruleSetConfigs.dod = {
        requiredFiles: [],
        requiredFolders: [],
        requiredWorkflowFiles: [],
        readmeRequirements: { requiredHeadings: [], architectureDiagram: { heading: 'Architecture', requiresImage: false } },
      };
      // Defensive: ensure arrays exist even if async loader overwrites with partial object
      const cfg = analyzer.ruleSetConfigs.dod;
      cfg.requiredFiles = Array.isArray(cfg.requiredFiles) ? cfg.requiredFiles : [];
      cfg.requiredFolders = Array.isArray(cfg.requiredFolders) ? cfg.requiredFolders : [];
      cfg.requiredWorkflowFiles = Array.isArray(cfg.requiredWorkflowFiles) ? cfg.requiredWorkflowFiles : [];
    }
    // inject minimal DOM support for analyzer UI operations
    const result = await analyzer.analyzeTemplate('https://github.com/SomeOrg/sample', 'dod');
    expect(result).toBeTruthy();
    const triedMain = calls.some(c => /git\/trees\/main/.test(c));
    const triedFallback = calls.some(c => /git\/trees\/default/.test(c));
    expect(triedMain).toBe(true);
    expect(triedFallback).toBe(true);
  }, 30000);
});
