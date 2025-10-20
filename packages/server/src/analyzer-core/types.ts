/**
 * Core types for Template Doctor analyzer
 */

export interface AnalyzerOptions {
  ruleSet?: string;
  config?: AnalyzerConfig;
  readmeContent?: string;
  azureYamlContent?: string;
  bicepContents?: Record<string, string>;
  deprecatedModels?: string[];
  categories?: string[];
  azureDeveloperCliEnabled?: boolean;
  aiDeprecationCheckEnabled?: boolean;
}

export interface AnalyzerConfig {
  requiredFiles: string[];
  requiredFolders: string[];
  requiredWorkflowFiles: WorkflowFilePattern[];
  readmeRequirements?: ReadmeRequirements;
  bicepChecks?: BicepChecks;
  azureYamlRules?: AzureYamlRules;
}

export interface WorkflowFilePattern {
  pattern: RegExp;
  message: string;
}

export interface ReadmeRequirements {
  requiredHeadings: string[];
  architectureDiagram?: {
    heading: string;
    requiresImage: boolean;
  };
}

export interface BicepChecks {
  requiredResources?: string[];
  securityBestPractices?: boolean;
}

export interface AzureYamlRules {
  mustDefineServices?: boolean;
}

export interface AnalysisIssue {
  id: string;
  severity: 'error' | 'warning';
  category?: string;
  message: string;
  error: string;
  details?: any;
}

export interface CompliantItem {
  id: string;
  category: string;
  message: string;
  details?: any;
}

export interface AnalysisResult {
  repoUrl: string;
  ruleSet?: string;
  timestamp?: string;
  compliance: {
    issues: AnalysisIssue[];
    compliant: CompliantItem[];
    percentage: number;
    summary: string;
    categories?: Record<
      string,
      {
        enabled: boolean;
        issues: AnalysisIssue[];
        compliant: CompliantItem[];
        percentage: number;
      }
    >;
  };
  archiveRequested?: boolean;
}

export interface GitHubFile {
  path: string;
  sha?: string;
  content?: string;
  type?: string;
}

export interface MarkdownHeading {
  level: number;
  text: string;
  hasImage: boolean;
}
