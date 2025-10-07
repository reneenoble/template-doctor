import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";

// Lazy load Octokit only when needed (saves cold start & avoids ESM require clash)
async function getOctokit(authToken: string) {
    const { Octokit } = await import("@octokit/rest");
    return new Octokit({ auth: authToken });
}

interface TemplateData {
    timestamp: number;
    repoUrl: string;
    ruleSet?: string;
    compliance: { percentage: number; issues: number; passed: number };
    scannedBy?: string[];
    originUpstream?: string;
    // enriched fields added during processing
    dashboardPath?: string;
    dataPath?: string;
    relativePath?: string;
}

export default wrapHttp(async (req: any, _ctx: Context, requestId: string) => {
    if (req.method === "OPTIONS") return { status: 204 };
    if (req.method !== "POST")
        return {
            status: 405,
            body: { error: "Method Not Allowed", requestId },
        };

    const tokenHeader: string | undefined =
        req.headers["authorization"] || req.headers["Authorization"];
    const token = tokenHeader?.replace(/Bearer\s+/i, "").trim();
    if (!token)
        return {
            status: 401,
            body: { error: "Authorization token is required", requestId },
        };

    const templateData: TemplateData | undefined = req.body;
    if (!validateTemplateData(templateData)) {
        return {
            status: 400,
            body: { error: "Invalid or missing template data", requestId },
        };
    }

    try {
        const octokit = await getOctokit(token);
        const { data: user } = await octokit.users.getAuthenticated();

        const owner = process.env.GITHUB_REPO_OWNER || user.login; // fallback to caller
        const repo = process.env.GITHUB_REPO_NAME || "template-doctor";

        const DEFAULT_BRANCH = "main";
        let baseBranch = DEFAULT_BRANCH;
        let sourceBranch = DEFAULT_BRANCH; // track branch we branched from for history/latest lookups

        // Ensure repository exists / accessible
        try {
            await octokit.repos.get({ owner, repo });
        } catch (e: any) {
            return {
                status: 400,
                body: {
                    error: "Repository access error",
                    details: `Cannot access repository ${owner}/${repo}. Check name & permissions.`,
                    originalError: e?.message,
                    requestId,
                },
            };
        }

        // Resolve base commit SHA (attempt configured branch then default)
        let baseCommitSha: string;
        try {
            const { data: refData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${baseBranch}`,
            });
            baseCommitSha = refData.object.sha;
        } catch (branchErr: any) {
            const { data: repoData } = await octokit.repos.get({ owner, repo });
            baseBranch = repoData.default_branch;
            sourceBranch = baseBranch;
            const { data: defaultRef } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${baseBranch}`,
            });
            baseCommitSha = defaultRef.object.sha;
        }

        const timestamp = Date.now();
        const branchName = `add-template-${timestamp}`;
        const repoIdentifier = getRepoIdentifier(templateData.repoUrl);

        // Create branch
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseCommitSha,
        });

        const folderName = getTemplateFolderName(templateData.repoUrl);
        const folderPath = `packages/app/results/${folderName}`;

        // Ensure folder (via .gitkeep if absent)
        try {
            await octokit.repos.getContent({
                owner,
                repo,
                path: folderPath,
                ref: branchName,
            });
        } catch {
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `${folderPath}/.gitkeep`,
                message: `Create folder for template: ${repoIdentifier}`,
                content: Buffer.from("").toString("base64"),
                branch: branchName,
            });
        }

        const timestampStr = timestamp.toString();
        const dashboardFileName = `${timestampStr}-dashboard.html`;
        const dataFileName = `${timestampStr}-data.js`;

        // Mutate templateData with derived fields before serialization
        templateData.dashboardPath = dashboardFileName;
        templateData.dataPath = dataFileName;
        templateData.relativePath = `${folderName}/${dashboardFileName}`;

        // Write data file
        const dataContent = createResultData(templateData);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/${dataFileName}`,
            message: `Add data file for template: ${repoIdentifier}`,
            content: Buffer.from(dataContent).toString("base64"),
            branch: branchName,
        });

        // Write dashboard file
        const dashboardHtml = createDashboardHtml(templateData, dataFileName);
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/${dashboardFileName}`,
            message: `Add dashboard file for template: ${repoIdentifier}`,
            content: Buffer.from(dashboardHtml).toString("base64"),
            branch: branchName,
        });

        // latest.json
        let latestSha: string | undefined;
        try {
            const { data: latestFile }: any = await octokit.repos.getContent({
                owner,
                repo,
                path: `${folderPath}/latest.json`,
                ref: sourceBranch,
            });
            latestSha = latestFile?.sha;
        } catch {
            /* create new */
        }
        const latestObj = createLatestJson(
            templateData,
            dataFileName,
            dashboardFileName,
        );
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/latest.json`,
            message: `Update latest.json for template: ${repoIdentifier}`,
            content: Buffer.from(JSON.stringify(latestObj, null, 2)).toString(
                "base64",
            ),
            branch: branchName,
            sha: latestSha,
        });

        // history.json
        let history: any[] = [];
        let historySha: string | undefined;
        try {
            const { data: historyFile }: any = await octokit.repos.getContent({
                owner,
                repo,
                path: `${folderPath}/history.json`,
                ref: sourceBranch,
            });
            const decoded = Buffer.from(
                historyFile.content,
                "base64",
            ).toString();
            const parsed = JSON.parse(decoded);
            if (Array.isArray(parsed)) history = parsed;
            historySha = historyFile?.sha;
        } catch {
            /* none */
        }
        history.push(
            createHistoryEntry(templateData, dataFileName, dashboardFileName),
        );
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folderPath}/history.json`,
            message: `Update history.json for template: ${repoIdentifier}`,
            content: Buffer.from(JSON.stringify(history, null, 2)).toString(
                "base64",
            ),
            branch: branchName,
            sha: historySha,
        });

        // Update index-data.js
        const { data: indexFile }: any = await octokit.repos.getContent({
            owner,
            repo,
            path: "packages/app/results/index-data.js",
            ref: branchName,
        });
        const indexContent = Buffer.from(
            indexFile.content,
            "base64",
        ).toString();
        const updatedIndex = addTemplateToIndexData(
            indexContent,
            templateData as any,
        );
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: "packages/app/results/index-data.js",
            message: `Add template: ${repoIdentifier} to index`,
            content: Buffer.from(updatedIndex).toString("base64"),
            branch: branchName,
            sha: indexFile.sha,
        });

        // Pull Request
        const prBody = buildPrBody(
            templateData,
            folderPath,
            dashboardFileName,
            dataFileName,
        );
        const { data: pr } = await octokit.pulls.create({
            owner,
            repo,
            title: `Add template: ${repoIdentifier}`,
            head: branchName,
            base: baseBranch,
            body: prBody,
        });

        return {
            status: 200,
            body: { success: true, prUrl: pr.html_url, requestId },
        };
    } catch (e: any) {
        return {
            status: 500,
            body: {
                error: "Failed to create pull request",
                details: e?.message,
                requestId,
            },
        };
    }
});

function validateTemplateData(d: any): d is TemplateData {
    return !!(
        d &&
        typeof d.timestamp === "number" &&
        typeof d.repoUrl === "string" &&
        d.compliance &&
        typeof d.compliance.percentage === "number" &&
        typeof d.compliance.issues === "number" &&
        typeof d.compliance.passed === "number"
    );
}

function addTemplateToIndexData(content: string, templateData: any): string {
    const arrayStart = content.indexOf("[");
    if (arrayStart === -1)
        throw new Error("Could not find array start in index-data.js");
    const templateJson = JSON.stringify(templateData, null, 2)
        .replace(/^{/gm, "  {")
        .replace(/^}/gm, "  }")
        .replace(/^  "(.+)":/gm, '    "$1":');
    return (
        content.slice(0, arrayStart + 1) +
        "\n" +
        templateJson +
        "," +
        content.slice(arrayStart + 1)
    );
}

function getRepoIdentifier(url: string): string {
    try {
        const u = new URL(url);
        const p = u.pathname.split("/");
        if (p.length >= 3) return `${p[1]}/${p[2]}`;
        return url.replace(/https?:\/\//, "");
    } catch {
        return url;
    }
}

function getTemplateFolderName(url: string): string {
    try {
        const u = new URL(url);
        const p = u.pathname.split("/");
        if (p.length >= 3) return `${p[1]}-${p[2]}`;
    } catch {
        /* noop */
    }
    return url
        .replace(/https?:\/\/|[^a-zA-Z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "");
}

function createResultData(templateData: TemplateData): string {
    // Preserve existing JS format (window.reportData = ...;)
    const issues = templateData.compliance.issues;
    const passed = templateData.compliance.passed;
    const report = {
        repoUrl: templateData.repoUrl,
        ruleSet: templateData.ruleSet || "default",
        timestamp: templateData.timestamp,
        compliance: {
            issues: Array.isArray(issues)
                ? issues
                : typeof issues === "number"
                  ? Array(issues)
                        .fill(null)
                        .map((_, i) => ({
                            id: `issue-${i + 1}`,
                            severity: "info",
                            message: `Placeholder issue ${i + 1}`,
                        }))
                  : [],
            compliant: Array.isArray(passed)
                ? passed
                : typeof passed === "number"
                  ? Array(passed)
                        .fill(null)
                        .map((_, i) => ({
                            id: `passed-${i + 1}`,
                            category: "placeholder",
                            message: `Placeholder passed check ${i + 1}`,
                        }))
                  : [],
            summary: `Issues found - Compliance: ${templateData.compliance.percentage}%`,
        },
        upstreamTemplate:
            typeof templateData.originUpstream === "string" &&
            templateData.originUpstream.includes("/")
                ? templateData.originUpstream.trim()
                : undefined,
        history: [
            {
                timestamp: templateData.timestamp,
                ruleSet: templateData.ruleSet || "default",
                percentage: templateData.compliance.percentage,
                issues: templateData.compliance.issues,
                passed: templateData.compliance.passed,
                dashboardPath: templateData.dashboardPath || "",
            },
        ],
    };
    return `window.reportData = ${JSON.stringify(report, null, 2)};`;
}

function createDashboardHtml(
    templateData: TemplateData,
    dataFileName: string,
): string {
    // Keep logic minimal; we cannot access file system safely in Azure Functions consumption if ESM mismatch
    const repoName = getRepoIdentifier(templateData.repoUrl);
    const timestampStr = new Date(templateData.timestamp).toLocaleString();
    const percent = templateData.compliance.percentage;
    const gaugeClass =
        percent >= 80 ? "high" : percent >= 50 ? "medium" : "low";
    return `<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Template Doctor - ${repoName} Analysis</title><style>body{font-family:Arial, sans-serif;margin:0;padding:20px;line-height:1.6}.gauge{height:20px;background:#eee;border-radius:10px;overflow:hidden;margin:10px 0}.gauge-fill{height:100%;border-radius:10px}.high{background:#107c10}.medium{background:#f0ad4e}.low{background:#d83b01}</style></head><body><h1>${repoName}</h1><p>Rule Set: ${templateData.ruleSet || "Default"}</p><p>Analyzed on: ${timestampStr}</p><h3>Compliance Score: ${percent}%</h3><div class=\"gauge\"><div class=\"gauge-fill ${gaugeClass}\" style=\"width:${percent}%\"></div></div><p>Issues: ${templateData.compliance.issues} | Passed: ${templateData.compliance.passed} | Total: ${templateData.compliance.issues + templateData.compliance.passed}</p><script src=\"${dataFileName}\"></script></body></html>`;
}

function createLatestJson(
    templateData: TemplateData,
    dataFileName: string,
    dashboardFileName: string,
) {
    return {
        repoUrl: templateData.repoUrl,
        ruleSet: templateData.ruleSet || "default",
        timestamp: templateData.timestamp,
        dataPath: dataFileName,
        dashboardPath: dashboardFileName,
        compliance: {
            percentage: templateData.compliance.percentage,
            issues: templateData.compliance.issues,
            passed: templateData.compliance.passed,
        },
    };
}

function createHistoryEntry(
    templateData: TemplateData,
    dataFileName: string,
    dashboardFileName: string,
) {
    return {
        timestamp: templateData.timestamp,
        ruleSet: templateData.ruleSet || "default",
        percentage: templateData.compliance.percentage,
        issues: templateData.compliance.issues,
        passed: templateData.compliance.passed,
        dataPath: dataFileName,
        dashboardPath: dashboardFileName,
    };
}

function buildPrBody(
    t: TemplateData,
    folderPath: string,
    dashboardFile: string,
    dataFile: string,
): string {
    return `This PR adds a new template scan for ${t.repoUrl} to Template Doctor.\n\n### Template Details\n- Repository: ${t.repoUrl}\n- Rule Set: ${t.ruleSet || "default"}\n- Compliance: ${t.compliance.percentage}%\n- Issues: ${t.compliance.issues}\n- Passed: ${t.compliance.passed}\n- Scanned By: ${t.scannedBy?.join(", ") || "Template Doctor"}\n\n### Files Created/Updated\n- Added template to index-data.js\n- Created folder: ${folderPath}\n- Created dashboard file: ${folderPath}/${dashboardFile}\n- Created data file: ${folderPath}/${dataFile}\n- Created/Updated latest.json: ${folderPath}/latest.json\n- Created/Updated history.json: ${folderPath}/history.json\n`;
}
