const fs = require("fs");
const path = require("path");
const core = require("@actions/core");

async function run() {
    try {
        // Inputs
        const repoUrl = core.getInput("repo-url");
        const ruleSet = core.getInput("rule-set");
        const username = core.getInput("username");
        const timestamp = core.getInput("timestamp");
        const analysisDataRaw = core.getInput("analysis-data");
        const upstreamInput = core.getInput("upstream");
        const originUpstreamInput = core.getInput("origin-upstream");

        core.info(`Processing analysis for repo: ${repoUrl}`);
        core.info(`Rule Set: ${ruleSet}, Username: ${username}`);
        if (upstreamInput) core.info(`Upstream (from input): ${upstreamInput}`);
        if (originUpstreamInput)
            core.info(`Origin Upstream (from input): ${originUpstreamInput}`);

        // Parse analysis data (robust to double-encoded JSON)
        let analysisData;
        try {
            const first = JSON.parse(analysisDataRaw);
            // If first parse yields a string, try parsing again (double-encoded payloads)
            analysisData =
                typeof first === "string" ? JSON.parse(first) : first;
            core.info("Analysis data parsed successfully");
        } catch (parseError) {
            core.warning(
                `Failed to parse analysis data: ${parseError.message}`,
            );
            core.setFailed(`Invalid JSON in analysis-data input.`);
            return;
        }

        // Repo folder name (sanitize URL: strip trailing slash and .git)
        const sanitizedRepoUrl = String(repoUrl)
            .replace(/\/+$/, "")
            .replace(/\.git$/i, "");
        const repoUrlParts = sanitizedRepoUrl.split("/");
        const repoName =
            repoUrlParts.length >= 2
                ? `${repoUrlParts[repoUrlParts.length - 2]}-${repoUrlParts[repoUrlParts.length - 1]}`
                : sanitizedRepoUrl.split("/").pop();

        // Compliance summary
        const complianceSummary = analysisData.compliance?.compliant?.find(
            (c) => c.id === "compliance-summary",
        );
        const percentageCompliant =
            complianceSummary?.details?.percentageCompliant || 0;
        const issuesCount = analysisData.compliance?.issues?.length || 0;
        const passedCount = analysisData.compliance?.compliant?.length || 0;

        // Timestamp for file names
        const fileTimestamp = Date.now();

        // Canonical upstream
        const canonicalOriginUpstream = (
            originUpstreamInput ||
            upstreamInput ||
            ""
        ).trim();
        if (!canonicalOriginUpstream) {
            core.warning(
                "origin-upstream (or upstream) is not provided. Proceeding without canonical upstream.",
            );
        }

        // Template data
        const templateData = {
            timestamp,
            dashboardPath: `${fileTimestamp}-dashboard.html`,
            dataPath: `${fileTimestamp}-data.js`,
            repoUrl,
            collection: "aigallery",
            ruleSet,
            compliance: {
                percentage: percentageCompliant,
                issues: issuesCount,
                passed: passedCount,
            },
            scannedBy: [username],
            relativePath: `${repoName}/${fileTimestamp}-dashboard.html`,
            ...(canonicalOriginUpstream
                ? { originUpstream: canonicalOriginUpstream }
                : {}),
        };

        // Resolve root of repo (scripts/ is under root)
        const rootDir = path.resolve(__dirname, "..");

        // Index-data path under monorepo app/results
        const indexDataPath = path.join(
            rootDir,
            "packages",
            "app",
            "results",
            "index-data.js",
        );
        core.info(`Index data path: ${indexDataPath}`);

        // Read or init index-data
        let indexDataText;
        try {
            indexDataText = fs.readFileSync(indexDataPath, "utf8");
        } catch (readErr) {
            core.warning(
                `index-data.js not found, initializing new. Reason: ${readErr.message}`,
            );
            indexDataText = "window.templatesData = [];";
        }

        // Parse templatesData
        let templatesData = [];
        const match = indexDataText.match(
            /window\.templatesData\s*=\s*(\[[\s\S]*?\]);/,
        );
        if (match && match[1]) {
            try {
                templatesData = JSON.parse(match[1]);
            } catch (e) {
                core.warning(
                    `Failed to parse templatesData; reinitializing. ${e.message}`,
                );
                templatesData = [];
            }
        }

        // Upsert entry
        const existingIndex = templatesData.findIndex(
            (t) => t.repoUrl === repoUrl,
        );
        if (existingIndex >= 0) {
            const existing = templatesData[existingIndex];
            if (!Array.isArray(existing.scannedBy)) existing.scannedBy = [];
            if (!existing.scannedBy.includes(username))
                existing.scannedBy.push(username);
            existing.timestamp = timestamp;
            existing.dashboardPath = templateData.dashboardPath;
            existing.dataPath = templateData.dataPath;
            existing.ruleSet = ruleSet;
            existing.collection = "aigallery";
            existing.compliance = templateData.compliance;
            existing.relativePath = templateData.relativePath;
            if (canonicalOriginUpstream) {
                existing.originUpstream = canonicalOriginUpstream;
            }
            templatesData[existingIndex] = existing;
        } else {
            templatesData.unshift(templateData);
        }

        // Ensure results dir exists (packages/app/results)
        const resultsRootDir = path.dirname(indexDataPath);
        if (!fs.existsSync(resultsRootDir)) {
            fs.mkdirSync(resultsRootDir, { recursive: true });
        }

        // Write index-data.js preserving the existing wrapper/auth logic
        const arrayJson = JSON.stringify(templatesData, null, 2);
        const replaceRe = /(window\.templatesData\s*=\s*)(\[[\s\S]*?\])(\s*;?)/;
        let newIndexDataText;
        if (replaceRe.test(indexDataText)) {
            // Replace only the array content inside the existing file, preserving wrapper and auth gating
            newIndexDataText = indexDataText.replace(
                replaceRe,
                `$1${arrayJson}$3`,
            );
            core.info(
                "Updated templatesData array within existing index-data.js wrapper.",
            );
        } else {
            // Fallback: create a minimal wrapper that preserves auth gating semantics
            core.warning(
                "Could not find templatesData array in index-data.js; writing a guarded wrapper as fallback.",
            );
            newIndexDataText = `// Control visibility of results via runtime config\n(function() {\n  try {\n    if (!window.templatesData) window.templatesData = [];\n    const cfg = window.TemplateDoctorConfig || {};\n    const requireAuth = typeof cfg.requireAuthForResults === 'boolean' ? cfg.requireAuthForResults : true;\n    const isAuthed = !!(window.GitHubAuth && window.GitHubAuth.isAuthenticated && window.GitHubAuth.isAuthenticated());\n    if (!requireAuth || isAuthed) {\n      window.templatesData = ${arrayJson};\n    } else {\n      window.templatesData = [];\n    }\n  } catch (e) {\n    // In case runtime config or auth is unavailable, fall back to exposing data\n    window.templatesData = ${arrayJson};\n  }\n})();\n`;
        }
        fs.writeFileSync(indexDataPath, newIndexDataText);

        // Repository-specific results dir inside packages/app/results
        const repoResultsDir = path.join(resultsRootDir, repoName);
        if (!fs.existsSync(repoResultsDir))
            fs.mkdirSync(repoResultsDir, { recursive: true });

        // Data file (window.templateData)
        const dataFilePath = path.join(repoResultsDir, templateData.dataPath);
        fs.writeFileSync(
            dataFilePath,
            `window.templateData = ${JSON.stringify(analysisData, null, 2)};`,
        );

        // Dashboard HTML referencing app assets under ../../ (relative to repoResultsDir)
        const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Template Analysis: ${repoUrl}</title>
  <link rel="stylesheet" href="../../css/style.css" />
  <link rel="stylesheet" href="../../css/dashboard.css" />
  <script src="${templateData.dataPath}" defer></script>
  <script src="../../js/dashboard-renderer.js" defer></script>
</head>
<body>
  <div class="container">
    <header>
      <h1>Template Analysis: ${repoName}</h1>
      <div class="meta">
        <p>Repository: <a href="${repoUrl}" target="_blank">${repoUrl}</a></p>
        <p>Analyzed: ${new Date(timestamp).toLocaleString()}</p>
        <p>Rule Set: ${ruleSet?.toUpperCase?.() || ruleSet}</p>
        <p>Scanned by: ${username}</p>
      </div>
    </header>
    <main id="results-container">
      <div class="loading">Loading analysis results...</div>
    </main>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (window.DashboardRenderer && window.templateData) {
        const renderer = new DashboardRenderer();
        renderer.render(window.templateData, document.getElementById('results-container'));
      }
    });
  </script>
</body>
</html>`;

        const dashboardPath = path.join(
            repoResultsDir,
            templateData.dashboardPath,
        );
        fs.writeFileSync(dashboardPath, dashboardHtml);

        // ===== CREATE latest.json =====
        const latestJsonPath = path.join(repoResultsDir, "latest.json");
        const latestJson = {
            repoUrl,
            ruleSet,
            timestamp,
            dataPath: templateData.dataPath,
            dashboardPath: templateData.dashboardPath,
            compliance: {
                percentage: percentageCompliant,
                issues: issuesCount,
                passed: passedCount,
            },
        };
        fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2));
        core.info(`Created/updated latest.json: ${latestJsonPath}`);

        // ===== CREATE/UPDATE history.json =====
        const historyJsonPath = path.join(repoResultsDir, "history.json");
        let historyArray = [];
        if (fs.existsSync(historyJsonPath)) {
            try {
                const existingHistory = fs.readFileSync(
                    historyJsonPath,
                    "utf8",
                );
                historyArray = JSON.parse(existingHistory);
            } catch (e) {
                core.warning(
                    `Could not parse existing history.json, starting fresh: ${e.message}`,
                );
                historyArray = [];
            }
        }

        const historyEntry = {
            timestamp,
            ruleSet,
            percentage: percentageCompliant,
            issues: issuesCount,
            passed: passedCount,
            dataPath: templateData.dataPath,
            dashboardPath: templateData.dashboardPath,
        };
        historyArray.push(historyEntry);

        // Sort by timestamp descending (newest first)
        historyArray.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
        );

        fs.writeFileSync(
            historyJsonPath,
            JSON.stringify(historyArray, null, 2),
        );
        core.info(`Created/updated history.json: ${historyJsonPath}`);

        // ===== CREATE scan-meta-{timestamp}.js =====
        const scanMetaPath = path.join(
            repoResultsDir,
            `scan-meta-${fileTimestamp}.js`,
        );
        const scanMetaContent = `window.__TD_DYNAMIC_RESULTS = window.__TD_DYNAMIC_RESULTS || [];
window.__TD_DYNAMIC_RESULTS.push({
  timestamp: "${timestamp}",
  dashboardPath: "${templateData.dashboardPath}",
  dataPath: "${templateData.dataPath}",
  repoUrl: "${repoUrl}",
  collection: "${templateData.collection}",
  ruleSet: "${ruleSet}",
  compliance: ${JSON.stringify({
      percentage: percentageCompliant,
      issues: issuesCount,
      passed: passedCount,
  })},
  scannedBy: ${JSON.stringify([username])},
  relativePath: "${templateData.relativePath}"
});
`;
        fs.writeFileSync(scanMetaPath, scanMetaContent);
        core.info(`Created scan-meta file: ${scanMetaPath}`);

        core.setOutput("template-data", JSON.stringify(templateData));
        core.info(`Successfully updated template analysis for ${repoUrl}`);
    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();
