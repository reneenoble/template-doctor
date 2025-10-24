// Simplified, type-safe class implementation replacing legacy function/prototype pattern.
import { runAgentsEnrichment, updateAgentsTileStatus } from './agents-enrichment.js';

interface ComplianceItem {
  id: string;
  category: string;
  message: string;
  error?: string;
  details?: Record<string, any>;
  [k: string]: any;
}
interface AdaptedData {
  repoUrl: string;
  ruleSet: string;
  compliance: {
    issues: ComplianceItem[];
    compliant: ComplianceItem[];
    summary: string;
    categories?: any;
  };
  totalIssues: number;
  totalPassed: number;
  customConfig?: any;
  [k: string]: any;
}

class DashboardRenderer {
  debug: (message: string, data?: any) => void;
  constructor() {
    this.debug = (message: string, data?: any) => {
      if (typeof (window as any).debug === 'function') {
        (window as any).debug('dashboard-renderer', message, data);
      } else {
        console.log(`[DashboardRenderer] ${message}`, data !== undefined ? data : '');
      }
    };
    this.debug('Dashboard renderer initialized');
  }
  async render(result: any, container: HTMLElement) {
    this.debug('Rendering dashboard', result);

    if (!result || !container) {
      console.error('Missing result data or container element');
      container.innerHTML = `<div style="padding: 20px; background: #f8d7da; border-radius: 5px; margin: 20px 0; color: #721c24;"><h3>Error: Cannot render dashboard</h3><p>Missing required data or container element</p><pre style="background: #f5f5f5; padding: 10px; border-radius: 3px;">${JSON.stringify({ resultExists: !!result, containerExists: !!container, resultType: result ? typeof result : 'undefined', containerType: container ? typeof container : 'undefined' }, null, 2)}</pre></div>`;
      return;
    }

    try {
      container.innerHTML = '';
      try {
        (window as any).reportDataOriginal = result;
      } catch (_) {}

      // Add CSS for raw data toggle
      const rawDataStyle = document.createElement('style');
      rawDataStyle.textContent = `.raw-data-visible { display: block !important; }`;
      if (!document.head.querySelector('style[data-raw-data-style]')) {
        rawDataStyle.setAttribute('data-raw-data-style', 'true');
        document.head.appendChild(rawDataStyle);
      }

      // Render action buttons section
      const actionHtml = `<div id="action-section" class="action-footer action-header" style="background: white !important; border-radius: 5px !important; padding: 16px !important; margin-bottom: 20px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; width: 100% !important;"><div style="width: 100% !important; text-align: center !important; margin-bottom: 15px !important;"><h3 style="margin: 0 !important; padding: 0 !important; font-size: 1.2rem !important; color: #333 !important;">Template Doctor Actions</h3></div><div style="display: flex !important; flex-wrap: wrap !important; justify-content: center !important; gap: 15px !important; width: 100% !important;"><a href="#" id="fixButton" class="btn" style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; text-decoration: none !important; pointer-events: auto !important;"><i class="fas fa-code"></i> Fix with AI Agent</a><button id="create-github-issue-btn" class="btn" style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #2b3137 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: wait !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: none !important; transition: opacity 0.25s ease;" aria-disabled="true"><i class="fas fa-spinner fa-spin"></i> Loading...</button><button id="testProvisionButton" class="btn" style="opacity: 1 !important; visibility: visible !important; padding: 12px 24px !important; background-color: #0078d4 !important; color: white !important; border: none !important; border-radius: 4px !important; font-size: 1rem !important; font-weight: 500 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; min-width: 180px !important; justify-content: center !important; pointer-events: auto !important;"><i class="fas fa-rocket"></i> Test AZD Provision</button></div></div>`;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = actionHtml;
      const actionSection = tempDiv.firstElementChild as HTMLElement | null;
      if (actionSection) container.appendChild(actionSection);

      // Render debug section with raw data toggle
      const debugSection = document.createElement('div');
      debugSection.className = 'debug-section';
      debugSection.style.cssText =
        'margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd; position: relative; z-index: 1;';
      debugSection.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><h3 style="margin: 0;">Template Analysis Report</h3><div style="display: flex; align-items: center; gap: 15px;"><span style="color: #6c757d; font-size: 0.9em; font-style: italic;">Developer Tools</span><button id="toggle-raw-data" class="btn" style="padding: 5px 10px; font-size: 0.9em;"><i class="fas fa-code"></i> Raw Data</button></div></div><div id="raw-data-content" style="display: none; margin-top: 15px; position: relative; z-index: 2;"><div style="background: #2d2d2d; color: #eee; padding: 10px; border-radius: 5px; font-size: 0.9em; margin-bottom: 10px;"><i class="fas fa-info-circle"></i> This is the raw report data used to generate the dashboard.</div><pre style="background: #2d2d2d; color: #eee; padding: 15px; border-radius: 5px; max-height: 400px; overflow: auto; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 13px;">${JSON.stringify(result, null, 2)}</pre></div>`;
      container.appendChild(debugSection);
      console.log(
        '[DashboardRenderer] Debug section appended, container:',
        container.id,
        'debugSection visible:',
        debugSection.offsetHeight > 0,
      );

      // Set up raw data toggle after DOM insertion
      setTimeout(() => {
        const toggleBtn = document.getElementById('toggle-raw-data');
        const rawContent = document.getElementById('raw-data-content');
        console.log('[DashboardRenderer] Raw data toggle setup:', {
          toggleBtn: !!toggleBtn,
          rawContent: !!rawContent,
        });

        if (toggleBtn && rawContent) {
          // Check if listener already attached
          if ((toggleBtn as any)._listenerAttached) {
            console.log('[DashboardRenderer] Listener already attached, skipping');
            return;
          }
          (toggleBtn as any)._listenerAttached = true;

          // Store visibility state directly on the element
          (rawContent as any)._isVisible = false;

          const clickHandler = function () {
            console.log(
              '[DashboardRenderer] Raw data toggle clicked, current state:',
              (rawContent as any)._isVisible,
            );

            if (!(rawContent as any)._isVisible) {
              // Show it
              rawContent.style.display = 'block';
              (rawContent as any)._isVisible = true;
              toggleBtn.innerHTML = '<i class="fas fa-times"></i> Hide Raw Data';
              toggleBtn.style.backgroundColor = '#dc3545';
              toggleBtn.style.color = 'white';
              console.log('[DashboardRenderer] SHOWED raw data');
            } else {
              // Hide it
              rawContent.style.display = 'none';
              (rawContent as any)._isVisible = false;
              toggleBtn.innerHTML = '<i class="fas fa-code"></i> Raw Data';
              toggleBtn.style.backgroundColor = '';
              toggleBtn.style.color = '';
              console.log('[DashboardRenderer] HID raw data');
            }
          };

          toggleBtn.addEventListener('click', clickHandler, { once: false });
          console.log('[DashboardRenderer] Raw data toggle event listener attached ONCE');
        } else {
          console.warn('[DashboardRenderer] Could not find raw data toggle elements');
        }
      }, 100);

      // Adapt and render report data
      const adaptedData = this.adaptResultData(result);

      // Run agents enrichment (adds agents.md validation)
      await runAgentsEnrichment(adaptedData).catch((e) => {
        console.warn('[DashboardRenderer] Agents enrichment failed:', e);
      });

      // Compute agents category stats after enrichment
      if (adaptedData.compliance) {
        const agentsIssues = adaptedData.compliance.issues.filter(
          (i: any) => i.category === 'agents',
        );
        const agentsPassed = adaptedData.compliance.compliant.filter(
          (i: any) => i.category === 'agents',
        );

        if (agentsIssues.length > 0 || agentsPassed.length > 0) {
          if (!adaptedData.compliance.categories) {
            adaptedData.compliance.categories = {};
          }
          adaptedData.compliance.categories.agents = {
            enabled: true,
            passed: agentsPassed,
            issues: agentsIssues,
          };
          console.log(
            '[DashboardRenderer] Added agents category:',
            adaptedData.compliance.categories.agents,
          );
        }
      }

      (window as any).reportData = adaptedData;
      this.renderOverview(adaptedData, container);
      this.renderIssuesPanel(adaptedData, container);
      this.renderPassedPanel(adaptedData, container);
      this.renderActionFooter(adaptedData, container);
      this.addEventListeners(container);

      // Update agents tile status AFTER tiles are rendered
      setTimeout(() => {
        const agentsIssue = adaptedData.compliance.issues.find((i: any) => i.category === 'agents');
        if (agentsIssue) {
          if (agentsIssue.id === 'agents-missing-file') {
            updateAgentsTileStatus('missing');
          } else {
            updateAgentsTileStatus('invalid');
          }
        } else {
          const agentsPassed = adaptedData.compliance.compliant.find(
            (i: any) => i.category === 'agents',
          );
          if (agentsPassed) {
            updateAgentsTileStatus('valid');
          }
        }
      }, 150);
    } catch (error: any) {
      console.error('Error rendering dashboard:', error);
      container.innerHTML = `<div style="padding: 20px; background: #f8d7da; border-radius: 5px; margin: 20px 0; color: #721c24;"><h3>Dashboard Rendering Error</h3><p>${error.message}</p><pre style="background: #f5f5f5; padding: 10px; border-radius: 3px;">${error.stack}</pre><h4 style="margin-top: 20px;">Raw Data</h4><pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; max-height: 300px; overflow: auto;">${JSON.stringify(result, null, 2)}</pre></div>`;
    }
  }
  adaptResultData(result: any): AdaptedData {
    try {
      // If HTML fallback only, surface a minimal placeholder message
      if (result && result.rawHtml && !result.compliance) {
        return {
          repoUrl: result.repoUrl || window.location.href,
          ruleSet: result.ruleSet || 'unknown',
          compliance: {
            issues: [
              {
                id: 'raw-html-fallback',
                category: 'fallback',
                message: 'Legacy embedded HTML report – structured compliance data unavailable',
                error:
                  'Rendered from historical HTML dashboard. Re-run analysis for structured data.',
              },
            ],
            compliant: [],
            summary: 'Fallback HTML',
          },
          totalIssues: 1,
          totalPassed: 0,
        };
      }
      const issues: ComplianceItem[] = [];
      const compliant: ComplianceItem[] = [];
      // Server side analyzer-core shape normalization
      if (Array.isArray(result.categories)) {
        result.categories.forEach((cat: any) => {
          if (!Array.isArray(cat.checks)) return;
          cat.checks.forEach((check: any, idx: number) => {
            const base = {
              id: `${cat.id || cat.name || 'cat'}-${check.id || idx}`,
              category: cat.id || cat.name || 'general',
              message: check.name || check.title || check.description || 'Unnamed check',
              error: check.details || check.description || '',
              details: check.meta || {},
            } as any;
            const status = (check.status || check.state || '').toLowerCase();
            if (status === 'passed' || status === 'success' || status === 'ok') {
              compliant.push(base);
            } else {
              issues.push(base);
            }
          });
        });
      }
      // Legacy compliance shape (client analyzer)
      if (result.compliance && Array.isArray(result.compliance.issues)) {
        result.compliance.issues.forEach((issue: any, idx: number) => {
          issues.push({
            id: issue.id || `issue-${idx}`,
            category: (issue.id ? issue.id.split('-')[0] : issue.category) || 'general',
            message: issue.message || issue.summary || 'Unknown issue',
            error: issue.error || issue.details || issue.message || 'No details available',
            severity: issue.severity || 'warning',
            details: issue.details || {},
          });
        });
        if (Array.isArray(result.compliance.compliant)) {
          result.compliance.compliant.forEach((item: any, idx: number) => {
            compliant.push({
              id: item.id || `passed-${idx}`,
              category: (item.id ? item.id.split('-')[0] : item.category) || 'general',
              message: item.message || 'Passed check',
              error: '',
              details: item.details || {},
            });
          });
        }
      }
      // Deduplicate by id
      const dedupe = (arr: ComplianceItem[]) => {
        const seen = new Set();
        return arr.filter((x) => {
          if (seen.has(x.id)) return false;
          seen.add(x.id);
          return true;
        });
      };
      const issuesDeduped = dedupe(issues);
      const compliantDeduped = dedupe(compliant);
      const totalChecks = issuesDeduped.length + compliantDeduped.length;
      const percentageCompliant =
        totalChecks > 0 ? Math.round((compliantDeduped.length / totalChecks) * 100) : 0;
      compliantDeduped.push({
        id: 'compliance-summary',
        category: 'meta',
        message: 'Compliance Summary',
        details: {
          percentageCompliant,
          totalChecks,
          passedChecks: compliantDeduped.length,
          issuesCount: issuesDeduped.length,
          ruleSet: result.ruleSet || 'dod',
        },
      });
      const adaptedData: AdaptedData = {
        repoUrl: result.repoUrl || window.location.href,
        ruleSet: result.ruleSet || 'dod',
        compliance: {
          issues: issuesDeduped,
          compliant: compliantDeduped,
          summary: `${percentageCompliant}% compliant`,
          categories: result.compliance?.categories || result.categories || null,
        },
        totalIssues: issuesDeduped.length,
        totalPassed: compliantDeduped.length,
      };
      if (result.customConfig) adaptedData.customConfig = result.customConfig;
      return adaptedData;
    } catch (e: any) {
      console.error('adaptResultData fatal error', e);
      return {
        repoUrl: result?.repoUrl || window.location.href,
        ruleSet: result?.ruleSet || 'unknown',
        compliance: {
          issues: [
            {
              id: 'adapter-failure',
              category: 'internal',
              message: 'Failed adapting result data',
              error: e?.message || String(e),
            },
          ],
          compliant: [],
          summary: 'Adapter failure',
        },
        totalIssues: 1,
        totalPassed: 0,
      } as AdaptedData;
    }
  }
  renderOverview(data: AdaptedData, container: HTMLElement) {
    const overviewSection = document.createElement('section');
    overviewSection.className = 'overview';
    const compliancePercentage =
      data.compliance.compliant.find((item) => item.category === 'meta')?.details
        ?.percentageCompliant || 0;
    const ruleSet =
      data.ruleSet ||
      data.compliance.compliant.find((item) => item.category === 'meta')?.details?.ruleSet ||
      'dod';
    const ruleSetDisplay =
      ruleSet === 'dod'
        ? 'DoD'
        : ruleSet === 'partner'
          ? 'Partner'
          : ruleSet === 'docs'
            ? 'Docs'
            : 'Custom';
    const gistUrl = data.customConfig?.gistUrl;
    overviewSection.innerHTML = `<h2>Compliance Overview</h2><div class="overview-header"><p class="overview-text">This dashboard provides an overview for your Azure template compliance status with the 'Azure Developer CLI Template Framework' <a href="https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/definition-of-done.md" title="Definition of Done">Definition of Done</a>. Browse the list below to fix specific issues or use the AI agent to automatically fix all compliance issues in VS Code.</p><div class="ruleset-info"><span class="ruleset-label">Configuration:</span>${ruleSet === 'custom' && gistUrl ? `<a href="${gistUrl}" target="_blank" class="ruleset-value ${ruleSet}-badge" title="View custom ruleset on GitHub">${ruleSetDisplay} <i class="fas fa-external-link-alt fa-xs"></i></a>` : `<span class="ruleset-value ${ruleSet}-badge">${ruleSetDisplay}</span>`}<button id="change-ruleset-btn" class="btn btn-small" title="Change configuration"><i class="fas fa-sync-alt"></i></button></div></div><p>For more information about compliance and collections, go here <a href="https://github.com/Azure-Samples/azd-template-artifacts">Azure Developer CLI Template Framework Docs</a></p><div class="compliance-gauge"><div class="gauge-fill" id="complianceGauge" style="width: ${compliancePercentage}%; background-position: ${compliancePercentage}% 0;"></div><div class="gauge-label" id="compliancePercentage">${compliancePercentage}%</div></div><div class="overview-tiles"><div class="tile tile-issues"><div class="tile-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="tile-value" id="issuesCount">${data.totalIssues}</div><div class="tile-title">Issues Found</div></div><div class="tile tile-passed"><div class="tile-icon"><i class="fas fa-check-circle"></i></div><div class="tile-value" id="passedCount">${data.totalPassed - 1}</div><div class="tile-title">Passed Checks</div></div><div class="tile tile-trend"><div class="tile-header"><div class="tile-icon"><i class="fas fa-chart-line"></i></div><div class="tile-title">Compliance Trend</div></div><div id="trendChart" class="trend-chart"><div class="no-data-message">Not enough historical data available yet.</div></div></div></div>`;
    container.appendChild(overviewSection);
    try {
      this.loadAndRenderTrend(data, overviewSection);
    } catch (e) {
      console.warn('Failed to initialize compliance trend rendering:', e);
    }
    if (data.compliance?.categories) {
      const categorySection = this.renderCategoryBreakdown(data.compliance.categories);
      if (categorySection) overviewSection.appendChild(categorySection);
    }
    setTimeout(() => {
      const changeRulesetBtn = document.getElementById('change-ruleset-btn');
      if (changeRulesetBtn) {
        changeRulesetBtn.addEventListener('click', () => {
          const repoUrl = data.repoUrl;
          if (repoUrl && typeof (window as any).analyzeRepo === 'function') {
            (window as any).analyzeRepo(repoUrl, 'show-modal');
          } else {
            console.error('Unable to get repository URL or analyzeRepo function');
          }
        });
      }
    }, 100);
  }
  getResultsFolderForRepo(repoUrl: string) {
    if (!repoUrl) return null;
    try {
      if (Array.isArray((window as any).templatesData)) {
        const match = (window as any).templatesData.find((t: any) => {
          const a = String(t.repoUrl || '')
            .replace(/\.git$/, '')
            .toLowerCase();
          const b = String(repoUrl)
            .replace(/\.git$/, '')
            .toLowerCase();
          return a === b;
        });
        if (match && match.relativePath) {
          const folder = match.relativePath.split('/')[0];
          if (folder) return folder;
        }
      }
      const u = new URL(repoUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}-${parts[1]}`.toLowerCase();
      }
    } catch (_) {}
    return null;
  }
  async loadAndRenderTrend(data: AdaptedData, section: HTMLElement) {
    const trendHost = section.querySelector('#trendChart') as HTMLElement | null;
    if (!trendHost) return;

    // Extract owner/repo from repoUrl
    const match = data.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) return;
    const [, owner, repo] = match;

    let history: any[] = [];
    try {
      // Load from MongoDB API instead of filesystem
      const token = localStorage.getItem('gh_access_token');
      const resp = await fetch(`/api/v4/results/repo/${owner}/${repo}`, {
        cache: 'no-store',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const apiData = await resp.json();

      // Transform analyses array to history format
      if (apiData.analyses && Array.isArray(apiData.analyses)) {
        history = apiData.analyses.map((a: any) => ({
          timestamp: a.scanDate || a.timestamp,
          percentage: a.compliance?.percentage || 0,
          issues: a.compliance?.issues || 0,
          passed: a.compliance?.passed || 0,
        }));
      }
    } catch (err: any) {
      console.warn(`No history found for ${owner}/${repo}:`, err.message);
      return;
    }

    if (!Array.isArray(history) || history.length < 2) {
      return;
    }
    const points = history
      .map((h: any) => ({ x: new Date(h.timestamp), y: Number(h.percentage) || 0 }))
      .sort((a, b) => a.x.getTime() - b.x.getTime());
    this.renderTrendSVG(trendHost, points);
  }
  renderTrendSVG(host: HTMLElement, points: { x: Date; y: number }[]) {
    host.innerHTML = '';
    const width = host.clientWidth || 360;
    const height = 120;
    const padding = 12;
    const times = points.map((p) => p.x.getTime());
    const values = points.map((p) => p.y);
    const minX = Math.min(...times);
    const maxX = Math.max(...times);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    minY = Math.max(0, Math.min(100, minY));
    maxY = Math.max(0, Math.min(100, maxY));
    const xScale = (t: number) => {
      if (maxX === minX) return padding;
      return padding + ((t - minX) / (maxX - minX)) * (width - 2 * padding);
    };
    const yScale = (v: number) => {
      if (maxY === minY) {
        return height / 2;
      }
      return height - padding - ((v - minY) / (maxY - minY)) * (height - 2 * padding);
    };
    const pathD = points
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${xScale(p.x.getTime()).toFixed(2)} ${yScale(p.y).toFixed(2)}`,
      )
      .join(' ');
    const last = points[points.length - 1];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', `${height}`);
    svg.innerHTML = `<defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#28a745" stop-opacity="0.8" /><stop offset="100%" stop-color="#28a745" stop-opacity="0.2" /></linearGradient></defs><rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/><path d="${pathD}" fill="none" stroke="#28a745" stroke-width="2" /><circle cx="${xScale(last.x.getTime()).toFixed(2)}" cy="${yScale(last.y).toFixed(2)}" r="3" fill="#28a745" />`;
    host.appendChild(svg);
    const sr = document.createElement('div');
    sr.className = 'sr-only';
    sr.textContent = `Latest compliance: ${last.y}%`;
    host.appendChild(sr);
  }
  renderCategoryBreakdown(categories: any): HTMLElement | null {
    if (!categories) {
      console.warn('[CategoryBreakdown] No categories data provided');
      return null;
    }
    console.log('[CategoryBreakdown] Categories data:', categories);
    const categoryMap = [
      { key: 'repositoryManagement', label: 'Repository Management', icon: 'fa-folder' },
      { key: 'functionalRequirements', label: 'Functional Requirements', icon: 'fa-tasks' },
      { key: 'deployment', label: 'Deployment', icon: 'fa-cloud-upload-alt' },
      { key: 'security', label: 'Security', icon: 'fa-shield-alt' },
      { key: 'testing', label: 'Testing', icon: 'fa-vial' },
      { key: 'agents', label: 'Agents', icon: 'fa-robot' },
    ];
    const section = document.createElement('div');
    section.className = 'category-breakdown';
    section.style.cssText = 'margin-top: 30px;';
    section.innerHTML =
      '<h3 style="margin-bottom: 20px;">Category Breakdown</h3><div class="category-tiles"></div>';
    const tilesContainer = section.querySelector('.category-tiles') as HTMLElement;
    if (tilesContainer) {
      tilesContainer.style.cssText =
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;';
    }
    categoryMap.forEach((cat) => {
      const catData = categories[cat.key];
      console.log(`[CategoryBreakdown] ${cat.key}:`, catData);
      if (!catData) {
        console.warn(`[CategoryBreakdown] No data for ${cat.key}`);
        return;
      }
      const enabled = catData.enabled !== false;
      // Support both 'passed' (frontend) and 'compliant' (backend) property names
      const passedArray = catData.passed || catData.compliant || [];
      const passed = Array.isArray(passedArray) ? passedArray.length : (typeof passedArray === 'number' ? passedArray : 0);
      const issues = Array.isArray(catData.issues) ? catData.issues.length : catData.issues || 0;
      const total = passed + issues;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      console.log(
        `[CategoryBreakdown] ${cat.key} stats: enabled=${enabled}, passed=${passed}, issues=${issues}, total=${total}, percentage=${percentage}%`,
      );
      const tile = document.createElement('div');
      tile.className = `category-tile tile ${enabled ? 'enabled' : 'disabled'}`;
      tile.id = `category-tile-${cat.key}`;
      tile.setAttribute('data-category', cat.key);
      tile.style.cssText = `background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 15px; ${!enabled ? 'opacity: 0.6;' : ''}`;
      tile.innerHTML = `<div class="category-icon" style="font-size: 2rem; color: #0078d4; min-width: 40px; text-align: center;"><i class="fas ${cat.icon}"></i></div><div class="category-info" style="flex: 1;"><div class="category-label" style="font-weight: 600; font-size: 1rem; margin-bottom: 5px;">${cat.label}</div><div class="category-status" style="margin-bottom: 8px;"><span class="badge ${enabled ? 'badge-enabled' : 'badge-disabled'}" style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.75rem; ${enabled ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">${enabled ? 'Enabled' : 'Disabled'}</span></div><div class="category-percentage" style="font-size: 1.5rem; font-weight: bold; color: ${percentage >= 80 ? '#28a745' : percentage >= 50 ? '#ffc107' : '#dc3545'}; margin-bottom: 5px;">${percentage}%</div><div class="category-counts" style="font-size: 0.875rem; color: #6c757d;"><span class="passed-count">${passed} passed</span> / <span class="issues-count">${issues} issues</span></div>${cat.key === 'agents' ? '<div class="agents-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 0.75rem; color: #666;"><a href="https://agents.md" target="_blank" style="color: #0078d4; text-decoration: none;"><i class="fas fa-info-circle"></i> Learn about agents.md</a></div>' : ''}</div>`;
      tilesContainer.appendChild(tile);
    });
    return section;
  }
  renderIssuesPanel(data: AdaptedData, container: HTMLElement) {
    const issuesPanel = document.createElement('section');
    issuesPanel.className = 'panel';
    issuesPanel.id = 'issuesPanel';
    if (data.compliance.issues.length > 0) {
      issuesPanel.classList.add('panel-open');
    }
    issuesPanel.innerHTML = `<div class="panel-header"><div class="panel-title"><i class="fas fa-exclamation-circle"></i><span>Issues</span></div><i class="fas fa-chevron-down panel-toggle"></i></div><div class="panel-body"><div class="panel-content"><ul class="item-list" id="issuesList">${this.renderIssueItems(data.compliance.issues)}</ul></div></div>`;
    container.appendChild(issuesPanel);
  }
  renderPassedPanel(data: AdaptedData, container: HTMLElement) {
    const passedPanel = document.createElement('section');
    passedPanel.className = 'panel';
    passedPanel.id = 'passedPanel';
    if (data.compliance.issues.length === 0) {
      passedPanel.classList.add('panel-open');
    }
    const passedItems = data.compliance.compliant.filter(
      (item: ComplianceItem) => item.category !== 'meta',
    );
    passedPanel.innerHTML = `<div class="panel-header"><div class="panel-title"><i class="fas fa-check-circle"></i><span>Passed Checks</span></div><i class="fas fa-chevron-down panel-toggle"></i></div><div class="panel-body"><div class="panel-content"><ul class="item-list" id="passedList">${this.renderPassedItems(passedItems)}</ul></div></div>`;
    container.appendChild(passedPanel);
  }
  renderIssueItems(issues: ComplianceItem[]) {
    if (!issues || issues.length === 0) {
      return '<li class="item"><div class="item-message">No issues found. Great job!</div></li>';
    }
    const issuePriorities: { [key: string]: number } = { 'agents-missing-file': 1, default: 100 };
    const sortedIssues = [...issues].sort((a, b) => {
      const priorityA = issuePriorities[a.id] || issuePriorities['default'];
      const priorityB = issuePriorities[b.id] || issuePriorities['default'];
      return priorityA - priorityB;
    });
    return sortedIssues
      .map((issue: ComplianceItem) => {
        if (issue.id === 'agents-missing-file') {
          return `<li class="item issue-item agents-missing" style="border-left:4px solid #d9534f;"><div class="item-header"><div class="item-title" style="color:#d9534f; font-weight:600;">Agents.md missing</div><div class="item-category">Missing File</div></div><div class="item-message">A standard agents.md file is not present in the root of your repository. This file provides important information about AI agents that work with your template.</div><div class="item-details"><strong>How to fix:</strong> Create an agents.md file in the root of your repository with the required structure.</div><div class="item-actions"><a href="#" class="item-link" style="color:#d9534f;" onclick="return createAgentsMdIssue(event)"><i class="fas fa-magic"></i> Create agents.md Issue</a></div></li>`;
        }
        let category;
        if (issue.id.includes('missing-file')) category = 'Missing File';
        else if (issue.id.includes('missing-folder')) category = 'Missing Folder';
        else if (issue.id.includes('missing-workflow')) category = 'Missing Workflow';
        else if (issue.id.includes('missing-doc')) category = 'Missing Documentation';
        else if (issue.id.includes('readme')) category = 'README Issue';
        else if (issue.id.includes('bicep')) category = 'Bicep Issue';
        else if (issue.id.includes('azure-yaml')) category = 'Azure YAML Issue';
        else category = 'General Issue';
        let fixHint;
        if (issue.id.includes('missing-file') || issue.id.includes('missing-folder'))
          fixHint = `Create the missing ${issue.id.includes('file') ? 'file' : 'folder'} in your repository.`;
        else if (issue.id.includes('missing-workflow'))
          fixHint = 'Add the required workflow file to your .github/workflows directory.';
        else if (issue.id.includes('readme'))
          fixHint = 'Update your README.md with the required headings and content.';
        else if (issue.id.includes('bicep'))
          fixHint = 'Add the missing resources to your Bicep files.';
        else if (issue.id.includes('azure-yaml'))
          fixHint = 'Update your azure.yaml file to include required sections.';
        else fixHint = 'Review the issue details and make appropriate changes.';
        return `<li class="item issue-item"><div class="item-header"><div class="item-title">${issue.message}</div><div class="item-category">${category}</div></div><div class="item-message">${issue.error || issue.message}</div><div class="item-details"><strong>How to fix:</strong> ${fixHint}</div><div class="item-actions"><a href="#" class="item-link" onclick="return openEditorWithFile(event, '${issue.id}')"><i class="fas fa-external-link-alt"></i> Fix in editor</a><a href="#" class="item-link" style="margin-left: 15px;" onclick="return createSingleIssue(event, '${issue.id}')"><i class="fab fa-github"></i> Create issue</a></div></li>`;
      })
      .join('');
  }
  renderPassedItems(passedItems: ComplianceItem[]) {
    if (!passedItems || passedItems.length === 0) {
      return '<li class="item"><div class="item-message">No passed checks yet.</div></li>';
    }
    return passedItems
      .map((item: ComplianceItem) => {
        const categoryDisplay = item.category
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());
        let detailsHtml = '';
        if (item.details && Object.keys(item.details).length > 0) {
          detailsHtml = '<div class="item-details">';
          for (const [key, value] of Object.entries(item.details)) {
            if (Array.isArray(value) && value.length > 3) {
              detailsHtml += `<div><strong>${key}:</strong> ${value.length} items</div>`;
            } else if (typeof value === 'object' && value !== null) {
              detailsHtml += `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
            } else {
              detailsHtml += `<div><strong>${key}:</strong> ${value}</div>`;
            }
          }
          detailsHtml += '</div>';
        }
        return `<li class="item passed-item"><div class="item-header"><div class="item-title">${item.message}</div><div class="item-category">${categoryDisplay}</div></div>${detailsHtml}</li>`;
      })
      .join('');
  }
  renderActionFooter(data: AdaptedData, container: HTMLElement) {
    console.log('renderActionFooter called');
    this.debug('Setting up action buttons from renderActionFooter');
    this.generateAgentPrompt(data);
    this.setupActionButtons(data);
    const actionHeader = document.querySelector('.action-header') as HTMLElement | null;
    if (actionHeader) {
      console.log('Action header is in the DOM');
      console.log('Action header styles:', window.getComputedStyle(actionHeader));
    } else {
      console.warn('Action header not found in the DOM!');
    }
  }
  generateAgentPrompt(data: AdaptedData) {
    const issues = data.compliance.issues;
    const compliancePercentage =
      data.compliance.compliant.find((item: ComplianceItem) => item.category === 'meta')?.details
        ?.percentageCompliant || 0;
    let prompt = `Fix Azure Template Compliance Issues (${compliancePercentage}%)\n\n`;
    if (issues.length === 0) {
      prompt += '• No issues found! The template is fully compliant.';
      return prompt;
    }
    prompt += `Issues that need fixing:\n\n`;
    issues.forEach((issue: ComplianceItem) => {
      if (issue.id.includes('missing-file')) {
        const fileName = issue.message.match(/Missing required file: (.+)/)?.[1] || issue.message;
        prompt += `• Create file: ${fileName}\n`;
      } else if (issue.id.includes('missing-folder')) {
        const folderName =
          issue.message.match(/Missing required folder: (.+)/)?.[1] || issue.message;
        prompt += `• Create folder: ${folderName}\n`;
      } else {
        prompt += `• ${issue.message}\n`;
      }
    });
    prompt += `\nPlease fix these issues following Azure template best practices.`;
    return prompt;
  }
  setupActionButtons(data: AdaptedData) {
    this.debug('Setting up action buttons');
    setTimeout(() => {
      try {
        this.debug('Setting up action buttons with delay');
        const fixButton = document.getElementById('fixButton') as HTMLElement | null;
        if (fixButton) {
          this.debug('Found fixButton - setting up');
          const newFixButton = fixButton.cloneNode(true) as HTMLElement;
          if (fixButton.parentNode) {
            fixButton.parentNode.replaceChild(newFixButton, fixButton);
          }
          (newFixButton.style as any).opacity = '1';
          (newFixButton.style as any).visibility = 'visible';
          newFixButton.style.pointerEvents = 'auto';
          newFixButton.style.cursor = 'pointer';
          newFixButton.style.display = 'inline-flex';
          const templateUrl = encodeURIComponent(data.repoUrl);
          (newFixButton as any).href =
            `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`;
          this.debug(`Set fix button URL to: ${(newFixButton as any).href}`);
          newFixButton.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('Fix button clicked');
            window.open(
              `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`,
              '_blank',
            );
          });
        }
        const createIssueButton = document.getElementById(
          'create-github-issue-btn',
        ) as HTMLElement | null;
        if (createIssueButton) {
          this.debug('Found createIssueButton - setting up');
          const newCreateIssueButton = createIssueButton.cloneNode(true) as HTMLElement;
          if (createIssueButton.parentNode) {
            createIssueButton.parentNode.replaceChild(newCreateIssueButton, createIssueButton);
          }
          // Replace spinner with actual button content
          newCreateIssueButton.innerHTML = '<i class="fab fa-github"></i> Create GitHub Issue';
          newCreateIssueButton.style.opacity = '1';
          newCreateIssueButton.style.visibility = 'visible';
          newCreateIssueButton.style.pointerEvents = 'auto';
          newCreateIssueButton.style.cursor = 'pointer';
          newCreateIssueButton.style.display = 'inline-flex';
          newCreateIssueButton.addEventListener('click', function () {
            console.log('Create GitHub Issue button clicked');
            if (typeof (window as any).createGitHubIssue === 'function') {
              (window as any).createGitHubIssue();
            } else {
              // Use notification system (required - no fallback to alert)
              if ((window as any).NotificationSystem) {
                (window as any).NotificationSystem.showError(
                  'Feature Unavailable',
                  'GitHub issue creation is not available in this view.',
                  5000,
                );
              }
            }
          });
        }
        const testProvisionButton = document.getElementById(
          'testProvisionButton',
        ) as HTMLElement | null;
        if (testProvisionButton) {
          this.debug('Found testProvisionButton - setting up');
          const newTestProvisionButton = testProvisionButton.cloneNode(true) as HTMLElement;
          if (testProvisionButton.parentNode) {
            testProvisionButton.parentNode.replaceChild(
              newTestProvisionButton,
              testProvisionButton,
            );
          }
          newTestProvisionButton.style.opacity = '1';
          newTestProvisionButton.style.visibility = 'visible';
          newTestProvisionButton.style.pointerEvents = 'auto';
          newTestProvisionButton.style.cursor = 'pointer';
          newTestProvisionButton.style.display = 'inline-flex';
          newTestProvisionButton.addEventListener('click', function () {
            console.log('Test AZD Provision button clicked');
            if (typeof (window as any).testAzdProvision === 'function') {
              (window as any).testAzdProvision();
            } else {
              // Use notification system (required - no fallback to alert)
              if ((window as any).NotificationSystem) {
                (window as any).NotificationSystem.showError(
                  'Feature Unavailable',
                  'AZD provision testing is not available in this view.',
                  5000,
                );
              }
            }
          });
        }
        const allButtons = document.querySelectorAll('button, a.btn');
        this.debug(`After setup: Found ${allButtons.length} total interactive elements`);
        allButtons.forEach((btn, idx) => {
          this.debug(
            `Button #${idx}: id=${(btn as any).id}, visible=${(btn as any).style.visibility}, clickable=${(btn as any).style.pointerEvents}`,
          );
        });
      } catch (e) {
        console.error('Error setting up action buttons:', e);
      }
    }, 200);
  }
  addEventListeners(container: HTMLElement) {
    container.querySelectorAll('.panel-header').forEach((header) => {
      header.addEventListener('click', () => {
        const panel = header.parentElement as HTMLElement | null;
        panel?.classList.toggle('panel-open');
      });
    });
    (window as any).openEditorWithFile = function (event: MouseEvent, issueId: string) {
      event.preventDefault();
      const issue = (window as any).reportData.compliance.issues.find(
        (i: ComplianceItem) => i.id === issueId,
      );
      if (!issue) return true;
      let filePath = '';
      if (issueId.includes('missing-file')) {
        filePath = issueId.replace('missing-file-', '');
      } else if (issueId.includes('missing-workflow')) {
        const workflowName = issueId.replace('missing-workflow-', '');
        filePath = `.github/workflows/${workflowName}.yml`;
      } else if (issueId.includes('readme')) {
        filePath = 'README.md';
      } else if (issueId.includes('bicep') && issueId.includes('main')) {
        filePath = 'infra/main.bicep';
      } else if (issueId.includes('azure-yaml')) {
        filePath = 'azure.yaml';
      }
      const templateUrl = encodeURIComponent((window as any).reportData.repoUrl);
      let url = `https://insiders.vscode.dev/azure?azdTemplateUrl=${templateUrl}`;
      if (filePath) {
        url += `&path=${encodeURIComponent(filePath)}`;
      }
      window.open(url, '_blank');
      return false;
    };
    (window as any).createSingleIssue = async function (event: MouseEvent, issueId: string) {
      event.preventDefault();
      const gh = (window as any).GitHubClient;
      if (!gh || !gh.auth || !gh.auth.isAuthenticated()) {
        if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showWarning(
            'Authentication Required',
            'Please sign in with GitHub to create issues.',
            5000,
          );
        } else {
          console.error('Please sign in with GitHub to create issues');
        }
        return false;
      }
      const issue = (window as any).reportData.compliance.issues.find(
        (i: ComplianceItem) => i.id === issueId,
      );
      if (!issue) {
        if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showError(
            'Issue Not Found',
            'Could not find the specified issue.',
            5000,
          );
        }
        return false;
      }
      const repoUrl = (window as any).reportData.repoUrl;
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showError(
            'Invalid Repository',
            'Could not parse repository URL.',
            5000,
          );
        }
        return false;
      }
      const [, owner, repo] = match;
      let notification;
      if ((window as any).NotificationSystem) {
        notification = (window as any).NotificationSystem.showLoading(
          'Creating Issue',
          `Creating GitHub issue for: ${issue.message}`,
        );
      }
      try {
        const title = `[Template Doctor] ${issue.message}`;
        const category = issue.category.replace(/([A-Z])/g, ' $1').trim();
        let body = `## Issue Details\n\n`;
        body += `**Category:** ${category}\n`;
        body += `**Severity:** ${issue.severity || 'medium'}\n`;
        body += `**Repository:** ${repoUrl}\n\n`;
        body += `### Description\n\n${issue.error || issue.message}\n\n`;
        if (issue.recommendation) {
          body += `### Recommendation\n\n${issue.recommendation}\n\n`;
        }
        body += `---\n*This issue was automatically created by Template Doctor*\n`;
        const labels = [
          'template-doctor',
          `severity:${issue.severity || 'medium'}`,
          `category:${issue.category}`,
        ];
        const createdIssue = await gh.createIssueGraphQL(owner, repo, title, body, labels);
        if (notification && notification.success) {
          notification.success('Issue Created', `Created issue #${createdIssue.number}`);
        } else if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showSuccess(
            'Issue Created',
            `Created issue #${createdIssue.number} and assigned to Copilot.`,
            8000,
            {
              actions: [
                {
                  label: 'Open Issue',
                  onClick: () => window.open(createdIssue.url, '_blank'),
                  primary: true,
                },
              ],
            },
          );
        }
        window.open(createdIssue.url, '_blank');
        return false;
      } catch (error: any) {
        console.error('Error creating individual issue:', error);
        if (notification && notification.error) {
          notification.error('Creation Failed', error.message || 'Failed to create issue');
        } else if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showError(
            'Creation Failed',
            `Failed to create issue: ${error.message}`,
            8000,
          );
        }
        return false;
      }
    };
  }
}

// Initialize once
if (!(window as any).DashboardRenderer) {
  (window as any).DashboardRenderer = new DashboardRenderer();
}
// Expose types indirectly for potential future use (no runtime impact)
export type { ComplianceItem, AdaptedData };
export {};
