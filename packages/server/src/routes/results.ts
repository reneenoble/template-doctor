/**
 * Results API Routes
 *
 * Provides endpoints to query analysis results from database
 * Replaces the legacy filesystem-based results loading
 */

import { Router, Request, Response, NextFunction } from "express";
import { analysisStorage } from "../services/analysis-storage.js";

const router = Router();

/**
 * Build categories object from issues and compliant items
 * Categories are computed dynamically to match analyzer logic
 */
function buildCategoriesFromIssues(issues: any[], compliant: any[]) {
    const categoryKeys = [
        "repositoryManagement",
        "functionalRequirements",
        "deployment",
        "security",
        "testing",
        "agents",
    ];

    const categories: Record<
        string,
        {
            enabled: boolean;
            issues: any[];
            compliant: any[];
            percentage: number;
        }
    > = {};

    // Initialize categories
    for (const key of categoryKeys) {
        categories[key] = {
            enabled: true,
            issues: [],
            compliant: [],
            percentage: 0,
        };
    }

    // Category mapping
    const categoryMap: Record<string, string> = {
        file: "repositoryManagement",
        folder: "repositoryManagement",
        missing: "repositoryManagement",
        required: "repositoryManagement",
        readme: "functionalRequirements",
        documentation: "functionalRequirements",
        workflow: "deployment",
        infra: "deployment",
        infrastructure: "deployment",
        azure: "deployment",
        bicep: "deployment",
        bicepFiles: "deployment",
        security: "security",
        auth: "security",
        authentication: "security",
        testing: "testing",
        test: "testing",
        agents: "agents",
        meta: "meta",
    };

    // Distribute issues to categories
    for (const issue of issues) {
        const cat = issue.category || "general";
        const mappedCat = categoryMap[cat] || "repositoryManagement";
        if (categories[mappedCat]) {
            categories[mappedCat].issues.push(issue);
        }
    }

    // Distribute compliant items to categories
    for (const item of compliant) {
        const cat = item.category || "general";
        const mappedCat = categoryMap[cat] || "repositoryManagement";
        if (mappedCat !== "meta" && categories[mappedCat]) {
            categories[mappedCat].compliant.push(item);
        }
    }

    // Calculate percentage for each category
    for (const key of Object.keys(categories)) {
        const cat = categories[key];
        const total = cat.issues.length + cat.compliant.length;
        cat.percentage =
            total > 0 ? Math.round((cat.compliant.length / total) * 100) : 0;
    }

    return categories;
}

/**
 * GET /api/v4/results/latest
 * Get latest analysis results (for tiles/dashboard)
 * V2: Queries repos collection with latestAnalysis summary
 *
 * Query params:
 * - limit: Number of results to return (default: 50, max: 200)
 */
router.get(
    "/results/latest",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = Math.min(
                parseInt(req.query.limit as string) || 50,
                200,
            );
            const repos = await analysisStorage.getLatestAnalyses(limit);

            res.json({
                count: repos.length,
                results: repos.map((r) => ({
                    id: r._id?.toString(),
                    repoUrl: r.repoUrl,
                    owner: r.owner,
                    repo: r.repo,
                    latestAnalysis: r.latestAnalysis
                        ? {
                              scanDate: r.latestAnalysis.scanDate,
                              ruleSet: r.latestAnalysis.ruleSet,
                              compliancePercentage:
                                  r.latestAnalysis.compliancePercentage,
                              passed: r.latestAnalysis.passed,
                              issues: r.latestAnalysis.issues,
                          }
                        : null,
                    tags: r.tags || [],
                })),
            });
        } catch (error: any) {
            console.error(
                "[Results API] Latest results failed:",
                error?.message,
            );
            next(error);
        }
    },
);

/**
 * GET /api/v4/results/leaderboard
 * Get leaderboard (top templates by compliance)
 *
 * Query params:
 * - limit: Number of results (default: 100, max: 500)
 */
router.get(
    "/results/leaderboard",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = Math.min(
                parseInt(req.query.limit as string) || 100,
                500,
            );
            const leaderboard = await analysisStorage.getLeaderboard(limit);

            res.json({
                count: leaderboard.length,
                leaderboard,
            });
        } catch (error: any) {
            console.error("[Results API] Leaderboard failed:", error?.message);
            next(error);
        }
    },
);

/**
 * GET /api/v4/results/repo/:owner/:repo
 * Get repository with historical analyses (V2: repos + last 10 from analysis)
 */
router.get(
    "/results/repo/:owner/:repo",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { owner, repo } = req.params;
            const repoUrl = `https://github.com/${owner}/${repo}`;

            // V2: Get repo document + historical analyses
            const { database } = await import("../services/database.js");

            const [repoDoc, analyses, stats] = await Promise.all([
                database.repos.findOne({ repoUrl }),
                analysisStorage.getAnalysesByRepo(repoUrl),
                analysisStorage.getTemplateStats(repoUrl),
            ]);

            if (!repoDoc) {
                return res.status(404).json({ error: "Repository not found" });
            }

            res.json({
                repoUrl,
                owner,
                repo,
                latestAnalysis: repoDoc.latestAnalysis,
                latestAzdTest: repoDoc.latestAzdTest,
                tags: repoDoc.tags || [],
                count: analyses.length,
                stats,
                analyses: analyses.map((a) => {
                    // Compute categories from issues/compliant if not present
                    const categories =
                        a.categories ||
                        buildCategoriesFromIssues(
                            Array.isArray(a.issues) ? a.issues : [],
                            Array.isArray(a.compliant) ? a.compliant : [],
                        );

                    return {
                        id: a._id?.toString(),
                        ruleSet: a.ruleSet,
                        timestamp: a.timestamp,
                        scanDate: a.scanDate,
                        compliance: a.compliance,
                        categories,
                        issues: a.issues,
                        compliant: a.compliant,
                        analysisResult: a.analysisResult,
                        scannedBy: a.scannedBy,
                        createdBy: a.createdBy,
                    };
                }),
            });
        } catch (error: any) {
            console.error("[Results API] Repo results failed:", error?.message);
            next(error);
        }
    },
);

/**
 * GET /api/v4/results/:id
 * Get full analysis result by ID
 */
router.get(
    "/results/:id",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const analysis = await analysisStorage.getAnalysisById(id);

            if (!analysis) {
                return res.status(404).json({ error: "Analysis not found" });
            }

            res.json(analysis);
        } catch (error: any) {
            console.error("[Results API] Get result failed:", error?.message);
            next(error);
        }
    },
);

/**
 * GET /api/v4/results/search
 * Search analyses by criteria
 *
 * Query params:
 * - owner: Filter by owner
 * - repo: Filter by repo name
 * - ruleSet: Filter by ruleset
 * - minCompliance: Minimum compliance percentage
 * - limit: Number of results (default: 50, max: 200)
 */
router.get(
    "/results/search",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { owner, repo, ruleSet, minCompliance } = req.query;
            const limit = Math.min(
                parseInt(req.query.limit as string) || 50,
                200,
            );

            const filter: any = {};

            if (owner) filter.owner = owner;
            if (repo) filter.repo = repo;
            if (ruleSet) filter.ruleSet = ruleSet;
            if (minCompliance) {
                filter["compliance.percentage"] = {
                    $gte: parseFloat(minCompliance as string),
                };
            }

            const { database } = await import("../services/database.js");
            const results = await database.analysis
                .find(filter)
                .sort({ scanDate: -1 })
                .limit(limit)
                .toArray();

            res.json({
                count: results.length,
                filter,
                results: results.map((r) => ({
                    id: r._id?.toString(),
                    repoUrl: r.repoUrl,
                    owner: r.owner,
                    repo: r.repo,
                    ruleSet: r.ruleSet,
                    timestamp: r.timestamp,
                    scanDate: r.scanDate,
                    compliance: r.compliance,
                })),
            });
        } catch (error: any) {
            console.error("[Results API] Search failed:", error?.message);
            next(error);
        }
    },
);

export { router as resultsRouter };
