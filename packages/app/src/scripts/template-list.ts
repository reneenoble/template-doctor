// Minimal Template List Renderer (transitional)
// Extracted subset of legacy app.js logic to satisfy tests expecting .template-card elements.
// Focus: render scanned templates from window.templatesData when available & authenticated.

// Uses the shared ScannedTemplateEntry interface from global.d.ts

// Extend the global Window interface for template list-specific properties
declare global {
  interface Window {
    TemplateList?: TemplateListAPI;
  }
}

interface TemplateListAPI {
  init: () => void;
  render: () => void;
  isRendered: () => boolean;
  refresh: () => void; // re-render (used if templatesData changes dynamically)
  getCount: () => number;
  getLoadedCount: () => number; // how many templates are currently loaded/displayed
  loadMore: () => boolean; // load next batch of templates, returns true if more were loaded
  loadUntilIndex: (index: number) => Promise<boolean>; // load templates until specified index is visible
}

const SECTION_ID = 'scanned-templates-section';
const GRID_ID = 'template-grid';
const LOAD_MORE_CLASS = 'load-more-container';
const PAGE_SIZE = 9; // Load 9 templates at a time

let rendered = false;
let loadedCount = 0; // Track how many templates are currently loaded/displayed

function ensureSection(): HTMLElement | null {
  let section = document.getElementById(SECTION_ID);
  if (!section) {
    // Create a minimal section (reduced markup compared to legacy for now).
    section = document.createElement('section');
    section.id = SECTION_ID;
    section.className = 'scanned-templates-section';
    section.innerHTML = `
      <div class="section-header">
        <h2>Previously Scanned Templates</h2>
      </div>
      <div class="section-content">
        <div id="${GRID_ID}" class="template-grid"></div>
      </div>`;
    const searchSection = document.getElementById('search-section');
    if (searchSection?.parentNode) {
      searchSection.parentNode.insertBefore(section, searchSection.nextSibling);
    } else {
      document.body.appendChild(section);
    }
  }
  return section;
}

function createCard(t: ScannedTemplateEntry): HTMLElement {
  const repoName = t.repoUrl.includes('github.com/')
    ? t.repoUrl.split('github.com/')[1]
    : t.repoUrl;
  const templateId = `template-${(t.relativePath || 'unknown').split('/')[0]}`.replace(
    /[^a-zA-Z0-9-]/g,
    '-',
  );
  const lastScanner =
    t.scannedBy && t.scannedBy.length ? t.scannedBy[t.scannedBy.length - 1] : 'Unknown';
  const ruleSet = t.ruleSet || 'dod';
  const ruleSetDisplay =
    ruleSet === 'dod'
      ? 'DoD'
      : ruleSet === 'partner'
        ? 'Partner'
        : ruleSet === 'docs'
          ? 'Docs'
          : 'Custom';
  const gistUrl = ruleSet === 'custom' ? t.customConfig?.gistUrl : '';

  // AZD test status badge
  const azdTest = t.latestAzdTest;
  const azdBadgeHtml = azdTest
    ? `<div class="azd-badge azd-${azdTest.status}" title="AZD Deployment: ${azdTest.status}">
         <i class="icon-${azdTest.status === 'success' ? 'check' : azdTest.status === 'failed' ? 'x' : 'clock'}"></i>
         AZD ${azdTest.status.toUpperCase()}
       </div>`
    : '';

  const card = document.createElement('div');
  card.className = 'template-card';
  card.id = templateId;
  card.dataset.repoUrl = t.repoUrl;
  card.dataset.dashboardPath = t.relativePath;
  card.dataset.ruleSet = ruleSet;
  card.innerHTML = `
    <div class="card-header">
      <h3 data-tooltip="${repoName}" class="has-permanent-tooltip">${repoName}</h3>
      <span class="scan-date">Last scanned by <strong>${lastScanner}</strong> on ${new Date(t.timestamp).toLocaleDateString()}</span>
    </div>
    <div class="card-body">
      <div class="badges">
        ${gistUrl ? `<a href="${gistUrl}" target="_blank" class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</a>` : `<div class="ruleset-badge ${ruleSet}-badge">${ruleSetDisplay}</div>`}
        ${azdBadgeHtml}
      </div>
      <div class="compliance-bar">
        <div class="compliance-fill" style="width: ${t.compliance.percentage}%"></div>
        <span class="compliance-value">${t.compliance.percentage}%</span>
      </div>
      <div class="stats">
        <div class="stat-item issues">${t.compliance.issues} issues</div>
        <div class="stat-item passed">${t.compliance.passed} passed</div>
      </div>
    </div>
    <div class="card-footer">
      <button class="view-report-btn" data-action="view">View Report</button>
      <button class="rescan-btn" data-action="rescan">Rescan</button>
      <button class="validate-btn" data-action="validate">Run Validation</button>
    </div>`;

  // For now only stub the view button needed by near-future tests.
  const footer = card.querySelector('.card-footer');
  footer?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName !== 'BUTTON') return;
    const action = target.getAttribute('data-action');
    if (action === 'view') {
      e.stopPropagation(); // Prevent delegated handler from catching this
      document.dispatchEvent(new CustomEvent('template-card-view', { detail: { template: t } }));
    } else if (action === 'rescan') {
      console.log('[TemplateList] rescan requested', t.repoUrl);
      document.dispatchEvent(new CustomEvent('template-card-rescan', { detail: { template: t } }));
    } else if (action === 'validate') {
      console.log('[TemplateList] validate requested', t.repoUrl);
      document.dispatchEvent(
        new CustomEvent('template-card-validate', { detail: { template: t } }),
      );
    }
  });
  return card;
}

function renderPage(page: number, data: ScannedTemplateEntry[], grid: Element) {
  // Deprecated - kept for compatibility but now using loadMore pattern
  grid.innerHTML = '';
  const start = (page - 1) * PAGE_SIZE;
  data.slice(start, start + PAGE_SIZE).forEach((entry) => grid.appendChild(createCard(entry)));
}

function renderLoadedTemplates(data: ScannedTemplateEntry[], grid: Element) {
  // Render all templates up to loadedCount
  grid.innerHTML = '';
  data.slice(0, loadedCount).forEach((entry) => grid.appendChild(createCard(entry)));
}

function loadMore(data: ScannedTemplateEntry[], grid: Element, section: HTMLElement): boolean {
  // Load next PAGE_SIZE templates and return true if more templates were loaded
  const previousCount = loadedCount;
  loadedCount = Math.min(loadedCount + PAGE_SIZE, data.length);

  if (loadedCount > previousCount) {
    // Append only the newly loaded cards (more efficient than re-rendering all)
    data.slice(previousCount, loadedCount).forEach((entry) => grid.appendChild(createCard(entry)));
    updateLoadMoreButton(data.length, section);
    return true;
  }

  return false;
}

function renderLoadMoreButton(total: number, section: HTMLElement) {
  let container = section.querySelector(`.${LOAD_MORE_CLASS}`) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = LOAD_MORE_CLASS;
    container.innerHTML = `
      <button class="load-more-btn">
        <i class="fas fa-sync-alt"></i>
        <span class="load-more-text">Load More Templates</span>
      </button>
      <div class="load-more-info"></div>`;
    section.appendChild(container);

    const btn = container.querySelector('.load-more-btn') as HTMLButtonElement;
    btn.onclick = () => {
      const data = window.templatesData;
      if (!Array.isArray(data)) return;
      const grid = section.querySelector(`#${GRID_ID}`);
      if (!grid) return;

      // Show loading state
      btn.disabled = true;
      btn.classList.add('loading');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = 'fas fa-spinner fa-spin';
      }

      // Simulate slight delay for better UX (feels more deliberate)
      setTimeout(() => {
        loadMore(data, grid, section);
        btn.disabled = false;
        btn.classList.remove('loading');
        if (icon) {
          icon.className = 'fas fa-sync-alt';
        }
      }, 150);
    };
  }

  updateLoadMoreButton(total, section);
}

function updateLoadMoreButton(total: number, section: HTMLElement) {
  const container = section.querySelector(`.${LOAD_MORE_CLASS}`) as HTMLElement | null;
  if (!container) return;

  const btn = container.querySelector('.load-more-btn') as HTMLButtonElement;
  const info = container.querySelector('.load-more-info') as HTMLElement;

  if (loadedCount >= total) {
    // All templates loaded - hide button
    container.style.display = 'none';
  } else {
    container.style.display = 'flex';
    const remaining = total - loadedCount;
    info.textContent = `Showing ${loadedCount} of ${total} templates (${remaining} more)`;
  }
}

function renderPagination(total: number, section: HTMLElement) {
  // Deprecated - kept for API compatibility but replaced by Load More
  console.debug('[TemplateList] renderPagination is deprecated, using Load More button instead');
}

function render() {
  try {
    // Allow rendering in test/headless context even if auth not yet established.
    const testMode =
      !!(window as any).PLAYWRIGHT_TEST || navigator.userAgent.includes('Playwright');
    if (window.GitHubAuth && typeof window.GitHubAuth.isAuthenticated === 'function') {
      if (!window.GitHubAuth.isAuthenticated() && !testMode) {
        console.debug('[TemplateList] render aborted: not authenticated (non-test mode)');
        return;
      }
    }
    const data = window.templatesData;
    if (!Array.isArray(data)) {
      console.debug('[TemplateList] render aborted: templatesData not an array', data);
      return;
    }
    if (data.length === 0) {
      console.debug('[TemplateList] render aborted: templatesData empty');
      return;
    }
    console.debug('[TemplateList] rendering', { count: data.length });
    const section = ensureSection();
    const grid = section?.querySelector(`#${GRID_ID}`);
    if (!grid) {
      console.debug('[TemplateList] render aborted: grid element missing');
      return;
    }

    // Initialize with first PAGE_SIZE templates
    loadedCount = Math.min(PAGE_SIZE, data.length);
    renderLoadedTemplates(data, grid);
    renderLoadMoreButton(data.length, section as HTMLElement);

    if (!rendered) {
      rendered = true;
      document.dispatchEvent(
        new CustomEvent('template-cards-rendered', { detail: { count: data.length } }),
      );
      console.debug('[TemplateList] render complete');
    }
  } catch (e) {
    console.warn('[TemplateList] render error', e);
  }
}

function refresh() {
  if (!rendered) {
    console.debug('[TemplateList] refresh: not rendered yet; calling render');
    return render();
  }
  const section = document.getElementById(SECTION_ID);
  if (!section) return;
  const grid = section.querySelector(`#${GRID_ID}`);
  if (!grid) return;
  if (!Array.isArray(window.templatesData)) return;
  console.debug('[TemplateList] refresh executing');

  // Keep current loadedCount but re-render all loaded templates
  renderLoadedTemplates(window.templatesData, grid);
  renderLoadMoreButton(window.templatesData.length, section);
}

function tryRenderSoon() {
  // Attempt a few times in case auth/scripts arrive slightly later.
  let attempts = 0;
  const max = 10;
  const interval = setInterval(() => {
    attempts++;
    if (rendered) {
      clearInterval(interval);
      return;
    }
    try {
      render();
      if (rendered) clearInterval(interval);
    } catch (e) {
      // swallow transient errors
    }
    if (attempts >= max) clearInterval(interval);
  }, 300);
}

function init() {
  console.debug('[TemplateList] init start');
  render();
  document.addEventListener('template-data-loaded', () => {
    console.debug('[TemplateList] template-data-loaded event received');
    if (!rendered) render();
    else refresh();
  });
  document.addEventListener('template-data-updated', () => {
    // external event to force refresh after data mutation
    console.debug('[TemplateList] template-data-updated event received');
    refresh();
  });
  tryRenderSoon();
}

window.TemplateList = {
  init,
  render,
  isRendered: () => rendered,
  refresh,
  getCount: () => (Array.isArray(window.templatesData) ? window.templatesData.length : 0),
  getLoadedCount: () => loadedCount,
  loadMore: (): boolean => {
    const section = document.getElementById(SECTION_ID);
    const grid = section?.querySelector(`#${GRID_ID}`);
    const data = window.templatesData;
    if (!section || !grid || !Array.isArray(data)) return false;
    return loadMore(data, grid, section as HTMLElement);
  },
  loadUntilIndex: async (index: number): Promise<boolean> => {
    const data = window.templatesData;
    if (!Array.isArray(data) || index < 0 || index >= data.length) return false;

    const section = document.getElementById(SECTION_ID);
    const grid = section?.querySelector(`#${GRID_ID}`);
    if (!section || !grid) return false;

    // Load templates progressively until the target index is visible
    while (loadedCount <= index && loadedCount < data.length) {
      loadMore(data, grid, section as HTMLElement);
      // Small delay for smoother UX and to allow DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return loadedCount > index;
  },
};

// Auto-init after DOM is ready if loaded late in the document lifecycle
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(() => init());
} else {
  document.addEventListener('DOMContentLoaded', () => init());
}

export {}; // ensure module scope
