// TypeScript migration of legacy report-loader.js (parity-focused)
// Provides both callback style (loadReportData) and Promise style (loadReport)
// Typings added while preserving legacy runtime behaviour.

export interface TemplateDescriptor {
  relativePath?: string;
  folderPath?: string;
  scannedBy?: string[];
  dataPath?: string; // points to data.js inside folder
  repoUrl?: string;
  result?: unknown; // direct embedded result payload
}

interface IndexJson {
  timestamps?: number[];
  [k: string]: unknown;
}

export type ReportData = Record<string, any>; // We keep it loose for now; can be tightened later.

interface ReportLoaderAPI {
  loadReportData(
    template: string | TemplateDescriptor,
    success?: (data: ReportData) => void,
    error?: (message: string) => void,
  ): void;
  loadReport(template: string | TemplateDescriptor): Promise<ReportData>;
  _loadDataJsFile(dataJsPath: string): Promise<ReportData>;
  _tryLoadReport(
    templateName?: string,
    templatePath?: string,
    folderName?: string,
  ): Promise<ReportData>;
  _fetchReportFile(path: string): Promise<ReportData>;
  _findMostRecentAnalysisFile(template: string | TemplateDescriptor): Promise<ReportData>;
  _tryTimestamps(template: string | TemplateDescriptor, timestamps: number[]): Promise<ReportData>;
}

// Ensure this file is treated as a module for global augmentation
export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window {
    // minimal augmentation (using index signature optional pattern)
    RESULTS_DIR?: string;
    reportData?: ReportData | null;
    debug?: (source: string, message: string, data?: unknown) => void;
    ReportLoader?: ReportLoaderAPI;
  }
}

(function (window) {
  'use strict';

  const RESULTS_DIR =
    typeof (window as any).RESULTS_DIR === 'string' && (window as any).RESULTS_DIR
      ? (window as any).RESULTS_DIR
      : 'results';

  function debug(source: string, message: string, data?: unknown) {
    if (typeof window.debug === 'function') {
      window.debug(source, message, data);
    } else if (console?.log) {
      console.log(`[${source}] ${message}`, data ?? '');
    }
  }
  function isValidObject(obj: unknown): obj is ReportData {
    return !!obj && typeof obj === 'object' && Object.keys(obj as object).length > 0;
  }

  const ReportLoader: ReportLoaderAPI = {
    loadReportData: function (
      template: string | TemplateDescriptor,
      successCallback?: (d: ReportData) => void,
      errorCallback?: (m: string) => void,
    ) {
      this.loadReport(template)
        .then((d: ReportData) => {
          if (successCallback) successCallback(d);
        })
        .catch((err: any) => {
          if (errorCallback) errorCallback((err as Error).message || String(err));
        });
    },
    loadReport: function (template: string | TemplateDescriptor) {
      return new Promise((resolve, reject) => {
        if (!template) {
          return reject(new Error('No template specified'));
        }

        // NEW: Try loading from MongoDB API first if we have owner/repo info
        const tryApiLoad = async (): Promise<ReportData | null> => {
          try {
            // Extract owner/repo from URL params or template object
            let owner: string | undefined, repo: string | undefined;

            // Check URL params first (e.g., /report.html?repo=owner/repo)
            const urlParams = new URLSearchParams(window.location.search);
            const repoParam = urlParams.get('repo');
            if (repoParam && repoParam.includes('/')) {
              [owner, repo] = repoParam.split('/');
              debug('report-loader', `Extracted from URL: ${owner}/${repo}`);
            }

            // Otherwise try to extract from template object
            if (!owner && !repo && typeof template === 'object' && template?.repoUrl) {
              const match = template.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
              if (match) {
                owner = match[1];
                repo = match[2].replace(/\.git$/, '');
                debug('report-loader', `Extracted from repoUrl: ${owner}/${repo}`);
              }
            }

            if (owner && repo) {
              debug('report-loader', `Attempting API load for ${owner}/${repo}`);
              const token = localStorage.getItem('gh_access_token');
              const response = await fetch(`/api/v4/results/repo/${owner}/${repo}`, {
                cache: 'no-store',
                headers: {
                  Accept: 'application/json',
                  ...(token && { Authorization: `Bearer ${token}` }),
                },
              });

              if (response.ok) {
                const apiData = await response.json();
                debug('report-loader', 'API load successful', apiData);

                // Transform API response to match expected report data structure
                if (apiData.analyses && apiData.analyses.length > 0) {
                  const latest = apiData.analyses[0];

                  // Use the complete analysisResult which contains all compliance data with categories
                  const analysisResult = latest.analysisResult || {};
                  const compliance = analysisResult.compliance || latest.compliance || {};

                  const transformedData = {
                    repoUrl: apiData.repoUrl,
                    owner: apiData.owner,
                    repo: apiData.repo,
                    ruleSet: latest.ruleSet,
                    timestamp: latest.timestamp,
                    scanDate: latest.scanDate,
                    compliance: compliance,
                    analysisResult: analysisResult,
                    // Keep raw API data for debugging
                    _apiData: apiData,
                  };

                  debug('report-loader', 'Transformed data:', transformedData);
                  debug('report-loader', 'Compliance object:', compliance);
                  debug('report-loader', 'Categories:', compliance.categories);

                  return transformedData;
                }
              }
            }
          } catch (err: any) {
            debug('report-loader', 'API load failed, will try filesystem fallback', err?.message);
          }
          return null;
        };

        // Load from database API only (no filesystem fallback)
        tryApiLoad()
          .then((apiData) => {
            if (apiData) {
              return resolve(apiData);
            }
            // No filesystem fallback - database-first architecture
            reject(new Error('Could not load report data from database API'));
          })
          .catch(reject);
      });
    },

    // Legacy filesystem methods - DEPRECATED (database-first architecture)
    _loadDataJsFile: function (dataJsPath: string) {
      return Promise.reject(
        new Error('Filesystem loading deprecated - use database API'),
      );
    },
    _tryLoadReport: function (templateName?: string, templatePath?: string, folderName?: string) {
      return Promise.reject(
        new Error('Filesystem loading deprecated - use database API'),
      );
    },
    _fetchReportFile: function (path: string) {
      return Promise.reject(
        new Error('Filesystem loading deprecated - use database API'),
      );
    },
    _findMostRecentAnalysisFile: function (template: string | TemplateDescriptor) {
      return Promise.reject(
        new Error('Filesystem loading deprecated - use database API'),
      );
    },
    _tryTimestamps: function (template: string | TemplateDescriptor, timestamps: number[]) {
      return Promise.reject(
        new Error('Filesystem loading deprecated - use database API'),
      );
    },
  };

  window.ReportLoader = ReportLoader;
  debug('report-loader', 'Report Loader initialized (database-first)', ReportLoader);
})(window);
