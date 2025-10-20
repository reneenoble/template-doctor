/**
 * Unit tests for AZD validation error pattern & issue body helpers
 */
import { describe, it, expect } from 'vitest';

// Pattern duplicated from UI logic (ensure kept in sync with frontend highlight logic)
const unmatchedPrincipalErrorPattern =
  /UnmatchedPrincipalType[\s\S]*has type[\s\S]*ServicePrincipal[\s\S]*different from[\s\S]*PrinciaplType[\s\S]*User/i;

describe('UnmatchedPrincipalType error pattern', () => {
  it('matches real multi-line error sample', () => {
    const actualError = `ERROR: error executing step command 'provision': deployment failed: error deploying infrastructure: deploying to subscription:\n\nDeployment Error Details:\nUnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.\nTraceID: 7dc0c1710a91ebcbef32dff73560b11d`;
    expect(unmatchedPrincipalErrorPattern.test(actualError)).toBe(true);
  });

  it('matches variations in case and spacing', () => {
    const v1 = `UnmatchedPrincipalType: The PrincipalId 'abc' has type 'ServicePrincipal', which is different from specified PrinciaplType 'User'.`;
    const v2 = `UNMATCHEDPRINCIPALTYPE: The PrincipalId 'xyz' has type 'ServicePrincipal' , which is different from specified PRINCIAPLTYPE 'User'.`;
    expect(unmatchedPrincipalErrorPattern.test(v1)).toBe(true);
    expect(unmatchedPrincipalErrorPattern.test(v2)).toBe(true);
  });

  it('does not match unrelated errors', () => {
    const unrelated = [
      'Error: Resource not found',
      'Deployment failed: timeout',
      'PrincipalId mismatch but different error',
      'ServicePrincipal error without keyword',
    ];
    unrelated.forEach((e) => expect(unmatchedPrincipalErrorPattern.test(e)).toBe(false));
  });

  it('matches all-lowercase variant', () => {
    const lower = `unmatchedprincipaltype: the principalid 'abc' has type 'serviceprincipal' , which is different from specified princiapltype 'user'.`;
    expect(unmatchedPrincipalErrorPattern.test(lower)).toBe(true);
  });

  it('works across line breaks', () => {
    const multi = `UnmatchedPrincipalType: The PrincipalId 'a614'\n has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.`;
    expect(unmatchedPrincipalErrorPattern.test(multi)).toBe(true);
  });
});

describe('Issue body generation helpers', () => {
  function extractFailedSteps(markdown: string): string[] {
    return markdown.match(/\(x\) Failed:.*$/gm) || [];
  }
  function extractSecuritySection(markdown: string): string | null {
    const m = markdown.match(/## Security Requirements:?([\s\S]*?)(?=##|$)/);
    return m ? m[1].trim() : null;
  }

  it('extracts multiple failed steps', () => {
    const md = `(x) Failed: Region not available\n(x) Failed: Insufficient quota\n## Security Requirements\n- [ ] :x: Missing encryption`;
    const failed = extractFailedSteps(md);
    expect(failed).toHaveLength(2);
    expect(failed[0]).toContain('Region not available');
    expect(failed[1]).toContain('Insufficient quota');
  });

  it('extracts security section content', () => {
    const md = `## Validation Results\nBody\n## Security Requirements\n- [ ] :x: Missing TLS\n- [ ] :x: Weak passwords\n## Other Section`;
    const sec = extractSecuritySection(md);
    expect(sec).not.toBeNull();
    expect(sec!).toContain('Missing TLS');
    expect(sec!).toContain('Weak passwords');
    expect(sec!).not.toContain('Other Section');
  });

  it('returns null when security section absent', () => {
    const md = `## Validation Results\n- [x] AZD Up`;
    expect(extractSecuritySection(md)).toBeNull();
  });
});
