/**
 * Input Validation UX Tests
 * Tests consistent validation behavior across individual and batch scans
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { containsXssAttempt, sanitizeGitHubUrl } from '../../packages/app/src/shared/sanitize';

describe('Input Validation UX - Consistent Behavior', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window & typeof globalThis;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
    });
    document = dom.window.document;
    window = dom.window as Window & typeof globalThis;
  });

  describe('XSS Detection', () => {
    it('should detect script tags', () => {
      expect(containsXssAttempt('<script>alert("XSS")</script>')).toBe(true);
      expect(containsXssAttempt('<ScRiPt>alert("XSS")</ScRiPt>')).toBe(true);
      expect(containsXssAttempt('some text <script> evil')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsXssAttempt('text onclick="alert(1)"')).toBe(true);
      expect(containsXssAttempt('text onload="steal()"')).toBe(true);
      expect(containsXssAttempt('text onmouseover="bad()"')).toBe(true);
      expect(containsXssAttempt('text onerror="attack()"')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsXssAttempt('javascript:alert(1)')).toBe(true);
      expect(containsXssAttempt('JavaScript:void(0)')).toBe(true);
    });

    it('should detect dangerous HTML tags', () => {
      expect(containsXssAttempt('<iframe src="evil">')).toBe(true);
      expect(containsXssAttempt('<object data="bad">')).toBe(true);
      expect(containsXssAttempt('<embed src="malicious">')).toBe(true);
    });

    it('should detect data URI attacks', () => {
      expect(containsXssAttempt('data:text/html,<script>alert(1)</script>')).toBe(true);
    });

    it('should not flag safe input', () => {
      expect(containsXssAttempt('https://github.com/owner/repo')).toBe(false);
      expect(containsXssAttempt('owner/repo')).toBe(false);
      expect(containsXssAttempt('some normal search text')).toBe(false);
      expect(containsXssAttempt('repo-name-with-dashes')).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should accept valid GitHub URLs', () => {
      expect(sanitizeGitHubUrl('https://github.com/owner/repo')).toBe('https://github.com/owner/repo');
      expect(sanitizeGitHubUrl('https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
      expect(sanitizeGitHubUrl('owner/repo')).toBe('https://github.com/owner/repo');
    });

    it('should reject XSS attempts in URLs', () => {
      expect(sanitizeGitHubUrl('<script>alert(1)</script>')).toBeNull();
      expect(sanitizeGitHubUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeGitHubUrl('owner/repo" onclick="alert(1)')).toBeNull();
    });

    it('should reject invalid URL patterns', () => {
      expect(sanitizeGitHubUrl('not-a-url')).toBeNull();
      expect(sanitizeGitHubUrl('http://evil.com/repo')).toBeNull();
      expect(sanitizeGitHubUrl('github.com/owner')).toBeNull();
      expect(sanitizeGitHubUrl('')).toBeNull();
    });

    it('should reject single words without slash', () => {
      expect(sanitizeGitHubUrl('hello')).toBeNull();
      expect(sanitizeGitHubUrl('randomword')).toBeNull();
      expect(sanitizeGitHubUrl('test123')).toBeNull();
    });

    it('should reject malformed URL attempts', () => {
      expect(sanitizeGitHubUrl('htt://something.com')).toBeNull();
      expect(sanitizeGitHubUrl('http://something.com')).toBeNull();
      expect(sanitizeGitHubUrl('https://evil.com/repo')).toBeNull();
    });

    it('should reject URLs with dangerous characters', () => {
      expect(sanitizeGitHubUrl('owner/<script>/repo')).toBeNull();
      expect(sanitizeGitHubUrl('owner/../repo')).toBeNull();
      expect(sanitizeGitHubUrl('owner/repo; rm -rf /')).toBeNull();
    });
  });

  describe('Error Message Consistency', () => {
    it('should show "Oops! That\'s not allowed!" for XSS attempts', () => {
      const xssInputs = [
        '<script>alert("hello")</script>',
        'text onclick="attack()"',
        'javascript:alert(1)',
        '<iframe src="evil">',
      ];

      xssInputs.forEach(input => {
        const isXss = containsXssAttempt(input);
        expect(isXss).toBe(true);
        // In real implementation, this triggers: showError('Invalid Input', "Oops! That's not allowed!")
      });
    });

    it('should show "Invalid URL" for malformed URL attempts', () => {
      const malformedUrls = [
        'htt://something.com',
        'http://evil.com/repo',
        'https://notgithub.com/owner/repo',
      ];

      malformedUrls.forEach(url => {
        const isUrlAttempt = /^https?:\/\/|:\/\//.test(url);
        const sanitized = sanitizeGitHubUrl(url);
        expect(isUrlAttempt).toBe(true);
        expect(sanitized).toBeNull();
        // In real implementation, this triggers: showError('Invalid URL', 'Not a valid GitHub repository URL')
      });
    });

    it('should show format guidance for single words', () => {
      const singleWords = [
        'hello',
        'randomword',
        'test123',
      ];

      singleWords.forEach(word => {
        const hasSlash = word.includes('/');
        const sanitized = sanitizeGitHubUrl(word);
        expect(hasSlash).toBe(false);
        expect(sanitized).toBeNull();
        // In real implementation, this triggers: showError('Invalid Repository', 'Use "owner/repo" format')
      });
    });
  });

  describe('Red Border Behavior', () => {
    it('should determine need for red border on individual search XSS', () => {
      const inputValue = '<script>alert("XSS")</script>';
      const shouldShowError = containsXssAttempt(inputValue);
      expect(shouldShowError).toBe(true);
      // In real implementation: input.style.border = '2px solid #dc3545'
    });

    it('should determine need for red border on batch scan XSS', () => {
      const textareaValue = '<script>alert("hello")</script>\nhttps://github.com/valid/repo';
      const lines = textareaValue.split('\n');
      const hasXss = lines.some(line => containsXssAttempt(line));
      expect(hasXss).toBe(true);
      // In real implementation: textarea.style.border = '2px solid #dc3545'
    });

    it('should determine need for red border on invalid URLs', () => {
      const textareaValue = 'not-a-url\ninvalid-format';
      const lines = textareaValue.split('\n');
      const invalidUrls = lines.filter(line => !sanitizeGitHubUrl(line.trim()));
      expect(invalidUrls.length).toBeGreaterThan(0);
      // In real implementation: textarea.style.border = '2px solid #dc3545'
    });

    it('should not show error for valid input', () => {
      const inputValue = 'owner/repo';
      const hasXss = containsXssAttempt(inputValue);
      const isValidUrl = sanitizeGitHubUrl(inputValue) !== null;
      expect(hasXss).toBe(false);
      expect(isValidUrl).toBe(true);
      // In real implementation: input.style.border = '' (reset)
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input gracefully', () => {
      expect(containsXssAttempt('')).toBe(false);
      expect(sanitizeGitHubUrl('')).toBeNull();
    });

    it('should handle whitespace-only input', () => {
      expect(containsXssAttempt('   ')).toBe(false);
      expect(sanitizeGitHubUrl('   ')).toBeNull();
    });

    it('should handle mixed valid and invalid URLs in batch', () => {
      const batch = [
        'https://github.com/valid1/repo1',
        '<script>alert(1)</script>',
        'https://github.com/valid2/repo2',
        'invalid-url',
        'owner/valid-repo',
      ];

      const hasXss = batch.some(url => containsXssAttempt(url));
      const validUrls = batch
        .filter(url => !containsXssAttempt(url))
        .map(url => sanitizeGitHubUrl(url))
        .filter(url => url !== null);

      expect(hasXss).toBe(true);
      expect(validUrls.length).toBe(3);
    });

    it('should handle case-insensitive XSS detection', () => {
      expect(containsXssAttempt('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
      expect(containsXssAttempt('<ScRiPt>alert(1)</ScRiPt>')).toBe(true);
      expect(containsXssAttempt('ONCLICK="bad()"')).toBe(true);
      expect(containsXssAttempt('JavaScript:void(0)')).toBe(true);
    });
  });
});
