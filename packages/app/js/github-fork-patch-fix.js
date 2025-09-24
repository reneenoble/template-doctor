/**
 * Minimal fork shim.
 * Large legacy patch removed. Keeps ONLY forkAndAnalyzeRepo helper.
 */
(function minimalForkShim() {
	if (window.__MinimalForkShimApplied) return;
	window.__MinimalForkShimApplied = true; // fixed flag name

	if (
		typeof window.forkAndAnalyzeRepo !== 'function' &&
		typeof window.analyzeRepo === 'function'
	) {
		window.forkAndAnalyzeRepo = function (
			repoUrl,
			ruleSet = 'dod',
			selectedCategories = null,
		) {
			try {
				if (repoUrl && !/[?#].*fork\b/i.test(repoUrl)) {
					repoUrl += (repoUrl.includes('?') ? '&' : '?') + 'fork=1';
				}
			} catch (e) {
				// swallow
			}
			return window.analyzeRepo(repoUrl, ruleSet, selectedCategories);
		};
		console.log('[MinimalForkShim] forkAndAnalyzeRepo installed');
	}
})();