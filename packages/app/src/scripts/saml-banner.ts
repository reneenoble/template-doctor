/**
 * SAML Banner - Dismissible warning banner
 * Handles showing/hiding the SAML/SSO authentication warning banner
 * with localStorage persistence
 */

const BANNER_DISMISSED_KEY = 'saml-banner-dismissed';

function initSamlBanner(): void {
  const banner = document.getElementById('saml-banner');
  const closeBtn = document.getElementById('close-saml-banner');

  if (!banner || !closeBtn) {
    return;
  }

  // Check if banner was previously dismissed
  const wasDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  
  if (wasDismissed) {
    banner.classList.add('hidden');
  }

  // Handle close button click
  closeBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSamlBanner);
} else {
  initSamlBanner();
}
