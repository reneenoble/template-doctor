// Extraction of adaptResultData from legacy dashboard-renderer.js (parity)

export interface AdaptedIssue {
  id: string;
  category: string;
  message: string;
  error?: string;
  severity?: string;
  details?: any;
}
export interface AdaptedCompliant extends AdaptedIssue {}
export interface AdaptedData {
  repoUrl: string;
  ruleSet: string;
  compliance: {
    issues: AdaptedIssue[];
    compliant: AdaptedCompliant[];
    summary: string;
    categories?: any;
  };
  totalIssues: number;
  totalPassed: number;
  __analysisMode?: string;
  customConfig?: any;
}

export function adaptResultData(result: any): AdaptedData {
  const issues: AdaptedIssue[] = [];
  const compliant: AdaptedCompliant[] = [];

  if (result?.compliance && Array.isArray(result.compliance.issues)) {
    result.compliance.issues.forEach((issue: any) => {
      issues.push({
        id: issue.id || `issue-${issues.length}`,
        category: issue.id ? issue.id.split('-')[0] : 'general',
        message: issue.message || 'Unknown issue',
        error: issue.error || issue.message || 'No details available',
        severity: issue.severity || 'warning',
        details: {},
      });
    });
    if (result.compliance.compliant && Array.isArray(result.compliance.compliant)) {
      result.compliance.compliant.forEach((item: any) => {
        compliant.push({
          id: item.id || `passed-${compliant.length}`,
          category: item.id ? item.id.split('-')[0] : 'general',
          message: item.message || 'Passed check',
          error: '',
          details: {},
        });
      });
    }
  } else if (result?.categories && Array.isArray(result.categories)) {
    result.categories.forEach((category: any) => {
      if (category.checks && Array.isArray(category.checks)) {
        category.checks.forEach((check: any) => {
          const item = {
            id: `${category.id}-${check.id}`,
            category: category.id,
            message: check.name,
            error: check.details || check.description,
            details: {},
          };
          if (check.status === 'passed') compliant.push(item);
          else issues.push(item);
        });
      }
    });
  }
  const totalChecks = issues.length + compliant.length;
  const percentageCompliant =
    totalChecks > 0 ? Math.round((compliant.length / totalChecks) * 100) : 0;
  compliant.push({
    id: 'meta-compliance-summary',
    category: 'meta',
    message: 'Compliance Summary',
    details: {
      percentageCompliant,
      totalChecks,
      passedChecks: compliant.length,
      issuesCount: issues.length,
      ruleSet: result.ruleSet || 'dod',
    },
  });
  const adapted: AdaptedData = {
    repoUrl: result.repoUrl || window.location.href,
    ruleSet: result.ruleSet || 'dod',
    compliance: { issues, compliant, summary: `${percentageCompliant}% compliant` },
    totalIssues: issues.length,
    totalPassed: compliant.length,
  };
  if (result.__analysisMode) adapted.__analysisMode = result.__analysisMode;
  if (result?.compliance?.categories) adapted.compliance.categories = result.compliance.categories;
  if (result.customConfig) adapted.customConfig = result.customConfig;
  return adapted;
}

// Attach to window for legacy renderer consumption (incremental migration)
if (!(window as any).__TD_adaptResultData) {
  (window as any).__TD_adaptResultData = adaptResultData;
}
