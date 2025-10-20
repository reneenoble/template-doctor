import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

const distFile = path.join(process.cwd(), 'packages/api/dist/functions/archive-collection.js');
let handler;

function makeReq(method = 'POST', body = {}) {
  return { method, headers: {}, body };
}
function makeCtx() {
  return { log: { warn: () => {}, error: () => {}, info: () => {} } };
}

describe('archive-collection function', () => {
  beforeAll(() => {
    if (!fs.existsSync(distFile)) throw new Error('archive-collection dist missing');
    handler = require(distFile).default || require(distFile);
  });

  it('405 on non-POST', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('GET'));
    expect(res.status).toBe(405);
  });

  it('500 when GH_WORKFLOW_TOKEN missing', async () => {
    const prev = process.env.GH_WORKFLOW_TOKEN;
    delete process.env.GH_WORKFLOW_TOKEN;
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { foo: 'bar' }));
    process.env.GH_WORKFLOW_TOKEN = prev;
    expect(res.status).toBe(500);
  });

  it('400 when required fields missing', async () => {
    process.env.GH_WORKFLOW_TOKEN = 'dummy';
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { collection: 'c' }));
    expect(res.status).toBe(400);
  });
});
