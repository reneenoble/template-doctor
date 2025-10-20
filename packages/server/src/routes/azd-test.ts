import { Router, Request, Response } from 'express';
import { azdTestStorage } from '../services/azd-test-storage.js';

const router = Router();

/**
 * POST /api/v4/azd-test
 * Save or update an AZD deployment test result
 *
 * Request body:
 * {
 *   repoUrl: string;           // GitHub repo URL
 *   status: 'pending' | 'running' | 'success' | 'failed';
 *   startedAt?: Date;          // When test started
 *   completedAt?: Date;        // When test completed
 *   duration?: number;         // Duration in milliseconds
 *   result?: {
 *     deploymentTime?: number;
 *     resourcesCreated?: number;
 *     endpoints?: string[];
 *     services?: string[];
 *   };
 *   error?: {
 *     message: string;
 *     stack?: string;
 *     command?: string;
 *   };
 * }
 */
router.post('/azd-test', async (req: Request, res: Response) => {
  try {
    const { repoUrl, status, startedAt, completedAt, duration, result, error } = req.body;

    // Validate required fields
    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid repoUrl',
      });
    }

    if (!status || !['pending', 'running', 'success', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid status (must be: pending, running, success, or failed)',
      });
    }

    // Convert date strings to Date objects if provided
    const params = {
      repoUrl,
      status,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      completedAt: completedAt ? new Date(completedAt) : undefined,
      duration,
      result,
      error,
    };

    // Save to database
    const testId = await azdTestStorage.saveAzdTest(params);

    console.log(`[azd-test] ✅ Saved AZD test for ${repoUrl}`, {
      testId,
      status,
      duration,
    });

    res.json({
      success: true,
      testId,
      message: 'AZD test result saved successfully',
    });
  } catch (err: any) {
    console.error('[azd-test] ❌ Failed to save AZD test:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to save AZD test result',
    });
  }
});

/**
 * GET /api/v4/azd-test/latest/:owner/:repo
 * Get the latest AZD test result for a repository
 */
router.get('/azd-test/latest/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const repoUrl = `https://github.com/${owner}/${repo}`;

    const latestTest = await azdTestStorage.getLatestAzdTest(repoUrl);

    if (!latestTest) {
      return res.status(404).json({
        success: false,
        error: 'No AZD test found for this repository',
      });
    }

    res.json({
      success: true,
      test: latestTest,
    });
  } catch (err: any) {
    console.error('[azd-test] ❌ Failed to get latest test:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve AZD test',
    });
  }
});

/**
 * GET /api/v4/azd-test/:testId
 * Get a specific AZD test by ID
 */
router.get('/azd-test/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await azdTestStorage.getAzdTest(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'AZD test not found',
      });
    }

    res.json({
      success: true,
      test,
    });
  } catch (err: any) {
    console.error('[azd-test] ❌ Failed to get test:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve AZD test',
    });
  }
});

export { router as azdTestRouter };
