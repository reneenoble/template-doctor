/**
 * Setup Endpoint Tests
 * Tests GET/POST /api/v4/setup with Git CSV persistence
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type http from 'http';
// IMPORTANT: set test env flags BEFORE importing server module (dynamic import later)
process.env.NODE_ENV = 'test';

// Mock Octokit used inside misc route for Gist persistence
let gistContent: string | null = null; // null => simulate 404 on first GET
vi.mock('@octokit/rest', () => {
  class OctokitMock {
    gists = {
      get: async ({ gist_id }: any) => {
        if (!gistContent) {
          const err: any = new Error('Not Found');
          err.status = 404;
          throw err;
        }
        return {
          data: {
            files: {
              'template-doctor-config.csv': {
                content: gistContent,
              },
            },
          },
        };
      },
      update: async ({ files, description }: any) => {
        const file = files['template-doctor-config.csv'];
        gistContent = file.content;
        return {
          data: {
            html_url: `https://gist.github.com/mock/${process.env.CONFIG_GIST_ID}`,
            description,
          },
        };
      },
    };
  }
  return { Octokit: OctokitMock };
});

const CONFIG_FILE = path.join(process.cwd(), 'config', 'overrides.csv');

describe('Setup Endpoint - Git CSV Persistence', () => {
  let server: http.Server;
  const testPort = 3100; // Dedicated port for tests to avoid collisions

  beforeAll(async () => {
    process.env.PORT = String(testPort);
    process.env.CONFIG_GIST_ID = 'GIST123';
    process.env.GITHUB_TOKEN = 'dummy-token';
    const mod = await import('../src/index');
    server = await mod.startServer(testPort);
  });

  afterAll(async () => {
    await new Promise<void>((res) => server.close(() => res()));
  });
  beforeEach(async () => {
    // Reset mocked gist between tests for isolation
    // (cast to any to reach mocked module variable)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    gistContent = null;
    // Clean up any existing config file
    try {
      await fs.unlink(CONFIG_FILE);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  });

  it('should return empty overrides when CSV does not exist (GET)', async () => {
    const response = await fetch(`http://localhost:${testPort}/api/v4/setup`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.overrides).toEqual({});
    expect(data.count).toBe(0);
    expect(data.message).toContain('No configuration overrides found');
  });

  it('should reject unauthorized users (POST)', async () => {
    const response = await fetch(`http://localhost:${testPort}/api/v4/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'unauthorized-user',
        overrides: { testKey: 'testValue' },
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('should save and load configuration overrides (POST + GET)', async () => {
    // Set SETUP_ALLOWED_USERS for test
    const originalEnv = process.env.SETUP_ALLOWED_USERS;
    process.env.SETUP_ALLOWED_USERS = 'test-user,admin';
    try {
      // Save overrides (first POST will create gist content)
      const postResponse = await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'test-user',
          overrides: {
            feature1: 'enabled',
            timeout: '5000',
          },
        }),
      });

      expect(postResponse.status).toBe(200);
      const postData = await postResponse.json();
      expect(postData.ok).toBe(true);
      expect(postData.applied).toBe(2);

      // Verify CSV was created
      // Gist content should now exist in memory
      expect(gistContent).toMatch(/feature1/);

      // Load overrides
      const getResponse = await fetch(`http://localhost:${testPort}/api/v4/setup`);
      const getData = await getResponse.json();

      expect(getData.overrides.feature1).toBe('enabled');
      expect(getData.overrides.timeout).toBe('5000');
      expect(getData.count).toBe(2);
      expect(getData.metadata).toHaveLength(2);

      // Verify metadata includes user and timestamp
      const feature1Meta = getData.metadata.find((m: any) => m.key === 'feature1');
      expect(feature1Meta.updatedBy).toBe('test-user');
      expect(feature1Meta.updatedAt).toBeTruthy();
    } finally {
      process.env.SETUP_ALLOWED_USERS = originalEnv;
    }
  });

  it('should update existing overrides (POST)', async () => {
    process.env.SETUP_ALLOWED_USERS = 'admin';

    try {
      // Create initial overrides
      await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'admin',
          overrides: { key1: 'value1', key2: 'value2' },
        }),
      });

      // Update one key, add a new one
      await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'admin',
          overrides: { key1: 'updated-value1', key3: 'value3' },
        }),
      });

      // Verify final state
      const response = await fetch(`http://localhost:${testPort}/api/v4/setup`);
      const data = await response.json();

      expect(data.overrides.key1).toBe('updated-value1');
      expect(data.overrides.key2).toBe('value2');
      expect(data.overrides.key3).toBe('value3');
      expect(data.count).toBe(3);
    } finally {
      delete process.env.SETUP_ALLOWED_USERS;
    }
  });

  it('should delete overrides when value is null (POST)', async () => {
    process.env.SETUP_ALLOWED_USERS = 'admin';

    try {
      // Create overrides
      await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'admin',
          overrides: {
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
          },
        }),
      });

      // Delete key2
      await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'admin',
          overrides: { key2: null },
        }),
      });

      // Verify deletion
      const response = await fetch(`http://localhost:${testPort}/api/v4/setup`);
      const data = await response.json();

      expect(data.overrides.key1).toBe('value1');
      expect(data.overrides.key2).toBeUndefined();
      expect(data.overrides.key3).toBe('value3');
      expect(data.count).toBe(2);
    } finally {
      delete process.env.SETUP_ALLOWED_USERS;
    }
  });

  it('should handle CSV values with commas and quotes', async () => {
    process.env.SETUP_ALLOWED_USERS = 'admin';

    try {
      await fetch(`http://localhost:${testPort}/api/v4/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'admin',
          overrides: {
            description: 'This value has, commas',
            quoted: 'Value with "quotes" inside',
            both: 'Has, commas and "quotes"',
          },
        }),
      });

      const response = await fetch(`http://localhost:${testPort}/api/v4/setup`);
      const data = await response.json();

      expect(data.overrides.description).toBe('This value has, commas');
      expect(data.overrides.quoted).toBe('Value with "quotes" inside');
      expect(data.overrides.both).toBe('Has, commas and "quotes"');
    } finally {
      delete process.env.SETUP_ALLOWED_USERS;
    }
  });
});
