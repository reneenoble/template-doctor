// Dashboard render patch (Phase 3c)
// If TemplateDoctorConfig.useTsDashboardParts is true, override overview & category sections
// using extracted TS functions renderOverview / renderCategoryBreakdown.

(function () {
  function enabled() {
    try {
      return !!(window as any).TemplateDoctorConfig?.useTsDashboardParts;
    } catch (_) {
      return false;
    }
  }
  if (!enabled()) return; // do nothing unless flag set

  if (!(window as any).DashboardRenderer || !(window as any).__TD_renderOverview) {
    console.warn('[dashboard-patch] Required globals missing; skipping replacement');
    return;
  }

  const original = (window as any).DashboardRenderer;
  if (typeof original.render !== 'function') {
    return;
  }

  const renderOverview = (window as any).__TD_renderOverview;

  (window as any).DashboardRenderer.render = function (result: any, container: HTMLElement) {
    // Use original adaptation & safety nets by invoking the original first for non-overview parts
    try {
      // We'll capture original render but stop it from building overview by temporarily monkey patching methods if needed.
      // Simpler: run original, then surgically replace the overview section DOM.
      original.render.call(this, result, container);
    } catch (e) {
      console.error('[dashboard-patch] original render failed', e);
    }

    try {
      // Locate existing overview section
      const existing = container.querySelector('section.overview');
      if (existing) {
        existing.remove();
      }
      // Adapted data is stored on window.reportData by legacy renderer; use that.
      const adapted = (window as any).reportData || result;
      const frag = renderOverview(adapted);
      // Insert at top before other sections (action header is first child) after action header + debug block
      const insertionPoint = container.querySelector('.debug-section');
      if (insertionPoint && insertionPoint.parentElement) {
        insertionPoint.parentElement.insertBefore(frag, insertionPoint.nextSibling);
      } else {
        container.prepend(frag);
      }
      console.debug('[dashboard-patch] Replaced overview with TS component');
    } catch (e) {
      console.error('[dashboard-patch] overview replacement failed', e);
    }
  };
})();
