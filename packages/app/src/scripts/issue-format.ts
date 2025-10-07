// Provides mapping helpers to convert analyzer findings into issue payload structures
// consumed by issue-service.ts and analyzer.ts.

/** Raw analyzer issue shape (partial / inferred) */
export interface AnalyzerIssue {
  id?: string;
  ruleId?: string;
  title?: string;
  message?: string;
  severity?: string; // e.g., 'info'|'warning'|'error'
  path?: string;
  remediation?: string;
  docsUrl?: string;
  category?: string;
  line?: number;
}

/** Normalized violation used internally in UI */
export interface Violation {
  key: string; // stable identifier
  title: string;
  body: string; // markdown-ish description
  severity: string;
  path?: string;
  filePath?: string; // optional original file path (legacy compatibility)
  snippet?: string; // optional code/document snippet
  docsUrl?: string;
  remediation?: string;
  category?: string;
  line?: number;
}

/**
 * Convert a raw analyzer issue into a Violation structure.
 */
export function mapAnalyzerIssueToViolation(issue: AnalyzerIssue): Violation {
  const key = issue.id || issue.ruleId || generateKey(issue);
  const title = issue.title || issue.ruleId || 'Issue';
  const bodyParts = [] as string[];
  if (issue.message) bodyParts.push(issue.message.trim());
  if (issue.remediation) bodyParts.push('\nRemediation: ' + issue.remediation.trim());
  const body = bodyParts.join('\n\n');
  return {
    key,
    title,
    body,
    severity: issue.severity || 'info',
    path: issue.path,
    filePath: issue.path, // preserve for legacy consumers that expect filePath
    docsUrl: issue.docsUrl,
    remediation: issue.remediation,
    category: issue.category,
    line: issue.line,
  };
}

/**
 * Transform a violation into an issue payload suitable for backend issue-create.
 */
export function formatViolationAsIssue(
  v: Violation,
  options?: { compliancePercentage?: number },
): { title: string; body: string; labels: string[] } {
  const labels: string[] = [];
  if (v.severity) labels.push('severity:' + v.severity);
  if (v.category) labels.push('category:' + sanitizeLabel(v.category));
  const effectivePath = v.path || v.filePath;
  if (effectivePath) labels.push('path'); // generic marker that path context exists
  const bodyLines: string[] = [];
  bodyLines.push(v.body || v.title);
  if (typeof options?.compliancePercentage === 'number') {
    bodyLines.push(`\nCompliance Snapshot: ${options.compliancePercentage}%`);
  }
  if (effectivePath) bodyLines.push('\nFile: ' + effectivePath + (v.line ? ':' + v.line : ''));
  if (v.docsUrl) bodyLines.push('\nDocs: ' + v.docsUrl);
  if (v.remediation) bodyLines.push('\nRemediation: ' + v.remediation);
  if (v.snippet) bodyLines.push('\n```\n' + v.snippet.slice(0, 800) + '\n```');
  return { title: v.title, body: bodyLines.join('\n'), labels: dedupe(labels) };
}

function sanitizeLabel(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function generateKey(issue: AnalyzerIssue): string {
  return (
    [issue.ruleId, issue.path, issue.line, issue.title].filter(Boolean).join('|') ||
    'issue-' + Math.random().toString(36).slice(2, 8)
  );
}
