#!/bin/bash

# Batch Scan Script for Template Doctor
# This script processes a list of GitHub repository URLs and scans them with security enabled
# but without resources results.

# Exit on error
set -e

# Path to the file containing repository URLs
URL_FILE="./scripts/batch-scan-urls.txt"

# Check if the URL file exists
if [ ! -f "$URL_FILE" ]; then
  echo "Error: URL file $URL_FILE not found."
  exit 1
fi

# Reset results first
echo "Resetting existing results..."
./scripts/reset-results.sh

# Set options for scanning
SCAN_OPTIONS="--security-scan --skip-resources"

# Process each URL in the file
echo "Starting batch scan of repositories..."
count=0
total=$(wc -l < "$URL_FILE")

while IFS= read -r repo_url || [ -n "$repo_url" ]; do
  # Skip empty lines
  if [ -z "$repo_url" ]; then
    continue
  fi
  
  # Increment counter
  ((count++))
  
  # Extract repo name for logging
  repo_name=$(echo "$repo_url" | sed 's/.*github.com\///g')
  
  echo "[$count/$total] Scanning repository: $repo_name"
  
  # Run the analysis command (no timeout on macOS)
  npm run analyze -- "$repo_url" $SCAN_OPTIONS || {
    echo "Warning: Scan failed for $repo_name"
    continue
  }
  
  # Small delay between requests to avoid rate limiting
  sleep 2
  
done < "$URL_FILE"

echo "Batch scan completed. Processed $count repositories."
echo "Results are available in the packages/app/results directory."

# Generate aggregated backfill meta so template index can load tiles
echo "Generating scan meta backfill..."
npm run generate:scan-meta-backfill || echo "Warning: Failed to generate scan meta backfill."
echo "Done. Open packages/app/results/template-index.html via local server to view tiles."