// This script extracts all repository URLs from the gallery.json file
// and formats them for batch scanning with security enabled but without resources results

const fs = require('fs');
const path = require('path');

// Read the gallery.json file
const galleryJsonPath = path.resolve(__dirname, '../packages/app/results/gallery.json');
const galleryJson = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));

// Extract the repository URLs
const repoUrls = galleryJson
  .filter(item => item.source) // Filter out items without a source URL
  .map(item => item.source.trim()) // Get the source URL and trim whitespace
  .filter(url => url.includes('github.com')); // Filter to only include GitHub repos

// Format each URL for easy copy-pasting
console.log('# Extracted GitHub Repository URLs from gallery.json');
console.log('# Total repositories:', repoUrls.length);
console.log('# Copy these URLs for batch scanning with security enabled but without resources results');
console.log('# ');
console.log(repoUrls.join('\n'));

// Save the URLs to a file for easy access
const outputPath = path.resolve(__dirname, '../repo-urls-for-batch-scan.txt');
fs.writeFileSync(outputPath, repoUrls.join('\n'), 'utf8');
console.log('\nURLs saved to:', outputPath);