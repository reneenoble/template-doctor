// Extraction of agents.md enrichment logic from legacy dashboard-renderer.js (parity oriented)
// Exposes runAgentsEnrichment(adaptedData) plus helpers used by legacy renderer.

interface AdaptedDataLike {
  repoUrl: string;
  compliance: {
    issues: any[];
    compliant: any[];
    categories?: any;
  };
}

function debug(msg: string, data?: any) {
  try {
    console.debug('[AgentsEnrichment]', msg, data || '');
  } catch (_) {}
}

function storeAgentsCache(key: string, value: any) {
  try {
    if (sessionStorage)
      sessionStorage.setItem(key, JSON.stringify({ ...value, cachedAt: Date.now() }));
  } catch (_) {}
}
function applyAgentsCachedResult(adaptedData: AdaptedDataLike, cached: any) {
  if (!cached || !adaptedData) return;
  if (cached.status === 'missing') {
    adaptedData.compliance.issues.push({
      id: 'agents-missing-file',
      category: 'agents',
      severity: 'error',
      message: 'agents.md file is missing (client check, cached)',
    });
  } else if (cached.status === 'invalid') {
    adaptedData.compliance.issues.push({
      id: 'agents-format-invalid',
      category: 'agents',
      severity: 'warning',
      message: 'agents.md formatting issues (cached)',
      details: cached.problems,
    });
  } else if (cached.status === 'valid') {
    const agentLabel = cached.agentCount === 1 ? 'agent' : 'agents';
    adaptedData.compliance.compliant.push({
      id: 'agents-doc-valid',
      category: 'agents',
      message: `agents.md valid (${cached.agentCount || 0} ${agentLabel})`,
    });
  }
}

function updateAgentsBadge(issue: any, compliant: any) {
  try {
    const actionHeader = document.getElementById('action-section');
    if (!actionHeader) return;
    let badge = document.getElementById('agents-status-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'agents-status-badge';
      badge.style.cssText =
        'margin-left:8px; padding:2px 6px; border-radius:10px; font-size:0.65rem; letter-spacing:.5px; font-weight:600; vertical-align:middle;';
      const h3 = actionHeader.querySelector('h3');
      if (h3) h3.appendChild(badge);
      else actionHeader.prepend(badge);
    }
    if (issue && issue.id === 'agents-missing-file') {
      badge.textContent = 'Agents: Missing';
      badge.style.background = '#d9534f';
      badge.style.color = '#fff';
      badge.title = 'agents.md not found in repository';
      updateAgentsTileStatus('missing');
    } else if (issue) {
      badge.textContent = 'Agents: Invalid';
      badge.style.background = '#ff9800';
      badge.style.color = '#fff';
      badge.title = 'agents.md formatting problems';
      updateAgentsTileStatus('invalid');
    } else if (compliant) {
      badge.textContent = 'Agents: OK';
      badge.style.background = '#28a745';
      badge.style.color = '#fff';
      badge.title = 'agents.md validated';
      updateAgentsTileStatus('valid');
    }
  } catch (_) {}
}

function updateAgentsTileStatus(status: string) {
  try {
    const tile = document.querySelector(
      '.category-breakdown .tile[data-category="agents"]',
    ) as HTMLElement | null;
    if (!tile) return;
    tile.style.transition = 'background 0.3s, border-color 0.3s';
    if (status === 'missing') {
      tile.style.background = '#ffe5e5';
      tile.style.border = '1px solid #d9534f';
      if (!tile.querySelector('.agents-action')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small agents-action';
        btn.style.cssText =
          'margin-top:8px; background:#d9534f; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:0.7rem; font-weight:600; width:100%;';
        btn.textContent = 'Create agents.md Issue';
        btn.title = 'Open a GitHub issue asking Copilot to generate agents.md';
        btn.onclick = (e) => {
          e.preventDefault();
          (window as any).createAgentsMdIssue && (window as any).createAgentsMdIssue();
        };
        tile.appendChild(btn);
      }
    } else if (status === 'invalid') {
      tile.style.background = '#fff3e0';
      tile.style.border = '1px solid #ff9800';
      const existing = tile.querySelector('.agents-action');
      if (existing) existing.remove();
    } else if (status === 'valid') {
      tile.style.background = '#e6f7ed';
      tile.style.border = '1px solid #28a745';
      const existing = tile.querySelector('.agents-action');
      if (existing) existing.remove();
    }
  } catch (_) {}
}

function updateAgentsBadgeFromData(adaptedData: AdaptedDataLike) {
  const issues = adaptedData.compliance.issues.filter((i) => i.category === 'agents');
  const passes = adaptedData.compliance.compliant.filter((i) => i.category === 'agents');
  updateAgentsBadge(issues[0] || null, passes[0] || null);
}

export async function runAgentsEnrichment(adaptedData: AdaptedDataLike) {
  if (!adaptedData || !adaptedData.compliance) return;
  const existingItems = adaptedData.compliance.issues
    .concat(adaptedData.compliance.compliant)
    .filter((i) => i.category === 'agents');
  if (existingItems.length) {
    debug('Skip enrichment (already present)');
    updateAgentsBadgeFromData(adaptedData);
    return;
  }
  const repoUrl = adaptedData.repoUrl || '';
  if (!/https?:\/\/github\.com\//i.test(repoUrl)) {
    debug('Skip (non-GitHub repo)');
    return;
  }
  const ownerRepoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/i);
  if (!ownerRepoMatch) return;
  const owner = ownerRepoMatch[1];
  const repo = ownerRepoMatch[2];
  const cacheKey = `__TD_agents_cache_${owner}_${repo}`;
  try {
    const cached = sessionStorage && sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      applyAgentsCachedResult(adaptedData, parsed);
      updateAgentsBadgeFromData(adaptedData);
      return;
    }
  } catch (_) {}
  const candidateBranches = ['main', 'master'];
  let content: string | null = null;
  for (const branch of candidateBranches) {
    try {
      const cdnResp = await fetch(
        `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/agents.md`,
        { cache: 'no-store' },
      );
      if (cdnResp.ok) {
        content = await cdnResp.text();
        break;
      }
      const rawResp = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/agents.md`,
        { cache: 'no-store' },
      );
      if (rawResp.ok) {
        content = await rawResp.text();
        break;
      }
    } catch (_) {}
  }
  if (content == null) {
    const issue = {
      id: 'agents-missing-file',
      category: 'agents',
      severity: 'error',
      message: 'agents.md file is missing (client check)',
      recommendation:
        'Add an agents.md defining agents (name, description, inputs, outputs, permissions).',
    };
    adaptedData.compliance.issues.push(issue);
    if (!adaptedData.compliance.categories) adaptedData.compliance.categories = {};
    if (!adaptedData.compliance.categories.agents) {
      adaptedData.compliance.categories.agents = {
        enabled: true,
        issues: [issue],
        compliant: [],
        percentage: 0,
      };
    }
    storeAgentsCache(cacheKey, { status: 'missing', problems: ['file not found'] });
    updateAgentsBadge(issue, null);
    updateAgentsTileStatus('missing');
    return;
  }
  const lines = content.split(/\r?\n/);
  const firstHeader = lines.find((l) => /^#\s+/.test(l.trim())) || '';
  const hasTopHeader = /^#\s+/.test(firstHeader);
  const hasAgentsSection = /##\s+agents?/i.test(content);
  const tableHeaderLine = lines.find(
    (l) => /\|/.test(l) && /name/i.test(l) && /description/i.test(l),
  );
  let headerCols: string[] = [];
  if (tableHeaderLine) {
    headerCols = tableHeaderLine
      .split('|')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
  }
  const requiredCols = ['name', 'description', 'inputs', 'outputs', 'permissions'];
  const missingCols = requiredCols.filter((c) => !headerCols.some((h) => h === c));
  const hasTable = headerCols.length > 0;
  const problems: string[] = [];
  if (!hasTopHeader) problems.push('missing top-level heading');
  if (!hasAgentsSection) problems.push('missing Agents section (## Agents)');
  if (!hasTable) problems.push('missing agent definition table');
  if (hasTable && missingCols.length)
    problems.push('missing required columns: ' + missingCols.join(', '));
  let agentCount = 0;
  if (hasTable) {
    const tableIndex = lines.indexOf(tableHeaderLine || '');
    for (let i = tableIndex + 1; i < lines.length; i++) {
      const ln = lines[i];
      if (/^\s*\|\s*[-:]+(\s*\|\s*[-:]+)*\s*\|?\s*$/.test(ln)) continue;
      if (!/\|/.test(ln)) {
        if (ln.trim() === '') break;
        continue;
      }
      const cellParts = ln.split('|').map((c) => c.trim());
      if (cellParts.filter(Boolean).length >= 2) {
        agentCount++;
      }
    }
  }
  if (problems.length) {
    const issue = {
      id: 'agents-format-invalid',
      category: 'agents',
      severity: 'warning',
      message: 'agents.md present but formatting issues detected (client check)',
      details: problems,
    };
    adaptedData.compliance.issues.push(issue);
    storeAgentsCache(cacheKey, { status: 'invalid', problems, agentCount });
    updateAgentsBadge(issue, null);
    updateAgentsTileStatus('invalid');
  } else {
    const compliantItem = {
      id: 'agents-doc-valid',
      category: 'agents',
      message: `agents.md present and basic structure validated (${agentCount} agent${agentCount === 1 ? '' : 's'})`,
      details: { agentCount, columns: headerCols },
    };
    adaptedData.compliance.compliant.push(compliantItem);
    storeAgentsCache(cacheKey, { status: 'valid', agentCount });
    updateAgentsBadge(null, compliantItem);
    updateAgentsTileStatus('valid');
  }
}

// Export helpers if legacy code still calls them directly
if (!(window as any).__TD_agents) {
  (window as any).__TD_agents = {
    runAgentsEnrichment,
    updateAgentsBadge,
    updateAgentsBadgeFromData,
    updateAgentsTileStatus,
  };
}
