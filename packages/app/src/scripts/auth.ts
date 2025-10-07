// Migrated from js/auth.js (behavior preserved) with TypeScript typings added
import { buildApiUrl, API_ENDPOINTS } from './api-constants.js';

interface AuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
  tokenStorageKey: string;
  userStorageKey: string;
}

interface StoredUserInfo {
  login: string;
  name: string;
  avatarUrl: string;
}

interface TokenExchangeResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  [k: string]: any;
}

function isTokenExchangeResponse(obj: any): obj is TokenExchangeResponse {
  return obj && typeof obj === 'object';
}

function debug(module: string, message: string, ...data: unknown[]) {
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}][${module}] ${message}`, ...data);
}

function getBasePath(): string {
  const pathname = window.location.pathname || '/';
  const withoutFile = pathname.match(/\.[a-zA-Z0-9]+$/)
    ? pathname.substring(0, pathname.lastIndexOf('/'))
    : pathname;
  if (withoutFile === '/') return '';
  return withoutFile.endsWith('/') ? withoutFile.slice(0, -1) : withoutFile;
}
const AUTH_CONFIG: AuthConfig = {
  clientId: '',
  redirectUri: window.location.origin + getBasePath() + '/callback.html',
  scope: 'public_repo read:user',
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenStorageKey: 'gh_access_token',
  userStorageKey: 'gh_user_info',
};
console.log('AUTH_CONFIG.redirectUri:', AUTH_CONFIG.redirectUri);
console.log('window.location.origin:', window.location.origin);
console.log('getBasePath():', getBasePath());
async function loadRuntimeAuthConfig(): Promise<void> {
  try {
    if ((window as any).ConfigLoader && (window as any).ConfigLoader.loadConfig) {
      const config = await (window as any).ConfigLoader.loadConfig();
      if (config.githubOAuth) {
        if (config.githubOAuth.clientId) AUTH_CONFIG.clientId = config.githubOAuth.clientId;
        if (config.githubOAuth.scope) AUTH_CONFIG.scope = config.githubOAuth.scope;
        if (config.githubOAuth.authUrl) AUTH_CONFIG.authUrl = config.githubOAuth.authUrl;
        if (config.githubOAuth.redirectUri && config.githubOAuth.redirectUri.trim() !== '')
          AUTH_CONFIG.redirectUri = config.githubOAuth.redirectUri;
      }
      if (config.GITHUB_CLIENT_ID) AUTH_CONFIG.clientId = config.GITHUB_CLIENT_ID;
      console.log('Updated AUTH_CONFIG:', {
        clientId: AUTH_CONFIG.clientId ? 'Set' : 'Not set',
        redirectUri: AUTH_CONFIG.redirectUri,
        scope: AUTH_CONFIG.scope,
        authUrl: AUTH_CONFIG.authUrl,
      });
      return;
    }
    const basePath = getBasePath();
    const res = await fetch(`${basePath}/config.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg?.githubOAuth?.clientId) AUTH_CONFIG.clientId = cfg.githubOAuth.clientId;
    if (cfg?.githubOAuth?.scope) AUTH_CONFIG.scope = cfg.githubOAuth.scope;
    if (cfg?.githubOAuth?.authUrl) AUTH_CONFIG.authUrl = cfg.githubOAuth.authUrl;
    if (cfg?.githubOAuth?.redirectUri && cfg.githubOAuth.redirectUri.trim() !== '')
      AUTH_CONFIG.redirectUri = cfg.githubOAuth.redirectUri;
  } catch (error) {
    console.error('Error loading runtime config:', error);
  }
}
// Edge-case helper: Sometimes GitHub may redirect directly to index.html with ?code&state instead of callback.html
// (e.g., misconfigured redirect or older bookmarked URL). We capture that here early.
// Legacy code capture for both callback.html and (if indicated) index.html
function captureOAuthParams(forceCaptureOnIndex = false): boolean {
  try {
    if (!window.location.search) return false;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) return false;

    const path = window.location.pathname || '';
    const isCallback = /callback\.html$/i.test(path);

    // Only act if: 1) We're on callback.html, OR 2) We're on index with forceCaptureOnIndex=true
    if (!isCallback && !forceCaptureOnIndex) {
      console.warn(
        '[GitHubAuth][oauth] Found code parameter on non-callback page; leaving intact. Set forceCaptureOnIndex=true to handle here.',
      );
      return false;
    }

    // Don't overwrite existing code unless on callback (which is the "right" place)
    if (!isCallback && sessionStorage.getItem('gh_auth_code')) {
      console.warn('[GitHubAuth][oauth] Already have stored code; not overwriting from index.html');
      return false;
    }

    console.log(
      '[GitHubAuth][oauth] Capturing OAuth params on ' +
        (isCallback ? 'callback page' : 'index page'),
    );
    sessionStorage.setItem('gh_auth_code', code);
    if (state) sessionStorage.setItem('gh_auth_state', state);

    // Clean URL of sensitive parameters
    const clean = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, clean);
    return true;
  } catch (e) {
    console.error('[GitHubAuth][oauth] Capture error', e);
    return false;
  }
}

// Check if we are on callback.html (the "right" place for param capture)
const isCallbackPage = /callback\.html$/i.test(window.location.pathname || '');

// ALWAYS capture on callback.html, and make index.html capture optional
// This restores the original logic while allowing for potential index.html capture if needed
const captured = captureOAuthParams(true); // Allow capture on index OR callback

// If we are on callback.html, we expect to be redirected to the main page soon
// We can help by doing it ourselves if needed
if (isCallbackPage && captured) {
  // Give it a very brief moment to allow other scripts to possibly redirect us
  setTimeout(() => {
    if (document.location.pathname.includes('callback.html')) {
      console.log(
        '[GitHubAuth][oauth] Still on callback page after param capture; auto-redirecting to index',
      );
      document.location.href =
        document.location.origin +
        document.location.pathname.replace(/callback\.html$/, '') +
        'index.html';
    }
  }, 500);
}

// Deferred exchange safety: if a code is stored (e.g., captured on callback.html) but no token yet, attempt exchange shortly after load.
window.addEventListener('load', () => {
  try {
    const existingToken = localStorage.getItem('gh_access_token');
    const pendingCode = sessionStorage.getItem('gh_auth_code');
    if (!existingToken && pendingCode) {
      console.log(
        '[GitHubAuth][oauth] Detected pending auth code post-load; initiating token exchange.',
      );
      if ((window as any).GitHubAuth?.exchangeCodeForToken) {
        (window as any).GitHubAuth.exchangeCodeForToken(pendingCode).catch((err: any) =>
          console.error('[GitHubAuth][oauth] Deferred exchange failed', err),
        );
      } else if (typeof (window as any).exchangeCodeForToken === 'function') {
        (window as any)
          .exchangeCodeForToken(pendingCode)
          .catch((err: any) => console.error('[GitHubAuth][oauth] Deferred exchange failed', err));
      } else {
        console.error('[GitHubAuth][oauth] No exchange method available');
      }
    }
  } catch (e) {
    console.debug('[GitHubAuth][oauth] Deferred exchange check failed', e);
  }
});
class GitHubAuth {
  private accessToken: string | null;
  private userInfo: StoredUserInfo | null;

  constructor() {
    debug('GitHubAuth', 'Initializing authentication handler');
    this.accessToken = localStorage.getItem(AUTH_CONFIG.tokenStorageKey);
    debug(
      'GitHubAuth',
      'Access token from localStorage:',
      this.accessToken ? 'Present' : 'Not present',
    );
    this.userInfo = JSON.parse(localStorage.getItem(AUTH_CONFIG.userStorageKey) || 'null');
    debug('GitHubAuth', 'User info from localStorage:', this.userInfo);
    this.initEventListeners();
    this.checkAuthentication();
  }
  private initEventListeners(): void {
    const loginButton = document.getElementById('login-button');
    if (loginButton) loginButton.addEventListener('click', () => this.login());
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.addEventListener('click', () => this.logout());
    this.handleCallback();
  }
  login(): void {
    console.log('Starting login flow with scopes:', AUTH_CONFIG.scope);
    console.log('Configured redirectUri:', AUTH_CONFIG.redirectUri);
    this.clearGitHubCookies();
    const authUrl = new URL(AUTH_CONFIG.authUrl);
    authUrl.searchParams.append('client_id', AUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', AUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', AUTH_CONFIG.scope);
    authUrl.searchParams.append('state', this.generateState());
    console.log('Full auth URL:', authUrl.toString());
    if (!AUTH_CONFIG.clientId) {
      const notify = (window as any).Notifications?.info?.bind((window as any).Notifications);
      notify && notify('Preparing login…', 'Loading authentication configuration', 2000);
      const error = (window as any).Notifications?.error?.bind((window as any).Notifications);
      if (error) {
        error(
          'Missing OAuth client ID',
          'GitHub OAuth clientId is not configured. Set GITHUB_CLIENT_ID environment variable in your .env file.',
          6000,
        );
      } else {
        console.error(
          'GitHub OAuth clientId is not configured. Please set GITHUB_CLIENT_ID in your .env file.',
        );
      }
      return;
    }
    authUrl.searchParams.append('allow_signup', 'true');
    authUrl.searchParams.append('_t', String(Date.now()));
    authUrl.searchParams.append('_r', Math.random().toString(36).substring(7));
    authUrl.searchParams.append('prompt', 'consent');
    console.log('Redirecting to GitHub OAuth URL:', authUrl.toString());
    window.location.href = authUrl.toString();
  }
  private clearGitHubCookies(): void {
    console.log('Attempting to clear GitHub cookies');
    const cookiesToClear = [
      { name: '_gh_sess', domain: '.github.com', path: '/' },
      { name: 'user_session', domain: '.github.com', path: '/' },
      { name: '__Host-user_session_same_site', domain: '', path: '/' },
      { name: 'logged_in', domain: '.github.com', path: '/' },
      { name: 'dotcom_user', domain: '.github.com', path: '/' },
    ];
    cookiesToClear.forEach((cookie) => {
      try {
        const cookieStr = `${cookie.name}=; path=${cookie.path}; ${cookie.domain ? 'domain=' + cookie.domain + ';' : ''} expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=none`;
        console.log('Clearing cookie:', cookieStr);
        document.cookie = cookieStr;
      } catch (e) {
        console.error('Error clearing cookie:', cookie.name, e);
      }
    });
  }
  private generateState(): string {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oauth_state', state);
    return state;
  }
  private handleCallback(): void {
    debug('handleCallback', 'Checking for code in sessionStorage');
    const code = sessionStorage.getItem('gh_auth_code');
    const state = sessionStorage.getItem('gh_auth_state');
    const expectedState = localStorage.getItem('oauth_state');
    debug(
      'handleCallback',
      'Code from sessionStorage:',
      code,
      'State:',
      state,
      'Expected State:',
      expectedState,
    );
    if (code) {
      debug('handleCallback', 'Found code in sessionStorage');
      if (state !== expectedState) {
        debug('handleCallback', 'State mismatch, potential CSRF attack');
      }
      this.exchangeCodeForToken(code);
      sessionStorage.removeItem('gh_auth_code');
      sessionStorage.removeItem('gh_auth_state');
    } else {
      debug('handleCallback', 'No code found in sessionStorage');
    }
  }
  async exchangeCodeForToken(code: string): Promise<boolean | void> {
    debug('exchangeCodeForToken', 'Starting token exchange with code', code);
    debug('exchangeCodeForToken', 'Sending request to Azure Function');
    sessionStorage.setItem('last_auth_code', code);

    // CRITICAL: Wait for config to load before making API calls
    if ((window as any).TemplateDoctorConfigReady) {
      debug('exchangeCodeForToken', 'Waiting for config to load...');
      await (window as any).TemplateDoctorConfigReady;
      debug('exchangeCodeForToken', 'Config loaded, proceeding with API call');
    }

    // Use centralized API configuration
    const apiUrl = buildApiUrl(API_ENDPOINTS.GITHUB_OAUTH_TOKEN);

    debug('exchangeCodeForToken', `API URL: ${apiUrl}`);
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      mode: 'cors',
      body: JSON.stringify({ code }),
    })
      .then((response) => {
        debug('exchangeCodeForToken', 'Got response from token exchange', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Array.from(response.headers.entries()),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response
          .clone()
          .text()
          .then((rawText) => {
            debug('exchangeCodeForToken', 'Raw token exchange response:', rawText);
            try {
              const rawJson = JSON.parse(rawText);
              debug('exchangeCodeForToken', 'Raw token exchange response as JSON:', rawJson);
              if (rawJson.error) {
                const errorMsg = `${rawJson.error}: ${rawJson.error_description || 'Unknown error'}`;
                const errorNotify = (window as any).Notifications?.error?.bind(
                  (window as any).Notifications,
                );
                if (errorNotify) {
                  errorNotify('GitHub OAuth Error', errorMsg, 10000);
                } else {
                  console.error('GitHub OAuth Error:', errorMsg);
                }
                throw new Error(errorMsg);
              }
              if (rawJson.scope)
                debug('exchangeCodeForToken', 'Token scopes from response:', rawJson.scope);
            } catch (e) {
              debug('exchangeCodeForToken', 'Failed to parse raw response as JSON:', e);
            }
            return response.json();
          });
      })
      .then((data: TokenExchangeResponse) => {
        debug('exchangeCodeForToken', 'Token exchange response data received', data);
        if (isTokenExchangeResponse(data)) {
          debug('exchangeCodeForToken', 'Detailed token information:', {
            hasAccessToken: !!data.access_token,
            tokenType: data.token_type || null,
            scopes: data.scope ? data.scope.split(' ') : null,
            hasRefreshToken: !!data.refresh_token,
            expiresIn: data.expires_in || null,
            responseKeys: Object.keys(data),
          });
          if (data.access_token) {
            debug('exchangeCodeForToken', 'Successfully received access token');
            debug(
              'exchangeCodeForToken',
              'Token scopes (if provided):',
              data.scope || 'Not provided in response',
            );
            this.setAccessToken(data.access_token);
            this.fetchUserInfo();
            sessionStorage.removeItem('last_auth_code');
            return true;
          } else if (data.error) {
            debug('exchangeCodeForToken', 'Error in token response', data.error);
            throw new Error(data.error);
          } else {
            debug('exchangeCodeForToken', 'No token in response', data);
            throw new Error('No access token received');
          }
        } else {
          throw new Error('Unexpected token exchange response');
        }
      })
      .catch((error) => {
        debug('exchangeCodeForToken', 'Error exchanging code for token', error.message);
        sessionStorage.setItem('auth_error', error.message);
        debug('exchangeCodeForToken', 'Full error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      });
  }
  private setAccessToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem(AUTH_CONFIG.tokenStorageKey, token);
    this.fetchUserInfo();
  }
  fetchUserInfo(): Promise<StoredUserInfo | null> {
    debug('fetchUserInfo', 'Fetching user information');
    if (!this.accessToken) {
      debug('fetchUserInfo', 'No access token available');
      return Promise.reject('No access token');
    }
    debug('fetchUserInfo', 'Making request to GitHub API');
    return fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${this.accessToken}` },
    })
      .then((response) => {
        debug('fetchUserInfo', 'Response from GitHub API', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });
        if (!response.ok)
          throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((data) => {
        debug('fetchUserInfo', 'User data received', data);
        this.userInfo = {
          login: data.login,
          name: data.name || data.login,
          avatarUrl: data.avatar_url,
        };
        localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo));
        this.updateUI();
        if ((window as any).GitHubClient) {
          (window as any).GitHubClient.currentUser = this.userInfo;
          debug('fetchUserInfo', 'Updated GitHub client with user info');
        }
        return this.userInfo;
      })
      .catch((error) => {
        debug('fetchUserInfo', 'Error fetching user info', error.message);
        if (error.message.includes('401')) {
          debug('fetchUserInfo', 'Token is invalid, logging out');
          this.logout();
        }
        return null;
      });
  }
  checkAuthentication(): boolean {
    debug('checkAuthentication', 'Checking authentication status');
    const pendingCode = sessionStorage.getItem('github_auth_code');
    const pendingTimestamp = sessionStorage.getItem('github_auth_timestamp');
    const directCode = sessionStorage.getItem('gh_auth_code');
    if (!this.accessToken && directCode) {
      debug(
        'checkAuthentication',
        'Found gh_auth_code but no access token yet. Attempting exchange now.',
      );
      this.exchangeCodeForToken(directCode);
    }
    if (pendingCode && pendingTimestamp) {
      const timestamp = new Date(pendingTimestamp);
      const now = new Date();
      const secondsElapsed = (now.getTime() - timestamp.getTime()) / 1000;
      if (secondsElapsed < 30 && !this.accessToken) {
        debug('checkAuthentication', 'Found recent pending auth code, retrying exchange');
        this.exchangeCodeForToken(pendingCode);
        sessionStorage.removeItem('github_auth_code');
        sessionStorage.removeItem('github_auth_timestamp');
      } else if (secondsElapsed >= 30) {
        debug('checkAuthentication', 'Clearing expired pending auth code');
        sessionStorage.removeItem('github_auth_code');
        sessionStorage.removeItem('github_auth_timestamp');
      }
    }
    this.updateUI();
    if (this.accessToken && !this.userInfo) {
      debug('checkAuthentication', 'Have token but no user info, fetching user info');
      this.fetchUserInfo();
    }
    return !!this.accessToken;
  }
  simulateLogin(): void {
    console.log('Simulating login for local development');
    this.accessToken = 'simulated_token';
    localStorage.setItem(AUTH_CONFIG.tokenStorageKey, this.accessToken);
    this.userInfo = {
      login: 'dev-user',
      name: 'Development User',
      avatarUrl: 'https://avatars.githubusercontent.com/u/0',
    };
    localStorage.setItem(AUTH_CONFIG.userStorageKey, JSON.stringify(this.userInfo));
  }
  updateUI(): void {
    console.log('updateUI: Access Token:', this.accessToken ? 'Present' : 'Not present');
    console.log('updateUI: User Info:', this.userInfo);
    const loginButton = document.getElementById('login-button');
    const userProfile = document.getElementById('user-profile');
    const username = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    const searchSection = document.getElementById('search-section');
    const welcomeSection = document.getElementById('welcome-section');
    // New behavior: treat presence of token as authenticated immediately (even before userInfo fetch completes)
    // to avoid forced re-login perception after redeploy / hard refresh.
    if (this.accessToken) {
      if (loginButton) loginButton.style.display = 'none';
      if (userProfile) userProfile.style.display = 'flex';
      if (username)
        username.textContent =
          (this.userInfo && (this.userInfo.name || this.userInfo.login)) || 'Loading…';
      if (userAvatar && userAvatar instanceof HTMLImageElement)
        userAvatar.src =
          (this.userInfo && this.userInfo.avatarUrl) || 'https://avatars.githubusercontent.com/u/0';
      if (searchSection) searchSection.style.display = 'block';
      // Remove welcome section from DOM instead of just hiding it
      if (welcomeSection) welcomeSection.remove();
      document.dispatchEvent(
        new CustomEvent('auth-state-changed', {
          detail: { authenticated: true, provisional: !this.userInfo },
          bubbles: true,
          cancelable: true,
        }),
      );
      // If we have token but no user info yet, initiate fetch (idempotent) – safe because fetchUserInfo checks token.
      if (!this.userInfo) {
        this.fetchUserInfo();
      }

      // Check setup access and show/hide setup link
      this.checkSetupAccess();

      // Show leaderboards link when logged in
      this.showLeaderboardsLink();
    } else {
      if (loginButton) loginButton.style.display = 'flex';
      if (userProfile) userProfile.style.display = 'none';
      if (searchSection) searchSection.style.display = 'none';
      if (welcomeSection) welcomeSection.style.display = 'block';

      // Hide setup and leaderboards links when logged out
      this.hideSetupLink();
      this.hideLeaderboardsLink();

      document.dispatchEvent(
        new CustomEvent('auth-state-changed', {
          detail: { authenticated: false },
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }

  async checkSetupAccess(): Promise<void> {
    const username = this.getUsername();
    if (!username) {
      this.hideSetupLink();
      return;
    }

    try {
      const apiUrl = buildApiUrl(`/setup/check-access?username=${encodeURIComponent(username)}`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        this.hideSetupLink();
        return;
      }

      const data = await response.json();
      if (data.hasAccess) {
        this.showSetupLink();
      } else {
        this.hideSetupLink();
      }
    } catch (error) {
      console.error('Error checking setup access:', error);
      this.hideSetupLink();
    }
  }

  private showSetupLink(): void {
    const setupLinks = document.querySelectorAll('a[href="/setup"]');
    setupLinks.forEach((link) => {
      if (link instanceof HTMLElement) {
        link.style.display = '';
      }
    });
  }

  private hideSetupLink(): void {
    const setupLinks = document.querySelectorAll('a[href="/setup"]');
    setupLinks.forEach((link) => {
      if (link instanceof HTMLElement) {
        link.style.display = 'none';
      }
    });
  }

  private showLeaderboardsLink(): void {
    const leaderboardLinks = document.querySelectorAll('a[href="/leaderboards"]');
    leaderboardLinks.forEach((link) => {
      if (link instanceof HTMLElement) {
        link.style.display = '';
      }
    });
  }

  private hideLeaderboardsLink(): void {
    const leaderboardLinks = document.querySelectorAll('a[href="/leaderboards"]');
    leaderboardLinks.forEach((link) => {
      if (link instanceof HTMLElement) {
        link.style.display = 'none';
      }
    });
  }

  async revokeToken(): Promise<void> {
    if (!this.accessToken) return Promise.resolve();
    try {
      console.log('Revoking token and clearing GitHub session...');
      this.clearGitHubCookies();
      return Promise.resolve();
    } catch (e) {
      console.error('Error revoking token:', e);
      return Promise.resolve();
    }
  }
  logout(): void {
    console.log('Logging out user...');
    this.revokeToken().finally(() => {
      console.log('Clearing all storage...');
      sessionStorage.clear();
      localStorage.removeItem(AUTH_CONFIG.tokenStorageKey);
      localStorage.removeItem(AUTH_CONFIG.userStorageKey);
      localStorage.removeItem('oauth_state');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes('gh_') ||
            key.includes('github') ||
            key.includes('oauth') ||
            key.includes('token'))
        ) {
          console.log('Removing localStorage item:', key);
          localStorage.removeItem(key);
        }
      }
      this.accessToken = null;
      this.userInfo = null;
      this.updateUI();
      console.log('Logged out successfully, redirecting to home page');
      const redirectUrl = new URL(window.location.origin);
      redirectUrl.searchParams.append('_t', String(Date.now()));
      redirectUrl.searchParams.append('_r', Math.random().toString(36).substring(7));
      redirectUrl.searchParams.append('logged_out', 'true');
      redirectUrl.searchParams.append('require_permissions', 'public_repo');
      if ((window as any).Notifications) {
        (window as any).Notifications.success(
          'Logged Out Successfully',
          'You have been logged out of GitHub. Please log in again with the required permissions.',
          5000,
        );
        setTimeout(() => {
          window.location.href = redirectUrl.toString();
        }, 1000);
      } else {
        window.location.href = redirectUrl.toString();
      }
    });
  }
  getAccessToken(): string | null {
    return this.accessToken;
  }
  getToken(): string | null {
    return this.getAccessToken();
  }
  getUserInfo(): StoredUserInfo | null {
    return this.userInfo;
  }
  getUsername(): string | null {
    const username = this.userInfo?.login || this.userInfo?.name;
    return username || null;
  }
  isAuthenticated(): boolean {
    const authenticated = !!this.accessToken;
    console.log('isAuthenticated check - token exists:', authenticated);
    return authenticated;
  }
}
// Immediately create the GitHubAuth instance so it's available to early consumers
console.log('[GitHubAuth] Creating instance immediately, will update config async');
(window as any).GitHubAuth = new GitHubAuth(); // CRITICAL: must be available synchronously
loadRuntimeAuthConfig()
  .catch(() => {})
  .finally(() => {
    // Ensure we dispatch ready event
    console.log('[GitHubAuth] Config loaded, dispatching ready event');
    document.dispatchEvent(new CustomEvent('github-auth-ready'));
  });

// Expose exchangeCodeForToken method so load-time listener can work
(window as any).exchangeCodeForToken = function (code: string) {
  console.log('[GitHubAuth] Global exchangeCodeForToken called with', code);
  if ((window as any).GitHubAuth?.exchangeCodeForToken) {
    return (window as any).GitHubAuth.exchangeCodeForToken(code);
  } else {
    console.error('[GitHubAuth] No GitHubAuth instance available for token exchange');
    return Promise.reject(new Error('No GitHubAuth instance available'));
  }
};

export {};
