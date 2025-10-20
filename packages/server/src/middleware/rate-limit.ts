import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting configuration for API endpoints
 * 
 * We use tiered rate limits based on endpoint sensitivity:
 * - Strict: Heavy operations (analysis, validation, batch scanning)
 * - Standard: General API endpoints
 * - Auth: OAuth token exchange
 */

// Environment variable configuration with defaults
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const RATE_LIMIT_STRICT_MAX = parseInt(process.env.RATE_LIMIT_STRICT_MAX || '10', 10);
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10);

/**
 * Custom key generator that uses IP address for rate limiting
 * 
 * Note: Future enhancement after OAuth PR #147 merges:
 * Can be extended to use req.user.login for authenticated users
 */
const keyGenerator = (req: Request): string => {
  // Use IP address for rate limiting
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.ip || 'unknown';
  
  return `ip:${ip}`;
};

/**
 * Custom handler for rate limit exceeded
 */
const handler = (req: Request, res: Response) => {
  const identifier = keyGenerator(req);
  console.warn(`Rate limit exceeded for ${identifier} on ${req.path}`);
  
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

/**
 * Standard rate limiter for general API endpoints
 * Default: 100 requests per minute per user/IP
 */
export const standardRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  keyGenerator,
  handler,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable legacy `X-RateLimit-*` headers; use standard `RateLimit-*` headers instead
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
  // Disable IPv6 validation since we handle X-Forwarded-For
  validate: { keyGeneratorIpFallback: false },
});

/**
 * Strict rate limiter for expensive operations
 * Default: 10 requests per minute per user/IP
 * 
 * Use for:
 * - Template analysis
 * - Validation workflows
 * - Batch scanning
 */
export const strictRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_STRICT_MAX,
  keyGenerator,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
});

/**
 * Auth rate limiter for OAuth token exchange
 * Default: 20 requests per minute per IP
 * 
 * More restrictive than standard to prevent token abuse,
 * but higher than strict to allow normal login flows
 */
export const authRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  keyGenerator,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
});

/**
 * No rate limit (for testing or admin endpoints)
 */
export const noRateLimit = (req: Request, res: Response, next: NextFunction) => {
  next();
};
