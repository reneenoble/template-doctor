# MongoDB Seed Data

This directory contains sample data files for importing into MongoDB collections.

## Collections

### 1. analyses.json
Sample template analysis results with compliance scores, issues, and compliant items.
- **2 sample documents**
- Demonstrates complete analysis structure with categories, issues, and compliance data

### 2. azdtests.json
Sample Azure Developer CLI deployment test results.
- **3 sample documents** (2 successful, 1 failed)
- Shows deployment duration, resources created, errors, and cost estimates

### 3. rulesets.json
Analysis ruleset configurations defining validation rules.
- **3 rulesets**: DoD Best Practices, Partner Best Practices, Minimal Requirements
- Each ruleset contains multiple rules with severity levels and categories

### 4. configuration.json
Application configuration key-value pairs.
- **15 configuration settings**
- Categories: features, defaults, limits, github, archive, validation, security, notifications

## Import Methods

### Method 1: MongoDB Compass GUI (Recommended for Learning)

1. **Open MongoDB Compass** and connect to `mongodb://localhost:27017`
2. **Select or create database**: `template_doctor`
3. **For each collection:**
   - Click "Create Collection" button
   - Enter collection name (e.g., `analyses`)
   - Click "Create Collection"
   - Click "Add Data" → "Import JSON or CSV file"
   - Select the corresponding `.json` file from this directory
   - Click "Import"

### Method 2: mongoimport (Command Line)

```bash
# Navigate to the seed data directory
cd data/seed

# Import each collection
mongoimport --db template_doctor --collection analyses --file analyses.json --jsonArray
mongoimport --db template_doctor --collection azdtests --file azdtests.json --jsonArray
mongoimport --db template_doctor --collection rulesets --file rulesets.json --jsonArray
mongoimport --db template_doctor --collection configuration --file configuration.json --jsonArray
```

### Method 3: MongoDB Shell (mongosh)

```javascript
// Connect to MongoDB
mongosh mongodb://localhost:27017/template_doctor

// Load and insert data for each collection
load('analyses.json')
db.analyses.insertMany([/* paste content from analyses.json */])

load('azdtests.json')
db.azdtests.insertMany([/* paste content from azdtests.json */])

load('rulesets.json')
db.rulesets.insertMany([/* paste content from rulesets.json */])

load('configuration.json')
db.configuration.insertMany([/* paste content from configuration.json */])
```

### Method 4: Automated Import Script

```bash
# Run the import script (creates collections and imports data)
npm run db:seed

# Or use the Node.js script directly
node scripts/seed-database.js
```

## Verify Import

After importing, verify the data:

```bash
# Using mongosh
mongosh mongodb://localhost:27017/template_doctor

# Check document counts
db.analyses.countDocuments()      // Should return: 2
db.azdtests.countDocuments()      // Should return: 3
db.rulesets.countDocuments()      // Should return: 3
db.configuration.countDocuments() // Should return: 15

# View sample documents
db.analyses.findOne()
db.azdtests.findOne()
db.rulesets.findOne()
db.configuration.findOne()
```

Or use the API:

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Query latest analyses
curl http://localhost:3000/api/v4/results/latest | jq '.'

# Query leaderboard
curl http://localhost:3000/api/v4/results/leaderboard | jq '.'
```

## Indexes

The database service automatically creates indexes when it connects. You can verify indexes were created:

```javascript
// In mongosh
db.analyses.getIndexes()
db.azdtests.getIndexes()
```

Expected indexes for `analyses`:
- `_id_` (default)
- `repoUrl_1_scanDate_-1`
- `scanDate_-1`
- `compliance.percentage_-1`
- `owner_1_repo_1`
- `ruleSet_1`

Expected indexes for `azdtests`:
- `_id_` (default)
- `repoUrl_1_startedAt_-1`
- `status_1_startedAt_-1`
- `testId_1` (unique)

## Sample Data Details

### analyses.json
- **Azure-Samples/todo-nodejs-mongo**: 85.5% compliance, 3 issues
- **Azure-Samples/contoso-real-estate**: 95% compliance, 1 issue

### azdtests.json
- **todo-nodejs-mongo** (Oct 9): ✅ Success, 5.5 min deployment, 7 resources
- **contoso-real-estate** (Oct 8): ❌ Failed, Node.js version mismatch
- **todo-nodejs-mongo** (Oct 1): ✅ Success, 4.25 min deployment, 7 resources

### rulesets.json
- **dod**: 13 rules (DoD best practices)
- **partner**: 5 rules (Partner requirements)
- **minimal**: 3 rules (Basic validation)

### configuration.json
- Feature flags: auto_save, require_auth, archive_enabled
- Defaults: rule_set (dod), azure_region (eastus)
- Limits: file sizes, timeouts
- GitHub: dispatch repo, workflow file
- Security: allowed users

## Next Steps

After importing seed data:

1. **Test API endpoints**: Query analyses and test results via REST API
2. **View in Compass**: Browse data visually in MongoDB Compass
3. **Run migration**: Import real production data from filesystem results
4. **Update frontend**: Connect UI to database APIs instead of static files

## Cleanup

To remove all seed data:

```javascript
// In mongosh
db.analyses.deleteMany({})
db.azdtests.deleteMany({})
db.rulesets.deleteMany({})
db.configuration.deleteMany({})
```

Or drop the entire database:

```javascript
use template_doctor
db.dropDatabase()
```
