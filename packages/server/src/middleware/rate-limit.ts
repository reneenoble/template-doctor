import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting configuration for API endpoints
 * 
 * We use tiered rate limits based on endpoint sensitivity:
 * - Batch: Very heavy operations (batch analysis) - 3 requests/hour
 * - Strict: Heavy operations (single analysis, validation) - 10 requests/15min
 * - Standard: General API endpoints - 100 requests/minute
 * - Auth: OAuth token exchange - 20 requests/minute
 */

// Environment variable configuration with defaults
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const RATE_LIMIT_STRICT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_STRICT_MAX = parseInt(process.env.RATE_LIMIT_STRICT_MAX || '10', 10);
const RATE_LIMIT_BATCH_WINDOW_MS = parseInt(process.env.RATE_LIMIT_BATCH_WINDOW_MS || '3600000', 10); // 1 hour
const RATE_LIMIT_BATCH_MAX = parseInt(process.env.RATE_LIMIT_BATCH_MAX || '3', 10);
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10);

/**
 * Custom key generator that uses authenticated user OR IP address
 * 
 * For authenticated requests: Uses GitHub username for accurate per-user limits
 * For unauthenticated requests: Falls back to IP address
 */
const keyGenerator = (req: Request): string => {
  // Use authenticated user's GitHub login if available (from requireAuth middleware)
  if (req.user?.login) {
    return `user:${req.user.login}`;
  }
  
  // Fall back to IP address for unauthenticated requests
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
});

/**
 * Strict rate limiter for expensive operations (single analysis/validation)
 * Default: 10 requests per 15 minutes per user/IP
 * 
 * Use for:
 * - Single template analysis
 * - Validation workflows
 * - Individual scans
 * 
 * Rationale: Analysis is CPU/memory intensive and calls external APIs.
 * 15-minute window prevents API abuse while allowing normal usage.
 */
export const strictRateLimit = rateLimit({
  windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
  max: RATE_LIMIT_STRICT_MAX,
  keyGenerator,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Batch rate limiter for very expensive batch operations
 * Default: 3 requests per hour per user/IP
 * 
 * Use for:
 * - Batch analysis (multiple repos)
 * - Batch validation
 * 
 * Rationale: Each batch can process up to 50 repositories, consuming
 * significant server resources. Hourly limit prevents resource exhaustion.
 */
export const batchRateLimit = rateLimit({
  windowMs: RATE_LIMIT_BATCH_WINDOW_MS,
  max: RATE_LIMIT_BATCH_MAX,
  keyGenerator,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Batch analysis rate limit exceeded. You can perform 3 batch operations per hour.',
    retryAfter: '1 hour',
  },
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
});

/**
 * No rate limit (for testing or admin endpoints)
 */
export const noRateLimit = (req: Request, res: Response, next: NextFunction) => {
  next();
};
