#!/usr/bin/env node

/**
 * Seed Database Script
 * Imports sample data into MongoDB collections
 * 
 * Usage:
 *   node scripts/seed-database.js
 *   npm run db:seed
 */

import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'template-doctor';
const SEED_DATA_DIR = path.join(__dirname, '../data/seed');

// Collections to seed
const COLLECTIONS = [
  'analyses',
  'azdtests',
  'rulesets',
  'configuration'
];

/**
 * Parse MongoDB extended JSON dates
 */
function parseExtendedJSON(data) {
  return JSON.parse(JSON.stringify(data), (key, value) => {
    if (value && typeof value === 'object' && value.$date) {
      return new Date(value.$date);
    }
    return value;
  });
}

/**
 * Import data for a single collection
 */
async function importCollection(db, collectionName) {
  const filePath = path.join(SEED_DATA_DIR, `${collectionName}.json`);
  
  console.log(`\n📦 Importing ${collectionName}...`);
  
  try {
    // Read JSON file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const documents = parseExtendedJSON(JSON.parse(fileContent));
    
    if (!Array.isArray(documents) || documents.length === 0) {
      console.log(`   ⚠️  No documents found in ${collectionName}.json`);
      return { collection: collectionName, imported: 0, skipped: 0 };
    }
    
    // Get collection
    const collection = db.collection(collectionName);
    
    // Check if collection already has data
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`   ⚠️  Collection already has ${existingCount} documents`);
      const answer = process.env.FORCE_SEED === 'true' ? 'yes' : 'no';
      
      if (answer !== 'yes') {
        console.log(`   ⏭️  Skipping ${collectionName} (use FORCE_SEED=true to override)`);
        return { collection: collectionName, imported: 0, skipped: existingCount };
      }
      
      // Clear existing data
      await collection.deleteMany({});
      console.log(`   🗑️  Cleared ${existingCount} existing documents`);
    }
    
    // Insert documents
    const result = await collection.insertMany(documents);
    console.log(`   ✅ Imported ${result.insertedCount} documents`);
    
    return { collection: collectionName, imported: result.insertedCount, skipped: 0 };
    
  } catch (error) {
    console.error(`   ❌ Error importing ${collectionName}:`, error.message);
    return { collection: collectionName, imported: 0, skipped: 0, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🌱 MongoDB Seed Script');
  console.log('='.repeat(50));
  console.log(`📍 MongoDB URI: ${MONGODB_URI}`);
  console.log(`📂 Database: ${DATABASE_NAME}`);
  console.log(`📁 Seed data: ${SEED_DATA_DIR}`);
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected');
    
    const db = client.db(DATABASE_NAME);
    
    // Import each collection
    const results = [];
    for (const collectionName of COLLECTIONS) {
      const result = await importCollection(db, collectionName);
      results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log('='.repeat(50));
    
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const result of results) {
      const status = result.error ? '❌' : result.imported > 0 ? '✅' : '⏭️';
      console.log(`${status} ${result.collection.padEnd(20)} Imported: ${result.imported}, Skipped: ${result.skipped}`);
      
      totalImported += result.imported;
      totalSkipped += result.skipped;
      if (result.error) totalErrors++;
    }
    
    console.log('='.repeat(50));
    console.log(`Total imported: ${totalImported} documents`);
    console.log(`Total skipped: ${totalSkipped} documents`);
    if (totalErrors > 0) {
      console.log(`Errors: ${totalErrors} collections`);
    }
    
    // Verify with document counts
    console.log('\n🔍 Verification:');
    for (const collectionName of COLLECTIONS) {
      const count = await db.collection(collectionName).countDocuments();
      console.log(`   ${collectionName}: ${count} documents`);
    }
    
    console.log('\n✨ Seed completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. View data in MongoDB Compass');
    console.log('   2. Test API: curl http://localhost:3000/api/v4/results/latest');
    console.log('   3. Check health: curl http://localhost:3000/api/health');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
