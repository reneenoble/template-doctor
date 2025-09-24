import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const clientSource = fs.readFileSync(path.join(process.cwd(), 'packages/app/js/github-client-new.js'), 'utf8');

function makeClient(fetchImpl) {
  global.window = global.window || {};
  if (!global.document) {
    global.document = { addEventListener: () => {}, dispatchEvent: () => {}, createElement: () => ({}), body: { appendChild: () => {} }, readyState: 'complete' };
  }
  const auth = {
    getAccessToken: () => 'TEST_TOKEN',
    isAuthenticated: () => true,
    getUsername: () => 'testuser'
  };
  global.window.GitHubAuth = auth;
  global.fetch = fetchImpl;
  // eslint-disable-next-line no-eval
  eval(clientSource); // constructs and assigns window.GitHubClient
  return window.GitHubClient;
}

function buildFetch(scenario) {
  return vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    // Authenticated user lookup
    if (/https:\/\/api\.github\.com\/user$/.test(url)) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ login: 'testuser', id: 1, type: 'User', node_id: 'XYZ' }),
        headers: { get: () => undefined, forEach: () => {} },
        clone: () => ({ headers: { forEach: () => {} } })
      };
    }
    // Token scope check root call
    if (/https:\/\/api\.github\.com\/?$/.test(url)) {
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({}), headers: { forEach: () => {}, get: () => undefined }, clone: () => ({ headers: { forEach: () => {} } }) };
    }
    // User fork repo path (polled)
    if (/\/repos\/testuser\/sample$/.test(url)) {
      const resp = scenario.userRepoResponses.shift();
      if (!resp) throw new Error('No more stub responses for user repo');
      return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        statusText: resp.status === 404 ? 'Not Found' : 'OK',
        json: async () => resp.body,
        headers: { forEach: () => {}, get: () => undefined },
        clone: () => ({ headers: { forEach: () => {} } })
      };
    }
    // Fork creation
    if (/\/repos\/SomeOrg\/sample\/forks$/.test(url) && method === 'POST') {
      return { ok: true, status: 202, statusText: 'Accepted', json: async () => ({ html_url: 'https://github.com/testuser/sample' }), headers: { forEach: () => {}, get: () => undefined }, clone: () => ({ headers: { forEach: () => {} } }) };
    }
    // merge-upstream
    if (/merge-upstream/.test(url) && method === 'POST') {
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ merged: true }), headers: { forEach: () => {}, get: () => undefined }, clone: () => ({ headers: { forEach: () => {} } }) };
    }
    throw new Error('Unexpected fetch call: ' + url);
  });
}

describe('ensureAccessibleRepo', () => {
  beforeEach(() => {
    delete global.window;
    delete global.fetch;
  });

  it('forks when user fork missing without upstream GET', async () => {
    const scenario = {
      userRepoResponses: [
        { status: 404, body: { message: 'Not Found' } }, // initial user repo lookup
        { status: 404, body: { message: 'Not Found' } }, // first poll
        { status: 200, body: { name: 'sample', fork: true, default_branch: 'main', owner: { login: 'testuser' } } }, // available now
      ]
    };
    const fetchImpl = buildFetch(scenario);
    const client = makeClient(fetchImpl);
    const res = await client.ensureAccessibleRepo('SomeOrg', 'sample');
    expect(res.source).toBe('fork');
    const upstreamGet = fetchImpl.mock.calls.find(([u, o]) => /\/repos\/SomeOrg\/sample$/.test(u) && (!o || (o.method || 'GET') === 'GET'));
    expect(upstreamGet).toBeFalsy();
    const forkPost = fetchImpl.mock.calls.find(([u]) => /\/repos\/SomeOrg\/sample\/forks$/.test(u));
    expect(forkPost).toBeTruthy();
  }, 15000);

  it('syncs existing fork (merge-upstream) when already present', async () => {
    const scenario = {
      userRepoResponses: [
        { status: 200, body: { name: 'sample', fork: true, default_branch: 'main', owner: { login: 'testuser' } } },
      ]
    };
    const fetchImpl = buildFetch(scenario);
    const client = makeClient(fetchImpl);
    const res = await client.ensureAccessibleRepo('SomeOrg', 'sample');
    expect(res.repo.name).toBe('sample');
    const mergeCall = fetchImpl.mock.calls.find(([u]) => /merge-upstream/.test(u));
    expect(mergeCall).toBeTruthy();
  });
});
