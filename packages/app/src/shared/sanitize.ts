/**
 * Input sanitization utilities for Template Doctor
 * Prevents XSS attacks and ensures data integrity
 */

/**
 * Sanitize HTML string to prevent XSS attacks
 * Escapes HTML special characters
 * 
 * @param str - Raw input string
 * @returns Sanitized string safe for insertion into HTML
 */
export function sanitizeHtml(str: string): string {
  if (!str) return '';
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitize and validate search query input
 * - Trims whitespace
 * - Removes control characters
 * - Limits length
 * - Escapes HTML special characters
 * 
 * @param query - Raw search query
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized query string
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 500): string {
  if (!query) return '';
  
  // Trim whitespace
  let sanitized = query.trim();
  
  // Remove control characters (except newlines and tabs for now)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Check if input contains potential XSS attempts
 * Detects script tags, event handlers, and other malicious patterns
 * 
 * @param input - Raw input string
 * @returns true if XSS attempt detected, false otherwise
 */
export function containsXssAttempt(input: string): boolean {
  if (!input) return false;
  
  const xssPatterns = [
    /<script[\s>]/i,           // Script tags
    /<\/script>/i,             // Closing script
    /javascript:/i,            // JavaScript protocol
    /on\w+\s*=/i,             // Event handlers (onclick=, onload=, etc.)
    /<iframe/i,                // Iframes
    /<object/i,                // Objects
    /<embed/i,                 // Embeds
    /<applet/i,                // Applets (legacy but still dangerous)
    /data:text\/html/i,        // Data URIs with HTML
    /vbscript:/i,              // VBScript protocol
    /<meta[\s>]/i,             // Meta tags (can do redirects)
    /<link[\s>]/i,             // Link tags (can load external resources)
    /<base[\s>]/i,             // Base tags (can hijack relative URLs)
    /<form[\s>]/i,             // Forms (can submit data to attacker)
    /expression\s*\(/i,        // CSS expressions (IE)
    /import\s+/i,              // CSS/JS imports
    /<svg[\s>]/i,              // SVG (can contain scripts)
    /<math[\s>]/i,             // MathML (can contain scripts)
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize GitHub repository URL
 * Ensures URL is valid GitHub format
 * 
 * @param url - Raw repository URL
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeGitHubUrl(url: string): string | null {
  if (!url) return null;
  
  const sanitized = url.trim();
  
  // Valid patterns:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo.git
  // - owner/repo
  const githubUrlPattern = /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/;
  
  const match = sanitized.match(githubUrlPattern);
  if (!match) return null;
  
  const [, owner, repo] = match;
  
  // Ensure no dangerous characters in owner/repo names
  if (!/^[a-zA-Z0-9_-]+$/.test(owner)) return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(repo)) return null;
  
  // Return normalized URL
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Sanitize text for safe display in HTML attributes
 * Escapes quotes and HTML entities
 * 
 * @param str - Raw text
 * @returns Sanitized text safe for HTML attributes
 */
export function sanitizeAttribute(str: string): string {
  if (!str) return '';
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate input length
 * 
 * @param input - Input string
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns true if valid, false otherwise
 */
export function validateLength(input: string, min: number = 0, max: number = 1000): boolean {
  if (!input) return min === 0;
  return input.length >= min && input.length <= max;
}

/**
 * Sanitize user input for logging
 * Truncates long strings and removes sensitive patterns
 * 
 * @param input - Raw input
 * @param maxLength - Maximum length for logs (default: 100)
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLogging(input: string, maxLength: number = 100): string {
  if (!input) return '';
  
  let sanitized = input.trim();
  
  // Remove potential tokens/secrets (anything that looks like a token)
  sanitized = sanitized.replace(/\b[a-f0-9]{40,}\b/gi, '[TOKEN_REDACTED]');
  sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN_REDACTED]');
  
  // Truncate for logs
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}
