// Combined TypeScript migration of server-analysis-bridge.js and analyzer-server-only-patch.js.
// Attaches analyzeTemplateServerSide and enforces server-only analysis (no client fallback).

interface AnalyzerLike {
  analyzeTemplate?: (repoUrl: string, ruleSet?: string) => Promise<any>;
  analyzeTemplateServerSide?: (repoUrl: string, ruleSetOrOptions?: any) => Promise<any>;
  analyzeTemplateClientSide?: (...args: any[]) => Promise<any>;
  [k: string]: any; // allow legacy properties
}

interface GitHubAuthSubset {
  isAuthenticated: () => boolean;
  getToken?: () => string | null | undefined;
}

export {};

// (No global interface merge here to avoid conflict with existing TemplateAnalyzer type in global.d.ts)

(function () {
  function attachServerMethod(instance: AnalyzerLike) {
    if (typeof instance.analyzeTemplateServerSide === 'function') return instance;
    instance.analyzeTemplateServerSide = async function (repoUrl: string, ruleSetOrOptions?: any) {
      try {
        const cfg = (window as any).TemplateDoctorConfig || {};
        let ruleSet = 'dod';
        if (typeof ruleSetOrOptions === 'string') ruleSet = ruleSetOrOptions;
        else if (ruleSetOrOptions && typeof ruleSetOrOptions.ruleSet === 'string')
          ruleSet = ruleSetOrOptions.ruleSet;
        const apiBase = cfg.apiBase || window.location.origin;
        const primaryEndpoint =
          (window as any).ApiRoutes && (window as any).ApiRoutes.build
            ? (window as any).ApiRoutes.build('analyze-template')
            : apiBase.replace(/\/$/, '') + '/api/v4/analyze-template';
        const payload = { repoUrl: repoUrl, ruleSet: ruleSet };
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cfg.functionKey) headers['x-functions-key'] = cfg.functionKey;
        
        // Add GitHub OAuth token if available
        const token = localStorage.getItem('gh_access_token');
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }

        // Dev fallback: if frontend is running on a different port (e.g. 4000 or 5173) and no reverse proxy is configured,
        // try localhost:7071 (default Functions port) when the same‑origin request 404s.
        const candidates: string[] = [primaryEndpoint];
        const currentPort = window.location.port;
        const devPort = (cfg.devFunctionsPort && String(cfg.devFunctionsPort)) || '7071';
        if (currentPort !== devPort && !primaryEndpoint.includes(':' + devPort)) {
          const alt = primaryEndpoint.replace(
            window.location.origin,
            window.location.protocol + '//' + window.location.hostname + ':' + devPort,
          );
          if (!candidates.includes(alt)) candidates.push(alt);
        }

        let lastErr: any = null;
        for (const ep of candidates) {
          try {
            const resp = await fetch(ep, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });
            if (!resp.ok) {
              // Retry only on 404/502/503; other status codes treated as terminal.
              if (
                (resp.status === 404 || resp.status === 502 || resp.status === 503) &&
                ep !== candidates[candidates.length - 1]
              ) {
                lastErr = 'Endpoint ' + ep + ' -> ' + resp.status;
                continue;
              }
              const txt = await resp.text();
              throw new Error(
                'Server-side analysis failed: ' + resp.status + ' ' + resp.statusText + ' - ' + txt,
              );
            }
            const json = await resp.json();
            if (ep !== primaryEndpoint) {
              console.info(
                '[server-bridge] analyze-template fallback succeeded via',
                ep,
                'after primary failure',
                lastErr,
              );
            }
            if (!json.timestamp) (json as any).timestamp = new Date().toISOString();
            return json as any;
          } catch (e: any) {
            lastErr = e;
            if (ep === candidates[candidates.length - 1]) throw e;
          }
        }
        // If loop somehow exits without return (should not), throw lastErr.
        if (lastErr) throw lastErr;
        const json: any = { error: 'Unexpected analyze-template fallback exhaustion' };
        if (!json.timestamp) (json as any).timestamp = new Date().toISOString();
        return json as any;
      } catch (e: any) {
        console.error('[server-bridge] analyzeTemplateServerSide error', e);
        throw e;
      }
    };
    return instance;
  }

  function enforceServerOnly(instance: AnalyzerLike) {
    if (!instance || typeof instance.analyzeTemplateServerSide !== 'function') return false;
    instance.analyzeTemplate = function (repoUrl: string, ruleSet?: string) {
      return this.analyzeTemplateServerSide(repoUrl, ruleSet || 'dod');
    };
    instance.analyzeTemplateClientSide = function () {
      throw new Error('Client-side analysis disabled');
    };
    (window as any).TemplateDoctorConfig = (window as any).TemplateDoctorConfig || {};
    (window as any).TemplateDoctorConfig.analysis =
      (window as any).TemplateDoctorConfig.analysis || {};
    (window as any).TemplateDoctorConfig.analysis.useServerSide = true;
    (window as any).TemplateDoctorConfig.analysis.fallbackToClientSide = false;
    return true;
  }

  function ensure() {
    let ta = (window as any).TemplateAnalyzer as
      | AnalyzerLike
      | (new () => AnalyzerLike)
      | undefined;
    if (!ta) return false;
    if (typeof ta === 'function') {
      try {
        ta = new (ta as new () => AnalyzerLike)();
        (window as any).TemplateAnalyzer = ta;
      } catch (e) {
        return false;
      }
    }
    if (!ta || typeof ta !== 'object') return false;
    attachServerMethod(ta);
    enforceServerOnly(ta);
    if (!(window as any).analyzeTemplateServerSide) {
      (window as any).analyzeTemplateServerSide = function (repoUrl: string, opts?: any) {
        return (ta as AnalyzerLike).analyzeTemplateServerSide?.(repoUrl, opts || 'dod')!;
      };
    }
    if (!(window as any).__templateAnalyzerReady) {
      (window as any).__templateAnalyzerReady = Promise.resolve(ta);
    }
    return true;
  }

  function ready(fn: () => void) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function poll(maxMs: number) {
    const start = Date.now();
    (function loop() {
      if (ensure()) return;
      if (Date.now() - start > maxMs) {
        console.warn('[server-bridge] Timed out waiting for TemplateAnalyzer');
        return;
      }
      setTimeout(loop, 50);
    })();
  }

  ready(function () {
    poll(5000);
  });
})();
