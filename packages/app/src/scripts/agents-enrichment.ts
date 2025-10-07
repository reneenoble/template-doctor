// Agents.md validation and enrichment for dashboard
// Performs client-side checks for agents.md presence and structure

interface AgentsCache {
  status: 'missing' | 'invalid' | 'valid';
  problems?: string[];
  agentCount?: number;
  cachedAt?: number;
}

export async function runAgentsEnrichment(adaptedData: any): Promise<void> {
  if (!adaptedData || !adaptedData.compliance) return;

  // Check if backend already provided agents data
  const existingItems = adaptedData.compliance.issues
    .concat(adaptedData.compliance.compliant)
    .filter((i: any) => i.category === 'agents');

  if (existingItems.length) {
    console.log('[AgentsEnrichment] Skipped - already present from backend');
    updateAgentsBadgeFromData(adaptedData);
    return;
  }

  // Only proceed for public GitHub URLs
  const repoUrl = adaptedData.repoUrl || '';
  if (!/https?:\/\/github\.com\//i.test(repoUrl)) {
    console.log('[AgentsEnrichment] Skipped - non-GitHub repo');
    return;
  }

  const ownerRepoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/i);
  if (!ownerRepoMatch) return;

  const owner = ownerRepoMatch[1];
  const repo = ownerRepoMatch[2];
  const cacheKey = `__TD_agents_cache_${owner}_${repo}`;

  // Check session cache
  try {
    if (sessionStorage) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache: AgentsCache = JSON.parse(cached);
        console.log('[AgentsEnrichment] Using session cache');
        applyAgentsCachedResult(adaptedData, parsedCache);
        updateAgentsBadgeFromData(adaptedData);
        return;
      }
    }
  } catch (e) {
    console.warn('[AgentsEnrichment] Cache read error:', e);
  }

  // Fetch agents.md
  const candidateBranches = ['main', 'master'];
  let content: string | null = null;

  for (const branch of candidateBranches) {
    try {
      // Try jsdelivr CDN first (fast + cached)
      const cdnResp = await fetch(
        `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/agents.md`,
        { cache: 'no-store' },
      );
      if (cdnResp.ok) {
        content = await cdnResp.text();
        break;
      }

      // Fallback to raw.githubusercontent.com
      const rawResp = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/agents.md`,
        { cache: 'no-store' },
      );
      if (rawResp.ok) {
        content = await rawResp.text();
        break;
      }
    } catch (e) {
      // Try next branch
      continue;
    }
  }

  if (content === null) {
    // File not found
    const issue = {
      id: 'agents-missing-file',
      category: 'agents',
      severity: 'error',
      message: 'agents.md file is missing (client check)',
      recommendation:
        'Add an agents.md describing available agents following the [agents.md specification](https://agents.md) for documenting AI Agents.',
    };
    adaptedData.compliance.issues.push(issue);

    // Ensure categories object exists
    if (!adaptedData.compliance.categories) {
      adaptedData.compliance.categories = {};
    }
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

  // Parse and validate content
  const lines = content.split(/\r?\n/);
  const firstHeader = lines.find((l) => /^#\s+/.test(l.trim())) || '';
  const hasTopHeader = /^#\s+/.test(firstHeader);
  const hasAgentsSection = /##\s+agents?/i.test(content);

  // Find table header
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
  if (hasTable && missingCols.length) {
    problems.push('missing required columns: ' + missingCols.join(', '));
  }

  // Count agent rows
  let agentCount = 0;
  if (hasTable && tableHeaderLine) {
    const tableIndex = lines.indexOf(tableHeaderLine);
    for (let i = tableIndex + 1; i < lines.length; i++) {
      const ln = lines[i];
      // Skip separator row
      if (/^\s*\|\s*[-:]+(\s*\|\s*[-:]+)*\s*\|?\s*$/.test(ln)) continue;
      // Stop if no pipes
      if (!/\|/.test(ln)) break;
      // Count rows with at least 2 cells
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
      recommendation:
        'Ensure agents.md contains required heading, section and columns as per the [agents.md specification](https://agents.md): ' +
        requiredCols.join(', '),
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

function storeAgentsCache(key: string, value: AgentsCache): void {
  try {
    if (sessionStorage) {
      sessionStorage.setItem(key, JSON.stringify({ ...value, cachedAt: Date.now() }));
    }
  } catch (e) {
    console.warn('[AgentsEnrichment] Cache write error:', e);
  }
}

function applyAgentsCachedResult(adaptedData: any, cached: AgentsCache): void {
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
    adaptedData.compliance.compliant.push({
      id: 'agents-doc-valid',
      category: 'agents',
      message: `agents.md present and validated (${cached.agentCount || 0} agents, cached)`,
      details: { agentCount: cached.agentCount },
    });
  }
}

function updateAgentsBadgeFromData(adaptedData: any): void {
  const issues = adaptedData.compliance.issues.filter((i: any) => i.category === 'agents');
  const passes = adaptedData.compliance.compliant.filter((i: any) => i.category === 'agents');
  updateAgentsBadge(issues[0] || null, passes[0] || null);
}

function updateAgentsBadge(issue: any | null, compliant: any | null): void {
  try {
    const actionHeader = document.getElementById('action-section');
    if (!actionHeader) return;

    let badge = document.getElementById('agents-status-badge') as HTMLElement | null;
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'agents-status-badge';
      badge.style.cssText =
        'margin-left:8px; padding:2px 6px; border-radius:10px; font-size:0.65rem; letter-spacing:.5px; font-weight:600; vertical-align:middle;';

      // Insert next to header title (first h3)
      const h3 = actionHeader.querySelector('h3');
      if (h3) h3.appendChild(badge);
      else actionHeader.appendChild(badge);
    }

    if (issue && issue.id === 'agents-missing-file') {
      badge.textContent = 'Agents: Missing';
      badge.style.background = '#d9534f';
      badge.style.color = '#fff';
      badge.title = 'agents.md not found in repository';
      updateAgentsTileStatus('missing');
    } else if (issue) {
      badge.textContent = 'Agents: Invalid';
      badge.style.background = '#f0ad4e';
      badge.style.color = '#fff';
      badge.title = 'agents.md has formatting issues';
      updateAgentsTileStatus('invalid');
    } else if (compliant) {
      badge.textContent = 'Agents: Valid';
      badge.style.background = '#28a745';
      badge.style.color = '#fff';
      badge.title = 'agents.md found and validated';
      updateAgentsTileStatus('valid');
    }
  } catch (e) {
    console.warn('[AgentsEnrichment] Badge update error:', e);
  }
}

export function updateAgentsTileStatus(status: 'missing' | 'invalid' | 'valid'): void {
  try {
    const tile = document.querySelector<HTMLElement>(
      '.category-breakdown .tile[data-category="agents"]',
    );
    if (!tile) return; // Not rendered yet

    tile.style.transition = 'background 0.3s, border-color 0.3s';

    if (status === 'missing') {
      tile.style.background = '#ffe5e5';
      tile.style.border = '1px solid #d9534f';

      // Inject action button if not present
      if (!tile.querySelector('.agents-action')) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'agents-action';
        actionDiv.style.cssText = 'margin-top:8px;';
        actionDiv.innerHTML = `<button onclick="createAgentsMdIssue(event)" style="padding:6px 12px; background:#d9534f; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem;"><i class="fas fa-magic"></i> Create agents.md Issue</button>`;
        tile.appendChild(actionDiv);
      }
    } else if (status === 'invalid') {
      tile.style.background = '#fff3cd';
      tile.style.border = '1px solid #f0ad4e';
    } else {
      tile.style.background = '';
      tile.style.border = '';
    }
  } catch (e) {
    console.warn('[AgentsEnrichment] Tile update error:', e);
  }
}

// Global function for creating agents.md issue
(window as any).createAgentsMdIssue = async function (event: Event) {
  event?.preventDefault();

  // Check authentication first
  const gh = (window as any).GitHubClient;
  if (!gh || !gh.auth || !gh.auth.isAuthenticated()) {
    // Try to use NotificationSystem if available, otherwise just log
    const notify = (window as any).NotificationSystem;
    if (notify && typeof notify.showError === 'function') {
      notify.showError('Sign In Required', 'Please sign in with GitHub to create issues.', 6000);
    } else {
      console.warn('[AgentsEnrichment] Please sign in with GitHub to create issues.');
    }
    return false;
  }

  // Get NotificationSystem - if not available yet, wait briefly and retry once
  let notify = (window as any).NotificationSystem;
  if (!notify || typeof notify.showLoading !== 'function') {
    // NotificationSystem might still be loading - wait briefly
    await new Promise((resolve) => setTimeout(resolve, 100));
    notify = (window as any).NotificationSystem;

    // If still not available, fail silently (user will just not see notifications)
    if (!notify || typeof notify.showLoading !== 'function') {
      console.debug(
        '[AgentsEnrichment] NotificationSystem not yet loaded, proceeding without notifications',
      );
      // Create a dummy notification object so code below doesn't fail
      notify = {
        showLoading: () => {},
        hideLoading: () => {},
        showSuccess: () => {},
        showError: (title: string, message: string) => console.error(`${title}: ${message}`),
        showWarning: (title: string, message: string) => console.warn(`${title}: ${message}`),
      };
    }
  }

  // Get report data with fallback to reportDataOriginal
  let reportData = (window as any).reportData;
  if (!reportData || !reportData.repoUrl) {
    console.debug('[AgentsEnrichment] Primary reportData not found, trying reportDataOriginal');
    reportData = (window as any).reportDataOriginal;
  }

  if (!reportData || !reportData.repoUrl) {
    console.error('[AgentsEnrichment] No report data available:', {
      reportData: !!(window as any).reportData,
      reportDataOriginal: !!(window as any).reportDataOriginal,
      hasRepoUrl: !!reportData?.repoUrl,
    });
    notify.showError(
      'Error',
      'Repository data not loaded. Please wait for the analysis to complete.',
      6000,
    );
    return false;
  }

  const repoUrl = reportData.repoUrl;
  const ownerRepoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?/i);
  if (!ownerRepoMatch) {
    notify.showError('Error', 'Invalid repository URL', 6000);
    return false;
  }

  let owner = ownerRepoMatch[1];
  const repo = ownerRepoMatch[2];

  // Check if user owns the repository
  const currentUser = gh.auth.getUsername();

  // If user doesn't own the repo, update owner to current user (assume fork exists or will be created)
  if (owner.toLowerCase() !== currentUser.toLowerCase()) {
    console.log(
      `[AgentsEnrichment] Repository owned by ${owner}, not ${currentUser}. Creating issue in user's fork.`,
    );
    owner = currentUser;
  }

  notify.showLoading('Creating agents.md issue with Copilot assignment...');

  try {
    const title = '[TD-BOT] Missing file: agents.md';
    const body = [
      'Please scan the repository and README and generate a suitable `agents.md` respecting the format at [https://agents.md](https://agents.md) - the specification for documenting AI Agents.',
      '',
      '### Checklist',
      '- [ ] Create `agents.md` at repo root with a top-level `# Agents` heading',
      '- [ ] Include a `## Agents` section',
      '- [ ] Add a markdown table with columns: Name | Description | Inputs | Outputs | Permissions',
      '- [ ] Populate rows for each identified agent (existing automation, workflows, scripts, tools)',
      '- [ ] Ensure Inputs/Outputs are explicit and actionable',
      '- [ ] Use least-privilege scopes in the Permissions column',
      '- [ ] Validate table formatting against [agents.md specification](https://agents.md) guidance',
      '- [ ] Link any related workflows / scripts for traceability',
      '',
      '### Notes',
      '- The [agents.md specification](https://agents.md) standardizes how AI Agents are documented',
      '- Prefer concise descriptions (1–2 sentences) per agent',
      '- Group future agents logically (e.g., provisioning, validation, analysis)',
      '- Flag any permissions that may need security review',
      '- Visit https://agents.md for format details, examples, and best practices',
      '',
      'Generated by Template Doctor request.',
    ].join('\n');

    let created: any;

    // Try GraphQL first (better Copilot assignment support)
    if (gh && typeof gh.createIssueGraphQL === 'function') {
      try {
        // Ensure labels exist before GraphQL call
        if (typeof gh.ensureLabelsExist === 'function') {
          try {
            await gh.ensureLabelsExist(owner, repo, ['template-doctor-agents-compliance']);
          } catch (e) {
            console.warn('[AgentsEnrichment] Label creation warning:', e);
          }
        }

        const gqlIssue = await gh.createIssueGraphQL(owner, repo, title, body, [
          'template-doctor-agents-compliance',
        ]);
        created = {
          number: gqlIssue.number,
          html_url: gqlIssue.url,
          title: gqlIssue.title,
        };
        notify.showSuccess(
          'Issue Created!',
          `Created issue #${created.number} with Copilot assignment. <a href="${created.html_url}" target="_blank">View issue</a>`,
          8000,
        );
      } catch (gqlErr: any) {
        console.warn('[AgentsEnrichment] GraphQL failed, trying REST:', gqlErr.message);
      }
    }

    // Fallback to REST API
    if (!created) {
      const token = gh.auth.getToken();
      if (!token) {
        notify.showError('Error', 'GitHub token not available', 6000);
        return false;
      }

      try {
        // Try with Copilot assignee first
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            assignees: ['copilot-agent-swe'],
            labels: ['template-doctor-agents-compliance'],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        created = await response.json();
        notify.showSuccess(
          'Issue Created!',
          `Created issue #${created.number} (REST). <a href="${created.html_url}" target="_blank">View issue</a>`,
          8000,
        );
      } catch (assignErr: any) {
        console.warn(
          '[AgentsEnrichment] REST with assignee failed, retrying simplified:',
          assignErr.message,
        );

        // Retry without assignee
        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              body,
              labels: ['template-doctor-agents-compliance'],
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          created = await response.json();
          notify.showSuccess(
            'Issue Created!',
            `Created issue #${created.number}. <a href="${created.html_url}" target="_blank">View issue</a>`,
            8000,
          );
        } catch (labelErr: any) {
          console.warn('[AgentsEnrichment] Retry without label:', labelErr.message);

          // Final fallback - no labels
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, body }),
          });

          if (!response.ok) {
            let errorMessage = `Failed to create issue in ${owner}/${repo}: HTTP ${response.status}`;
            try {
              const errorData = await response.json();
              const apiError = errorData.message || errorData.error || '';
              if (apiError) {
                errorMessage = `Failed to create issue in ${owner}/${repo}: ${apiError}`;
              }
            } catch (parseErr) {
              // Failed to parse error JSON, use status code
            }
            throw new Error(errorMessage);
          }

          created = await response.json();
          notify.showSuccess(
            'Issue Created!',
            `Created issue #${created.number}. <a href="${created.html_url}" target="_blank">View issue</a>`,
            8000,
          );
        }
      }
    }

    // Update UI after successful creation
    if (created) {
      const issueEl = document.querySelector('li.issue-item.agents-missing') as HTMLElement;
      if (issueEl) {
        const actions = issueEl.querySelector('.item-actions');
        if (actions) {
          actions.innerHTML = `<a href="${created.html_url}" target="_blank" class="item-link"><i class='fab fa-github'></i> View Issue #${created.number}</a>`;
        }
        const titleEl = issueEl.querySelector('.item-title');
        if (titleEl) titleEl.textContent = 'agents.md issue created';
        issueEl.style.borderLeftColor = '#ff9800';
      }

      const tileBtn = document.querySelector(
        '.category-breakdown .tile[data-category="agents"] .agents-action button',
      ) as HTMLButtonElement;
      if (tileBtn) {
        tileBtn.textContent = 'Merge it and rescan';
        tileBtn.onclick = () => {
          window.open(created.html_url, '_blank');
        };
        tileBtn.style.background = '#ff9800';
        tileBtn.style.borderColor = '#ff9800';
      }
    }

    return false;
  } catch (error: any) {
    console.error('[AgentsEnrichment] Issue creation error:', error);

    // Extract meaningful error message
    let errorMsg = 'Unknown error occurred';
    if (error?.message) {
      errorMsg = error.message;
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (error?.toString && error.toString() !== '[object Object]') {
      errorMsg = error.toString();
    }

    // Use the beautiful NotificationSystem!
    const realNotify = (window as any).NotificationSystem;
    if (realNotify && typeof realNotify.showError === 'function') {
      realNotify.showError('Failed to Create Issue', errorMsg, 8000);
    }

    return false;
  }
};

export {};
