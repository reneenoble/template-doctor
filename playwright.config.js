// Root delegation config: re-export app Playwright configuration
// Allows running `npx playwright test` from repo root without extra flags.
const path = require('path');
module.exports = require(path.join(__dirname, 'packages', 'app', 'playwright.config.js'));
