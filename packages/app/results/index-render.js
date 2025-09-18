// Renders the Template Doctor index grid once meta data has been loaded & validated.
(function(){
  function log(...a){ console.log('[index-render]', ...a); }

  function gaugeClass(p){ if (p >= 80) return 'high'; if (p >= 50) return 'medium'; return 'low'; }

  function formatDate(ts){ try { const d = new Date(ts); return d.toLocaleDateString()+ ' ' + d.toLocaleTimeString(); } catch(_) { return ts; } }

  function extractRepoName(repoUrl){ const m = repoUrl && repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/); return m ? `${m[1]}/${m[2]}` : repoUrl || 'Unknown'; }

  function render(){
    const container = document.getElementById('templates-container');
    if(!container){ log('No container element'); return; }
    let data = Array.isArray(window.templatesData) ? window.templatesData : [];

    // Debug panel (one-time) if enabled via hash #debug or global flag
    if (!document.getElementById('td-debug-panel') && (location.hash.includes('debug') || window.TemplateDoctorDebug)) {
      const dbg = document.createElement('pre');
      dbg.id = 'td-debug-panel';
      dbg.style.background = '#111';
      dbg.style.color = '#0f0';
      dbg.style.padding = '8px';
      dbg.style.fontSize = '11px';
      dbg.style.maxHeight = '240px';
      dbg.style.overflow = 'auto';
      dbg.textContent = '[debug]\n' + JSON.stringify({
        metaValidated: window.__TD_META_VALIDATED,
        deferred: window.__TEMPLATE_RESULTS_DEFERRED,
        dynamicCount: (window.__TD_DYNAMIC_RESULTS||[]).length,
        templatesCount: data.length,
        keys: data.map(d=>d.repoUrl+"::"+d.dashboardPath)
      }, null, 2);
      container.parentElement.insertBefore(dbg, container);
    }

    if (window.__TEMPLATE_RESULTS_DEFERRED){
      container.innerHTML = `<div class="empty-state"><p>Results hidden until authentication.</p></div>`;
      return;
    }

    if(!data.length){
      container.innerHTML = `<div class="empty-state"><p>No templates have been analyzed yet.</p><p style='margin-top:10px;font-size:.9rem;'>Run <code>template-doctor analyze --repo=&lt;url&gt;</code> to analyze a template.</p></div>`;
      return;
    }

    // Clear existing
    container.innerHTML = '';

    data.forEach(entry => {
      const repoName = extractRepoName(entry.repoUrl);
      const p = entry.compliance && typeof entry.compliance.percentage === 'number' ? entry.compliance.percentage : 0;
      const issues = entry.compliance && (entry.compliance.issues ?? 0);
      const passed = entry.compliance && (entry.compliance.passed ?? 0);
      const ruleSet = entry.ruleSet || 'dod';
      const ruleBadgeText = ruleSet.charAt(0).toUpperCase() + ruleSet.slice(1);
      const ruleClass = `rule-${ruleSet}`;

      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="template-header">
          <div class="template-name">${repoName}</div>
          <div class="template-url" title="${entry.repoUrl}">${entry.repoUrl}</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;">
            <div>Compliance <span class="rule-set-badge ${ruleClass}">${ruleBadgeText}</span>:</div>
            <div><strong>${p}%</strong></div>
          </div>
          <div class="gauge">
            <div class="gauge-fill ${gaugeClass(p)}" style="width:${p}%"></div>
          </div>
        </div>
        <div class="template-stats">
          <div class="stat-item">
            <div class="stat-value">${issues}</div>
            <div class="stat-label">Issues</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${passed}</div>
            <div class="stat-label">Passed</div>
          </div>
        </div>
        <a href="${entry.relativePath}" class="btn"><i class="fas fa-chart-bar"></i> View Report</a>
        <div class="template-timestamp"><i class="far fa-clock"></i> ${formatDate(entry.timestamp)}</div>
      `;
      container.appendChild(card);
    });
    log('Rendered', data.length, 'entries');
  }

  function waitAndRender(attempt=0){
    if (!window.__TD_META_VALIDATED && attempt < 25){
      return setTimeout(()=>waitAndRender(attempt+1), 120);
    }
    if (!window.__TD_META_VALIDATED) {
      log('Validator flag not set after retries; proceeding with raw data.');
    }
    render();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => waitAndRender());
  } else {
    waitAndRender();
  }
})();
