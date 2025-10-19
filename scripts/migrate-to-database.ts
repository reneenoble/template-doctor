/**
 * Migration Script: Filesystem Results → Cosmos DB
 *
 * Reads all existing result files from packages/app/results/ and migrates them to Cosmos DB.
 * Can run in two modes:
 * 1. Export to BSON/JSON files for manual import
 * 2. Direct database import (requires COSMOS_ENDPOINT)
 */

import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ObjectId } from "mongodb";

// Load environment variables from packages/server/.env.local first, then fallback to root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.join(
    __dirname,
    "..",
    "packages",
    "server",
    ".env.local",
);
const rootEnvPath = path.join(__dirname, "..", ".env");

// Try to load server-specific env first
try {
    dotenv.config({ path: serverEnvPath });
    console.log(`📁 Loaded environment from: ${serverEnvPath}`);
} catch (err) {
    console.log(
        `⚠️  No .env.local found at ${serverEnvPath}, trying root .env...`,
    );
    dotenv.config({ path: rootEnvPath });
}

interface WindowReportData {
    repoUrl: string;
    ruleSet: string;
    timestamp: number;
    compliance: {
        issues: any[];
        compliant: any[];
        percentage: number;
        summary: string;
    };
    azdValidation?: any;
    upstreamTemplate?: string;
    history?: Array<{
        timestamp: number;
        ruleSet: string;
        percentage: number;
        issues: number;
        passed: number;
    }>;
}

interface AnalysisDocument {
    _id: ObjectId;
    repoUrl: string;
    owner: string;
    repo: string;
    ruleSet: string;
    timestamp: number;
    scanDate: Date;
    compliance: {
        percentage: number;
        passed: number;
        issues: number;
    };
    issues: any[];
    compliant: any[];
    analysisResult: any;
    createdBy?: string; // GitHub username who triggered the analysis
    upstreamTemplate?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Parse repository URL to extract owner and repo
 */
function parseRepoUrl(url: string): { owner: string; repo: string } {
    try {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
        if (!match) throw new Error("Invalid GitHub URL");
        return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, ""),
        };
    } catch (error) {
        console.warn(`Failed to parse URL: ${url}`);
        return { owner: "unknown", repo: "unknown" };
    }
}

/**
 * Load a single -data.js file and extract window.reportData
 */
async function loadResultFile(
    filePath: string,
): Promise<WindowReportData | null> {
    try {
        const content = await fs.readFile(filePath, "utf-8");

        // Extract window.reportData = {...};
        const match = content.match(
            /window\.reportData\s*=\s*(\{[\s\S]*\});?\s*$/,
        );
        if (!match) {
            console.warn(`No reportData found in ${filePath}`);
            return null;
        }

        // Evaluate the JavaScript object (not JSON - has unquoted keys)
        const jsObject = match[1];

        // Create a safe eval environment
        const window = { reportData: null };
        const evalCode = `window.reportData = ${jsObject}`;

        // Use Function constructor for safer eval (no access to local scope)
        const evaluator = new Function("window", evalCode);
        evaluator(window);

        return window.reportData as unknown as WindowReportData;
    } catch (error: any) {
        console.error(`Failed to load ${filePath}: ${error?.message}`);
        return null;
    }
}

/**
 * Find all *-data.js files in results directory
 */
async function findResultFiles(resultsDir: string): Promise<string[]> {
    const files: string[] = [];

    async function scan(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.name.match(/^\d+-data\.js$/)) {
                files.push(fullPath);
            }
        }
    }

    await scan(resultsDir);
    return files;
}

/**
 * Convert filesystem result to Cosmos DB document
 */
function convertToAnalysisDocument(
    data: WindowReportData,
    filePath?: string,
): AnalysisDocument {
    const { owner, repo } = parseRepoUrl(data.repoUrl);
    const scanDate = new Date(data.timestamp);

    // Extract createdBy from file path (e.g., "packages/app/results/anfibiacreativa-Redis_LLMmemory/..." -> "anfibiacreativa")
    let createdBy: string | undefined;
    if (filePath) {
        const match = filePath.match(/results\/([^-/]+)-/);
        if (match) {
            createdBy = match[1];
        }
    }

    return {
        _id: new ObjectId(),
        repoUrl: data.repoUrl,
        owner,
        repo,
        ruleSet: data.ruleSet || "default",
        timestamp: data.timestamp,
        scanDate,
        compliance: {
            percentage: data.compliance.percentage,
            passed: Array.isArray(data.compliance.compliant)
                ? data.compliance.compliant.length
                : 0,
            issues: Array.isArray(data.compliance.issues)
                ? data.compliance.issues.length
                : 0,
        },
        issues: Array.isArray(data.compliance.issues)
            ? data.compliance.issues
            : [],
        compliant: Array.isArray(data.compliance.compliant)
            ? data.compliance.compliant
            : [],
        analysisResult: {
            compliance: data.compliance,
            azdValidation: data.azdValidation,
        },
        createdBy, // GitHub username extracted from directory name
        upstreamTemplate: data.upstreamTemplate,
        createdAt: scanDate,
        updatedAt: scanDate,
    };
}

/**
 * Export Mode: Generate BSON/JSON files for manual import
 */
async function exportToBSON(documents: AnalysisDocument[], outputDir: string) {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate JSON file (MongoDB can import JSON)
    const jsonPath = path.join(outputDir, "analysis-export.json");
    const jsonContent = documents.map((doc) => JSON.stringify(doc)).join("\n");
    await fs.writeFile(jsonPath, jsonContent, "utf-8");
    console.log(`✅ Exported ${documents.length} documents to ${jsonPath}`);

    // Generate human-readable JSON for inspection
    const prettyPath = path.join(outputDir, "analysis-export-pretty.json");
    await fs.writeFile(prettyPath, JSON.stringify(documents, null, 2), "utf-8");
    console.log(`✅ Exported pretty JSON to ${prettyPath}`);

    // Generate import script
    const importScriptPath = path.join(outputDir, "import.sh");
    const importScript = `#!/bin/bash
# Import script for Cosmos DB MongoDB API
# Usage: ./import.sh <cosmos-endpoint> <database-name>

ENDPOINT=\${1:-"https://your-cosmos.mongo.cosmos.azure.com:10255"}
DATABASE=\${2:-"template-doctor"}
COLLECTION="analysis"

echo "Importing to \$ENDPOINT/\$DATABASE/\$COLLECTION"
echo "Note: You need mongoimport tool and appropriate credentials"
echo ""
echo "For Cosmos DB, use connection string from Azure Portal:"
echo "mongoimport --uri 'mongodb://...' --db \$DATABASE --collection \$COLLECTION --file analysis-export.json"
`;
    await fs.writeFile(importScriptPath, importScript, "utf-8");
    await fs.chmod(importScriptPath, 0o755);
    console.log(`✅ Generated import script: ${importScriptPath}`);

    // Generate statistics
    const timestamps = documents
        .map((d) => new Date(d.timestamp).getTime())
        .filter((t) => !isNaN(t));
    const stats = {
        totalDocuments: documents.length,
        repositories: new Set(documents.map((d) => d.repoUrl)).size,
        rulesets: new Set(documents.map((d) => d.ruleSet)).size,
        dateRange:
            timestamps.length > 0
                ? {
                      earliest: new Date(Math.min(...timestamps)),
                      latest: new Date(Math.max(...timestamps)),
                  }
                : null,
        complianceStats: {
            average:
                documents.reduce((sum, d) => sum + d.compliance.percentage, 0) /
                documents.length,
            max: Math.max(...documents.map((d) => d.compliance.percentage)),
            min: Math.min(...documents.map((d) => d.compliance.percentage)),
        },
    };

    const statsPath = path.join(outputDir, "migration-stats.json");
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), "utf-8");
    console.log(`✅ Generated statistics: ${statsPath}`);

    console.log("\n📊 Migration Statistics:");
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log(`   Unique repositories: ${stats.repositories}`);
    console.log(`   Rulesets used: ${stats.rulesets}`);
    if (stats.dateRange) {
        console.log(
            `   Date range: ${stats.dateRange.earliest.toISOString()} to ${stats.dateRange.latest.toISOString()}`,
        );
    }
    console.log(
        `   Average compliance: ${stats.complianceStats.average.toFixed(2)}%`,
    );
}

/**
 * Import Mode: Directly insert into Cosmos DB
 */
async function importToDatabase(documents: AnalysisDocument[]) {
    console.log("🔌 Connecting to Cosmos DB...");

    const { database } = await import(
        "../packages/server/src/services/database.js"
    );

    try {
        await database.connect();
        console.log("✅ Connected to Cosmos DB");

        console.log(`📝 Inserting ${documents.length} documents...`);

        // Insert in batches to avoid overwhelming the database
        const batchSize = 10;
        let inserted = 0;

        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);

            try {
                await database.analysis.insertMany(batch);
                inserted += batch.length;
                console.log(
                    `   Inserted ${inserted}/${documents.length} documents...`,
                );
            } catch (error: any) {
                console.error(`   Batch insert failed: ${error?.message}`);

                // Try inserting one by one to identify problematic documents
                for (const doc of batch) {
                    try {
                        await database.analysis.insertOne(doc);
                        inserted++;
                    } catch (docError: any) {
                        console.error(
                            `   Failed to insert ${doc.repoUrl}: ${docError?.message}`,
                        );
                    }
                }
            }
        }

        console.log(
            `✅ Successfully inserted ${inserted}/${documents.length} documents`,
        );

        // Verify insertion
        const count = await database.analysis.countDocuments();
        console.log(`📊 Total documents in database: ${count}`);

        await database.disconnect();
    } catch (error: any) {
        console.error(`❌ Database import failed: ${error?.message}`);
        throw error;
    }
}

/**
 * Main migration function
 */
async function migrate() {
    console.log("🚀 Starting migration from filesystem to database...\n");

    // Parse command-line arguments
    const mode = process.argv[2] || "export"; // 'export' or 'import'
    const resultsDir = path.resolve(__dirname, "../packages/app/results");
    const outputDir = path.resolve(__dirname, "../migration-output");

    console.log(`📁 Results directory: ${resultsDir}`);
    console.log(`📦 Mode: ${mode}\n`);

    // Find all result files
    console.log("🔍 Scanning for result files...");
    const files = await findResultFiles(resultsDir);
    console.log(`✅ Found ${files.length} result files\n`);

    // Load and convert all files
    console.log("📖 Loading result files...");
    const documents: AnalysisDocument[] = [];

    for (const file of files) {
        const data = await loadResultFile(file);
        if (data) {
            const doc = convertToAnalysisDocument(data, file); // Pass file path to extract createdBy
            documents.push(doc);
            console.log(
                `   ✓ ${data.repoUrl} (${new Date(data.timestamp).toISOString()})`,
            );
        }
    }

    console.log(`\n✅ Loaded ${documents.length} documents\n`);

    if (documents.length === 0) {
        console.log("⚠️  No documents to migrate");
        return;
    }

    // Execute based on mode
    if (mode === "export") {
        await exportToBSON(documents, outputDir);
        console.log("\n✅ Export complete!");
        console.log(`\nNext steps:`);
        console.log(`1. Review files in: ${outputDir}`);
        console.log(`2. Import to Cosmos DB using:`);
        console.log(
            `   mongoimport --uri '<connection-string>' --db template-doctor --collection analysis --file migration-output/analysis-export.json`,
        );
        console.log(`\nOr run: node scripts/migrate-to-database.js import`);
    } else if (mode === "import") {
        await importToDatabase(documents);
        console.log("\n✅ Import complete!");
    } else {
        console.error(`❌ Invalid mode: ${mode}`);
        console.log(
            "Usage: node scripts/migrate-to-database.js [export|import]",
        );
        process.exit(1);
    }
}

// Run migration
migrate().catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
});
