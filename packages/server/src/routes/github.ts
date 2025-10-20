import { Router, Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/v4/issue-create
 * Create a GitHub issue with labels and optional child issues
 * Requires authentication
 *
 * Body:
 * - owner: Repository owner (required)
 * - repo: Repository name (required)
 * - title: Issue title (required)
 * - body: Issue body
 * - labels: Array of label names (optional)
 * - assignCopilot: Whether to assign github-copilot (optional, default: false)
 * - childIssues: Array of child issues to create (optional)
 *   - Each child: { title: string, body: string, labels?: string[] }
 *
 * Returns:
 * - issueNumber: Created issue number
 * - htmlUrl: URL to the created issue
 * - labelsEnsured: Labels that were verified/created
 * - labelsCreated: Labels that were created (subset of ensured)
 * - copilotAssigned: Whether copilot was assigned
 * - childResults: Results of child issue creation
 */
router.post(
  '/issue-create',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = process.env.GH_WORKFLOW_TOKEN;
      if (!token) {
        return res.status(500).json({
          error: 'Server misconfiguration: missing GH_WORKFLOW_TOKEN',
        });
      }

      const {
        owner,
        repo,
        title,
        body: issueBody,
        labels = [],
        assignCopilot = false,
        childIssues = [],
      } = req.body || {};

      if (!owner || !repo || !title) {
        return res.status(400).json({
          error: 'Missing required: owner, repo, title',
        });
      }

      const octokit = new Octokit({
        auth: token,
        userAgent: 'TemplateDoctorBackend',
      });

      // Offline mode shortcut for testing
      if (process.env.API_OFFLINE) {
        return res.status(201).json({
          issueNumber: 1,
          htmlUrl: 'https://example/offline-issue',
          labelsEnsured: labels,
          labelsCreated: [],
          copilotAssigned: false,
          childResults: (childIssues || []).map((c: any, i: number) => ({
            title: c?.title,
            issueNumber: i + 2,
          })),
        });
      }

      // Ensure labels exist (create if missing)
      const created: string[] = [];
      const ensured: string[] = [];

      for (const label of labels) {
        if (!label || typeof label !== 'string') continue;

        try {
          // Check if label exists
          await octokit.issues.getLabel({
            owner,
            repo,
            name: label,
          });
          ensured.push(label);
        } catch (err: any) {
          if (err?.status === 404) {
            // Label doesn't exist, create it
            try {
              const color = hashColor(label);
              await octokit.issues.createLabel({
                owner,
                repo,
                name: label,
                color,
              });
              created.push(label);
              ensured.push(label);
            } catch (createErr) {
              console.error(`Failed to create label ${label}:`, createErr);
            }
          } else {
            console.error(`Error ensuring label ${label}:`, err);
          }
        }
      }

      // Create main issue
      let issueNumber: number | undefined;
      let issueUrl: string | undefined;

      try {
        const issueResp = await octokit.issues.create({
          owner,
          repo,
          title,
          body: issueBody,
          labels: ensured,
        });
        issueNumber = issueResp.data.number;
        issueUrl = issueResp.data.html_url;
      } catch (err: any) {
        console.error('Issue creation failed:', err?.message || err);
        return res.status(502).json({
          error: 'Failed to create issue',
          details: err?.message,
        });
      }

      // Assign Copilot if requested
      let copilotAssigned: boolean | undefined;
      if (assignCopilot && issueNumber) {
        try {
          await octokit.issues.addAssignees({
            owner,
            repo,
            issue_number: issueNumber,
            assignees: ['github-copilot'],
          });
          copilotAssigned = true;
        } catch (err) {
          console.log('Copilot assignment skipped:', err);
          copilotAssigned = false;
        }
      }

      // Create child issues with limited concurrency
      const childResults: {
        title: string;
        issueNumber?: number;
        error?: string;
      }[] = [];

      if (issueNumber && Array.isArray(childIssues) && childIssues.length) {
        const CONCURRENCY = 4;
        let index = 0;

        async function worker() {
          while (index < childIssues.length) {
            const c = childIssues[index++];
            if (!c?.title) continue;

            const labelsChild = Array.isArray(c.labels)
              ? c.labels.filter((l: any) => typeof l === 'string')
              : [];

            // Ensure child labels exist
            for (const label of labelsChild) {
              try {
                await octokit.issues.getLabel({
                  owner,
                  repo,
                  name: label,
                });
              } catch (e: any) {
                if (e?.status === 404) {
                  try {
                    await octokit.issues.createLabel({
                      owner,
                      repo,
                      name: label,
                      color: hashColor(label),
                    });
                  } catch {}
                }
              }
            }

            // Create child issue
            try {
              const childResp = await octokit.issues.create({
                owner,
                repo,
                title: c.title,
                body: c.body,
                labels: labelsChild,
              });
              childResults.push({
                title: c.title,
                issueNumber: childResp.data.number,
              });
            } catch (e: any) {
              childResults.push({
                title: c.title,
                error: e?.message || 'Failed to create child issue',
              });
            }
          }
        }

        const workers = Array.from({ length: Math.min(CONCURRENCY, childIssues.length) }, () =>
          worker(),
        );
        await Promise.all(workers);
      }

      res.status(201).json({
        issueNumber,
        htmlUrl: issueUrl,
        labelsEnsured: ensured,
        labelsCreated: created,
        copilotAssigned,
        childResults: childResults.length ? childResults : undefined,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Generate a color from a label name using a simple hash
 */
function hashColor(input: string): string {
  // Simple hash to hex color (avoid leading # in GitHub API)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  // Map hash to 24-bit color, ensure readable (avoid very dark)
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  const brighten = (c: number) => (c + 200) % 256; // push toward lighter palette

  return ((brighten(r) << 16) | (brighten(g) << 8) | brighten(b)).toString(16).padStart(6, '0');
}

export { router as githubRouter };
