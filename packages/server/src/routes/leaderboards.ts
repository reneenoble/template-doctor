import { Router, Request, Response, NextFunction } from 'express';
import { database } from '../services/database.js';

const router = Router();

/**
 * GET /api/v4/leaderboards/:section
 * Get leaderboard data for a specific section
 */
router.get('/:section', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section } = req.params;
    const { collection, limit } = req.query;

    // Check database connectivity
    const dbHealth = await database.healthCheck();
    if (!dbHealth.connected) {
      return res.status(503).json({
        section,
        data: [],
        available: false,
        error: 'Database not available',
        generatedAt: new Date().toISOString(),
      });
    }

    let data: any[] = [];
    let available = true;
    let total: number | undefined;

    switch (section) {
      // ========================================
      // PHASE 1: Implemented (No schema changes)
      // ========================================

      case 'most-issues':
        data = await database.repos
          .aggregate([
            {
              $match: {
                'latestAnalysis.issues': { $exists: true, $ne: null },
              },
            },
            {
              $addFields: {
                issuesCount: { $ifNull: ['$latestAnalysis.issues', 0] },
                compliancePercentage: { $ifNull: ['$latestAnalysis.compliancePercentage', 0] },
                severity: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $lt: [{ $ifNull: ['$latestAnalysis.compliancePercentage', 0] }, 70],
                        },
                        then: 'high',
                      },
                      {
                        case: {
                          $lt: [{ $ifNull: ['$latestAnalysis.compliancePercentage', 0] }, 85],
                        },
                        then: 'medium',
                      },
                    ],
                    default: 'low',
                  },
                },
              },
            },
            { $sort: { issuesCount: -1 } },
            { $limit: parseInt(limit as string) || 10 },
            {
              $project: {
                name: '$repo',
                author: '$owner',
                issues: '$issuesCount',
                severity: 1,
                _id: 0,
              },
            },
          ])
          .toArray();
        break;

      case 'prevalent-issues':
        // For this aggregation, we need to query the analysis collection (not repos)
        // because repos doesn't store detailed category/check information
        data = await database.analysis
          .aggregate([
            {
              $match: {
                categories: { $exists: true, $ne: null },
              },
            },
            {
              $unwind: { path: '$categories', preserveNullAndEmptyArrays: false },
            },
            {
              $group: {
                _id: '$categories.category',
                count: { $sum: 1 },
              },
            },
            {
              $match: {
                _id: { $ne: null },
              },
            },
            {
              $project: {
                category: '$_id',
                issue: '$_id',
                count: 1,
                _id: 0,
              },
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit as string) || 8 },
          ])
          .toArray();
        break;

      case 'active-templates':
        // Count analyses per repo from analysis collection
        const activityCounts = await database.analysis
          .aggregate([
            {
              $group: {
                _id: '$repoUrl',
                totalScans: { $sum: 1 },
                owner: { $first: '$owner' },
                repo: { $first: '$repo' },
              },
            },
            { $sort: { totalScans: -1 } },
            { $limit: parseInt(limit as string) || 10 },
          ])
          .toArray();

        data = activityCounts.map((a) => ({
          name: a.repo,
          author: a.owner,
          activity: a.totalScans,
          stars: 0, // Future: get from GitHub API
          _id: 0,
        }));
        break;

      // ========================================
      // PHASE 2: Coming Soon (Needs metadata)
      // ========================================

      case 'top-analyzers-overall':
      case 'top-analyzers-aigallery':
      case 'successful-builders':
      case 'healthiest-python':
      case 'healthiest-javascript':
        available = false;
        data = [];
        break;

      // ========================================
      // PHASE 3+: Future (Needs AI/tech detection)
      // ========================================

      case 'successful-models':
      case 'model-language-success':
      case 'azd-deployments':
      case 'tech-usage':
        available = false;
        data = [];
        break;

      default:
        return res.status(404).json({
          section,
          data: [],
          available: false,
          error: 'Unknown leaderboard section',
          generatedAt: new Date().toISOString(),
        });
    }

    // Get total count for pagination (if applicable)
    if (available && data.length > 0) {
      const countResult = await database.repos.countDocuments();
      total = countResult;
    }

    res.json({
      section,
      data,
      available,
      generatedAt: new Date().toISOString(),
      total,
    });
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    next(error);
  }
});

/**
 * GET /api/v4/leaderboards/global-stats
 * Get global statistics for the stats section
 */
router.get('/global/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check database connectivity
    const dbHealth = await database.healthCheck();
    if (!dbHealth.connected) {
      return res.status(503).json({
        error: 'Database not available',
      });
    }

    // Get counts from database
    const [totalTemplates, totalAnalyses] = await Promise.all([
      database.repos.countDocuments(),
      database.analysis.countDocuments(),
    ]);

    // Phase 2 will add: templatesWithMCP, totalInstalls
    res.json({
      totalTemplatesAnalyzed: totalTemplates,
      totalAnalyses: totalAnalyses,
      templatesCreatedWithMCP: 0, // Phase 2: Detect from metadata
      totalInstalls: 0, // Phase 2: Track from GitHub stars/forks
      available: {
        totalTemplatesAnalyzed: true,
        totalAnalyses: true,
        templatesCreatedWithMCP: false,
        totalInstalls: false,
      },
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    next(error);
  }
});

export default router;
