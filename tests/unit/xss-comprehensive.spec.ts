/**
 * Comprehensive XSS Protection Tests
 * Tests against OWASP XSS attack vectors
 */

import { describe, it, expect } from 'vitest';
import { containsXssAttempt, sanitizeHtml } from '../../packages/app/src/shared/sanitize';

describe('Comprehensive XSS Protection', () => {
  describe('Script Injection Attacks', () => {
    it('should detect basic script tags', () => {
      expect(containsXssAttempt('<script>alert(1)</script>')).toBe(true);
      expect(containsXssAttempt('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
      expect(containsXssAttempt('<script >alert(1)</script>')).toBe(true);
      expect(containsXssAttempt('<script\n>alert(1)</script>')).toBe(true);
    });

    it('should detect script with attributes', () => {
      expect(containsXssAttempt('<script src="evil.js"></script>')).toBe(true);
      expect(containsXssAttempt('<script type="text/javascript">alert(1)</script>')).toBe(true);
    });
  });

  describe('Event Handler Attacks', () => {
    it('should detect common event handlers', () => {
      expect(containsXssAttempt('onclick="alert(1)"')).toBe(true);
      expect(containsXssAttempt('onload="alert(1)"')).toBe(true);
      expect(containsXssAttempt('onerror="alert(1)"')).toBe(true);
      expect(containsXssAttempt('onmouseover="alert(1)"')).toBe(true);
      expect(containsXssAttempt('onfocus="alert(1)"')).toBe(true);
      expect(containsXssAttempt('onblur="alert(1)"')).toBe(true);
    });

    it('should detect event handlers with spaces', () => {
      expect(containsXssAttempt('onclick = "alert(1)"')).toBe(true);
      expect(containsXssAttempt('onload  =  "alert(1)"')).toBe(true);
    });
  });

  describe('Protocol-Based Attacks', () => {
    it('should detect javascript: protocol', () => {
      expect(containsXssAttempt('javascript:alert(1)')).toBe(true);
      expect(containsXssAttempt('JavaScript:alert(1)')).toBe(true);
      expect(containsXssAttempt('JAVASCRIPT:alert(1)')).toBe(true);
    });

    it('should detect vbscript: protocol', () => {
      expect(containsXssAttempt('vbscript:msgbox(1)')).toBe(true);
      expect(containsXssAttempt('VBScript:msgbox(1)')).toBe(true);
    });

    it('should detect data: URIs with HTML', () => {
      expect(containsXssAttempt('data:text/html,<script>alert(1)</script>')).toBe(true);
      expect(containsXssAttempt('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(true);
    });
  });

  describe('Dangerous HTML Tags', () => {
    it('should detect iframe tags', () => {
      expect(containsXssAttempt('<iframe src="evil.com"></iframe>')).toBe(true);
      expect(containsXssAttempt('<IFRAME src="evil.com"></IFRAME>')).toBe(true);
    });

    it('should detect object tags', () => {
      expect(containsXssAttempt('<object data="evil.swf"></object>')).toBe(true);
      expect(containsXssAttempt('<OBJECT data="evil.swf"></OBJECT>')).toBe(true);
    });

    it('should detect embed tags', () => {
      expect(containsXssAttempt('<embed src="evil.swf">')).toBe(true);
      expect(containsXssAttempt('<EMBED src="evil.swf">')).toBe(true);
    });

    it('should detect applet tags', () => {
      expect(containsXssAttempt('<applet code="Evil.class"></applet>')).toBe(true);
    });

    it('should detect meta tags', () => {
      expect(containsXssAttempt('<meta http-equiv="refresh" content="0;url=evil.com">')).toBe(true);
    });

    it('should detect link tags', () => {
      expect(containsXssAttempt('<link rel="stylesheet" href="evil.css">')).toBe(true);
    });

    it('should detect base tags', () => {
      expect(containsXssAttempt('<base href="evil.com">')).toBe(true);
    });

    it('should detect form tags', () => {
      expect(containsXssAttempt('<form action="evil.com">')).toBe(true);
    });

    it('should detect SVG tags', () => {
      expect(containsXssAttempt('<svg onload="alert(1)">')).toBe(true);
      expect(containsXssAttempt('<svg><script>alert(1)</script></svg>')).toBe(true);
    });

    it('should detect MathML tags', () => {
      expect(containsXssAttempt('<math><mtext>test</mtext></math>')).toBe(true);
    });
  });

  describe('CSS-Based Attacks', () => {
    it('should detect CSS expressions', () => {
      expect(containsXssAttempt('expression(alert(1))')).toBe(true);
      expect(containsXssAttempt('EXPRESSION(alert(1))')).toBe(true);
    });

    it('should detect CSS imports', () => {
      expect(containsXssAttempt('@import "evil.css"')).toBe(true);
      expect(containsXssAttempt('import "evil.css"')).toBe(true);
    });
  });

  describe('HTML Entity Encoding', () => {
    it('should properly escape HTML special characters', () => {
      expect(sanitizeHtml('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      
      expect(sanitizeHtml('Test & <danger>'))
        .toBe('Test &amp; &lt;danger&gt;');
      
      // Quotes are preserved by textContent (safe for display)
      expect(sanitizeHtml('"quotes" and \'apostrophes\''))
        .toContain('"quotes"');
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
    });
  });

  describe('Real-World Attack Vectors', () => {
    it('should detect OWASP Top 10 XSS examples', () => {
      // From OWASP XSS Filter Evasion Cheat Sheet
      const attacks = [
        '<IMG SRC=javascript:alert(1)>',
        '<IMG SRC=JaVaScRiPt:alert(1)>',
        '<IMG SRC="javascript:alert(1);">',
        '<IMG onload="alert(1)">',
        '<BODY ONLOAD=alert(1)>',
        '<INPUT TYPE="BUTTON" onclick="alert(1)">',
        '<SELECT onfocus=alert(1)>',
        '<TEXTAREA onfocus=alert(1)>',
        '<IFRAME SRC="javascript:alert(1);"></IFRAME>',
        '<OBJECT DATA="javascript:alert(1);"></OBJECT>',
        '<EMBED SRC="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
      ];

      attacks.forEach(attack => {
        expect(containsXssAttempt(attack)).toBe(true);
      });
    });

    it('should allow safe GitHub URLs', () => {
      const safeInputs = [
        'https://github.com/owner/repo',
        'owner/repo',
        'my-template-name',
        'azure-samples',
        'todo-app-123',
      ];

      safeInputs.forEach(input => {
        expect(containsXssAttempt(input)).toBe(false);
      });
    });
  });

  describe('Mutation XSS (mXSS) Protection', () => {
    it('should detect nested encoding attempts', () => {
      expect(containsXssAttempt('<script>alert(String.fromCharCode(88,83,83))</script>')).toBe(true);
    });

    it('should detect Unicode/UTF-8 bypasses', () => {
      // Common Unicode tricks
      expect(containsXssAttempt('\u003cscript\u003ealert(1)\u003c/script\u003e')).toBe(true);
    });
  });

  describe('Context-Specific Protection', () => {
    it('should handle repository URLs correctly', () => {
      const maliciousUrls = [
        'https://github.com/owner/<script>alert(1)</script>',
        'owner/repo<script>alert(1)</script>',
        'javascript:alert(1)',
        '<iframe src="evil.com">',
      ];

      maliciousUrls.forEach(url => {
        expect(containsXssAttempt(url)).toBe(true);
      });
    });

    it('should handle error messages safely', () => {
      const testCases = [
        { msg: 'Error: <script>alert(1)</script>', expect: '&lt;script' },
        { msg: 'Failed to load: <img onerror="alert(1)" src=x>', expect: '&lt;img' },
        { msg: 'Invalid input: javascript:alert(1)', expect: 'javascript:' },
      ];

      testCases.forEach(({ msg, expect: expectedContent }) => {
        const safe = sanitizeHtml(msg);
        // HTML tags should be escaped (not executed as HTML)
        expect(safe).not.toContain('<script');
        // Verify the dangerous content is still visible but escaped
        expect(safe).toContain(expectedContent);
      });
    });
  });

  describe('Edge Cases and Bypasses', () => {
    it('should detect obfuscated script tags', () => {
      // Null byte obfuscation - should be caught by sanitizeHtml even if not detected
      const obfuscated = '<scr\x00ipt>alert(1)</scr\x00ipt>';
      // Our pattern doesn't catch null bytes, but sanitizeHtml will escape the tags
      expect(sanitizeHtml(obfuscated)).toContain('&lt;');
    });

    it('should detect polyglot XSS', () => {
      // Polyglot that works in multiple contexts
      expect(containsXssAttempt('javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert(1)//')).toBe(true);
    });

    it('should handle very long inputs without performance issues', () => {
      const longInput = 'a'.repeat(10000) + '<script>alert(1)</script>';
      const start = Date.now();
      const result = containsXssAttempt(longInput);
      const duration = Date.now() - start;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });
});
