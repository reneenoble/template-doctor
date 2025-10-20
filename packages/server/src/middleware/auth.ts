/**
 * Authentication Middleware
 * Provides authentication and authorization checks for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { createLogger } from '../shared/logger.js';

const authLogger = createLogger('auth');

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        login: string;
        id: number;
        name: string | null;
        email: string | null;
        avatar_url: string;
      };
      githubToken?: string;
      githubUser?: string; // Deprecated: use req.user.login instead
    }
  }
}

/**
 * Fetch GitHub user info using token
 * Uses Octokit for better type safety and error handling
 */
async function getGitHubUserInfo(token: string): Promise<{
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string;
} | null> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();

    return {
      login: user.login,
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    };
  } catch (error: any) {
    authLogger.warn({ error: error?.message, status: error?.status }, 'GitHub user fetch failed');
    return null;
  }
}

/**
 * Middleware: Require authentication via GitHub token
 * Adds req.user and req.githubToken if authenticated
 *
 * @example
 * router.post('/protected', requireAuth, async (req, res) => {
 *   const { user, githubToken } = req;
 *   console.log(`Authenticated as: ${user.login}`);
 * });
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    authLogger.warn({ path: req.path, ip: req.ip }, 'Missing or invalid Authorization header');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <github_token>',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const userInfo = await getGitHubUserInfo(token);

  if (!userInfo) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid GitHub token or unable to fetch user information',
    });
  }

  authLogger.info({ user: userInfo.login, path: req.path }, 'User authenticated');

  // Attach user info to request for downstream handlers
  req.user = userInfo;
  req.githubToken = token;
  req.githubUser = userInfo.login; // Backwards compatibility

  next();
}

/**
 * Alias for requireAuth - validates GitHub OAuth token from Authorization header
 * Adds user info to req.user if token is valid
 */
export const authenticateGitHub = requireAuth;

/**
 * Optional middleware - allows both authenticated and unauthenticated requests
 * Attaches user info if token is present and valid
 * Continues without user info if no token provided
 *
 * @example
 * router.get('/public', optionalAuth, async (req, res) => {
 *   if (req.user) {
 *     console.log(`Logged in as: ${req.user.login}`);
 *   } else {
 *     console.log('Anonymous access');
 *   }
 * });
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without user info
    return next();
  }

  // Token provided - validate it
  return requireAuth(req, res, next);
}

/**
 * Middleware: Require admin privileges
 * Must be used AFTER requireAuth middleware
 *
 * Admin users are configured via ADMIN_GITHUB_USERS environment variable
 * Example: ADMIN_GITHUB_USERS=octocat,username2,username3
 *
 * @example
 * router.delete('/admin/purge', requireAuth, requireAdmin, async (req, res) => {
 *   // Only admin users can access this endpoint
 * });
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    authLogger.warn({ path: req.path }, 'Admin access attempted without authentication');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Use requireAuth middleware first.',
    });
  }

  // Get admin users from environment variable
  const adminUsers =
    process.env.ADMIN_GITHUB_USERS?.split(',')
      .map((u) => u.trim())
      .filter(Boolean) || [];

  if (adminUsers.length === 0) {
    authLogger.warn('No admin users configured. Set ADMIN_GITHUB_USERS environment variable.');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Admin access not configured. Please contact the system administrator.',
    });
  }

  if (!adminUsers.includes(req.user.login)) {
    authLogger.warn({ user: req.user.login, path: req.path }, 'Unauthorized admin access attempt');
    return res.status(403).json({
      error: 'Forbidden',
      message: `User '${req.user.login}' does not have admin privileges`,
      hint: 'Contact the system administrator to request admin access',
    });
  }

  authLogger.info({ user: req.user.login, path: req.path }, 'Admin access granted');
  next();
}

/**
 * Optional: Middleware to check if user is in allowed list for specific operations
 * Uses SETUP_ALLOWED_USERS for backwards compatibility with existing setup endpoint
 *
 * @deprecated Use requireAuth + custom authorization check instead
 */
export async function requireSetupAccess(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);
  const userInfo = await getGitHubUserInfo(token);

  if (!userInfo) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid GitHub token',
    });
  }

  const allowedUsers =
    process.env.SETUP_ALLOWED_USERS?.split(',')
      .map((u) => u.trim())
      .filter(Boolean) || [];

  if (allowedUsers.length === 0 || !allowedUsers.includes(userInfo.login)) {
    authLogger.warn({ user: userInfo.login, path: req.path }, 'Unauthorized setup access attempt');
    return res.status(403).json({
      error: 'Forbidden',
      message: `User '${userInfo.login}' is not authorized for setup operations`,
    });
  }

  req.user = userInfo;
  req.githubToken = token;
  req.githubUser = userInfo.login; // Backwards compatibility

  next();
}
