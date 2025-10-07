// Enhanced Search Module for Template Doctor
// Provides full-featured search and template handling based on the legacy app.js implementation

// Rely on the ScannedTemplateEntry interface from global.d.ts

// Extend the global Window interface for search-specific properties
declare global {
  interface Window {
    TemplateAnalyzer?: {
      analyzeTemplate: (repoUrl: string, ruleSet?: string) => Promise<any>;
      analyzeTemplateServerSide?: (repoUrl: string, ruleSetOrOptions?: any) => Promise<any>;
      githubClient?: any;
    };
    ForkWorkflow?: {
      ensureFork: (repoUrl: string) => Promise<any>;
    };
    __lastSearchResultsCount?: number;
    __searchModuleReady?: boolean;
  }
}

// Logging helper
const log = (...args: any[]) => console.log('[Search]', ...args);

// Helper function to find a template in the scanned templates list
function findScannedTemplate(query: string): ScannedTemplateEntry | null {
  console.log('[Search DEBUG] findScannedTemplate called with query:', query);

  if (!window.templatesData || !Array.isArray(window.templatesData)) {
    console.log('[Search DEBUG] templatesData is not available or not an array');
    return null;
  }

  // Normalize the query for matching
  const normalizedQuery = query.trim().toLowerCase();
  console.log('[Search DEBUG] normalized query:', normalizedQuery);

  // Helper to check if the query matches a URL (handles both full URLs and shorthand like "owner/repo")
  const isUrlMatch = (template: ScannedTemplateEntry): boolean => {
    if (!template.repoUrl) return false;

    const url = template.repoUrl.toLowerCase();

    // Direct match on full URL
    if (url === normalizedQuery) {
      console.log('[Search DEBUG] Exact URL match found:', url);
      return true;
    }

    // Extract owner and repo from template URL
    let templateOwner = '';
    let templateRepo = '';

    if (url.includes('github.com/')) {
      const repoPath = url.split('github.com/')[1].replace(/\.git$/, '');
      const parts = repoPath.split('/');

      if (parts.length >= 2) {
        templateOwner = parts[0].toLowerCase();
        templateRepo = parts[1].toLowerCase();
      }

      // Extract owner and repo from search query if in owner/repo format
      let queryOwner = '';
      let queryRepo = '';

      // Handle full GitHub URL in the query
      if (normalizedQuery.includes('github.com/')) {
        const queryPath = normalizedQuery.split('github.com/')[1].replace(/\.git$/, '');
        const queryParts = queryPath.split('/');

        if (queryParts.length >= 2) {
          queryOwner = queryParts[0].toLowerCase();
          queryRepo = queryParts[1].toLowerCase();
        }
      }
      // Handle owner/repo format in the query
      else if (normalizedQuery.includes('/')) {
        const queryParts = normalizedQuery.split('/');
        if (queryParts.length >= 2) {
          queryOwner = queryParts[0].toLowerCase();
          queryRepo = queryParts[1].toLowerCase();
        }
      }

      // Match if just the repo names match - more lenient matching
      if (queryRepo && queryRepo === templateRepo) {
        console.log('[Search DEBUG] Repo name match found:', templateRepo);
        return true;
      }

      // Match by full owner/repo (keeping this for backward compatibility)
      if (queryOwner && queryRepo && queryOwner === templateOwner && queryRepo === templateRepo) {
        console.log(
          '[Search DEBUG] Exact owner/repo match found:',
          templateOwner + '/' + templateRepo,
        );
        return true;
      }

      // If the full repoPath matches the normalized query (for backward compatibility)
      if (repoPath.toLowerCase() === normalizedQuery) {
        console.log('[Search DEBUG] GitHub repo path match found:', repoPath);
        return true;
      }
    }

    return false;
  };

  // Try to find exact matches first (by URL, path, etc)
  for (const template of window.templatesData) {
    // Match by repo URL
    if (template.repoUrl && isUrlMatch(template)) {
      console.log('[Search DEBUG] Match found by URL check for:', template.repoUrl);
      return template;
    }

    // Match by relative path (for local templates)
    if (template.relativePath && template.relativePath.toLowerCase() === normalizedQuery) {
      console.log('[Search DEBUG] Match found by relative path:', template.relativePath);
      return template;
    }
  }

  // No direct match found
  console.log('[Search DEBUG] No direct match found for:', normalizedQuery);
  return null;
}

// Scroll to and highlight a template card
async function scrollToTemplate(template: ScannedTemplateEntry): Promise<void> {
  console.log('[Search DEBUG] scrollToTemplate called with template:', template);

  if (!template.relativePath) {
    console.log('[Search DEBUG] Template has no relativePath, cannot scroll to it');
    log('Template has no relativePath, cannot scroll to it');
    return;
  }

  // Find the index of this template in the full dataset
  const data = window.templatesData;
  if (!Array.isArray(data)) {
    console.log('[Search DEBUG] templatesData not available');
    return;
  }

  const templateIndex = data.findIndex((t) => t.relativePath === template.relativePath);
  console.log('[Search DEBUG] Template found at index:', templateIndex);

  if (templateIndex === -1) {
    console.log('[Search DEBUG] Template not found in dataset');
    log('Template not found in dataset');
    return;
  }

  // Check if template is already loaded
  const loadedCount = window.TemplateList?.getLoadedCount?.() || 0;
  console.log(
    '[Search DEBUG] Current loaded count:',
    loadedCount,
    'Template index:',
    templateIndex,
  );

  if (templateIndex >= loadedCount) {
    // Template not yet loaded - load templates progressively until we reach it
    console.log('[Search DEBUG] Template not loaded yet, loading templates...');
    log(`Template at position ${templateIndex + 1} not loaded yet. Loading more templates...`);

    if (window.TemplateList?.loadUntilIndex) {
      const success = await window.TemplateList.loadUntilIndex(templateIndex);
      if (!success) {
        console.log('[Search DEBUG] Failed to load template');
        log('Failed to load template');
        return;
      }
      console.log('[Search DEBUG] Successfully loaded templates up to index', templateIndex);

      // Give DOM a moment to update
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      console.log('[Search DEBUG] TemplateList.loadUntilIndex not available');
      log('Cannot load more templates - TemplateList API not available');
      return;
    }
  }

  // Extract the template ID from relativePath
  const templateId = `template-${template.relativePath.split('/')[0]}`.replace(
    /[^a-zA-Z0-9-]/g,
    '-',
  );
  console.log('[Search DEBUG] Looking for template card with ID:', templateId);

  const templateCard = document.getElementById(templateId);
  console.log('[Search DEBUG] Template card found:', templateCard ? 'Yes' : 'No');

  if (!templateCard) {
    console.log('[Search DEBUG] Template card not found, will not scroll');
    log('Template card not found:', templateId);
    return;
  }

  // Make sure templates section is visible
  const templatesSection = document.getElementById('scanned-templates-section');
  console.log('[Search DEBUG] Templates section found:', templatesSection ? 'Yes' : 'No');

  if (templatesSection) {
    console.log('[Search DEBUG] Setting templates section display to block');
    templatesSection.style.display = 'block';

    // Make sure content is expanded
    const sectionContent = templatesSection.querySelector('.section-content') as HTMLElement;
    console.log('[Search DEBUG] Section content found:', sectionContent ? 'Yes' : 'No');

    if (sectionContent) {
      console.log('[Search DEBUG] Setting section content display to block');
      sectionContent.style.display = 'block';

      const toggleBtn = templatesSection.querySelector('.toggle-btn');
      console.log('[Search DEBUG] Toggle button found:', toggleBtn ? 'Yes' : 'No');

      if (toggleBtn) {
        console.log('[Search DEBUG] Updating toggle button icon');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
      }
    }
  }

  console.log('[Search DEBUG] Scrolling to template card and adding highlight effect');
  // Scroll to the template card with smooth behavior
  templateCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Add highlight effect
  templateCard.classList.add('highlight-pulse');

  // Remove highlight after animation completes
  setTimeout(() => {
    console.log('[Search DEBUG] Removing highlight effect after timeout');
    templateCard.classList.remove('highlight-pulse');
  }, 2000);
}

// Perform search for a repository
async function performSearch(query: string): Promise<void> {
  console.log('[Search DEBUG] performSearch called with query:', query);

  const container = document.getElementById('search-results');
  console.log('[Search DEBUG] search-results container:', container ? 'Found' : 'Missing');

  if (!container) {
    log('Search results container not found');
    return;
  }

  // Clear previous results
  container.innerHTML = '';

  // Trim and validate query
  const q = query.trim();
  if (!q) {
    console.log('[Search DEBUG] Empty query, showing prompt');
    container.innerHTML = '<div class="no-results">Enter a search term</div>';
    return;
  }

  log('Performing search with query:', q);

  // Debug template data
  console.log('[Search DEBUG] templatesData exists:', window.templatesData ? 'Yes' : 'No');
  console.log(
    '[Search DEBUG] templatesData is array:',
    Array.isArray(window.templatesData) ? 'Yes' : 'No',
  );
  console.log(
    '[Search DEBUG] templatesData length:',
    Array.isArray(window.templatesData) ? window.templatesData.length : 'N/A',
  );

  // First, check if this is a direct match in scanned templates
  const matchedTemplate = findScannedTemplate(q);
  console.log(
    '[Search DEBUG] matchedTemplate result:',
    matchedTemplate ? 'Found match' : 'No match',
  );

  if (matchedTemplate) {
    log('Found in scanned templates:', matchedTemplate);

    // Scroll to the template card if it exists in the DOM
    scrollToTemplate(matchedTemplate);

    // Still show it in search results
    const div = document.createElement('div');
    div.className = 'repo-item found-template';
    div.setAttribute('data-test', 'repo-item');

    const repoName = matchedTemplate.repoUrl.includes('github.com/')
      ? matchedTemplate.repoUrl.split('github.com/')[1].replace(/\.git$/, '')
      : matchedTemplate.relativePath || matchedTemplate.repoUrl;

    // Build HTML with more details and action buttons
    let html = `
      <div>
        <div class="repo-name" title="${repoName}">
          ${repoName}
        </div>`;

    if (matchedTemplate.description) {
      html += `<div class="repo-description" title="${matchedTemplate.description}">${matchedTemplate.description}</div>`;
    }

    // Add metadata if available
    const metaItems = [];
    if (Array.isArray(matchedTemplate.languages) && matchedTemplate.languages.length > 0) {
      metaItems.push(`<div class="repo-languages">${matchedTemplate.languages.join(', ')}</div>`);
    }
    if (Array.isArray(matchedTemplate.tags) && matchedTemplate.tags.length > 0) {
      metaItems.push(`<div class="repo-tags">${matchedTemplate.tags.join(', ')}</div>`);
    }

    if (metaItems.length > 0) {
      html += `<div class="repo-meta">${metaItems.join('')}</div>`;
    }

    html += `
      </div>
      <div class="action-buttons">
        <button class="analyze-btn">Scan Template</button>
        <button class="validate-btn">Run Validation</button>
      </div>
    `;

    div.innerHTML = html;

    console.log('[Search DEBUG] Adding matched template to results:', repoName);

    // Add specific click handlers to buttons (not the whole div)
    const analyzeBtn = div.querySelector('.analyze-btn') as HTMLButtonElement;
    const validateBtn = div.querySelector('.validate-btn') as HTMLButtonElement;

    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        console.log('[Search DEBUG] Analyze button clicked:', matchedTemplate.repoUrl);

        if (!matchedTemplate.repoUrl) return;

        // Check if user is authenticated to avoid rate limiting
        const isAuthenticated =
          window.GitHubAuth &&
          typeof window.GitHubAuth.isAuthenticated === 'function' &&
          window.GitHubAuth.isAuthenticated();

        if (!isAuthenticated) {
          // Prompt user to log in first
          if (window.GitHubAuth && typeof window.GitHubAuth.login === 'function') {
            const confirmLogin = confirm(
              'To analyze GitHub repositories without hitting rate limits, you need to log in with GitHub. Would you like to log in now?',
            );
            if (confirmLogin) {
              window.GitHubAuth.login();
              return;
            }
          }
        }

        // Use window.analyzeRepo for proper UI flow (shows modal, spinner, scrolls to results)
        if ((window as any).analyzeRepo && typeof (window as any).analyzeRepo === 'function') {
          console.log('[Search DEBUG] Calling window.analyzeRepo');
          (window as any).analyzeRepo(matchedTemplate.repoUrl, 'dod').catch((err: any) => {
            console.error('Analysis error:', err);
            if ((window as any).NotificationSystem) {
              (window as any).NotificationSystem.showError(
                'Analysis Failed',
                'Error analyzing repository: ' + (err.message || String(err)),
                8000,
              );
            }
          });
        }
      });
    }

    if (validateBtn) {
      validateBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        console.log('[Search DEBUG] Validate button clicked:', matchedTemplate.repoUrl);

        if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showInfo(
            'Validation',
            'Template validation feature coming soon!',
            3000,
          );
        } else {
          alert('Template validation feature coming soon!');
        }
      });
    }

    container.appendChild(div);

    // Signal to tests that results are ready
    window.__lastSearchResultsCount = 1;
    console.log('[Search DEBUG] Dispatching search-results-ready event with count: 1');
    document.dispatchEvent(
      new CustomEvent('search-results-ready', {
        detail: { count: 1 },
      }),
    );
    return;
  }

  // If no direct match, search in all available templates
  const data = Array.isArray(window.templatesData) ? window.templatesData : [];

  if (data.length > 0) {
    // Search through available templates
    const matches = data.filter((template) => {
      // Search in multiple fields
      const searchableFields = [
        template.repoUrl,
        template.description,
        template.relativePath,
        Array.isArray(template.languages) ? template.languages.join(' ') : '',
        Array.isArray(template.tags) ? template.tags.join(' ') : '',
      ]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .map((field) => field.toLowerCase());

      // Match if any field contains the query
      return searchableFields.some((field) => field.includes(q.toLowerCase()));
    });

    if (matches.length > 0) {
      // Display matched templates
      matches.slice(0, 10).forEach((template) => {
        const div = document.createElement('div');
        div.className = 'repo-item';
        div.setAttribute('data-test', 'repo-item');

        const repoName = template.repoUrl.includes('github.com/')
          ? template.repoUrl.split('github.com/')[1].replace(/\.git$/, '')
          : template.relativePath || template.repoUrl;

        // Build HTML with more details and action buttons
        let html = `
          <div>
            <div class="repo-name" title="${repoName}">
              ${repoName}
            </div>`;

        if (template.description) {
          html += `<div class="repo-description" title="${template.description}">${template.description}</div>`;
        }

        // Add metadata if available
        const metaItems = [];
        if (Array.isArray(template.languages) && template.languages.length > 0) {
          metaItems.push(`<div class="repo-languages">${template.languages.join(', ')}</div>`);
        }
        if (Array.isArray(template.tags) && template.tags.length > 0) {
          metaItems.push(`<div class="repo-tags">${template.tags.join(', ')}</div>`);
        }

        if (metaItems.length > 0) {
          html += `<div class="repo-meta">${metaItems.join('')}</div>`;
        }

        html += `
          </div>
          <div class="action-buttons">
            <button class="analyze-btn">Scan Template</button>
            <button class="validate-btn">Run Validation</button>
          </div>
        `;

        div.innerHTML = html;

        // Add specific click handlers to buttons
        const analyzeBtn = div.querySelector('.analyze-btn') as HTMLButtonElement;
        const validateBtn = div.querySelector('.validate-btn') as HTMLButtonElement;

        if (analyzeBtn) {
          analyzeBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!template.repoUrl) return;

            // Check if user is authenticated
            const isAuthenticated =
              window.GitHubAuth &&
              typeof window.GitHubAuth.isAuthenticated === 'function' &&
              window.GitHubAuth.isAuthenticated();

            if (!isAuthenticated) {
              if (window.GitHubAuth && typeof window.GitHubAuth.login === 'function') {
                const confirmLogin = confirm(
                  'To analyze GitHub repositories without hitting rate limits, you need to log in with GitHub. Would you like to log in now?',
                );
                if (confirmLogin) {
                  window.GitHubAuth.login();
                  return;
                }
              }
            }

            // Use window.analyzeRepo
            if ((window as any).analyzeRepo && typeof (window as any).analyzeRepo === 'function') {
              (window as any).analyzeRepo(template.repoUrl, 'dod').catch((err: any) => {
                console.error('Analysis error:', err);
                if ((window as any).NotificationSystem) {
                  (window as any).NotificationSystem.showError(
                    'Analysis Failed',
                    'Error analyzing repository: ' + (err.message || String(err)),
                    8000,
                  );
                }
              });
            }
          });
        }

        if (validateBtn) {
          validateBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if ((window as any).NotificationSystem) {
              (window as any).NotificationSystem.showInfo(
                'Validation',
                'Template validation feature coming soon!',
                3000,
              );
            } else {
              alert('Template validation feature coming soon!');
            }
          });
        }

        container.appendChild(div);
      });

      // Signal to tests that results are ready
      window.__lastSearchResultsCount = matches.length;
      document.dispatchEvent(
        new CustomEvent('search-results-ready', {
          detail: { count: matches.length },
        }),
      );
      return;
    }
  }

  // Handle GitHub URL directly
  if (q.includes('github.com') || q.includes('/')) {
    let repoUrl = q;

    // Add GitHub prefix if missing
    if (!repoUrl.includes('github.com')) {
      repoUrl = `https://github.com/${repoUrl}`;
    }

    // Add https:// if missing
    if (!repoUrl.startsWith('http')) {
      repoUrl = `https://${repoUrl}`;
    }

    // Check if user is authenticated to avoid rate limiting
    const isAuthenticated =
      window.GitHubAuth &&
      typeof window.GitHubAuth.isAuthenticated === 'function' &&
      window.GitHubAuth.isAuthenticated();

    const div = document.createElement('div');
    div.className = 'repo-item';
    div.setAttribute('data-test', 'repo-item');

    const repoName = repoUrl.includes('github.com/')
      ? repoUrl.split('github.com/')[1].replace(/\.git$/, '')
      : repoUrl;

    div.innerHTML = `
      <div>
        <div class="repo-name" title="${repoName}">
          ${repoName}
        </div>
        <div class="repo-description" title="Repository not yet scanned. ${isAuthenticated ? 'Click to analyze.' : 'Please log in first to avoid GitHub API rate limits.'}">
          Repository not yet scanned. ${isAuthenticated ? 'Click to analyze.' : 'Please log in first to avoid GitHub API rate limits.'}
        </div>
      </div>
      <div class="action-buttons">
        <button class="analyze-btn">Scan Template</button>
        <button class="validate-btn">Run Validation</button>
      </div>
    `;

    // Add specific click handlers to buttons
    const analyzeBtn = div.querySelector('.analyze-btn') as HTMLButtonElement;
    const validateBtn = div.querySelector('.validate-btn') as HTMLButtonElement;

    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!isAuthenticated) {
          // Prompt user to log in first
          if (window.GitHubAuth && typeof window.GitHubAuth.login === 'function') {
            const confirmLogin = confirm(
              'To analyze GitHub repositories without hitting rate limits, you need to log in with GitHub. Would you like to log in now?',
            );
            if (confirmLogin) {
              window.GitHubAuth.login();
              return;
            }
          }
          return;
        }

        // Use window.analyzeRepo for proper UI flow
        if ((window as any).analyzeRepo && typeof (window as any).analyzeRepo === 'function') {
          (window as any).analyzeRepo(repoUrl, 'dod').catch((err: any) => {
            console.error('Analysis error:', err);
            if ((window as any).NotificationSystem) {
              (window as any).NotificationSystem.showError(
                'Analysis Failed',
                'Error analyzing repository: ' + (err.message || String(err)),
                8000,
              );
            }
          });
        }
      });
    }

    if (validateBtn) {
      validateBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if ((window as any).NotificationSystem) {
          (window as any).NotificationSystem.showInfo(
            'Validation',
            'Template validation feature coming soon!',
            3000,
          );
        } else {
          alert('Template validation feature coming soon!');
        }
      });
    }

    container.appendChild(div);

    // Signal to tests that results are ready
    window.__lastSearchResultsCount = 1;
    document.dispatchEvent(
      new CustomEvent('search-results-ready', {
        detail: { count: 1 },
      }),
    );
    return;
  }

  // No results found
  container.innerHTML = '<div class="no-results">No matching templates found</div>';

  // Signal to tests that results are ready (with zero count)
  window.__lastSearchResultsCount = 0;
  document.dispatchEvent(
    new CustomEvent('search-results-ready', {
      detail: { count: 0 },
    }),
  );
}

// Attach search event handlers
function attachSearch(): void {
  const input = document.getElementById('repo-search') as HTMLInputElement | null;
  const btn = document.getElementById('search-button');

  console.log('[Search DEBUG] Attempting to attach search handlers');
  console.log('[Search DEBUG] DOM elements in attachSearch:', {
    input: input ? 'Found' : 'Missing',
    btn: btn ? 'Found' : 'Missing',
    searchSection: document.getElementById('search-section') ? 'Found' : 'Missing',
    searchSectionDisplay: document.getElementById('search-section')?.style.display,
  });

  if (!input || !btn) {
    log('Search elements not found yet, will retry');
    return;
  }

  // Check if already bound to avoid duplicate handlers
  if ((btn as any)._searchBound) {
    console.log('[Search DEBUG] Handlers already bound, skipping attachment');
    return;
  }

  (btn as any)._searchBound = true;
  log('Binding search handlers');
  console.log('[Search DEBUG] Successfully binding search handlers');

  const handler = () => {
    console.log('[Search DEBUG] Search handler triggered with value:', input.value);
    performSearch(input.value);
  };

  // Add click handler to search button
  btn.addEventListener('click', () => {
    console.log('[Search DEBUG] Search button clicked with value:', input.value);
    handler();
  });

  // Add enter key handler to input
  input.addEventListener('keydown', (e) => {
    console.log('[Search DEBUG] Key pressed in search input:', e.key);
    if (e.key === 'Enter') {
      console.log('[Search DEBUG] Enter key pressed, triggering search');
      handler();
    }
  });

  // If there's already a query in the input, perform search
  if (input.value.trim()) {
    log('Auto-running search with existing query:', input.value);
    console.log('[Search DEBUG] Auto-running search with existing value:', input.value);
    performSearch(input.value);
  }
}

// Initialize the search module
function init(): void {
  log('Initializing search module - DEBUG VERSION');
  console.log('[Search DEBUG] Search module initialization started');

  // Debug DOM elements
  const searchInput = document.getElementById('repo-search');
  const searchButton = document.getElementById('search-button');
  const searchSection = document.getElementById('search-section');
  const searchResults = document.getElementById('search-results');

  console.log('[Search DEBUG] DOM elements on init:', {
    searchInput: searchInput ? 'Found' : 'Missing',
    searchButton: searchButton ? 'Found' : 'Missing',
    searchSection: searchSection ? 'Found' : 'Missing',
    searchSectionDisplay: searchSection ? searchSection.style.display : 'N/A',
    searchResults: searchResults ? 'Found' : 'Missing',
  });

  // Attach search handlers
  attachSearch();

  // Retry a few times if elements injected later
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    console.log(`[Search DEBUG] Retry attempt ${attempts}/10`);

    const input = document.getElementById('repo-search');
    const button = document.getElementById('search-button');

    console.log('[Search DEBUG] DOM elements on retry:', {
      searchInput: input ? 'Found' : 'Missing',
      searchButton: button ? 'Found' : 'Missing',
    });

    attachSearch();
    if (attempts >= 10) {
      console.log('[Search DEBUG] Max attempts reached, clearing interval');
      clearInterval(interval);
    }
  }, 500);

  // Listen for template data loaded events
  document.addEventListener('template-data-loaded', () => {
    log('template-data-loaded event received');
    console.log('[Search DEBUG] template-data-loaded event fired');
    console.log(
      '[Search DEBUG] Template data length:',
      Array.isArray(window.templatesData) ? window.templatesData.length : 'Not an array',
    );

    // Give a small delay to ensure DOM is ready
    setTimeout(() => {
      const input = document.getElementById('repo-search') as HTMLInputElement | null;
      console.log('[Search DEBUG] DOM elements after data load:', {
        searchInput: input ? 'Found' : 'Missing',
        searchInputValue: input ? input.value : 'N/A',
      });

      attachSearch();

      // If user already typed a query, auto-run search
      if (input && input.value.trim()) {
        log('Auto-running search after data load with query:', input.value);
        performSearch(input.value);
      }
    }, 100);
  });

  // Add test hook for triggering search via custom event
  document.addEventListener('perform-test-search', (e: Event) => {
    try {
      const ce = e as CustomEvent<{ query?: string }>;
      performSearch(ce.detail?.query || '');
    } catch (err) {
      log('Error handling test search event', err);
    }
  });

  // Signal that search module is ready
  window.__searchModuleReady = true;
  document.dispatchEvent(new CustomEvent('search-module-ready'));

  // Add highlight pulse CSS if not already present
  if (!document.getElementById('highlight-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-pulse-style';
    style.textContent = `
      @keyframes highlightPulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 123, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
      }
      
      .highlight-pulse {
        animation: highlightPulse 2s ease-out;
        border: 2px solid #007bff !important;
        background-color: rgba(0, 123, 255, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize module when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  queueMicrotask(init);
} else {
  document.addEventListener('DOMContentLoaded', init);
}

// Expose the search function globally for legacy code
(window as any).performSearch = performSearch;

export {}; // module scope
