import { describe, it, expect } from 'vitest';
import { isAllowedCollection, ALLOWED_COLLECTIONS } from '../../src/constants/collections.js';

describe('Admin Routes - NoSQL Injection Prevention', () => {
  describe('Collection Whitelist', () => {
    it('should allow valid collection names', () => {
      expect(isAllowedCollection('analyses')).toBe(true);
      expect(isAllowedCollection('repos')).toBe(true);
      expect(isAllowedCollection('azdtests')).toBe(true);
      expect(isAllowedCollection('rulesets')).toBe(true);
      expect(isAllowedCollection('configuration')).toBe(true);
    });

    it('should reject system collections', () => {
      expect(isAllowedCollection('admin.system.users')).toBe(false);
      expect(isAllowedCollection('admin.system.roles')).toBe(false);
      expect(isAllowedCollection('config')).toBe(false);
      expect(isAllowedCollection('system.indexes')).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      expect(isAllowedCollection('../../../etc/passwd')).toBe(false);
      expect(isAllowedCollection('../../config')).toBe(false);
      expect(isAllowedCollection('..')).toBe(false);
    });

    it('should reject NoSQL injection attempts', () => {
      expect(isAllowedCollection('analyses; DROP TABLE users')).toBe(false);
      expect(isAllowedCollection('$where')).toBe(false);
      expect(isAllowedCollection('{ $ne: null }')).toBe(false);
    });

    it('should reject empty or malformed collection names', () => {
      expect(isAllowedCollection('')).toBe(false);
      expect(isAllowedCollection(' ')).toBe(false);
      expect(isAllowedCollection('invalid-collection')).toBe(false);
    });

    it('should export exactly 5 allowed collections', () => {
      expect(ALLOWED_COLLECTIONS).toHaveLength(5);
      expect(ALLOWED_COLLECTIONS).toEqual([
        'analyses',
        'repos',
        'azdtests',
        'rulesets',
        'configuration',
      ]);
    });

    it('should be case-sensitive', () => {
      expect(isAllowedCollection('Analyses')).toBe(false);
      expect(isAllowedCollection('REPOS')).toBe(false);
      expect(isAllowedCollection('AzdTests')).toBe(false);
    });
  });
});
