#!/usr/bin/env node

/**
 * Simple MongoDB query using server's database service
 */

import '../packages/server/dist/services/database.js';
import { MongoClient } from '../packages/server/node_modules/mongodb/lib/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'template-doctor';

console.log('🔌 Connecting to Azure Cosmos DB...');
console.log(`   Database: ${MONGODB_DATABASE}\n`);

const client = new MongoClient(MONGODB_URI);

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected!\n');

    const db = client.db(MONGODB_DATABASE);
    const collections = await db.listCollections().toArray();
    
    console.log('📚 Collections:', collections.length);
    
    if (collections.length === 0) {
      console.log('   (Database is empty)\n');
      return;
    }

    for (const col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      console.log(`\n📂 ${col.name}: ${count} document(s)`);
      
      if (count > 0) {
        const sample = await collection.findOne();
        console.log('   Keys:', Object.keys(sample).slice(0, 10).join(', '));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

main();
