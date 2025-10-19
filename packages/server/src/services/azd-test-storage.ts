import { database } from './database.js';
import type { AzdTest } from './database.js';

export interface SaveAzdTestParams {
  repoUrl: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  workflowRunId?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  result?: {
    deploymentTime?: number;
    resourcesCreated?: number;
    azdUpSuccess?: boolean;
    azdDownSuccess?: boolean;
    errors?: string[];
    warnings?: string[];
    endpoints?: Array<{ name: string; url: string }>;
  };
  logs?: string;
  error?: string;
}

class AzdTestStorage {
  /**
   * Save or update an AZD test result
   */
  async saveAzdTest(params: SaveAzdTestParams): Promise<string> {
    const now = new Date();
    
    // Extract owner and repo from URL
    const match = params.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid GitHub repository URL');
    
    const [, owner, repo] = match;
    const testId = `test-${Date.now()}`;
    
    const azdTest: Partial<AzdTest> = {
      repoUrl: params.repoUrl,
      owner,
      repo: repo.replace(/\.git$/, ''),
      testId,
      timestamp: now.getTime(),
      status: params.status,
      startedAt: params.startedAt || now,
      completedAt: params.completedAt,
      duration: params.duration,
      result: params.result,
      error: params.error,
      createdAt: now,
    };

    // Insert into azdtests collection
    const insertResult = await database.azdTests.insertOne(azdTest as AzdTest);
    const insertedId = insertResult.insertedId.toString();

    // Update repos collection with latestAzdTest
    await database.repos.updateOne(
      { repoUrl: params.repoUrl },
      {
        $set: {
          latestAzdTest: {
            testId: insertedId,
            timestamp: params.completedAt || params.startedAt || now,
            status: params.status,
            duration: params.duration,
            result: params.result,
          },
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    console.log(`[AzdTestStorage] Saved test ${insertedId} for ${params.repoUrl}, status: ${params.status}`);
    return insertedId;
  }

  /**
   * Update existing AZD test status
   */
  async updateAzdTest(
    testId: string,
    updates: Partial<SaveAzdTestParams>
  ): Promise<void> {
    const now = new Date();
    
    const updateDoc: any = {
      updatedAt: now,
    };

    if (updates.status) updateDoc.status = updates.status;
    if (updates.completedAt) updateDoc.completedAt = updates.completedAt;
    if (updates.duration) updateDoc.duration = updates.duration;
    if (updates.result) updateDoc.result = updates.result;
    if (updates.error) updateDoc.error = updates.error;

    await database.azdTests.updateOne(
      { _id: testId as any },
      { $set: updateDoc }
    );

    // If status changed, update repos collection
    if (updates.status || updates.result) {
      const test = await database.azdTests.findOne({ _id: testId as any });
      if (test) {
        await database.repos.updateOne(
          { repoUrl: test.repoUrl },
          {
            $set: {
              'latestAzdTest.status': updates.status || test.status,
              'latestAzdTest.duration': updates.duration || test.duration,
              'latestAzdTest.result': updates.result || test.result,
              'latestAzdTest.timestamp': updates.completedAt || test.completedAt || test.startedAt,
              updatedAt: now,
            },
          }
        );
      }
    }

    console.log(`[AzdTestStorage] Updated test ${testId}, status: ${updates.status || 'unchanged'}`);
  }

  /**
   * Get AZD test by ID
   */
  async getAzdTest(testId: string): Promise<AzdTest | null> {
    return await database.azdTests.findOne({ _id: testId as any });
  }

  /**
   * Get latest AZD test for a repo
   */
  async getLatestAzdTest(repoUrl: string): Promise<AzdTest | null> {
    const tests = await database.azdTests
      .find({ repoUrl })
      .sort({ startedAt: -1 })
      .limit(1)
      .toArray();
    
    return tests.length > 0 ? tests[0] : null;
  }
}

export const azdTestStorage = new AzdTestStorage();
