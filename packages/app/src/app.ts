// Transitional TypeScript entry extracted from legacy js/app.js
// LEGACY CLEANUP (2025-09-30): app.js deleted, logic needs migration to TS modules

// DELETED: ../js/app.js - massive legacy file with mixed concerns
// TODO: Extract remaining functionality into focused TS modules
// - Search/UI handling -> already in modules
// - Analysis orchestration -> scripts/analyzer.ts
// - Dashboard rendering -> scripts/dashboard-renderer.ts
// - Batch scanning -> batch/facade.ts

// Expose any globals expected by tests (pass-through to window variables set by TS modules)
export const analyzeRepo: ((repoUrl: string, ruleSet?: string) => Promise<any>) | undefined = (
  window as any
).analyzeRepo;

declare global {
  interface Window {
    analyzeRepo?: (repoUrl: string, ruleSet?: string) => Promise<any>;
  }
}
