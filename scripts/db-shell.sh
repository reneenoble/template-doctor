#!/bin/bash

# Connect to Azure Cosmos DB using mongosh

# Load environment variables
source .env

if [ -z "$MONGODB_URI" ]; then
  echo "❌ MONGODB_URI not found in .env"
  exit 1
fi

DB_NAME="${MONGODB_DATABASE:-template-doctor}"

echo "🔌 Connecting to Azure Cosmos DB..."
echo "   Database: $DB_NAME"
echo ""

# Connect and show stats
mongosh "$MONGODB_URI" --eval "
  console.log('✅ Connected to Cosmos DB\n');
  
  // Switch to database
  db = db.getSiblingDB('$DB_NAME');
  console.log('📚 Database: $DB_NAME\n');
  
  // List collections
  const collections = db.getCollectionNames();
  console.log('Collections (' + collections.length + '):');
  
  if (collections.length === 0) {
    console.log('   (No collections - database is empty)\n');
  } else {
    collections.forEach(name => {
      const count = db.getCollection(name).countDocuments();
      console.log('   📂 ' + name + ': ' + count + ' document(s)');
    });
    
    console.log('\n📊 Collection Details:\n');
    
    // Show sample from each collection
    collections.forEach(name => {
      const coll = db.getCollection(name);
      const count = coll.countDocuments();
      
      if (count > 0) {
        console.log('Collection: ' + name);
        const sample = coll.findOne();
        console.log('Sample keys: ' + Object.keys(sample).join(', '));
        console.log('');
      }
    });
  }
"
