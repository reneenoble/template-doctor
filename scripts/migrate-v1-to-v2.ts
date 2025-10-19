/**
 * Migration Script: V1 Schema → V2 Schema
 * 
 * Transforms the flat analysis-based schema (V1) into the repo-centric schema (V2):
 * - V1: analysis collection (one doc per scan)
 * - V2: repos collection (one doc per repo) + analysis collection (last 10 per repo)
 * 
 * Steps:
 * 1. Group all analyses by repoUrl
 * 2. For each repo, create a repos document with latest analysis summary
 * 3. Keep only last 10 analyses per repo in analysis collection
 * 4. Verify migration success
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.join(__dirname, '..', 'packages', 'server', '.env.local');
const rootEnvPath = path.join(__dirname, '..', '.env');

try {
  dotenv.config({ path: serverEnvPath });
  console.log(`📁 Loaded environment from: ${serverEnvPath}`);
} catch (err) {
  console.log(`⚠️  No .env.local found, trying root .env...`);
  dotenv.config({ path: rootEnvPath });
}

async function migrateV1ToV2() {
  console.log('🚀 Starting V1 → V2 migration...\n');
  
  const { database } = await import('../packages/server/src/services/database.js');
  
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Connected\n');
    
    // Step 1: Get all analyses grouped by repoUrl
    console.log('📊 Step 1: Aggregating analyses by repository...');
    const repoGroups = await database.analysis.aggregate([
      {
        $sort: { scanDate: -1 }
      },
      {
        $group: {
          _id: '$repoUrl',
          owner: { $first: '$owner' },
          repo: { $first: '$repo' },
          latest: { $first: '$$ROOT' },
          allAnalyses: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log(`   Found ${repoGroups.length} unique repositories\n`);
    
    // Step 2: Create repos documents
    console.log('📝 Step 2: Creating repos documents...');
    const repoDocs = repoGroups.map((group: any) => {
      const latest = group.latest;
      
      return {
        repoUrl: group._id,
        owner: group.owner,
        repo: group.repo,
        latestAnalysis: {
          scanDate: latest.scanDate,
          ruleSet: latest.ruleSet,
          compliancePercentage: latest.compliance.percentage,
          passed: latest.compliance.passed,
          issues: latest.compliance.issues,
          analysisId: latest._id
        },
        // latestAzdTest will be undefined for now (no test data yet)
        upstreamTemplate: latest.upstreamTemplate || undefined,
        archiveRequested: latest.archiveRequested || false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    
    // Insert repos (with upsert to handle re-runs)
    let reposCreated = 0;
    for (const repoDoc of repoDocs) {
      const result = await database.repos.updateOne(
        { repoUrl: repoDoc.repoUrl },
        { $set: repoDoc },
        { upsert: true }
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        reposCreated++;
      }
    }
    
    console.log(`   ✅ Created/updated ${reposCreated} repos documents\n`);
    
    // Step 3: Prune old analyses (keep last 10 per repo)
    console.log('🧹 Step 3: Pruning old analyses (keeping last 10 per repo)...');
    let totalDeleted = 0;
    
    for (const group of repoGroups) {
      const repoUrl = group._id;
      const count = group.count;
      
      if (count > 10) {
        // Get IDs of analyses to delete (skip first 10, delete the rest)
        const toDelete = group.allAnalyses
          .slice(10) // Skip first 10 (already sorted by scanDate DESC)
          .map((a: any) => a._id);
        
        const deleteResult = await database.analysis.deleteMany({
          _id: { $in: toDelete }
        });
        
        totalDeleted += deleteResult.deletedCount;
        console.log(`   Pruned ${deleteResult.deletedCount} old analyses from ${repoUrl}`);
      }
    }
    
    console.log(`   ✅ Deleted ${totalDeleted} old analyses (kept last 10 per repo)\n`);
    
    // Step 4: Verify migration
    console.log('✅ Step 4: Verifying migration...');
    const reposCount = await database.repos.countDocuments();
    const analysisCount = await database.analysis.countDocuments();
    
    console.log(`   Repos collection: ${reposCount} documents`);
    console.log(`   Analysis collection: ${analysisCount} documents (max 10 per repo)\n`);
    
    // Show sample repo document
    const sampleRepo = await database.repos.findOne();
    if (sampleRepo) {
      console.log('📄 Sample repos document:');
      console.log({
        repoUrl: sampleRepo.repoUrl,
        owner: sampleRepo.owner,
        repo: sampleRepo.repo,
        latestAnalysis: sampleRepo.latestAnalysis,
        tags: sampleRepo.tags
      });
      console.log();
    }
    
    // Show analysis count per repo
    console.log('📊 Analysis retention per repo:');
    const retentionStats = await database.analysis.aggregate([
      {
        $group: {
          _id: '$repoUrl',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    retentionStats.forEach((stat: any) => {
      console.log(`   ${stat._id}: ${stat.count} analyses`);
    });
    
    console.log('\n✅ Migration complete!');
    console.log('\n📋 Summary:');
    console.log(`   - Created ${reposCount} repos documents`);
    console.log(`   - Retained ${analysisCount} analysis documents (max 10 per repo)`);
    console.log(`   - Deleted ${totalDeleted} old analysis documents`);
    console.log(`\n🎉 V2 schema is now active!`);
    
    await database.disconnect();
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error?.message);
    console.error(error.stack);
    await database.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateV1ToV2().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
