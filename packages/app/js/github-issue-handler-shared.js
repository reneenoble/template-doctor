// Shared GitHub Issue Handler for Template Doctor
// Consolidated to avoid duplicating a copy inside every results folder.
// Existing result dashboard pages can be updated to reference this file instead of a per-folder version.

(function(){
  async function createGitHubIssue(url, data, onSuccess, onError) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch(_) {}
        const status = response.status;
        const code = errorData.code;
        const message = errorData.message || errorData.error || `HTTP ${status}`;
        const issuesDisabled = (status === 403 || status === 410) && (code === 'ISSUES_DISABLED' || /issues are disabled/i.test(message));
        if (issuesDisabled) {
          const docUrl = errorData.documentation_url || 'https://docs.github.com/v3/issues/';
          const html = `\n<div class="error-box">\n  <h4>⚠️ GitHub Issues Disabled (${status})</h4>\n  <p><strong>GitHub message:</strong> ${message}</p>\n  <p>Enable Issues in repository settings under <em>Features</em>, then retry.</p>\n  <p><a href="${data.repoUrl || '#'}" target="_blank">Open Repository</a> • <a href="${docUrl}" target="_blank">Docs</a></p>\n</div>`;
          onError(html, true); return;
        }
        if (status === 500) {
          onError(`<div class='error-box'><h4>⚠️ Server Error (500)</h4><p>${message}</p></div>`, true); return;
        }
        throw new Error(message);
      }
      const json = await response.json();
      onSuccess(json);
    } catch(err) {
      console.error('[SharedIssueHandler] createGitHubIssue failed:', err);
      const html = `\n<div class="error-box">\n  <h4>⚠️ Error Creating GitHub Issue</h4>\n  <p>${err.message}</p>\n  <ul style='margin-top:6px;'>\n    <li>Permissions or missing scope</li>\n    <li>Network or CORS issue</li>\n    <li>API rate limiting</li>\n  </ul>\n</div>`;
      onError(html, true);
    }
  }
  window.templateDoctor = window.templateDoctor || {};
  window.templateDoctor.github = window.templateDoctor.github || {};
  window.templateDoctor.github.createIssue = createGitHubIssue;
})();
