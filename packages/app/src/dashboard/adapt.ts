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

/**
 * Build categories object from issues and compliant items
 * Mirrors backend logic in packages/server/src/routes/results.ts
 * This ensures category percentages are calculated correctly even when
 * the API doesn't provide pre-built categories
 */
function buildCategoriesFromData(
  issues: AdaptedIssue[],
  compliant: AdaptedCompliant[],
): Record<
  string,
  {
    enabled: boolean;
    issues: AdaptedIssue[];
    passed: AdaptedCompliant[];
    percentage: number;
  }
> {
  // Category mapping - maps issue/compliant category prefixes to standard categories
    const categoryMap: Record<string, string> = {
      file: 'repositoryManagement',
      folder: 'repositoryManagement',
      readme: 'functionalRequirements',
      docs: 'functionalRequirements',
      documentation: 'functionalRequirements',
      workflow: 'deployment',
      cicd: 'deployment',
      'ci-cd': 'deployment',
      deployment: 'deployment',
      security: 'security',
      'security-analysis': 'security',
      testing: 'testing',
      test: 'testing',
      tests: 'testing',
      agents: 'agents',
      agent: 'agents',
      ai: 'agents',
      general: 'repositoryManagement',
    };  // Initialize all categories
  const categories: Record<
    string,
    {
      enabled: boolean;
      issues: AdaptedIssue[];
      passed: AdaptedCompliant[];
      percentage: number;
    }
  > = {
    repositoryManagement: { enabled: true, issues: [], passed: [], percentage: 0 },
    functionalRequirements: { enabled: true, issues: [], passed: [], percentage: 0 },
    deployment: { enabled: true, issues: [], passed: [], percentage: 0 },
    security: { enabled: true, issues: [], passed: [], percentage: 0 },
    testing: { enabled: true, issues: [], passed: [], percentage: 0 },
    agents: { enabled: true, issues: [], passed: [], percentage: 0 },
  };

  // Distribute issues to their categories (skip meta category)
  issues.forEach((issue) => {
    const cat = issue.category || 'general';
    const mappedCat = categoryMap[cat] || 'repositoryManagement';
    if (mappedCat !== 'meta' && categories[mappedCat]) {
      categories[mappedCat].issues.push(issue);
    }
  });

  // Distribute compliant items to categories (skip meta)
  compliant.forEach((item) => {
    const cat = item.category || 'general';
    const mappedCat = categoryMap[cat] || 'repositoryManagement';
    if (mappedCat !== 'meta' && categories[mappedCat]) {
      categories[mappedCat].passed.push(item);
    }
  });

  // Calculate percentages for each category
  Object.keys(categories).forEach((key) => {
    const cat = categories[key];
    const total = cat.issues.length + cat.passed.length;
    cat.percentage = total > 0 ? Math.round((cat.passed.length / total) * 100) : 0;
  });

  return categories;
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

  // Build categories from issues/compliant if not provided by API or empty
  if (
    !result?.compliance?.categories ||
    Object.keys(result.compliance.categories).length === 0
  ) {
    adapted.compliance.categories = buildCategoriesFromData(issues, compliant);
  } else {
    adapted.compliance.categories = result.compliance.categories;
  }

  if (result.customConfig) adapted.customConfig = result.customConfig;
  return adapted;
}

// Attach to window for legacy renderer consumption (incremental migration)
if (!(window as any).__TD_adaptResultData) {
  (window as any).__TD_adaptResultData = adaptResultData;
}
