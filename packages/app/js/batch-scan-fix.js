// Inside the batch scan process, update the repository check section:

// First check if the repository needs to be forked
let processedUrl = url;
try {
  // Pass true as the second parameter to indicate batch mode
  processedUrl = await checkAndUpdateRepoUrl(url, true);

  if (processedUrl !== url) {
    itemElement.querySelector('.batch-item-message').textContent =
      'Using fork of the repository...';
  } else {
    itemElement.querySelector('.batch-item-message').textContent =
      'Analyzing repository...';
  }
} catch (forkError) {
  debug('app', `Error during fork check: ${forkError.message}`, forkError);
  itemElement.querySelector('.batch-item-message').textContent =
    'Proceeding with original repository...';
  // Always fall back to original URL on error in batch mode
  processedUrl = url;
}