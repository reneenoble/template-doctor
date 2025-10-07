/**
 * Bundle analyzer-core into API dist folder
 * This ensures analyzer-core is available during Azure SWA deployment
 * without relying on local file: dependencies
 */
const fs = require("fs");
const path = require("path");

const ANALYZER_CORE_SRC = path.join(__dirname, "../analyzer-core/dist");
const ANALYZER_CORE_DEST = path.join(__dirname, "dist/analyzer-core");
const ANALYZER_CORE_SRC_TS = path.join(__dirname, "../analyzer-core/src");

console.log("Bundling analyzer-core into API dist...");

// Create destination directories
fs.mkdirSync(ANALYZER_CORE_DEST, { recursive: true });
fs.mkdirSync(path.join(__dirname, "analyzer-core"), { recursive: true });

// Copy all files recursively
function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

if (!fs.existsSync(ANALYZER_CORE_SRC)) {
    throw new Error(
        "ERROR: analyzer-core dist not found. Build analyzer-core first!",
    );
}

// Copy TypeScript source files for compilation
if (fs.existsSync(ANALYZER_CORE_SRC_TS)) {
    copyRecursive(ANALYZER_CORE_SRC_TS, path.join(__dirname, "analyzer-core"));
    console.log("✓ Copied analyzer-core TypeScript sources");
}

// Also copy built dist for runtime
copyRecursive(ANALYZER_CORE_SRC, ANALYZER_CORE_DEST);

console.log("✓ Bundled analyzer-core successfully");
