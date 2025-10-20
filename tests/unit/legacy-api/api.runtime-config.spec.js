import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

// We will require the compiled JS. Ensure build ran before this test.
const distFile = path.join(process.cwd(), 'packages/api/dist/functions/runtime-config.js');
let handler;

function makeReq(method = 'GET') {
  return {
    method,
    headers: {},
    query: {},
    url: 'http://localhost',
    body: null,
  };
}
function makeCtx() {
  return { log: { info: () => {}, warn: () => {}, error: () => {} } };
}

describe('runtime-config function', () => {
  beforeAll(() => {
    if (!fs.existsSync(distFile)) {
      throw new Error('runtime-config dist file missing. Run build first.');
    }
    handler = require(distFile).default || require(distFile);
  });

  it('returns 200 and expected keys on GET', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('GET'));
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.body).toHaveProperty('backend');
    expect(res.body).toHaveProperty('GITHUB_CLIENT_ID');
  });

  it('rejects non-GET method', async () => {
    const ctx = makeCtx();
    const res = await handler(ctx, makeReq('POST'));
    expect(res.status).toBe(405);
  });
});
