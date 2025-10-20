// Temporary minimal error classifier for repo-fork legacy handler.
// Detects SAML/SSO related fork restrictions heuristically.

interface Classification {
  kind: 'saml' | 'generic';
  message: string;
  documentationUrl?: string;
}

export function classifyGitHubForkError(err: any): Classification {
  const status = err?.status;
  const doc = err?.documentation_url || err?.response?.data?.documentation_url;
  const message = err?.message || 'GitHub API error';
  // Heuristic: 403 with message containing SAML or requires SSO.
  if (status === 403 && /saml|sso|single sign-on/i.test(message)) {
    return { kind: 'saml', message, documentationUrl: doc };
  }
  return { kind: 'generic', message, documentationUrl: doc };
}
