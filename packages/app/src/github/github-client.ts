// TypeScript migration of github-client-new.js (transitional) now with typings.
// Preserves global window.GitHubClient expectation while adding safer method signatures.

interface GitHubAuthLike {
  isAuthenticated: () => boolean;
  getAccessToken?: () => string | null | undefined;
  getUsername?: () => string | null | undefined;
}

interface GitHubUser {
  login: string;
  [k: string]: any;
}
interface GitHubRepo {
  default_branch?: string;
  [k: string]: any;
}

type RestOptions = RequestInit & {
  suppressNotFoundLog?: boolean;
  headers?: Record<string, string>;
};

class GitHubApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

class GitHubClient {
  baseUrl: string;
  graphQLUrl: string;
  auth: GitHubAuthLike | undefined;
  currentUser: GitHubUser | null;
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.graphQLUrl = 'https://api.github.com/graphql';
    this.auth = (window as any).GitHubAuth;
    this.currentUser = null;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeAfterAuth());
    } else {
      this.initializeAfterAuth();
    }
  }
  initializeAfterAuth(): void {
    if (!this.auth) {
      this.auth = (window as any).GitHubAuth;
      if (!this.auth) {
        setTimeout(() => this.initializeAfterAuth(), 500);
        return;
      }
    }
    this.loadCurrentUser().then(() => {
      this.checkTokenScopes().catch(() => {});
    });
  }
  async loadCurrentUser(): Promise<void> {
    if (this.auth && this.auth.isAuthenticated()) {
      try {
        this.currentUser = await this.getAuthenticatedUser();
      } catch (_) {}
    }
  }
  async request<T = any>(path: string, options: RestOptions = {}): Promise<T> {
    const token = this.auth?.getAccessToken?.();
    if (!token) throw new Error('Not authenticated');
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      ...(options.headers || {}),
    };
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      let data = {};
      try {
        data = await resp.json();
      } catch (_) {}
      const msg =
        data && typeof data === 'object' && 'message' in data ? (data as any).message : undefined;
      throw new GitHubApiError(msg || `GitHub API error: ${resp.status}`, resp.status, data);
    }
    return resp.json() as Promise<T>;
  }
  async requestAllPages<T = any>(path: string, options: RestOptions = {}): Promise<T[] | T> {
    const token = this.auth?.getAccessToken?.();
    if (!token) return [];
    const base = path.startsWith('http') ? '' : this.baseUrl;
    let nextUrl: string | null = `${base}${path}`;
    const results: T[] = [];
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      ...(options.headers || {}),
    };
    const getNext = (link: string | null) => {
      if (!link) return null;
      for (const part of link.split(',')) {
        const m = part.trim().match(/<([^>]+)>; rel="([^"]+)"/);
        if (m && m[2] === 'next') return m[1];
      }
      return null;
    };
    while (nextUrl) {
      const r = await fetch(nextUrl, { ...options, headers });
      if (!r.ok) break;
      const data = await r.json();
      if (Array.isArray(data)) results.push(...(data as T[]));
      else if (results.length === 0) return data as T;
      const link = r.headers.get('Link');
      nextUrl = getNext(link);
    }
    return results as T[];
  }
  async graphql<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const token = this.auth?.getAccessToken?.();
    if (!token) throw new Error('Not authenticated');
    const resp = await fetch(this.graphQLUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `token ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    const json = await resp.json();
    if (json.errors) {
      const e = new GitHubApiError(json.errors[0].message || 'GraphQL Error', 400, json.errors);
      throw e;
    }
    return json.data as T;
  }
  getCurrentUsername(): string | null {
    try {
      if (this.auth?.getUsername) {
        const u = this.auth.getUsername();
        if (u) return u;
      }
    } catch (_) {}
    return this.currentUser?.login || null;
  }
  async getAuthenticatedUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }
  async checkTokenScopes(): Promise<string[]> {
    const token = this.auth?.getAccessToken?.();
    if (!token) return [];
    const r = await fetch(`${this.baseUrl}/user`, { headers: { Authorization: `token ${token}` } });
    const hdr = r.headers.get('X-OAuth-Scopes');
    return hdr ? hdr.split(',').map((s) => s.trim()) : [];
  }
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  /**
   * Simple fork creation - just POST to /repos/{owner}/{repo}/forks
   * This works even with SAML/SSO orgs because you're creating in YOUR namespace
   * Requires public_repo or repo scope, no SSO authorization needed
   * NO metadata reads - just fork and return
   */
  async forkRepository(owner: string, repo: string): Promise<any> {
    console.log(`[GitHubClient] Forking ${owner}/${repo}...`);
    const result = await this.request(`/repos/${owner}/${repo}/forks`, { method: 'POST' });
    console.log(`[GitHubClient] Fork initiated`);
    // Don't poll or read metadata - just return the result
    return result;
  }

  async ensureAccessibleRepo(
    owner: string,
    repo: string,
    { forceFork = false }: { forceFork?: boolean } = {},
  ) {
    const currentUsername = this.getCurrentUsername();
    if (!currentUsername) throw new Error('Not authenticated');
    const namesEq =
      owner && currentUsername && owner.toLowerCase() === currentUsername.toLowerCase();
    const getUserRepo = () =>
      this.request<GitHubRepo>(`/repos/${currentUsername}/${repo}`, {
        suppressNotFoundLog: true,
      }).catch((e) => {
        if (e instanceof GitHubApiError && e.status === 404) return null;
        throw e;
      });
    if (namesEq && !forceFork) {
      const selfRepo = await getUserRepo();
      if (!selfRepo) throw new Error('Repository not found under current user');
      return { repo: selfRepo, source: 'self' };
    }
    let forkMeta = await getUserRepo();
    const existingFork = !!forkMeta;
    if (!forkMeta) {
      try {
        await this.request(`/repos/${owner}/${repo}/forks`, { method: 'POST' });
      } catch (e) {
        throw e;
      }
      for (let i = 0; i < 14; i++) {
        await new Promise((r) => setTimeout(r, 1100 + i * 250));
        forkMeta = await getUserRepo();
        if (forkMeta) break;
      }
    }
    if (!forkMeta) throw new Error('Fork did not become available in time');
    return { repo: forkMeta, source: 'fork' };
  }
  getDefaultBranchFromMeta(meta: GitHubRepo) {
    return meta?.default_branch || 'main';
  }
  async listAllFiles(owner: string, repo: string, ref = 'HEAD'): Promise<string[]> {
    const r: any = await this.request(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
    return (r.tree || []).filter((t: any) => t.type === 'blob').map((t: any) => t.path);
  }
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = [],
  ) {
    return this.request(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  /* --- Added parity methods for issue creation & labels (GraphQL path) --- */
  async createIssueWithoutCopilot(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = [],
  ) {
    const created: any = await this.createIssue(owner, repo, title, body, labels);
    return {
      id: created.node_id || created.id,
      number: created.number,
      url: created.html_url,
      title: created.title,
    };
  }
  async ensureLabelsExist(owner: string, repo: string, labels: string[] = []) {
    if (!labels || !labels.length) return;
    let existing: any[] = [];
    try {
      const res: any = await this.requestAllPages(`/repos/${owner}/${repo}/labels?per_page=100`);
      existing = Array.isArray(res) ? res : [];
    } catch (e: any) {
      console.warn('[GitHubClient] ensureLabelsExist list failed', e?.message || e);
      return;
    }
    const have = new Set(existing.map((l) => l.name));
    const toCreate = Array.from(new Set(labels.filter((l) => !have.has(l))));
    if (!toCreate.length) return;
    const colorFor = (name: string) =>
      name.startsWith('severity:')
        ? name.endsWith('high')
          ? 'd73a4a'
          : name.endsWith('medium')
            ? 'fbca04'
            : name.endsWith('low')
              ? '0e8a16'
              : 'c5def5'
        : name.startsWith('ruleset:')
          ? '0366d6'
          : name.includes('template-doctor')
            ? '5319e7'
            : 'c5def5';
    await Promise.allSettled(
      toCreate.map((lbl) =>
        this.request(`/repos/${owner}/${repo}/labels`, {
          method: 'POST',
          body: JSON.stringify({ name: lbl, color: colorFor(lbl), description: lbl }),
          headers: { 'Content-Type': 'application/json' },
        }).catch((err) => {
          console.warn('[GitHubClient] label create failed', lbl, err?.message || err);
        }),
      ),
    );
  }
  async getRepoNodeId(owner: string, name: string): Promise<string> {
    const q = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id } }`;
    const d: any = await this.graphql(q, { owner, name });
    return d.repository.id;
  }
  async getLabelNodeIds(owner: string, name: string, labelNames: string[]): Promise<string[]> {
    if (!labelNames || !labelNames.length) return [];
    const q = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ labels(first:100){ nodes { id name } } } }`;
    const d: any = await this.graphql(q, { owner, name });
    const all = d.repository.labels.nodes;
    return labelNames
      .map((l) => {
        const f = all.find((n: any) => n.name === l);
        return f ? f.id : null;
      })
      .filter(Boolean);
  }
  async assignIssueToCopilotBot(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<boolean> {
    try {
      const data: any = await this.graphql(
        `query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ issue(number:$number){ id } suggestedActors(capabilities:[CAN_BE_ASSIGNED],first:10){ nodes { login ... on Bot { id } ... on User { id } } } } }`,
        { owner, repo, number: issueNumber },
      );
      const issueId = data.repository.issue.id;
      const copilot = (data.repository.suggestedActors.nodes || []).find(
        (a: any) => a.login === 'copilot-agent-swe' || a.login === 'copilot-swe-agent',
      );
      if (!copilot) return false;
      await this.graphql(
        `mutation($issueId:ID!,$assigneeId:ID!){ addAssigneesToAssignable(input:{assignableId:$issueId,assigneeIds:[$assigneeId]}){ clientMutationId } }`,
        { issueId, assigneeId: copilot.id },
      );
      return true;
    } catch (e) {
      console.warn('[GitHubClient] assignIssueToCopilotBot failed', (e as any)?.message || e);
      return false;
    }
  }
  async createIssueGraphQL(...args: any[]): Promise<any> {
    // Accept both createIssueGraphQL(owner, repo, title, body, labels?) and object form
    let owner: string, repo: string, title: string, body: string, labels: string[] | undefined;
    if (args.length === 1 && typeof args[0] === 'object') {
      const o = args[0];
      owner = o.owner;
      repo = o.repo;
      title = o.title;
      body = o.body;
      labels = o.labels;
    } else {
      [owner, repo, title, body, labels] = args as [string, string, string, string, string[]];
    }
    const scopes = await this.checkTokenScopes();
    if (!scopes.includes('public_repo') && !scopes.includes('repo'))
      throw new Error('GitHub token missing public_repo scope');
    let repoId: string;
    try {
      repoId = await this.getRepoNodeId(owner, repo);
    } catch {
      throw new Error(`Could not resolve repository ${owner}/${repo}`);
    }
    let labelIds: string[] = [];
    try {
      labelIds = await this.getLabelNodeIds(owner, repo, labels || []);
    } catch {
      /* ignore */
    }
    // Attempt to find copilot suggested actor
    let copilot: any = null;
    try {
      const r: any = await this.graphql(
        `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ suggestedActors(capabilities:[CAN_BE_ASSIGNED],first:10){ nodes { login ... on Bot { id } ... on User { id } } } } }`,
        { owner, name: repo },
      );
      copilot = r.repository.suggestedActors.nodes.find(
        (n: any) => n.login === 'copilot-agent-swe' || n.login === 'copilot-swe-agent',
      );
    } catch {
      /* non-fatal */
    }
    const start = Date.now();
    let mutation: string;
    let variables: any;
    if (copilot) {
      mutation = `mutation($input:CreateIssueInput!){ createIssue(input:$input){ issue { id number url title } } }`;
      variables = {
        input: { repositoryId: repoId, title, body, assigneeIds: [copilot.id], labelIds },
      };
    } else {
      mutation = `mutation($repositoryId:ID!,$title:String!,$body:String,$labelIds:[ID!]){ createIssue(input:{repositoryId:$repositoryId,title:$title,body:$body,labelIds:$labelIds}){ issue { id number url title } } }`;
      variables = { repositoryId: repoId, title, body, labelIds };
    }
    const data: any = await this.graphql(mutation, variables);
    const issue = data.createIssue.issue;
    (issue as any).issueNodeId = issue.id; // add alias expected by callers
    issue.elapsedMs = Date.now() - start;
    if (!copilot) {
      // best-effort post assignment
      try {
        await this.assignIssueToCopilotBot(owner, repo, issue.number);
      } catch {
        /* ignore */
      }
    }
    return issue;
  }
}

const githubClient = new GitHubClient();
(window as any).GitHubClient = githubClient;
export { githubClient };
