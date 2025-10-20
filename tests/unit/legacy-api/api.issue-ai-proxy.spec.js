import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

const distFile = path.join(process.cwd(), 'packages/api/dist/functions/issue-ai-proxy.js');
let handler;

function makeReq(method = 'POST', body) {
  return { method, headers: {}, body };
}
function makeCtx() {
  return { log: { warn: () => {}, error: () => {}, info: () => {} } };
}

function clearProviderEnv() {
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.GITHUB_MODELS_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.ISSUE_AI_PROVIDER;
}

describe('issue-ai-proxy function', () => {
  beforeAll(() => {
    if (!fs.existsSync(distFile)) throw new Error('issue-ai-proxy dist missing');
    handler = require(distFile).default || require(distFile);
  });
  afterEach(() => {
    clearProviderEnv();
  });

  it('405 on non-POST', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('GET'));
    expect(res.status).toBe(405);
  });

  it('400 invalid body', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', null));
    expect(res.status).toBe(400);
  });

  it('400 missing required fields', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { ruleId: 'R1', message: '', draftBody: '' }));
    expect(res.status).toBe(400);
  });

  it('400 missing provider token (github fallback)', async () => {
    clearProviderEnv();
    const ctx = makeCtx();
    const res = await handler(
      ctx,
      makeReq('POST', { ruleId: 'R1', message: 'm', draftBody: 'body' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing GITHUB_MODELS_TOKEN/i);
  });
});
