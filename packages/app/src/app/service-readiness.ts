// Service Readiness Poller (extracted from legacy app.js)
// Provides typed functions to monitor initialization of core services (GitHubAuth, GitHubClient, TemplateAnalyzer, DashboardRenderer)
// and drain the analysis queue when all are available.

interface WindowWithServices extends Window {
  GitHubAuth?: any;
  GitHubClient?: any;
  TemplateAnalyzer?: any;
  DashboardRenderer?: any;
  TemplateDoctorAnalysisQueue?: {
    drain(
      cb: (item: { args: { repoUrl: string; ruleSet: string; selectedCategories: any } }) => void,
    ): void;
  };
  NotificationSystem?: {
    showSuccess(title: string, msg: string, dur?: number): void;
    showError(title: string, msg: string, dur?: number): void;
  };
  __TD_FALLBACK_PENDING?: Array<{ repoUrl: string; ruleSet: string; selectedCategories: any }>;
  analyzeRepo?: (repo: string, ruleset?: string, categories?: any) => Promise<any>;
}

const w = window as WindowWithServices;

let appAuth: any, appGithub: any, appAnalyzer: any, appDashboard: any;
let serviceReadinessPolling = false;

export function updateServiceRefs() {
  appAuth = w.GitHubAuth || appAuth;
  appGithub = w.GitHubClient || appGithub;
  appAnalyzer = w.TemplateAnalyzer || appAnalyzer;
  appDashboard = w.DashboardRenderer || appDashboard;
}

export function areCoreServicesReady() {
  return !!(appAnalyzer && appGithub && appDashboard);
}

export function drainAnalysisQueue() {
  if (!areCoreServicesReady()) return;
  try {
    if (w.TemplateDoctorAnalysisQueue && w.TemplateDoctorAnalysisQueue.drain) {
      w.TemplateDoctorAnalysisQueue.drain(({ args }) => {
        const { repoUrl, ruleSet, selectedCategories } = args;
        if (typeof w.analyzeRepo === 'function') {
          w.analyzeRepo(repoUrl, ruleSet, selectedCategories);
        }
      });
      return;
    }
    const fallback = w.__TD_FALLBACK_PENDING || [];
    while (fallback.length) {
      const { repoUrl, ruleSet, selectedCategories } = fallback.shift()!;
      if (typeof w.analyzeRepo === 'function') {
        w.analyzeRepo(repoUrl, ruleSet, selectedCategories);
      }
    }
  } catch (e) {
    console.error('[service-readiness] drainAnalysisQueue error', e);
  }
}

export function pollForServiceReadiness(maxAttempts = 15, intervalMs = 500) {
  if (serviceReadinessPolling) return;
  serviceReadinessPolling = true;
  let attempts = 0;
  const loadingMessage = document.createElement('div');
  loadingMessage.id = 'service-init-message';
  loadingMessage.className = 'alert alert-info';
  Object.assign(loadingMessage.style, {
    position: 'fixed',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    padding: '10px 20px',
    borderRadius: '5px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  });
  loadingMessage.textContent = 'Services initializing... Please wait.';
  document.body.appendChild(loadingMessage);

  const timer = setInterval(() => {
    attempts++;
    updateServiceRefs();
    loadingMessage.textContent = `Services initializing (${attempts}/${maxAttempts})... ${appAnalyzer ? '✓' : '⟳'} Analyzer ${appDashboard ? '✓' : '⟳'} Dashboard ${appGithub ? '✓' : '⟳'} GitHub`;

    if (areCoreServicesReady()) {
      clearInterval(timer);
      serviceReadinessPolling = false;
      try {
        fadeOutAndRemove(loadingMessage);
      } catch {}
      drainAnalysisQueue();
    } else if (attempts >= maxAttempts) {
      clearInterval(timer);
      serviceReadinessPolling = false;
      loadingMessage.className = 'alert alert-warning';
      loadingMessage.textContent =
        'Some services failed to initialize. You may need to refresh the page.';
      setTimeout(() => {
        try {
          loadingMessage.remove();
        } catch {}
      }, 5000);
    }
  }, intervalMs);
}

function fadeOutAndRemove(el: HTMLElement) {
  el.style.transition = 'opacity 0.5s ease';
  el.style.opacity = '0';
  setTimeout(() => {
    try {
      el.remove();
    } catch {}
  }, 500);
}

export function onAnalyzerReady() {
  updateServiceRefs();
  const existing = document.getElementById('service-init-message');
  if (existing) {
    try {
      existing.remove();
    } catch {}
  }
  if (appAnalyzer) {
    const allServicesReady = areCoreServicesReady();
    if (w.NotificationSystem) {
      w.NotificationSystem.showSuccess(
        'Analyzer Ready',
        allServicesReady
          ? 'All services are now initialized and ready to use'
          : 'Analyzer ready; other services still initializing',
        3000,
      );
    }
    if (allServicesReady) {
      drainAnalysisQueue();
    } else {
      pollForServiceReadiness();
    }
  } else {
    if (w.NotificationSystem) {
      w.NotificationSystem.showError(
        'Initialization Issue',
        'Template analyzer failed to initialize properly. Refresh may be required.',
        5000,
      );
    }
  }
}

// Global bridge for legacy JS
(window as any).TemplateDoctorServiceReadiness = {
  pollForServiceReadiness,
  drainAnalysisQueue,
  updateServiceRefs,
  onAnalyzerReady,
  areCoreServicesReady,
};
