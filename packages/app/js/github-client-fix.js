/**
 * Fork a repository to the user's account with better error handling for batch scans
 * @param {string} owner - Original repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} - Fork data or error with special properties
 */
async function forkRepository(owner, repo) {
  try {
    const result = await this.request(`/repos/${owner}/${repo}/forks`, {
      method: 'POST',
    });
    return result;
  } catch (error) {
    // Check if this is a SAML or SSO related error
    const isSamlError = 
      (error.response?.status === 403 && /saml|sso/i.test(error.response?.data?.message)) ||
      (error.message && /saml|sso/i.test(error.message));
    
    // Enhance the error object with SAML detection
    error.isSamlError = isSamlError;
    
    console.error(`Error forking repository ${owner}/${repo}:`, error);
    throw error;
  }
}