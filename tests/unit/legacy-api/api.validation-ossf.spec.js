import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

const distFile = path.join(process.cwd(), 'packages/api/dist/functions/validation-ossf.js');
let handler;

function makeReq(method = 'POST', body = {}) {
  return { method, headers: {}, body };
}
function makeCtx() {
  return { log: { warn: () => {}, error: () => {}, info: () => {} } };
}

describe('validation-ossf function', () => {
  beforeAll(() => {
    if (!fs.existsSync(distFile)) throw new Error('validation-ossf dist missing. Build first.');
    handler = require(distFile).default || require(distFile);
  });

  it('405 on non-POST', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('GET'));
    expect(res.status).toBe(405);
  });

  it('400 when templateUrl missing', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { minScore: 5 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/templateUrl/i);
  });

  it('400 when minScore missing', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { templateUrl: 'owner/repo' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minScore/i);
  });

  it('400 when minScore invalid', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST', { templateUrl: 'owner/repo', minScore: 15 }));
    expect(res.status).toBe(400);
  });
});
