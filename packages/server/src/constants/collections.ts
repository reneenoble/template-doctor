/**
 * Allowed MongoDB collections for admin queries
 * SECURITY: Prevents NoSQL injection by whitelisting valid collection names
 */

export const ALLOWED_COLLECTIONS = [
  'analyses',
  'repos',
  'azdtests',
  'rulesets',
  'configuration',
] as const;

export type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number];

/**
 * Check if a collection name is in the allowed list
 * @param collection - Collection name to validate
 * @returns true if collection is allowed
 */
export function isAllowedCollection(collection: string): collection is AllowedCollection {
  return ALLOWED_COLLECTIONS.includes(collection as AllowedCollection);
}
