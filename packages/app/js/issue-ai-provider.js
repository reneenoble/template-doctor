(function(){
  // AI enrichment provider controlled via global config (no UI toggle).
  // Enable by setting ISSUE_AI_ENABLED env var (true/1/yes/on) or config.json { "issueAIEnabled": true }.
  if (typeof window === 'undefined') return;

  function isEnabled() {
    const cfg = window.TemplateDoctorConfig || {};
    if (typeof cfg.issueAIEnabled === 'boolean') return cfg.issueAIEnabled;
    if (typeof cfg.ISSUE_AI_ENABLED === 'string') {
      return /^(1|true|yes|on)$/i.test(cfg.ISSUE_AI_ENABLED.trim());
    }
    return false;
  }

  async function enrichIssue(draft, meta, ctx) {
    if (!isEnabled()) return draft;

    try {
      const baseUrl = (window.TemplateDoctorConfig && window.TemplateDoctorConfig.apiBase) || window.location.origin;
      const url = `${baseUrl.replace(/\/$/, '')}/api/issue-ai`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: meta.ruleId,
          severity: meta.severity,
          message: draft.title || '(untitled)',
          draftTitle: draft.title,
          draftBody: draft.body,
        }),
      });
      if (!res.ok) {
        console.warn('[IssueAIProvider] backend returned non-OK', res.status);
        return draft;
      }
      const json = await res.json();
      if (json && json.body) {
        return { title: json.title || draft.title, body: json.body };
      }
    } catch (e) {
      console.warn('[IssueAIProvider] enrichment failed', e);
    }
    return draft;
  }

  window.CustomIssueAIProvider = enrichIssue;
})();
