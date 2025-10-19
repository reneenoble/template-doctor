#!/usr/bin/env node

/**
 * Query MongoDB database to inspect stored data
 * Usage: node scripts/query-db.mjs [collection]
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'template_doctor';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

console.log('🔌 Connecting to MongoDB...');
console.log(`   URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
console.log(`   Database: ${MONGODB_DATABASE}`);

const client = new MongoClient(MONGODB_URI);

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected successfully\n');

    const db = client.db(MONGODB_DATABASE);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📚 Collections in database:');
    console.log('   Total:', collections.length);
    
    if (collections.length === 0) {
      console.log('   (No collections found - database is empty)\n');
      return;
    }

    collections.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col.name}`);
    });
    console.log('');

    // Query specific collection if provided as argument
    const targetCollection = process.argv[2];

    if (targetCollection) {
      console.log(`🔍 Querying collection: ${targetCollection}\n`);
      const collection = db.collection(targetCollection);
      const count = await collection.countDocuments();
      console.log(`   Total documents: ${count}`);

      if (count > 0) {
        console.log('\n   Sample documents (first 5):');
        const docs = await collection.find().limit(5).toArray();
        docs.forEach((doc, idx) => {
          console.log(`\n   Document ${idx + 1}:`);
          console.log(JSON.stringify(doc, null, 2).split('\n').map(line => '   ' + line).join('\n'));
        });
      }
    } else {
      // Show stats for all collections
      console.log('📊 Collection Statistics:\n');
      
      for (const col of collections) {
        const collection = db.collection(col.name);
        const count = await collection.countDocuments();
        console.log(`   ${col.name}: ${count} document(s)`);
        
        if (count > 0) {
          // Show one sample document
          const sample = await collection.findOne();
          console.log('      Sample keys:', Object.keys(sample).join(', '));
        }
      }

      console.log('\n💡 To see detailed data from a collection:');
      console.log('   node scripts/query-db.mjs <collection-name>');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('   Cannot reach database host. Check your network connection and MONGODB_URI.');
    } else if (error.name === 'MongoServerError' && error.code === 18) {
      console.error('   Authentication failed. Check your database credentials.');
    }
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

main();
