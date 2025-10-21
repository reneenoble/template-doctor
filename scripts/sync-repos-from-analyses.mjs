#!/usr/bin/env node

/**
 * Sync Repos Collection from Analyses
 * Populates the repos collection with denormalized data from analyses
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'template-doctor';

async function main() {
  console.log('🔄 Syncing repos collection from analyses...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const analysesCollection = db.collection('analyses');
    const reposCollection = db.collection('repos');
    
    // Get all analyses grouped by repo
    const analyses = await analysesCollection.find({}).sort({ scanDate: -1 }).toArray();
    
    console.log(`Found ${analyses.length} analyses`);
    
    // Group by owner/repo and keep only the latest
    const repoMap = new Map();
    for (const analysis of analyses) {
      const key = `${analysis.owner}/${analysis.repo}`;
      if (!repoMap.has(key)) {
        repoMap.set(key, analysis);
      }
    }
    
    console.log(`Found ${repoMap.size} unique repos\n`);
    
    // Clear existing repos
    await reposCollection.deleteMany({});
    console.log('Cleared existing repos collection');
    
    // Create repo documents
    const repoDocuments = [];
    for (const [key, analysis] of repoMap) {
      const repoDoc = {
        owner: analysis.owner,
        repo: analysis.repo,
        repoUrl: analysis.repoUrl, // Required for unique index
        latestAnalysis: {
          timestamp: analysis.timestamp,
          scanDate: analysis.scanDate,
          compliance: analysis.compliance,
          createdBy: analysis.createdBy || null,
          scannedBy: analysis.scannedBy || null,
          issues: analysis.compliance?.issues || 0,
          passed: analysis.compliance?.passed || 0,
          percentage: analysis.compliance?.percentage || 0
        },
        createdAt: analysis.createdAt || new Date(),
        updatedAt: analysis.updatedAt || new Date()
      };
      repoDocuments.push(repoDoc);
    }
    
    // Insert repo documents
    if (repoDocuments.length > 0) {
      await reposCollection.insertMany(repoDocuments);
      console.log(`✅ Created ${repoDocuments.length} repo documents\n`);
      
      // Show sample
      console.log('Sample repo document:');
      console.log(JSON.stringify(repoDocuments[0], null, 2));
    }
    
    console.log('\n✨ Sync completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
