// UI Controller - Manages section visibility and page layout
// Extracted from legacy app.js DOMContentLoaded initialization

interface Sections {
  welcome: HTMLElement | null;
  search: HTMLElement | null;
  analysis: HTMLElement | null;
  error: HTMLElement | null;
}

class UIController {
  private sections: Sections;

  constructor() {
    this.sections = {
      welcome: document.getElementById('welcome-section'),
      search: document.getElementById('search-section'),
      analysis: document.getElementById('analysis-section'),
      error: document.getElementById('error-section'),
    };

    this.initializeUI();
    this.attachEventListeners();
  }

  private initializeUI() {
    // Initial state: show welcome and search, hide analysis and error
    // CRITICAL: Analysis section MUST be hidden until user clicks "View Report" or starts new scan
    if (this.sections.welcome) this.sections.welcome.style.display = 'block';
    if (this.sections.search) this.sections.search.style.display = 'block';
    if (this.sections.analysis) this.sections.analysis.style.display = 'none';
    if (this.sections.error) this.sections.error.style.display = 'none';

    console.debug('[UIController] Initialized: welcome+search visible, analysis+error hidden');

    // DEBUG: Add MutationObserver to catch who's changing analysis section display
    if (this.sections.analysis) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const display = (mutation.target as HTMLElement).style.display;
            console.warn('[UIController] Analysis section display changed to:', display);
            console.trace('Call stack:');
          }
        });
      });
      observer.observe(this.sections.analysis, { attributes: true, attributeFilter: ['style'] });
    }
  }

  private attachEventListeners() {
    // Back button from analysis section
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.showSearch();
        this.hideAnalysis();
        console.debug('[UIController] Back to search');
      });
    }

    // Back button from error section
    const errorBackButton = document.getElementById('error-back-button');
    if (errorBackButton) {
      errorBackButton.addEventListener('click', () => {
        this.showSearch();
        this.hideError();
        console.debug('[UIController] Back from error');
      });
    }

    // Listen for events to show analysis section
    document.addEventListener('show-analysis-section', () => {
      this.hideSearch();
      this.showAnalysis();
    });

    // Listen for events to show search section
    document.addEventListener('show-search-section', () => {
      this.showSearch();
      this.hideAnalysis();
      this.hideError();
    });

    // Batch mode toggle
    const scanModeToggle = document.getElementById('scan-mode-toggle') as HTMLInputElement;
    const singleModeLabel = document.getElementById('single-mode-label');
    const batchModeLabel = document.getElementById('batch-mode-label');
    const singleContainer = document.getElementById('single-scan-container');
    const batchContainer = document.getElementById('batch-urls-container');

    if (scanModeToggle && singleContainer && batchContainer) {
      scanModeToggle.addEventListener('change', () => {
        if (scanModeToggle.checked) {
          // Batch mode
          singleContainer.style.display = 'none';
          batchContainer.style.display = 'block';
          singleModeLabel?.classList.remove('active');
          batchModeLabel?.classList.add('active');
          console.debug('[UIController] Switched to batch mode');
        } else {
          // Single mode
          singleContainer.style.display = 'flex';
          batchContainer.style.display = 'none';
          singleModeLabel?.classList.add('active');
          batchModeLabel?.classList.remove('active');
          console.debug('[UIController] Switched to single mode');
        }
      });
    }

    console.debug('[UIController] Event listeners attached');
  }

  showWelcome() {
    if (this.sections.welcome) this.sections.welcome.style.display = 'block';
  }

  hideWelcome() {
    if (this.sections.welcome) this.sections.welcome.style.display = 'none';
  }

  showSearch() {
    if (this.sections.search) this.sections.search.style.display = 'block';
  }

  hideSearch() {
    if (this.sections.search) this.sections.search.style.display = 'none';
  }

  showAnalysis() {
    if (this.sections.search) this.sections.search.style.display = 'none';
    if (this.sections.analysis) {
      this.sections.analysis.style.display = 'block';
      this.sections.analysis.classList.add('active');
    }
    console.debug('[UIController] Showing analysis section');
  }

  hideAnalysis() {
    if (this.sections.analysis) {
      this.sections.analysis.style.display = 'none';
      this.sections.analysis.classList.remove('active');
    }
    console.debug('[UIController] Hiding analysis section');
  }

  showError(message: string) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) errorMessage.textContent = message;
    if (this.sections.error) this.sections.error.style.display = 'block';
  }

  hideError() {
    if (this.sections.error) this.sections.error.style.display = 'none';
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new UIController();
    (window as any).UIController = controller;

    // FORCE hide analysis section after a delay to override any other code
    setTimeout(() => {
      const analysisSection = document.getElementById('analysis-section');
      if (
        analysisSection &&
        !analysisSection.querySelector('.results-container')?.hasChildNodes()
      ) {
        analysisSection.style.display = 'none';
        console.debug('[UIController] Force-hiding empty analysis section');
      }
    }, 100);
  });
} else {
  const controller = new UIController();
  (window as any).UIController = controller;

  // FORCE hide analysis section after a delay to override any other code
  setTimeout(() => {
    const analysisSection = document.getElementById('analysis-section');
    if (analysisSection && !analysisSection.querySelector('.results-container')?.hasChildNodes()) {
      analysisSection.style.display = 'none';
      console.debug('[UIController] Force-hiding empty analysis section');
    }
  }, 100);
}

export {};
