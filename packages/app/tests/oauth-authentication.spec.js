/**
 * OAuth API Authentication Integration Test
 *
 * Tests the OAuth authentication flow end-to-end:
 * 1. Unauthenticated requests to protected endpoints should return 401
 * 2. Authenticated requests with valid tokens should succeed
 * 3. Admin endpoints should require admin privileges
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('OAuth API Authentication', () => {
  test('health endpoint should be public (no auth required)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('client-settings endpoint should be public (no auth required)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v4/client-settings`);
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('github-oauth-token endpoint should be public (used during login)', async ({ request }) => {
    // This will fail with 400 (missing code) but should not be 401
    const response = await request.post(`${BASE_URL}/api/v4/github-oauth-token`, {
      data: {},
    });

    expect(response.status()).toBe(400); // Bad request, not unauthorized
    const body = await response.json();
    expect(body.error).toContain('code');
  });

  test('analyze-template endpoint should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v4/analyze-template`, {
      data: {
        repoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
        ruleSet: 'dod',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toContain('Authorization header');
  });

  test('validation-template endpoint should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v4/validation-template`, {
      data: {
        targetRepoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('issue-create endpoint should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v4/issue-create`, {
      data: {
        owner: 'test',
        repo: 'test',
        title: 'Test Issue',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('batch-scan-start endpoint should require authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v4/batch-scan-start`, {
      data: {
        repos: ['Azure-Samples/todo-nodejs-mongo'],
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('admin endpoints should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/db-info`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  // Tests with authentication (requires GITHUB_TOKEN env var)
  test.describe('Authenticated requests', () => {
    test.skip(!process.env.GITHUB_TOKEN, 'GITHUB_TOKEN not set');

    const authHeaders = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    };

    test('analyze-template should work with valid token', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/v4/analyze-template`, {
        headers: authHeaders,
        data: {
          repoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
          ruleSet: 'dod',
        },
      });

      // Should not be 401 - may be 200 (success) or other status if repo has issues
      expect(response.status()).not.toBe(401);

      if (response.ok()) {
        const body = await response.json();
        expect(body).toHaveProperty('timestamp');
        expect(body).toHaveProperty('repoUrl');
        expect(body).toHaveProperty('compliance');
      }
    });

    test('validation-template should work with valid token', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/v4/validation-template`, {
        headers: authHeaders,
        data: {
          targetRepoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
        },
      });

      // Should not be 401
      expect(response.status()).not.toBe(401);
    });

    test('admin endpoint should check for admin privileges', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/db-info`, {
        headers: authHeaders,
      });

      // Should not be 401 (authenticated)
      expect(response.status()).not.toBe(401);

      // Will be 403 (Forbidden) if user is not admin, or 200 if admin
      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error).toBe('Forbidden');
        expect(body.message).toContain('admin');
      } else if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('connectionType');
      }
    });
  });

  test.describe('Invalid token', () => {
    const invalidAuthHeaders = {
      Authorization: 'Bearer invalid_token_12345',
      'Content-Type': 'application/json',
    };

    test('should reject requests with invalid token', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/v4/analyze-template`, {
        headers: invalidAuthHeaders,
        data: {
          repoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
          ruleSet: 'dod',
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Invalid GitHub token');
    });
  });

  test.describe('Malformed Authorization header', () => {
    test('should reject non-Bearer tokens', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/v4/analyze-template`, {
        headers: {
          Authorization: 'Basic abc123',
          'Content-Type': 'application/json',
        },
        data: {
          repoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
          ruleSet: 'dod',
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Authorization header');
    });

    test('should reject empty Bearer token', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/v4/analyze-template`, {
        headers: {
          Authorization: 'Bearer ',
          'Content-Type': 'application/json',
        },
        data: {
          repoUrl: 'https://github.com/Azure-Samples/todo-nodejs-mongo',
          ruleSet: 'dod',
        },
      });

      expect(response.status()).toBe(401);
    });
  });
});
