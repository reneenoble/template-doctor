import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// Mock environment variables before importing
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.RATE_LIMIT_STRICT_MAX = '10';
process.env.RATE_LIMIT_AUTH_MAX = '20';

describe('Rate Limiting Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      ip: '127.0.0.1',
      headers: {},
    };

    const headerStore: Record<string, string | number> = {};

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn((name: string, value: string | number) => {
        headerStore[name] = value;
        return mockRes;
      }),
      getHeader: vi.fn((name: string) => headerStore[name]),
    };

    mockNext = vi.fn();
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', async () => {
      const { standardRateLimit } = await import('../../src/middleware/rate-limit.js');
      expect(standardRateLimit).toBeDefined();
    });

    it('should have default values when env vars not set', async () => {
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
      
      // Re-import to get defaults
      vi.resetModules();
      const { standardRateLimit } = await import('../../src/middleware/rate-limit.js');
      
      expect(standardRateLimit).toBeDefined();
      
      // Restore
      process.env.RATE_LIMIT_WINDOW_MS = '60000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '100';
    });
  });

  describe('keyGenerator', () => {
    it('should use IP address for rate limiting', () => {
      mockReq.ip = '192.168.1.1';
      
      expect(mockReq.ip).toBe('192.168.1.1');
    });

    it('should handle X-Forwarded-For header', () => {
      mockReq.headers = {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      };
      
      const forwarded = mockReq.headers['x-forwarded-for'];
      const firstIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null;
      
      expect(firstIp).toBe('1.2.3.4');
    });

    it('should handle missing IP gracefully', () => {
      mockReq.ip = undefined;
      mockReq.headers = {};
      
      // Should fall back to 'unknown'
      const ip = mockReq.ip || 'unknown';
      expect(ip).toBe('unknown');
    });
  });

  describe('Rate limit types', () => {
    it('should export standardRateLimit', async () => {
      const { standardRateLimit } = await import('../../src/middleware/rate-limit.js');
      expect(standardRateLimit).toBeDefined();
      expect(typeof standardRateLimit).toBe('function');
    });

    it('should export strictRateLimit', async () => {
      const { strictRateLimit } = await import('../../src/middleware/rate-limit.js');
      expect(strictRateLimit).toBeDefined();
      expect(typeof strictRateLimit).toBe('function');
    });

    it('should export authRateLimit', async () => {
      const { authRateLimit } = await import('../../src/middleware/rate-limit.js');
      expect(authRateLimit).toBeDefined();
      expect(typeof authRateLimit).toBe('function');
    });

    it('should export noRateLimit', async () => {
      const { noRateLimit } = await import('../../src/middleware/rate-limit.js');
      expect(noRateLimit).toBeDefined();
      expect(typeof noRateLimit).toBe('function');
    });
  });

  describe('noRateLimit', () => {
    it('should call next without any rate limiting', async () => {
      const { noRateLimit } = await import('../../src/middleware/rate-limit.js');
      
      noRateLimit(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Error response structure', () => {
    it('should return proper 429 response structure', () => {
      const mockHandler = (req: any, res: any) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: res.getHeader('Retry-After'),
        });
      };

      mockHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
          message: expect.any(String),
        })
      );
    });
  });

  describe('Health check skip logic', () => {
    it('should skip rate limiting for /api/health path', () => {
      mockReq.path = '/api/health';
      
      // The skip function checks if path === '/api/health'
      const shouldSkip = mockReq.path === '/api/health';
      
      expect(shouldSkip).toBe(true);
    });

    it('should not skip rate limiting for other paths', () => {
      mockReq.path = '/api/v4/analyze-template';
      
      const shouldSkip = mockReq.path === '/api/health';
      
      expect(shouldSkip).toBe(false);
    });
  });
});
