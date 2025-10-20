import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth, requireAdmin } from '../auth.js';

// Mock Octokit
const mockGetAuthenticated = vi.fn();
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    users: {
      getAuthenticated: mockGetAuthenticated,
    },
  })),
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      headers: {},
      path: '/api/v4/test',
      ip: '127.0.0.1',
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();
    mockGetAuthenticated.mockReset();
  });

  describe('requireAuth', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('Authorization header'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header doesn't start with Bearer", async () => {
      mockReq.headers = { authorization: 'Basic abc123' };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when GitHub token is invalid', async () => {
      mockReq.headers = { authorization: 'Bearer invalid_token' };

      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit({ auth: 'invalid_token' });
      (mockOctokit.users.getAuthenticated as any).mockRejectedValue(new Error('Bad credentials'));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('Invalid GitHub token'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should attach user info and call next() when token is valid', async () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };

      const mockUserData = {
        login: 'testuser',
        id: 12345,
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.png',
      };

      mockGetAuthenticated.mockResolvedValue({
        data: mockUserData,
      });

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUserData);
      expect(mockReq.githubToken).toBe('valid_token');
      expect(mockReq.githubUser).toBe('testuser');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next() without user info when no Authorization header', async () => {
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should validate token if Authorization header is present', async () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };

      const mockUserData = {
        login: 'testuser',
        id: 12345,
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.png',
      };

      mockGetAuthenticated.mockResolvedValue({
        data: mockUserData,
      });

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUserData);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    beforeEach(() => {
      mockReq.user = {
        login: 'testuser',
        id: 12345,
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.png',
      };
    });

    it('should return 401 when user is not authenticated', () => {
      mockReq.user = undefined;

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 503 when no admin users are configured', () => {
      process.env.ADMIN_GITHUB_USERS = '';

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Service Unavailable',
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not in admin list', () => {
      process.env.ADMIN_GITHUB_USERS = 'admin1,admin2';

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.stringContaining('testuser'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when user is in admin list', () => {
      process.env.ADMIN_GITHUB_USERS = 'admin1,testuser,admin2';

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle whitespace in admin list', () => {
      process.env.ADMIN_GITHUB_USERS = ' admin1 , testuser , admin2 ';

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
