/**
 * Test script for SAML/SSO batch scanning patch
 * 
 * This script demonstrates how to test the SAML/SSO handling in both batch and individual modes.
 * 
 * To use:
 * 1. Open DevTools console in the Template Doctor web app
 * 2. Copy and paste this script
 * 3. Call the test functions as needed
 */

// Test individual scan with SAML repo
async function testIndividualSamlRepo() {
  // Example repository that may have SAML protection
  const repoUrl = 'https://github.com/Microsoft/vscode';
  
  console.log('Testing individual scan with potentially SAML-protected repo:', repoUrl);
  
  try {
    // Call with batch mode=false (individual scan)
    const result = await window.checkAndUpdateRepoUrl(repoUrl, false);
    console.log('Result URL:', result);
    console.log('Success! URL was processed correctly for individual scan.');
    return result;
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
}

// Test batch scan with SAML repo
async function testBatchSamlRepo() {
  // Example repository that may have SAML protection
  const repoUrl = 'https://github.com/Microsoft/vscode';
  
  console.log('Testing batch scan with potentially SAML-protected repo:', repoUrl);
  
  try {
    // Call with batch mode=true
    const result = await window.checkAndUpdateRepoUrl(repoUrl, true);
    console.log('Result URL:', result);
    console.log('Success! URL was processed correctly for batch scan.');
    
    // Verify behavior - in batch mode, should return original URL on SAML error
    if (result === repoUrl) {
      console.log('✅ Correct behavior: Original URL returned for SAML repo in batch mode');
    } else {
      console.log('⚠️ Unexpected behavior: URL was changed in batch mode');
    }
    
    return result;
  } catch (error) {
    console.error('Test failed:', error);
    return null;
  }
}

// Test batch processing with mixed repos
async function testBatchProcessingWithMixedRepos() {
  // Mix of repositories (some may have SAML protection)
  const urls = [
    'https://github.com/Microsoft/vscode',          // May have SAML protection
    'https://github.com/Azure-Samples/todo-nodejs-mongo', // Public repo
    'https://github.com/Microsoft/TypeScript'       // May have SAML protection
  ];
  
  console.log('Testing batch processing with mixed repositories:', urls);
  
  try {
    if (typeof window.processBatchUrls !== 'function') {
      console.error('processBatchUrls function not found. Make sure patches are applied.');
      return;
    }
    
    // Process batch with enhanced function
    const options = { requireFork: false };
    await window.processBatchUrls(urls, options);
    
    console.log('Batch processing completed successfully');
    return true;
  } catch (error) {
    console.error('Batch processing test failed:', error);
    return false;
  }
}

// Print test instructions
console.log(`
SAML/SSO Batch Scan Patch Test Script Loaded

Available test functions:
- testIndividualSamlRepo() - Tests individual scan with SAML-protected repo
- testBatchSamlRepo() - Tests batch scan with SAML-protected repo
- testBatchProcessingWithMixedRepos() - Tests batch processing with mixed repos

Example usage:
> await testIndividualSamlRepo()
> await testBatchSamlRepo()
> await testBatchProcessingWithMixedRepos()
`);