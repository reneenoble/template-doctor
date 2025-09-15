// Docs Validation Badge Module
// Provides: animated badge, invocation count, modal diagnostics, externalized for caching.
(function(){
  const STORAGE_KEY = 'docsValidationState';
  const STATE = {
    count: 0,
    lastDetail: null,
    initialized: false,
    modalOpen: false,
  };

  function ensureStyles(){
    if(document.getElementById('docs-validation-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'docs-validation-badge-styles';
    style.textContent = `
      #docs-validation-badge { display:flex; align-items:center; gap:6px; margin-left:24px; font-size:12px; font-weight:500; font-family:Inter,system-ui,sans-serif; }
      .docs-val-pill { background:#215cca; color:#fff; padding:4px 10px 4px 10px; border-radius:16px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.16); cursor:pointer; position:relative; overflow:hidden; }
      .docs-val-pill .count { background:rgba(255,255,255,0.18); padding:2px 6px; border-radius:10px; font-size:11px; font-weight:600; }
      .docs-val-pill.fade-in { animation: dval-fade 420ms ease; }
      .docs-val-pill.pulse { animation: dval-pulse 900ms ease; }
      @keyframes dval-fade { from {opacity:0; transform:translateY(-4px);} to {opacity:1; transform:translateY(0);} }
      @keyframes dval-pulse { 0% { box-shadow:0 0 0 0 rgba(33,92,202,0.6);} 70% { box-shadow:0 0 0 12px rgba(33,92,202,0);} 100% { box-shadow:0 0 0 0 rgba(33,92,202,0);} }
      /* Modal */
      #docs-validation-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:flex-start; justify-content:center; padding-top:8vh; z-index:9999; animation:dval-fade 180ms ease; }
      #docs-validation-modal { background:#fff; width:520px; max-width:90%; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.18); font-family:Inter,system-ui,sans-serif; display:flex; flex-direction:column; overflow:hidden; }
      #docs-validation-modal header { padding:16px 20px 12px; border-bottom:1px solid #e2e5ea; display:flex; align-items:center; justify-content:space-between; }
      #docs-validation-modal header h3 { margin:0; font-size:16px; font-weight:600; display:flex; align-items:center; gap:8px; }
      #docs-validation-modal header button { background:transparent; border:none; font-size:18px; cursor:pointer; color:#5a6270; }
      #docs-validation-modal header button:hover { color:#222; }
      #docs-validation-modal .content { padding:16px 20px 24px; max-height:60vh; overflow:auto; }
      #docs-validation-modal .kv { font-family:SFMono-Regular,Consolas,monospace; font-size:12px; background:#f6f8fa; border:1px solid #e2e5ea; padding:8px 10px; border-radius:6px; line-height:1.4; }
      #docs-validation-modal .meta-grid { display:grid; grid-template-columns:120px 1fr; gap:6px 14px; align-items:flex-start; margin:12px 0 18px; }
      #docs-validation-modal .meta-grid div.label { font-weight:600; font-size:12px; color:#33415c; text-transform:uppercase; letter-spacing:0.5px; }
      #docs-validation-modal .actions { display:flex; justify-content:space-between; gap:12px; margin-top:4px; }
      #docs-validation-modal .actions button { flex:1; border:none; border-radius:6px; padding:10px 14px; font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; justify-content:center; }
      #docs-validation-modal .actions button.export { background:#215cca; color:#fff; }
      #docs-validation-modal .actions button.export:hover { background:#194b9f; }
      #docs-validation-modal .actions button.close { background:#e2e5ea; color:#222; }
      #docs-validation-modal .actions button.close:hover { background:#d2d5d9; }
      #docs-validation-modal footer { padding:12px 20px 18px; border-top:1px solid #e2e5ea; font-size:11px; color:#5a6270; display:flex; justify-content:space-between; align-items:center; }
      #docs-validation-modal .badge { background:#215cca; color:#fff; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
    `;
    document.head.appendChild(style);
  }

  function ensureContainer(){
    let bar = document.getElementById('docs-validation-badge');
    if(bar) return bar;
    const headerContent = document.querySelector('.header-content');
    if(!headerContent) return null;
    bar = document.createElement('div');
    bar.id = 'docs-validation-badge';
    headerContent.appendChild(bar);
    return bar;
  }

  function persistState(){
    try {
      const payload = { count: STATE.count, lastDetail: STATE.lastDetail };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch(e) { /* non-fatal */ }
  }

  function renderBadge(detail, opts){
    opts = opts || {};
    ensureStyles();
    const container = ensureContainer();
    if(!container) return;
    if(opts.isRestore){
      // Do not increment count; assume STATE already reflects persisted values
      STATE.lastDetail = detail || STATE.lastDetail;
    } else {
      STATE.count += 1;
      STATE.lastDetail = detail;
    }
    container.innerHTML = '';
    const pill = document.createElement('span');
    pill.className = 'docs-val-pill fade-in pulse';
    pill.setAttribute('role','button');
    pill.setAttribute('tabindex','0');
    pill.title = 'Click for diagnostics';
    const icon = document.createElement('i');
    icon.className = 'fas fa-book';
    const text = document.createElement('span');
  const ts = (STATE.lastDetail && STATE.lastDetail.ts) ? new Date(STATE.lastDetail.ts).toLocaleTimeString() : '—';
  // If restored, mark as restored until next run
  const prefix = opts.isRestore ? 'Restored docs validation' : 'Docs validation';
  text.textContent = `${prefix} #${STATE.count} · ${ts}`;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `#${STATE.count}`;
    pill.appendChild(icon);
    pill.appendChild(text);
    pill.appendChild(count);
    container.appendChild(pill);
    // Remove pulse after animation
    setTimeout(()=>pill.classList.remove('pulse'), 1200);
    pill.addEventListener('click', openModal);
    pill.addEventListener('keypress', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); openModal(); }});
    if(!opts.isRestore) {
      persistState();
    }
  }

  function openModal(){
    if(STATE.modalOpen) return;
    STATE.modalOpen = true;
    ensureStyles();
    const backdrop = document.createElement('div');
    backdrop.id = 'docs-validation-modal-backdrop';

    const modal = document.createElement('div');
    modal.id = 'docs-validation-modal';

    const header = document.createElement('header');
    const h3 = document.createElement('h3');
    const icon = document.createElement('i');
    icon.className = 'fas fa-book';
    h3.appendChild(icon);
    const titleTxt = document.createElement('span');
    titleTxt.textContent = 'Docs Validation Diagnostics';
    h3.appendChild(titleTxt);
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(h3);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'content';

    const meta = STATE.lastDetail || {};
    const metaGrid = document.createElement('div');
    metaGrid.className = 'meta-grid';
    function row(label, value){
      const l = document.createElement('div'); l.className='label'; l.textContent = label; const v = document.createElement('div'); v.textContent = value || '—'; metaGrid.appendChild(l); metaGrid.appendChild(v); }
    row('Owner', meta.owner);
    row('Repo', meta.repo);
    row('Default Branch', meta.defaultBranch);
    row('Timestamp', meta.ts ? new Date(meta.ts).toLocaleString() : '—');
    row('Invocation #', STATE.count);

    const rawBlock = document.createElement('pre');
    rawBlock.className = 'kv';
    rawBlock.textContent = JSON.stringify({ count: STATE.count, lastDetail: meta }, null, 2);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'export';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Export JSON';
    exportBtn.addEventListener('click', ()=>{
      try {
        const blob = new Blob([JSON.stringify({ count: STATE.count, lastDetail: meta }, null, 2)], { type:'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'docs-validation-diagnostics.json';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch(err){ console.error('Export failed', err); }
    });

    const closeAction = document.createElement('button');
    closeAction.className = 'close';
    closeAction.innerHTML = '<i class="fas fa-times"></i> Close';
    closeAction.addEventListener('click', closeModal);

    actions.appendChild(exportBtn);
    actions.appendChild(closeAction);

    content.appendChild(metaGrid);
    content.appendChild(rawBlock);
    content.appendChild(actions);

    const footer = document.createElement('footer');
    const left = document.createElement('div');
    left.innerHTML = `<span class="badge">Runs: ${STATE.count}</span>`;
    const right = document.createElement('div');
    right.textContent = 'Template Doctor';
    footer.appendChild(left);
    footer.appendChild(right);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener('click', (e)=>{ if(e.target === backdrop) closeModal(); });
    // Esc key
    document.addEventListener('keydown', escListener);
  }

  function escListener(e){ if(e.key === 'Escape') closeModal(); }

  function closeModal(){
    if(!STATE.modalOpen) return;
    const backdrop = document.getElementById('docs-validation-modal-backdrop');
    if(backdrop){ backdrop.remove(); }
    STATE.modalOpen = false;
    document.removeEventListener('keydown', escListener);
  }

  function init(){
    if(STATE.initialized) return;
    STATE.initialized = true;
    // If docs validation already ran before this module loaded, reflect state
    // Restore from sessionStorage if available
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if(stored){
        const parsed = JSON.parse(stored);
        if(parsed && typeof parsed === 'object'){
          if(Number.isFinite(parsed.count)) STATE.count = parsed.count;
          if(parsed.lastDetail) STATE.lastDetail = parsed.lastDetail;
          if(STATE.lastDetail){
            renderBadge(STATE.lastDetail, { isRestore: true });
          }
        }
      } else if(window.__TemplateDoctorLastDocsValidation){
        // Fallback to legacy global if present (first session after upgrade)
        STATE.count = 1; // assume at least one run
        renderBadge(window.__TemplateDoctorLastDocsValidation, { isRestore: true });
        persistState();
      }
    } catch(e){ /* ignore */ }
  }

  document.addEventListener('template-doctor-docs-validation', (e)=>{
    try { renderBadge(e.detail || {}); } catch(err){ console.warn('[docs-badge] render failed', err);} 
  });

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();