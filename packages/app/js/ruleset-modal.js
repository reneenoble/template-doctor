// Ruleset selection modal functionality

// Setup the ruleset modal functionality when the document is ready
document.addEventListener('DOMContentLoaded', function () {
  // Create the modal HTML if it doesn't exist
  initRulesetModal();
});

function initRulesetModal() {
  // Check if modal already exists
  if (document.getElementById('ruleset-modal')) {
    return; // Modal already exists
  }

  // Create modal HTML
  const modalDiv = document.createElement('div');
  modalDiv.id = 'ruleset-modal';
  modalDiv.className = 'modal';
  modalDiv.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Select Configuration</h2>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <p>Select the configuration ruleset to use for analyzing this template:</p>
                <form id="ruleset-form">
                    <div class="form-group">
                        <label>
                            <input type="radio" name="ruleset" value="dod" checked>
                            <strong>DoD - Default</strong>
                        </label>
                        <p class="ruleset-description">The full Definition of Done ruleset with all requirements.</p>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="radio" name="ruleset" value="partner">
                            <strong>Partner</strong>
                        </label>
                        <p class="ruleset-description">A simplified ruleset for partner templates.</p>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="radio" name="ruleset" value="docs">
                            <strong>Documentation</strong>
                        </label>
                        <p class="ruleset-description">A ruleset focused on https://aka.ms/samples guidance.</p>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="radio" name="ruleset" value="custom">
                            <strong>Custom</strong>
                        </label>
                        <p class="ruleset-description">Use a custom configuration ruleset.</p>
                    </div>
                    <div id="custom-config-container" style="display: none;">
                        <div class="custom-config-tabs">
                            <button type="button" class="tab-btn active" data-tab="paste">Paste JSON</button>
                            <button type="button" class="tab-btn" data-tab="gist">GitHub Gist URL</button>
                        </div>
                        
                        <div id="paste-tab" class="tab-content active">
                            <textarea id="custom-config-json" rows="10" placeholder="Paste your custom ruleset configuration in JSON format..."></textarea>
                        </div>
                        
                        <div id="gist-tab" class="tab-content">
                            <div class="gist-input-container">
                                <input type="text" id="gist-url" placeholder="Enter a GitHub Gist URL (e.g., https://gist.github.com/username/gistid)" class="gist-input" />
                                <button type="button" id="fetch-gist-btn" class="btn btn-small">Fetch Gist</button>
                            </div>
                        </div>
                        
                        <p class="helper-text">
                            JSON format should match the structure of the DoD ruleset. 
                            <a href="https://gist.github.com/anfibiacreativa/d8f29b232397069ec3157c8be799c1ac" target="_blank">Learn More</a>
                        </p>
                    </div>
          <div id="advanced-config" class="form-group" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <i class="fas fa-sliders-h" aria-hidden="true"></i>
            <strong>Advanced: Select categories to check</strong>
            </div>
            <div id="advanced-checkboxes" style="display:grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap:6px 16px;">
            <label><input type="checkbox" name="adv-category" value="repositoryManagement"> Repository management</label>
            <label><input type="checkbox" name="adv-category" value="functionalRequirements"> Functional requirements</label>
            <label><input type="checkbox" name="adv-category" value="deployment"> Deployment</label>
            <label><input type="checkbox" name="adv-category" value="security"> Security</label>
            <label><input type="checkbox" name="adv-category" value="testing"> Testing</label>
            </div>
            <div style="font-size:12px; color:#666; margin-top:6px;">Presets will preselect these automatically. You can tweak before analyzing.</div>
          </div>
                </form>

        <div id="archive-override-container" class="form-group" style="display: none; margin-top: 12px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="archive-override" />
          <span>
            Also save metadata to the centralized archive for this analysis
            <span id="archive-override-hint" style="display:block; font-size: 12px; color: #666; margin-top: 4px;"></span>
          </span>
          </label>
        </div>
            </div>
            <div class="modal-footer">
                <button id="analyze-with-ruleset-btn" class="btn">Analyze Template</button>
            </div>
        </div>
    `;

  // Add the modal to the document body
  document.body.appendChild(modalDiv);

  // Set up the event handlers
  setupRulesetModalHandlers();
}

function setupRulesetModalHandlers() {
  const modal = document.getElementById('ruleset-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.close');
  const analyzeBtn = modal.querySelector('#analyze-with-ruleset-btn');
  const rulesetForm = modal.querySelector('#ruleset-form');
  const advancedContainer = modal.querySelector('#advanced-config');
  const advancedBoxes = () => Array.from(
    modal.querySelectorAll('input[name="adv-category"]')
  );
  const archiveOverrideContainer = modal.querySelector('#archive-override-container');
  const archiveOverrideCheckbox = modal.querySelector('#archive-override');
  const archiveOverrideHint = modal.querySelector('#archive-override-hint');
  const customConfigContainer = modal.querySelector('#custom-config-container');
  const customConfigInput = modal.querySelector('#custom-config-json');
  const gistUrlInput = modal.querySelector('#gist-url');
  const fetchGistBtn = modal.querySelector('#fetch-gist-btn');
  const tabBtns = modal.querySelectorAll('.tab-btn');
  const tabContents = modal.querySelectorAll('.tab-content');

  // Close button handler
  if (closeBtn) {
    closeBtn.onclick = function () {
      modal.style.display = 'none';
    };
  }

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      // Remove active class from all tabs
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Add active class to clicked tab and content
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const tabContent = document.getElementById(`${tabId}-tab`);

      if (tabContent) {
        tabContent.classList.add('active');
      }
    };
  });

  // Fetch gist button handler
  if (fetchGistBtn) {
    fetchGistBtn.onclick = async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const gistUrl = gistUrlInput.value.trim();

      if (!gistUrl) {
        if (window.NotificationSystem) {
          window.NotificationSystem.showWarning(
            'Missing URL',
            'Please enter a GitHub Gist URL.',
            3000,
          );
        }
        return;
      }

      // Extract Gist ID from URL
      let gistId = '';
      try {
        const urlParts = gistUrl.split('/');
        gistId = urlParts[urlParts.length - 1];

        if (!gistId) {
          throw new Error('Could not extract Gist ID from URL');
        }
      } catch (e) {
        if (window.NotificationSystem) {
          window.NotificationSystem.showError(
            'Invalid Gist URL',
            'The Gist URL is not in the expected format. Please check and try again.',
            5000,
          );
        }
        return;
      }

      fetchGistBtn.textContent = 'Loading...';
      fetchGistBtn.disabled = true;

      try {
        // Fetch the Gist content using GitHub API
        const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`);

        if (!gistResponse.ok) {
          throw new Error(
            `Failed to fetch Gist: ${gistResponse.status} ${gistResponse.statusText}`,
          );
        }

        const gistData = await gistResponse.json();

        // Get the first file in the Gist
        const files = gistData.files;
        if (!files || Object.keys(files).length === 0) {
          throw new Error('No files found in this Gist');
        }

        const firstFile = Object.values(files)[0];
        const content = firstFile.content;

        // Try to parse as JSON and validate
        const parsedConfig = JSON.parse(content);

        // Set the content in the textarea
        customConfigInput.value = JSON.stringify(parsedConfig, null, 2);

        // Switch back to paste tab to show content
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabContents.forEach((c) => c.classList.remove('active'));
        modal.querySelector('.tab-btn[data-tab="paste"]').classList.add('active');
        modal.querySelector('#paste-tab').classList.add('active');

        if (window.NotificationSystem) {
          window.NotificationSystem.showSuccess(
            'Gist Loaded',
            'Custom configuration has been loaded from the Gist.',
            3000,
          );
        }
      } catch (e) {
        if (window.NotificationSystem) {
          window.NotificationSystem.showError('Gist Loading Failed', e.message, 5000);
        }
      } finally {
        fetchGistBtn.textContent = 'Fetch Gist';
        fetchGistBtn.disabled = false;
      }
    };
  }

  // Radio button change handler for ruleset selection
  if (rulesetForm) {
    const radios = rulesetForm.querySelectorAll('input[type="radio"]');
    radios.forEach((radio) => {
      radio.onchange = function () {
        if (radio.value === 'custom') {
          customConfigContainer.style.display = 'block';

          // Try to load saved custom config
          const savedConfig = localStorage.getItem('td_custom_ruleset');
          if (savedConfig) {
            try {
              const parsedConfig = JSON.parse(savedConfig);
              customConfigInput.value = JSON.stringify(parsedConfig, null, 2);

              // If we have a gist URL, populate that field too
              if (parsedConfig.gistUrl) {
                gistUrlInput.value = parsedConfig.gistUrl;
              }
            } catch (e) {
              customConfigInput.value = '';
            }
          }
        } else {
          customConfigContainer.style.display = 'none';
        }

        // Apply preset defaults to advanced checkboxes
        applyPresetToAdvanced(radio.value);
      };
    });
  }

  // Analyze button handler
  if (analyzeBtn) {
    analyzeBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      const selectedRuleset = rulesetForm.querySelector('input[name="ruleset"]:checked').value;
      const selectedCategories = getSelectedCategories();

      // Capture per-run archive override if visible
      try {
        const cfg = window.TemplateDoctorConfig || {};
        // Only set override when globally disabled and checkbox is present
        if (archiveOverrideContainer && archiveOverrideContainer.style.display !== 'none') {
          const shouldArchiveThisRun = !!(
            archiveOverrideCheckbox && archiveOverrideCheckbox.checked
          );
          // Store as a one-time override to be picked up by submitAnalysisToGitHub
          cfg.nextAnalysisArchiveEnabledOverride = shouldArchiveThisRun;
          window.TemplateDoctorConfig = cfg;
        }
      } catch (_) {}

      // Save custom config if selected
      if (selectedRuleset === 'custom') {
        try {
          const customConfig = customConfigInput.value.trim();
          const gistUrl = gistUrlInput.value.trim();

          if (customConfig) {
            // Validate JSON
            const parsedConfig = JSON.parse(customConfig);

            // Add the Gist URL to the config for reference
            if (gistUrl) {
              parsedConfig.gistUrl = gistUrl;
            }

            localStorage.setItem('td_custom_ruleset', JSON.stringify(parsedConfig));
          }
        } catch (e) {
          if (window.NotificationSystem) {
            window.NotificationSystem.showError(
              'Invalid JSON',
              'The custom configuration contains invalid JSON. Please check and try again.',
              5000,
            );
          }
          return;
        }
      }

      // Get the repo URL from data attribute
      const repoUrl = modal.getAttribute('data-repo-url');

      // Hide the modal
      modal.style.display = 'none';

      // Call the analyze function
      if (repoUrl && window.analyzeRepo) {
        window.analyzeRepo(repoUrl, selectedRuleset, selectedCategories);
      }
    };
  }

  // Close when clicking outside of the modal
  window.onclick = function (e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };

  // Initialize archive override UI based on global config
  try {
    const cfg = window.TemplateDoctorConfig || {};
    if (cfg.archiveEnabled === true) {
      // Globally enabled: hide the override (not needed)
      if (archiveOverrideContainer) archiveOverrideContainer.style.display = 'none';
    } else {
      // Globally disabled: show the opt-in checkbox
      if (archiveOverrideContainer) archiveOverrideContainer.style.display = 'block';
      if (archiveOverrideCheckbox) archiveOverrideCheckbox.checked = false;
      if (archiveOverrideHint)
        archiveOverrideHint.textContent =
          'Global archive is OFF. Check this to archive this single run.';
    }
  } catch (_) {}
}

// Function to show the ruleset modal
function showRulesetModal(repoUrl) {
  // Make sure the modal is initialized
  initRulesetModal();

  const modal = document.getElementById('ruleset-modal');
  if (modal) {
    // Store the repo URL as a data attribute
    modal.setAttribute('data-repo-url', repoUrl);

    // Refresh archive override UI based on current runtime config (handles cases where
    // the modal was initialized earlier with different config state)
    try {
      const cfg = window.TemplateDoctorConfig || {};
      const container = modal.querySelector('#archive-override-container');
      const checkbox = modal.querySelector('#archive-override');
      const hint = modal.querySelector('#archive-override-hint');
      if (cfg.archiveEnabled === true) {
        if (container) container.style.display = 'none';
      } else {
        if (container) container.style.display = 'block';
        if (checkbox) checkbox.checked = false;
        if (hint)
          hint.textContent = 'Global archive is OFF. Check this to archive this single run.';
      }
    } catch (_) {}

    // Show the modal
    modal.style.display = 'block';

    // Initialize advanced checkboxes based on the currently selected preset
    try {
      const selectedRuleset = modal.querySelector('input[name="ruleset"]:checked')?.value || 'dod';
      applyPresetToAdvanced(selectedRuleset);
    } catch (_) {}
  }
}

// Expose the function globally
window.showRulesetModal = showRulesetModal;

// Helpers within module scope
function applyPresetToAdvanced(preset) {
  const modal = document.getElementById('ruleset-modal');
  if (!modal) return;
  const form = modal;
  const set = (name, checked) => {
    const input = form.querySelector(`input[name="adv-category"][value="${name}"]`);
    if (input) input.checked = !!checked;
  };
  if (preset === 'dod') {
    set('repositoryManagement', true);
    set('functionalRequirements', true);
    set('deployment', true);
    set('security', true);
    set('testing', false);
  } else if (preset === 'partner') {
    set('repositoryManagement', false);
    set('functionalRequirements', true);
    set('deployment', true);
    set('security', true);
    set('testing', false);
  } else if (preset === 'docs') {
    set('repositoryManagement', true);
    set('functionalRequirements', true);
    set('deployment', false);
    set('security', true);
    set('testing', false);
  } else if (preset === 'custom') {
    set('repositoryManagement', false);
    set('functionalRequirements', false);
    set('deployment', false);
    set('security', false);
    set('testing', false);
  }
}

function getSelectedCategories() {
  const modal = document.getElementById('ruleset-modal');
  if (!modal) return null;
  const selected = Array.from(modal.querySelectorAll('input[name="adv-category"]:checked')).map(
    (i) => i.value,
  );
  return {
    repositoryManagement: selected.includes('repositoryManagement'),
    functionalRequirements: selected.includes('functionalRequirements'),
    deployment: selected.includes('deployment'),
    security: selected.includes('security'),
    testing: selected.includes('testing'),
  };
}
