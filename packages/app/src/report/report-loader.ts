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
              const response = await fetch(`/api/v4/results/repo/${owner}/${repo}`, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
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

        // Try API first, then fall back to existing filesystem logic
        tryApiLoad().then((apiData) => {
          if (apiData) {
            return resolve(apiData);
          }
          
          // Fall back to existing filesystem loading logic...
          let templateName: string | undefined,
          templatePath: string | undefined,
          directData: ReportData | undefined,
          dataJsPath: string | undefined,
          folderName: string | undefined;
        if (typeof template === 'object' && template !== null && !Array.isArray(template)) {
          debug('report-loader', 'Template is an object', template);
          if (template.relativePath) {
            const parts = template.relativePath.split('/');
            if (parts.length > 0) {
              folderName = parts[0];
              debug('report-loader', `Extracted folder name from relativePath: ${folderName}`);
            }
            let pathPrefix = folderName;
            if (template.folderPath) {
              pathPrefix = template.folderPath;
              debug('report-loader', `Using provided folderPath: ${pathPrefix}`);
            } else if (template.scannedBy && template.scannedBy.length > 0) {
              const lastScanner = template.scannedBy[template.scannedBy.length - 1];
              pathPrefix = `${lastScanner}-${folderName}`;
              debug('report-loader', `Created folderPath with scanner prefix: ${pathPrefix}`);
            }
            if (template.dataPath) {
              dataJsPath = `${pathPrefix}/${template.dataPath}`;
              debug('report-loader', `Found data.js path: ${dataJsPath}`);
            }
            templatePath = template.relativePath;
            debug('report-loader', `Using relative path: ${templatePath}`);
          }
          if (template.repoUrl) {
            const repoUrlParts = template.repoUrl.split('/');
            templateName = repoUrlParts[repoUrlParts.length - 1].replace(/\.git$/, '');
            debug('report-loader', `Extracted template name from URL: ${templateName}`);
            if (!folderName) {
              const repoOwner = repoUrlParts[repoUrlParts.length - 2] || '';
              folderName = `${repoOwner}-${templateName}`.toLowerCase();
              debug('report-loader', `Constructed folder name from URL: ${folderName}`);
            }
          }
          if (template.result) {
            directData = template.result;
            debug('report-loader', 'Using direct result data');
          }
        } else if (typeof template === 'string') {
          templateName = template;
        }
        debug('report-loader', `Loading report data for template: ${templateName || 'unknown'}`);
        if (directData) {
          debug('report-loader', 'Using direct data from template object');
          return resolve(directData);
        }

        const afterFallback = (promise: Promise<ReportData>) => {
          promise
            .then((d) => {
              if (d) resolve(d);
              else reject(new Error('Failed to load report data'));
            })
            .catch((error) => {
              debug('report-loader', 'All report loading strategies failed', error);
              reject(new Error((error as Error).message || 'Failed to load report data'));
            });
        };

        if (dataJsPath) {
          debug('report-loader', `Attempting to load data.js file: ${dataJsPath}`);
          this._loadDataJsFile(dataJsPath)
            .then((data: ReportData) => {
              debug('report-loader', 'Successfully loaded data from data.js file', data);
              resolve(data);
            })
            .catch((err: any) => {
              debug('report-loader', `Failed data.js, falling back: ${err.message}`);
              afterFallback(this._tryLoadReport(templateName, templatePath, folderName));
            });
        } else {
          afterFallback(this._tryLoadReport(templateName, templatePath, folderName));
        }
        }).catch(reject); // Close tryApiLoad().then() and handle errors
      });
    },
    _loadDataJsFile: function (dataJsPath: string) {
      return new Promise<ReportData>((resolve, reject) => {
        debug('report-loader', `Loading data.js file: ${dataJsPath}`);
        const script = document.createElement('script');
        script.src = `/${RESULTS_DIR}/${dataJsPath}`;
        script.id = `data-js-${Date.now()}`;
        script.async = true;
        script.onload = function () {
          debug('report-loader', 'Data.js script loaded, checking for reportData');
          if ((window as any).reportData) {
            const data = (window as any).reportData as ReportData;
            debug('report-loader', 'Found window.reportData', data);
            const copy: ReportData = { ...data };
            (window as any).reportData = null;
            try {
              script.remove();
            } catch (_) {}
            resolve(copy);
          } else {
            reject(new Error('Data.js loaded but did not set window.reportData'));
          }
        };
        script.onerror = function () {
          reject(new Error(`Failed to load data.js file: ${dataJsPath}`));
        };
        document.head.appendChild(script);
        setTimeout(() => {
          if ((window as any).reportData) {
            const data = (window as any).reportData as ReportData;
            const copy: ReportData = { ...data };
            (window as any).reportData = null;
            try {
              script.remove();
            } catch (_) {}
            resolve(copy);
          } else {
            fetch(`/${RESULTS_DIR}/${dataJsPath}`)
              .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              })
              .then(() => reject(new Error('Timed out waiting for reportData, but file exists')))
              .catch((err) =>
                reject(
                  new Error(
                    `Timed out waiting for reportData and couldn't fetch file: ${(err as Error).message}`,
                  ),
                ),
              );
          }
        }, 3000);
      });
    },
    _tryLoadReport: function (templateName?: string, templatePath?: string, folderName?: string) {
      return new Promise<ReportData>((resolve, reject) => {
        debug('report-loader', 'Starting report loading sequence');
        const tryStandardStrategies = () => {
          const templateId =
            folderName || (typeof templateName === 'string' ? templateName : 'unknown');
          debug('report-loader', `Trying standard strategies for template: ${templateId}`);
          this._fetchReportFile(`/${RESULTS_DIR}/${templateId}/latest.json`)
            .then((data: ReportData) => {
              if (isValidObject(data)) {
                if (data.dataPath) {
                  const dataPath = (data as any).dataPath;
                  debug(
                    'report-loader',
                    `Found dataPath in latest.json: ${dataPath}, loading that file`,
                  );
                  return this._loadDataJsFile(`${templateId}/${dataPath}`).catch((err: any) => {
                    debug(
                      'report-loader',
                      `Failed to load data.js file: ${(err as Error).message}, using latest.json metadata`,
                    );
                    return data;
                  });
                }
                return data;
              }
              throw new Error('Invalid data format in latest.json');
            })
            .then((data: ReportData) => {
              if (isValidObject(data)) resolve(data);
              else throw new Error('Invalid data after latest.json');
            })
            .catch(() => this._findMostRecentAnalysisFile(templateId))
            .then((data: ReportData) => {
              if (data && isValidObject(data)) resolve(data);
              else throw new Error('Could not find a valid analysis file');
            })
            .catch(() => {
              reject(new Error(`Failed to load report data for template: ${templateId}`));
            });
        };
        if (templatePath) {
          debug('report-loader', `Trying specific path: ${templatePath}`);
          this._fetchReportFile(`/${RESULTS_DIR}/${templatePath}`)
            .then((data: ReportData) => {
              if (isValidObject(data)) {
                resolve(data);
              } else throw new Error('Invalid data format from specific path');
            })
            .catch(() => {
              tryStandardStrategies();
            });
        } else {
          tryStandardStrategies();
        }
      });
    },
    _fetchReportFile: function (path: string) {
      debug('report-loader', `Fetching report file: ${path}`);
      return fetch(path).then((response) => {
        if (!response.ok) throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        return response.json() as Promise<ReportData>;
      });
    },
    _findMostRecentAnalysisFile: function (template: string | TemplateDescriptor) {
      debug('report-loader', 'Finding most recent analysis file for template', template);
      let folderPath: string;
      if (typeof template === 'object' && template !== null) {
        if (template.folderPath) folderPath = template.folderPath;
        else if (template.relativePath) {
          const folderName = template.relativePath.split('/')[0];
          if (template.scannedBy && template.scannedBy.length > 0) {
            const lastScanner = template.scannedBy[template.scannedBy.length - 1];
            folderPath = `${lastScanner}-${folderName}`;
          } else {
            folderPath = folderName;
          }
        } else {
          folderPath = String(template as any);
        }
      } else {
        folderPath = String(template);
      }
      debug('report-loader', `Using folder path: ${folderPath}`);
      return this._fetchReportFile(`/${RESULTS_DIR}/${folderPath}/index.json`)
        .then((indexData: unknown) => {
          const idx = indexData as IndexJson;
          if (idx && Array.isArray(idx.timestamps) && idx.timestamps.length > 0) {
            debug('report-loader', `Found index.json with ${idx.timestamps.length} timestamps`);
            return this._tryTimestamps(template, idx.timestamps as number[]);
          } else {
            debug('report-loader', 'No index.json or invalid format, using generated timestamps');
            const timestamps = [Date.now(), Date.now() - 60000, Date.now() - 120000];
            return this._tryTimestamps(template, timestamps);
          }
        })
        .catch(() => {
          debug('report-loader', 'Error fetching index.json, using generated timestamps');
          const timestamps = [Date.now(), Date.now() - 60000, Date.now() - 120000];
          return this._tryTimestamps(template, timestamps);
        });
    },
    _tryTimestamps: function (template: string | TemplateDescriptor, timestamps: number[]) {
      if (!timestamps || timestamps.length === 0) {
        return Promise.reject(new Error('No more timestamps to try'));
      }
      let folderPath: string;
      if (typeof template === 'object' && template !== null) {
        if (template.folderPath) folderPath = template.folderPath;
        else if (template.relativePath) {
          const folderName = template.relativePath.split('/')[0];
          if (template.scannedBy && template.scannedBy.length > 0) {
            const lastScanner = template.scannedBy[template.scannedBy.length - 1];
            folderPath = `${lastScanner}-${folderName}`;
          } else {
            folderPath = folderName;
          }
        } else {
          folderPath = String(template as any);
        }
      } else {
        folderPath = String(template);
      }
      debug('report-loader', `Using folder path for timestamps: ${folderPath}`);
      const timestamp = timestamps[0];
      const path = `/${RESULTS_DIR}/${folderPath}/${timestamp}-analysis.json`;
      debug('report-loader', `Trying timestamp ${timestamp} for template at path ${path}`);
      return this._fetchReportFile(path).catch(() =>
        this._tryTimestamps(template, timestamps.slice(1)),
      );
    },
  };

  window.ReportLoader = ReportLoader;
  debug('report-loader', 'Report Loader module initialized (TS migration)', ReportLoader);
})(window);
