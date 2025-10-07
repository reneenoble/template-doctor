// Category breakdown extraction (Phase 3a)
// Returns a DocumentFragment containing the category tiles section.
// Safe to call multiple times; caller responsible for insertion.

export interface CategoryInfo {
  enabled?: boolean;
  issues?: any[];
  compliant?: any[];
  percentage?: number;
}

export interface CategoriesShape {
  [key: string]: CategoryInfo;
}

const CATEGORY_MAP: { key: string; label: string; icon: string }[] = [
  { key: 'repositoryManagement', label: 'Repository Management', icon: 'fa-folder' },
  { key: 'functionalRequirements', label: 'Functional Requirements', icon: 'fa-tasks' },
  { key: 'deployment', label: 'Deployment', icon: 'fa-cloud-upload-alt' },
  { key: 'security', label: 'Security', icon: 'fa-shield-alt' },
  { key: 'testing', label: 'Testing', icon: 'fa-vial' },
  { key: 'agents', label: 'Agents', icon: 'fa-robot' },
];

export function renderCategoryBreakdown(categories: CategoriesShape | undefined): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!categories || typeof categories !== 'object') return frag;

  const section = document.createElement('div');
  section.className = 'category-breakdown';
  section.style.cssText = 'margin-top: 20px;';

  const tilesHtml = CATEGORY_MAP.map(({ key, label, icon }) => {
    const c = categories[key] || { enabled: false, issues: [], compliant: [], percentage: 0 };
    const total = (c.issues?.length || 0) + (c.compliant?.length || 0);
    const pct =
      typeof c.percentage === 'number'
        ? c.percentage
        : total > 0
          ? Math.round(((c.compliant?.length || 0) / total) * 100)
          : 0;
    const enabledBadge = c.enabled
      ? '<span class="badge" style="background:#28a745; color:#fff; padding:2px 6px; border-radius:10px; font-size: 0.75rem;">Enabled</span>'
      : '<span class="badge" style="background:#6c757d; color:#fff; padding:2px 6px; border-radius:10px; font-size: 0.75rem;">Disabled</span>';
    return `
      <div class="tile" data-category="${key}" style="min-width: 200px;">
        <div class="tile-header" style="display:flex; align-items:center; gap:8px; justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fas ${icon}"></i>
            <div class="tile-title">${label}</div>
          </div>
          ${enabledBadge}
        </div>
        <div class="tile-value">${pct}%</div>
        <div class="tile-title" style="opacity:0.8;">${c.compliant?.length || 0} passed • ${c.issues?.length || 0} issues</div>
      </div>`;
  }).join('');

  section.innerHTML = `
    <h3 style="margin: 16px 0 8px;">By Category</h3>
    <div class="overview-tiles">${tilesHtml}</div>
  `;
  frag.appendChild(section);
  return frag;
}

// Provide optional global to allow legacy renderer patching without import wiring.
if (!(window as any).__TD_renderCategoryBreakdown) {
  (window as any).__TD_renderCategoryBreakdown = renderCategoryBreakdown;
}
