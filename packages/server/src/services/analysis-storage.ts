/**
 * Analysis Storage Service (V2 Schema)
 *
 * Handles saving and retrieving analysis results from Cosmos DB.
 * V2 Schema: Uses repos collection (primary) + analysis collection (historical)
 * - repos: One document per repository with latest analysis summary
 * - analysis: Historical results (keep last 10 per repo)
 */

import { database, Analysis, Repo } from './database.js';
import { ObjectId } from 'mongodb';

export interface AnalysisData {
  repoUrl: string;
  ruleSet: string;
  compliance: {
    percentage: number;
    issues: number | any[];
    compliant?: any[];
    passed?: number;
  };
  categories?: Record<
    string,
    {
      enabled: boolean;
      issues: any[];
      compliant: any[];
      percentage: number;
    }
  >;
  analysisResult: any;
  scannedBy?: string[];
  createdBy?: string;
  upstreamTemplate?: string;
  archiveRequested?: boolean;
}

class AnalysisStorageService {
  /**
   * Save analysis result to database (V2 Schema)
   * 1. Insert full analysis to analysis collection
   * 2. Update repos collection with latest summary
   * 3. Prune old analyses (keep last 10 per repo)
   */
  async saveAnalysis(data: AnalysisData): Promise<{ id: string; success: boolean }> {
    try {
      const { owner, repo } = this.parseRepoUrl(data.repoUrl);
      const timestamp = Date.now();
      const now = new Date();

      // Normalize compliance data
      const issuesCount = Array.isArray(data.compliance.issues)
        ? data.compliance.issues.length
        : typeof data.compliance.issues === 'number'
          ? data.compliance.issues
          : 0;

      const passedCount = Array.isArray(data.compliance.compliant)
        ? data.compliance.compliant.length
        : data.compliance.passed || 0;

      const issuesArray = Array.isArray(data.compliance.issues) ? data.compliance.issues : [];

      const compliantArray = Array.isArray(data.compliance.compliant)
        ? data.compliance.compliant
        : [];

      // Extract createdBy from scannedBy array (last scanner is the creator)
      const createdBy =
        data.createdBy || (data.scannedBy && data.scannedBy.length > 0)
          ? data.scannedBy![data.scannedBy!.length - 1]
          : undefined;

      // Step 1: Insert full analysis document
      const analysis: Analysis = {
        repoUrl: data.repoUrl,
        owner,
        repo,
        ruleSet: data.ruleSet,
        timestamp,
        scanDate: now,
        compliance: {
          percentage: data.compliance.percentage,
          issues: issuesCount,
          passed: passedCount,
        },
        categories: data.categories,
        issues: issuesArray,
        compliant: compliantArray,
        analysisResult: data.analysisResult,
        scannedBy: data.scannedBy,
        createdBy: createdBy,
        upstreamTemplate: data.upstreamTemplate,
        archiveRequested: data.archiveRequested,
        createdAt: now,
        updatedAt: now,
      };

      const result = await database.analysis.insertOne(analysis);
      const analysisId = result.insertedId;

      console.log(`[AnalysisStorage] Saved analysis for ${data.repoUrl} with ID ${analysisId}`);

      // Step 2: Update repos collection with latest analysis summary
      await database.repos.updateOne(
        { repoUrl: data.repoUrl },
        {
          $set: {
            owner,
            repo,
            latestAnalysis: {
              scanDate: now,
              ruleSet: data.ruleSet,
              compliancePercentage: data.compliance.percentage,
              passed: passedCount,
              issues: issuesCount,
              analysisId: analysisId,
              createdBy: createdBy,
            },
            upstreamTemplate: data.upstreamTemplate,
            archiveRequested: data.archiveRequested,
            updatedAt: now,
          },
          $setOnInsert: {
            tags: [],
            createdAt: now,
          },
        },
        { upsert: true },
      );

      console.log(`[AnalysisStorage] Updated repos collection for ${data.repoUrl}`);

      // Step 3: Prune old analyses (keep last 10 per repo)
      const count = await database.analysis.countDocuments({
        repoUrl: data.repoUrl,
      });
      if (count > 10) {
        const toDelete = await database.analysis
          .find({ repoUrl: data.repoUrl })
          .sort({ scanDate: -1 })
          .skip(10)
          .toArray();

        if (toDelete.length > 0) {
          await database.analysis.deleteMany({
            _id: { $in: toDelete.map((d) => d._id) },
          });
          console.log(
            `[AnalysisStorage] Pruned ${toDelete.length} old analyses for ${data.repoUrl}`,
          );
        }
      }

      return {
        id: analysisId.toString(),
        success: true,
      };
    } catch (error: any) {
      console.error('[AnalysisStorage] Save failed:', error?.message);
      throw error;
    }
  }

  /**
   * Get latest analyses (V2: queries repos collection for dashboard)
   */
  async getLatestAnalyses(limit: number = 50): Promise<Repo[]> {
    try {
      const results = await database.repos
        .find()
        .sort({ 'latestAnalysis.scanDate': -1 })
        .limit(limit)
        .toArray();

      return results;
    } catch (error: any) {
      console.error('[AnalysisStorage] Get latest failed:', error?.message);
      throw error;
    }
  }

  /**
   * Get analyses for a specific repository
   */
  async getAnalysesByRepo(repoUrl: string): Promise<Analysis[]> {
    try {
      const results = await database.analysis.find({ repoUrl }).sort({ scanDate: -1 }).toArray();

      return results;
    } catch (error: any) {
      console.error('[AnalysisStorage] Get by repo failed:', error?.message);
      throw error;
    }
  }

  /**
   * Get single analysis by ID
   */
  async getAnalysisById(id: string): Promise<Analysis | null> {
    try {
      const objectId = new ObjectId(id);
      const result = await database.analysis.findOne({ _id: objectId });
      return result;
    } catch (error: any) {
      console.error('[AnalysisStorage] Get by ID failed:', error?.message);
      return null;
    }
  }

  /**
   * Get leaderboard (V2: queries repos.latestAnalysis.compliancePercentage)
   */
  async getLeaderboard(limit: number = 100): Promise<
    Array<{
      repoUrl: string;
      owner: string;
      repo: string;
      compliance: number;
      lastScan: Date;
      scanCount: number;
    }>
  > {
    try {
      const results = await database.repos
        .find({ latestAnalysis: { $exists: true } })
        .sort({ 'latestAnalysis.compliancePercentage': -1 })
        .limit(limit)
        .toArray();

      // Get scan count from analysis collection
      const leaderboard = await Promise.all(
        results.map(async (repo) => {
          const scanCount = await database.analysis.countDocuments({
            repoUrl: repo.repoUrl,
          });
          return {
            repoUrl: repo.repoUrl,
            owner: repo.owner,
            repo: repo.repo,
            compliance: repo.latestAnalysis?.compliancePercentage || 0,
            lastScan: repo.latestAnalysis?.scanDate || new Date(),
            scanCount,
          };
        }),
      );

      return leaderboard;
    } catch (error: any) {
      console.error('[AnalysisStorage] Leaderboard failed:', error?.message);
      throw error;
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(repoUrl: string): Promise<{
    totalScans: number;
    averageCompliance: number;
    bestCompliance: number;
    worstCompliance: number;
    lastScan: Date | null;
  } | null> {
    try {
      const results = await database.analysis
        .aggregate([
          { $match: { repoUrl } },
          {
            $group: {
              _id: '$repoUrl',
              totalScans: { $sum: 1 },
              avgCompliance: { $avg: '$compliance.percentage' },
              maxCompliance: { $max: '$compliance.percentage' },
              minCompliance: { $min: '$compliance.percentage' },
              lastScan: { $max: '$scanDate' },
            },
          },
        ])
        .toArray();

      if (results.length === 0) return null;

      const stats = results[0];
      return {
        totalScans: stats.totalScans,
        averageCompliance: Math.round(stats.avgCompliance * 100) / 100,
        bestCompliance: stats.maxCompliance,
        worstCompliance: stats.minCompliance,
        lastScan: stats.lastScan,
      };
    } catch (error: any) {
      console.error('[AnalysisStorage] Stats failed:', error?.message);
      return null;
    }
  }

  /**
   * Parse GitHub repository URL
   */
  private parseRepoUrl(url: string): { owner: string; repo: string } {
    try {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
      if (!match) throw new Error('Invalid GitHub URL');
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    } catch (error) {
      console.error('[AnalysisStorage] URL parse failed:', url);
      return { owner: 'unknown', repo: 'unknown' };
    }
  }
}

// Singleton instance
export const analysisStorage = new AnalysisStorageService();
