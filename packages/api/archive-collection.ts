import { wrapHttp } from "./shared/http";
import type { HttpRequest } from "@azure/functions";

interface ArchiveBody {
    collection: string;
    repoUrl: string;
    repoName: string;
    analysisId: string;
    username: string;
    timestamp: string;
    metadata: any;
}

function sanitizeSegment(v: string) {
    return String(v)
        .replace(/[^a-z0-9\-]/gi, "-")
        .toLowerCase();
}

export const handler = wrapHttp(async (req: HttpRequest, ctx) => {
    if (req.method !== "POST")
        return { status: 405, body: { error: "Method not allowed" } };
    const token = process.env.GH_WORKFLOW_TOKEN;
    const repoSlug =
        process.env.ARCHIVE_REPO_SLUG ||
        "Template-Doctor/centralized-collections-archive";
    if (!token) {
        return {
            status: 500,
            body: {
                error: "Server misconfiguration: GH_WORKFLOW_TOKEN missing",
            },
        };
    }
    const body: Partial<ArchiveBody> = (req.body as any) || {};
    const {
        collection,
        repoUrl,
        repoName,
        analysisId,
        username,
        timestamp,
        metadata,
    } = body as ArchiveBody;
    if (
        !collection ||
        !repoUrl ||
        !repoName ||
        !analysisId ||
        !username ||
        !timestamp ||
        !metadata
    ) {
        return { status: 400, body: { error: "Missing required fields" } };
    }
    const safeCollection = sanitizeSegment(collection);
    const safeRepo = sanitizeSegment(repoName);
    const safeId = sanitizeSegment(analysisId);
    const branchName = `archive-${safeCollection}-${Date.now()}`;
    const baseRef = "heads/main";
    const archivePath = `${safeCollection}/${safeRepo}/${timestamp}-${sanitizeSegment(username)}-${safeId}.json`;
    const content = Buffer.from(
        JSON.stringify(
            {
                collection: safeCollection,
                repoUrl,
                repoName,
                analysisId,
                username,
                timestamp,
                metadata,
            },
            null,
            2,
        ),
    ).toString("base64");

    // Helper for GitHub API
    async function gh(path: string, init: RequestInit = {}) {
        const headers: Record<string, string> = {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            ...(init.headers as any),
        };
        const res = await fetch(`https://api.github.com${path}`, {
            ...init,
            headers,
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(
                `${init.method || "GET"} ${path} failed ${res.status}: ${txt}`,
            );
        }
        return res.json();
    }
    try {
        const refJson = await gh(`/repos/${repoSlug}/git/ref/${baseRef}`);
        const baseSha = refJson.object && refJson.object.sha;
        await gh(`/repos/${repoSlug}/git/refs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
            }),
        });
        await gh(
            `/repos/${repoSlug}/contents/${encodeURIComponent(archivePath)}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `Add archive entry for ${repoName} in ${safeCollection}`,
                    content,
                    branch: branchName,
                }),
            },
        );
        const prJson = await gh(`/repos/${repoSlug}/pulls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: `Archive ${repoName} analysis to ${safeCollection}`,
                head: branchName,
                base: "main",
                body: `This PR archives analysis metadata for ${repoUrl} under ${archivePath}.`,
            }),
        });
        return {
            status: 200,
            body: {
                success: true,
                prUrl: prJson.html_url,
                branch: branchName,
                path: archivePath,
            },
        };
    } catch (err: any) {
        ctx.log.error("archive-collection: failure", { error: err.message });
        return { status: 500, body: { error: err.message } };
    }
});

export default handler;
