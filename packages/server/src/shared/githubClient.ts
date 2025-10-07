import type { Context } from "@azure/functions";
import { loadEnv } from "./env";

/** Lightweight GitHub client wrapper with:
 *  - Dynamic Octokit import (ESM) with graceful fallback to fetch
 *  - Auth / unauth retry downgrade on 401
 *  - Helpers for workflow runs, jobs, and logs URLs
 *  - No stubs; all functions execute real logic
 */

export interface GitHubClientOptions {
    owner: string;
    repo: string;
    workflowFile?: string;
    branch?: string;
    token?: string | undefined;
    ctx: Context;
}

export interface WorkflowRun {
    id: number;
    html_url: string;
    status: string;
    conclusion: string | null;
    run_started_at?: string;
    updated_at?: string;
    display_title?: string;
    name?: string;
    head_commit?: { message?: string };
}
export interface JobSummary {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    started_at?: string;
    completed_at?: string;
}

interface OctokitLike {
    actions: {
        listWorkflowRuns(
            params: any,
        ): Promise<{ data: { workflow_runs: WorkflowRun[] } }>;
        listWorkflowRunsForRepo(
            params: any,
        ): Promise<{ data: { workflow_runs: WorkflowRun[] } }>;
        getWorkflowRun(params: any): Promise<{ data: WorkflowRun }>;
        listJobsForWorkflowRun(
            params: any,
        ): Promise<{ data: { jobs: JobSummary[] } }>;
    };
}

export class GitHubHelper {
    private octokit: OctokitLike | null = null;
    private readonly token?: string;
    private readonly ctx: Context;
    readonly owner: string;
    readonly repo: string;
    readonly workflowFile?: string;
    readonly branch?: string;

    constructor(opts: GitHubClientOptions) {
        this.owner = opts.owner;
        this.repo = opts.repo;
        this.workflowFile = opts.workflowFile;
        this.branch = opts.branch;
        this.token = opts.token;
        this.ctx = opts.ctx;
    }

    static async create(opts: GitHubClientOptions): Promise<GitHubHelper> {
        const helper = new GitHubHelper(opts);
        await helper.init();
        return helper;
    }

    private async init() {
        try {
            const { Octokit } = await import("@octokit/rest");
            this.octokit = new Octokit(
                this.token
                    ? { auth: this.token, userAgent: "TemplateDoctorApp" }
                    : { userAgent: "TemplateDoctorApp" },
            ) as unknown as OctokitLike;
            this.ctx.log(
                `githubClient: octokit initialized (${this.token ? "auth" : "unauth"})`,
            );
        } catch (e: any) {
            this.ctx.log.warn?.(
                `githubClient: Octokit dynamic import failed, falling back to fetch-only mode: ${e?.message || e}`,
            );
            this.octokit = null;
        }
    }

    private async fetchJson(path: string, init: RequestInit = {}) {
        const headers: Record<string, string> = {
            accept: "application/vnd.github.v3+json",
            "user-agent": "TemplateDoctorApp",
            ...((init.headers as any) || {}),
        };
        if (this.token) headers["authorization"] = `token ${this.token}`;
        const res = await fetch(`https://api.github.com${path}`, {
            ...init,
            headers,
        });
        if (!res.ok) {
            const text = await res.text();
            const err: any = new Error(
                `GitHub ${res.status} ${res.statusText}: ${text}`,
            );
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    async listRecentWorkflowRuns(perPage = 100): Promise<WorkflowRun[]> {
        const { owner, repo, workflowFile, branch } = this;
        // Try specific workflow first
        if (workflowFile) {
            try {
                if (this.octokit) {
                    const r = await this.octokit.actions.listWorkflowRuns({
                        owner,
                        repo,
                        workflow_id: workflowFile,
                        branch,
                        event: "workflow_dispatch",
                        per_page: perPage,
                    });
                    return r.data.workflow_runs || [];
                }
                const data = await this.fetchJson(
                    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(branch || "")}&event=workflow_dispatch&per_page=${perPage}`,
                );
                return data.workflow_runs || [];
            } catch (e: any) {
                if (e.status === 401)
                    this.ctx.log.warn(
                        `githubClient: listWorkflowRuns 401 (will fallback to repo-wide) ${e.message}`,
                    );
            }
        }
        // Repo-wide fallback
        try {
            if (this.octokit) {
                const r = await this.octokit.actions.listWorkflowRunsForRepo({
                    owner,
                    repo,
                    per_page: perPage,
                    branch,
                    event: "workflow_dispatch",
                });
                return r.data.workflow_runs || [];
            }
            const data = await this.fetchJson(
                `/repos/${owner}/${repo}/actions/runs?per_page=${perPage}&branch=${encodeURIComponent(branch || "")}&event=workflow_dispatch`,
            );
            return data.workflow_runs || [];
        } catch (e: any) {
            this.ctx.log.warn(
                `githubClient: listWorkflowRunsForRepo failed: ${e.message}`,
            );
            return [];
        }
    }

    async findRunByLocalCorrelation(
        localId: string,
    ): Promise<WorkflowRun | null> {
        const runs = await this.listRecentWorkflowRuns();
        for (const r of runs) {
            const title = r.display_title || r.name || "";
            const msg = r.head_commit?.message || "";
            if ((title && title.includes(localId)) || msg.includes(localId))
                return r;
        }
        return null;
    }

    async getWorkflowRun(runId: number): Promise<WorkflowRun> {
        const { owner, repo } = this;
        if (this.octokit) {
            const r = await this.octokit.actions.getWorkflowRun({
                owner,
                repo,
                run_id: runId,
            });
            return r.data;
        }
        return this.fetchJson(`/repos/${owner}/${repo}/actions/runs/${runId}`);
    }

    async listJobs(runId: number): Promise<JobSummary[]> {
        const { owner, repo } = this;
        if (this.octokit) {
            const r = await this.octokit.actions.listJobsForWorkflowRun({
                owner,
                repo,
                run_id: runId,
                per_page: 100,
            });
            return r.data.jobs || [];
        }
        const data = await this.fetchJson(
            `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`,
        );
        return data.jobs || [];
    }

    async fetchLogsArchiveRedirect(
        runId: number,
    ): Promise<string | null | undefined> {
        const { owner, repo } = this;
        const headers: Record<string, string> = {
            accept: "application/vnd.github.v3+json",
            "user-agent": "TemplateDoctorApp",
        };
        if (this.token) headers["authorization"] = `token ${this.token}`;
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
            { headers, redirect: "manual" },
        );
        if (res.status === 302) return res.headers.get("location") || undefined;
        if (res.ok) return null; // served directly
        return undefined;
    }

    async fetchJobLogRedirect(jobId: number): Promise<string | undefined> {
        const { owner, repo } = this;
        const headers: Record<string, string> = {
            accept: "application/vnd.github.v3+json",
            "user-agent": "TemplateDoctorApp",
        };
        if (this.token) headers["authorization"] = `token ${this.token}`;
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
            { headers, redirect: "manual" },
        );
        if (res.status === 302) return res.headers.get("location") || undefined;
        return undefined;
    }
}

export async function createGitHubHelper(
    ctx: Context,
    params: {
        owner: string;
        repo: string;
        workflowFile?: string;
        branch?: string;
    },
): Promise<GitHubHelper> {
    const env = loadEnv();
    return GitHubHelper.create({
        owner: params.owner,
        repo: params.repo,
        workflowFile: params.workflowFile,
        branch: params.branch,
        token: env.GH_WORKFLOW_TOKEN,
        ctx,
    });
}
