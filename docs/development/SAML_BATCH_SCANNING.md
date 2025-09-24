# SAML/SSO Batch Scanning Enhancement

This enhancement improves how Template Doctor handles SAML/SSO protected repositories during batch scanning operations.

## Problem Statement

When scanning repositories that belong to organizations with SAML/SSO protection (like Microsoft or Azure-Samples), the application tries to fork the repository but fails if the user hasn't authorized SAML access. 

- In individual scan mode, the application shows an error notification
- In batch scan mode, the entire batch operation would fail when encountering a SAML/SSO protected repository

## Solution

The enhancement adds better detection of SAML/SSO errors and modifies how the application handles these errors in batch mode:

1. Enhanced the GitHub client's `forkRepository` method to detect SAML/SSO errors
2. Modified the `checkAndUpdateRepoUrl` function to:
   - Accept a `isBatchMode` parameter to handle errors differently based on the context
   - Continue with the original repository URL in batch mode when SAML/SSO errors occur
3. Created a patch loader that automatically applies these enhancements when the application loads

## Files Added

- `github-client-patch.js`: Enhanced version of the GitHub client methods for SAML detection
- `github-fork-patch.js`: Utility module with patches for both GitHub client and app.js functions
- `saml-batch-patch-loader.js`: Loader that automatically applies the patches when the application starts
- `saml-batch-test.js`: Test script to verify the patches are working correctly

## Implementation Details

### GitHub Client Enhancement

The GitHub client has been enhanced to:
- Better detect SAML/SSO errors by checking for specific patterns in error messages
- Add an `isSamlError` property to error objects when a SAML/SSO error is detected
- Accept a `isBatchMode` parameter to differentiate between batch and individual scanning

### Repository URL Handling

The `checkAndUpdateRepoUrl` function has been enhanced to:
- First check if a fork already exists before attempting to create a new one
- Handle errors differently based on whether it's batch mode or individual scan
- Continue with the original repository URL in batch mode when SAML/SSO errors occur
- Show appropriate notifications to the user

### Batch Processing

The `processBatchUrls` function has been enhanced to:
- Pass the batch mode flag to the `checkAndUpdateRepoUrl` function
- Handle errors more gracefully to prevent batch failure
- Continue processing the remaining URLs even if some repositories have SAML/SSO protection

## Testing

You can test the enhancement using the `saml-batch-test.js` script:

1. Open the Template Doctor web application
2. Open the browser developer console
3. Copy and paste the contents of `saml-batch-test.js` into the console
4. Run the test functions:
   - `testIndividualSamlRepo()` - Tests individual scan with SAML-protected repo
   - `testBatchSamlRepo()` - Tests batch scan with SAML-protected repo
   - `testBatchProcessingWithMixedRepos()` - Tests batch processing with mixed repos

## Expected Behavior

- **Individual scan**: Shows a notification about SAML/SSO authorization requirement
- **Batch scan**: Continues with the original repository URL without showing notifications
- **Existing forks**: Uses the existing fork if already available, regardless of mode
- **Non-SAML repositories**: Behavior remains unchanged