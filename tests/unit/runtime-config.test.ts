import { describe, it, expect } from 'vitest';

// Import the compiled function directly to mimic the Functions host environment.
// Using the compiled JS ensures we are testing the exact artifact function.json points to.
// If build output path changes, update this import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeConfigFn = require('../../packages/api/dist/functions/runtime-config.js').default;

function makeCtx() {
  return {
    log: {
      error: () => {},
      info: () => {},
      warn: () => {},
      verbose: () => {},
    },
    res: undefined as any,
  };
}

describe('runtime-config function wrapper', () => {
  it('returns JSON body on GET', async () => {
    const ctx = makeCtx();
    const req = { method: 'GET', headers: {} } as any;
    await runtimeConfigFn(ctx, req);
    expect(ctx.res).toBeDefined();
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body).toBeDefined();
    expect(typeof ctx.res.body).toBe('object');
    expect(ctx.res.body).toHaveProperty('backend');
  });

  it('omits body on HEAD', async () => {
    const ctx = makeCtx();
    const req = { method: 'HEAD', headers: {} } as any;
    await runtimeConfigFn(ctx, req);
    expect(ctx.res).toBeDefined();
    expect(ctx.res.status).toBe(200);
    // Per wrapper logic, HEAD should not include a body
    expect(ctx.res.body).toBeUndefined();
  });
});
