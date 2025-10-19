/**
 * Structured logging for Template Doctor server using Pino
 * 
 * Production: JSON-formatted logs for Azure Application Insights
 * Development: Pretty-printed colorized logs
 */

import pino from 'pino';
import pinoHttp from 'pino-http';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Base Pino logger instance
 * Configured for structured JSON logging in production, pretty printing in dev
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{module} - {msg}',
        },
      }
    : undefined, // Production: JSON logs for Azure
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    service: 'template-doctor-server',
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create a child logger for a specific module/component
 * 
 * @param module - Module name (e.g., 'database', 'auth', 'analysis-storage')
 * @returns Pino logger instance with module context
 * 
 * @example
 * const logger = createLogger('database');
 * logger.info('Connected to MongoDB');
 * logger.error({ err: error }, 'Connection failed');
 */
export const createLogger = (module: string) => {
  return logger.child({ module });
};

/**
 * HTTP request logger middleware for Express
 * Automatically logs all HTTP requests/responses with:
 * - Request method, URL, headers (redacted)
 * - Response status code, duration
 * - Error details (if applicable)
 * 
 * Log levels:
 * - info: Successful requests (2xx, 3xx)
 * - warn: Client errors (4xx)
 * - error: Server errors (5xx)
 */
export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  // Redact sensitive data from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-github-token"]',
      'req.headers["x-api-key"]',
    ],
    remove: true,
  },
  // Don't log health check spam
  autoLogging: {
    ignore: (req) => req.url === '/api/v4/health',
  },
});
