// Listens for `template-card-rescan` events (dispatched by template-list.ts) and opens the ruleset modal
// The modal's "Analyze Template" button will trigger the actual analysis

// Uses the shared ScannedTemplateEntry interface from global.d.ts

/**
 * Handles template rescan requests by opening the ruleset selection modal.
 * Does NOT trigger analysis directly - that happens when user clicks "Analyze Template" in the modal.
 */
function handleTemplateCardRescan(event: CustomEvent) {
  const tmpl = event.detail?.template as ScannedTemplateEntry | undefined;
  if (!tmpl || !tmpl.repoUrl) {
    console.warn('[template-card-rescan-handler] Missing template or repoUrl in event');
    return;
  }

  const repoUrl = tmpl.repoUrl;
  console.log('[template-card-rescan-handler] Opening modal for:', repoUrl);

  // Directly show the ruleset modal - analysis will be triggered from modal's "Analyze Template" button
  if (typeof (window as any).showRulesetModal === 'function') {
    (window as any).showRulesetModal(repoUrl);
  } else {
    console.error('[template-card-rescan-handler] showRulesetModal not available');
    if ((window as any).NotificationSystem?.showError) {
      (window as any).NotificationSystem.showError(
        'Rescan Failed',
        'Modal system not ready. Please refresh the page and try again.',
        5000,
      );
    }
  }
}

// Register the event listener
document.addEventListener('template-card-rescan', handleTemplateCardRescan as EventListener);

console.debug('[TemplateDoctor] template-card-rescan-handler initialized');
