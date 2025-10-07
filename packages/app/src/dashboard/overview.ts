// Dashboard overview extraction (Phase 3b)
// Provides renderOverview(adaptedData) returning DocumentFragment.
// Respects optional global flag TemplateDoctorConfig.useTsDashboardParts.

import { renderCategoryBreakdown } from './category-breakdown';

interface MetaDetails {
  percentageCompliant?: number;
  ruleSet?: string;
  totalChecks?: number;
}
interface AdaptedData {
  repoUrl: string;
  ruleSet: string;
  compliance: { issues: any[]; compliant: any[]; categories?: any };
  totalIssues: number;
  totalPassed: number;
  __analysisMode?: string;
  customConfig?: any;
}

function findMetaDetails(data: AdaptedData): MetaDetails {
  const meta = data.compliance.compliant.find((i) => i.category === 'meta');
  return meta?.details || {};
}

function computeMode(data: AdaptedData): { label: string; color: string; title: string } {
  let mode = data.__analysisMode || 'upstream';
  if (!data.__analysisMode) {
    try {
      const u = new URL(data.repoUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const forkKey = `${parts[0]}/${parts[1]}`.toLowerCase();
        const session: any = (window as any).__TemplateDoctorSession;
        if (session && session.newForks instanceof Set && session.newForks.has(forkKey)) {
          mode = 'fork-fresh';
        } else {
          const currentUser = (window as any).GitHubClient?.getCurrentUsername?.();
          if (currentUser && parts[0].toLowerCase() === currentUser.toLowerCase()) {
            mode = 'fork';
          }
        }
      }
    } catch (_) {}
  }
  const cfg: Record<string, { label: string; color: string; title: string }> = {
    'fork-fresh': {
      label: 'Fork (New)',
      color: '#ff9800',
      title: 'New fork in this session; no historical data yet.',
    },
    fork: { label: 'Fork', color: '#0078d4', title: 'Analyzing your existing fork.' },
    upstream: { label: 'Upstream', color: '#6c757d', title: 'Analyzing upstream repository.' },
  };
  return cfg[mode] || cfg.upstream;
}

export function renderOverview(data: AdaptedData): DocumentFragment {
  const frag = document.createDocumentFragment();
  const meta = findMetaDetails(data);
  const compliancePercentage = meta.percentageCompliant || 0;
  const ruleSet = data.ruleSet || meta.ruleSet || 'dod';
  const ruleSetDisplay =
    ruleSet === 'dod'
      ? 'DoD'
      : ruleSet === 'partner'
        ? 'Partner'
        : ruleSet === 'docs'
          ? 'Docs'
          : ruleSet === 'custom'
            ? 'Custom'
            : ruleSet;
  const gistUrl = data.customConfig?.gistUrl;
  const mc = computeMode(data);

  const section = document.createElement('section');
  section.className = 'overview';
  section.innerHTML = `
    <h2>Compliance Overview</h2>
    <div class="overview-header">
      <p class="overview-text">
        This dashboard provides an overview for your Azure template compliance status with the 'Azure Developer CLI Template Framework' <a href="https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/definition-of-done.md" title="Definition of Done">Definition of Done</a>. Browse the list below to
        fix specific issues or use the AI agent to automatically fix all compliance issues in VS Code.
      </p>
      <div class="ruleset-info">
        <span class="analysis-mode-badge" style="display:inline-block; background:${mc.color}; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.65rem; letter-spacing:.5px; margin-right:6px; vertical-align:middle;" title="${mc.title}">${mc.label}</span>
        <span class="ruleset-label">Configuration:</span>
        ${
          ruleSet === 'custom' && gistUrl
            ? `<a href="${gistUrl}" target="_blank" class="ruleset-value ${ruleSet}-badge" title="View custom ruleset on GitHub">${ruleSetDisplay} <i class="fas fa-external-link-alt fa-xs"></i></a>`
            : `<span class="ruleset-value ${ruleSet}-badge">${ruleSetDisplay}</span>`
        }
        <button id="change-ruleset-btn" class="btn btn-small" title="Change configuration"><i class="fas fa-sync-alt"></i></button>
      </div>
    </div>
    <p>For more information about compliance and collections, go here <a href="https://github.com/Azure-Samples/azd-template-artifacts">Azure Developer CLI Template Framework Docs</a></p>
    <div class="compliance-gauge">
      <div class="gauge-fill" id="complianceGauge" style="width: ${compliancePercentage}%; background-position: ${compliancePercentage}% 0;"></div>
      <div class="gauge-label" id="compliancePercentage">${compliancePercentage}%</div>
    </div>
    <div class="overview-tiles">
      <div class="tile tile-issues">
        <div class="tile-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="tile-value" id="issuesCount">${data.totalIssues}</div>
        <div class="tile-title">Issues Found</div>
      </div>
      <div class="tile tile-passed">
        <div class="tile-icon"><i class="fas fa-check-circle"></i></div>
        <div class="tile-value" id="passedCount">${data.totalPassed - 1}</div>
        <div class="tile-title">Passed Checks</div>
      </div>
      <div class="tile tile-trend">
        <div class="tile-header"><div class="tile-icon"><i class="fas fa-chart-line"></i></div><div class="tile-title">Compliance Trend</div></div>
        <div id="trendChart" class="trend-chart"><div class="no-data-message">Not enough historical data available yet.</div></div>
      </div>
    </div>`;

  // Append category breakdown if available
  try {
    if (data.compliance && data.compliance.categories) {
      section.appendChild(renderCategoryBreakdown(data.compliance.categories));
    }
  } catch (e) {
    console.warn('[overview] category breakdown failed', e);
  }

  frag.appendChild(section);

  // Defer binding for change ruleset button (parity with legacy timing)
  setTimeout(() => {
    const changeRulesetBtn = section.querySelector('#change-ruleset-btn');
    if (changeRulesetBtn) {
      changeRulesetBtn.addEventListener('click', () => {
        const repoUrl = data.repoUrl;
        if (repoUrl && typeof (window as any).analyzeRepo === 'function')
          (window as any).analyzeRepo(repoUrl, 'show-modal');
      });
    }
  }, 100);

  return frag;
}

if (!(window as any).__TD_renderOverview) {
  (window as any).__TD_renderOverview = renderOverview;
}
