/**
 * Authentication Middleware
 * Provides authentication and authorization checks for protected routes
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Extract GitHub username from authorization header
 * Expects: Authorization: Bearer <github_token>
 */
async function getGitHubUser(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error('[Auth] GitHub user fetch failed:', response.status);
      return null;
    }

    const user = await response.json();
    return user.login || null;
  } catch (error: any) {
    console.error('[Auth] Error fetching GitHub user:', error?.message);
    return null;
  }
}

/**
 * Middleware: Require authentication via GitHub token
 * Adds req.githubUser if authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <github_token>',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const githubUser = await getGitHubUser(token);

  if (!githubUser) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid GitHub token or unable to fetch user information',
    });
  }

  // Attach user to request for downstream handlers
  (req as any).githubUser = githubUser;
  (req as any).githubToken = token;

  next();
}

/**
 * Middleware: Require admin privileges
 * Must be used AFTER requireAuth middleware
 * 
 * Admin users are configured via ADMIN_GITHUB_USERS environment variable
 * Example: ADMIN_GITHUB_USERS=octocat,username2,username3
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const githubUser = (req as any).githubUser;

  if (!githubUser) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Use requireAuth middleware first.',
    });
  }

  // Get admin users from environment variable
  const adminUsers = process.env.ADMIN_GITHUB_USERS?.split(',').map(u => u.trim()) || [];

  if (adminUsers.length === 0) {
    console.warn('[Auth] No admin users configured. Set ADMIN_GITHUB_USERS environment variable.');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Admin access not configured. Please contact the system administrator.',
    });
  }

  if (!adminUsers.includes(githubUser)) {
    console.warn(`[Auth] Unauthorized admin access attempt by: ${githubUser}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: `User '${githubUser}' does not have admin privileges`,
      hint: 'Contact the system administrator to request admin access',
    });
  }

  console.log(`[Auth] Admin access granted to: ${githubUser}`);
  next();
}

/**
 * Optional: Middleware to check if user is in allowed list for specific operations
 * Uses SETUP_ALLOWED_USERS for backwards compatibility with existing setup endpoint
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
  const githubUser = await getGitHubUser(token);

  if (!githubUser) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid GitHub token',
    });
  }

  const allowedUsers = process.env.SETUP_ALLOWED_USERS?.split(',').map(u => u.trim()) || [];

  if (allowedUsers.length === 0 || !allowedUsers.includes(githubUser)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `User '${githubUser}' is not authorized for setup operations`,
    });
  }

  (req as any).githubUser = githubUser;
  (req as any).githubToken = token;

  next();
}
