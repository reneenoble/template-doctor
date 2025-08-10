// Azure Function: GitHub PR for Adding Template
// POST /api/add-template-pr
// Creates a PR to add a new template to the index-data.js file

const fetch = require('node-fetch');
// Using dynamic import for @octokit/rest which is an ES Module
let Octokit;

module.exports = async function (context, req) {
    // Dynamically import the Octokit module
    const { Octokit: OctokitModule } = await import('@octokit/rest');
    Octokit = OctokitModule;
    context.log('Add Template PR function triggered');
    
    // Enable CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
    };
    
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        context.log('Handling CORS preflight request');
        context.res.status = 204;
        return;
    }
    
    // Check for required parameters
    const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
    const templateData = req.body;
    
    if (!token) {
        context.res = {
            status: 401,
            body: { error: 'Authorization token is required' }
        };
        return;
    }
    
    if (!templateData || !validateTemplateData(templateData)) {
        context.res = {
            status: 400,
            body: { error: 'Invalid or missing template data' }
        };
        return;
    }

    try {
        // Initialize GitHub client
        const octokit = new Octokit({
            auth: token
        });
        
        // Get authenticated user
        const { data: user } = await octokit.users.getAuthenticated();
        context.log(`Authenticated as GitHub user: ${user.login}`);

        // GitHub repository configuration
        const owner = process.env.GITHUB_REPO_OWNER || user.login;  // Use authenticated user as owner by default
        const repo = process.env.GITHUB_REPO_NAME || 'template-doctor';  // Set your default repository name
        const baseBranch = 'main';  // Default base branch
        
        // Check if repository exists and is accessible
        try {
            // First, check if the repo exists and is accessible
            await octokit.repos.get({
                owner,
                repo
            });
            context.log(`Repository ${owner}/${repo} is accessible`);
        } catch (repoError) {
            context.log.error(`Repository access error: ${repoError.message}`);
            context.res = {
                status: 400,
                body: {
                    error: 'Repository access error',
                    details: `Cannot access repository ${owner}/${repo}. Please check repository name and permissions.`,
                    originalError: repoError.message
                }
            };
            return;
        }
        
        // Generate a unique branch name based on timestamp and template
        const timestamp = new Date().getTime();
        const branchName = `add-template-${timestamp}`;
        const repoIdentifier = getRepoIdentifier(templateData.repoUrl);
        
        // Get the latest commit on the base branch to branch from
        let baseCommitSha;
        try {
            const { data: refData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${baseBranch}`
            });
            baseCommitSha = refData.object.sha;
            context.log(`Found base branch: ${baseBranch}, SHA: ${baseCommitSha}`);
        } catch (branchError) {
            // Try default branch if specified branch doesn't exist
            context.log.error(`Branch ${baseBranch} not found: ${branchError.message}`);
            
            // Get default branch
            const { data: repoData } = await octokit.repos.get({
                owner,
                repo
            });
            
            const defaultBranch = repoData.default_branch;
            context.log(`Trying default branch: ${defaultBranch}`);
            
            const { data: defaultRefData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${defaultBranch}`
            });
            baseCommitSha = defaultRefData.object.sha;
            context.log(`Using default branch: ${defaultBranch}, SHA: ${baseCommitSha}`);
        }
        
        // Create a new branch
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseCommitSha
        });
        context.log(`Created branch: ${branchName}`);
        
        // Get the current index-data.js file
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'src/frontend/results/index-data.js',
            ref: branchName
        });
        
        // Decode the file content
        const content = Buffer.from(fileData.content, 'base64').toString();
        
        // Update the content by adding the new template
        const updatedContent = addTemplateToIndexData(content, templateData);
        
        // Commit the updated file
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'src/frontend/results/index-data.js',
            message: `Add template: ${repoIdentifier}`,
            content: Buffer.from(updatedContent).toString('base64'),
            branch: branchName,
            sha: fileData.sha
        });
        context.log(`Updated index-data.js file`);
        
        // Create a pull request
        const { data: prData } = await octokit.pulls.create({
            owner,
            repo,
            title: `Add template: ${repoIdentifier}`,
            head: branchName,
            base: baseBranch,
            body: `This PR adds a new template scan for ${templateData.repoUrl} to the index-data.js file.
            
### Template Details
- Repository: ${templateData.repoUrl}
- Rule Set: ${templateData.ruleSet}
- Compliance: ${templateData.compliance.percentage}%
- Issues: ${templateData.compliance.issues}
- Passed: ${templateData.compliance.passed}
- Scanned By: ${templateData.scannedBy.join(', ')}
            `
        });
        context.log(`Created PR: ${prData.html_url}`);
        
        // Return success
        context.res = {
            status: 200,
            body: {
                success: true,
                message: 'Pull request created successfully',
                prUrl: prData.html_url
            }
        };
    } catch (error) {
        context.log.error(`Error creating PR: ${error.message}`, error);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to create pull request',
                details: error.message
            }
        };
    }
};

/**
 * Validate that all required template data is present
 * @param {Object} data - Template data object
 * @returns {boolean} - True if valid
 */
function validateTemplateData(data) {
    return data &&
        data.timestamp &&
        data.dashboardPath &&
        data.dataPath &&
        data.repoUrl &&
        data.ruleSet &&
        data.compliance &&
        typeof data.compliance.percentage === 'number' &&
        typeof data.compliance.issues === 'number' &&
        typeof data.compliance.passed === 'number' &&
        Array.isArray(data.scannedBy) &&
        data.relativePath;
}

/**
 * Add the new template data to the index-data.js content
 * @param {string} content - Current file content
 * @param {Object} templateData - New template data to add
 * @returns {string} - Updated file content
 */
function addTemplateToIndexData(content, templateData) {
    // Find the opening bracket of the array
    const arrayStart = content.indexOf('[');
    if (arrayStart === -1) {
        throw new Error('Could not find array start in index-data.js');
    }
    
    // Format the new template data as JSON with proper indentation
    const templateJson = JSON.stringify(templateData, null, 2)
        .replace(/^{/gm, '  {')
        .replace(/^}/gm, '  }')
        .replace(/^  "(.+)":/gm, '    "$1":');
    
    // Insert the new template at the beginning of the array
    return content.slice(0, arrayStart + 1) + 
        '\n' + templateJson + ',' + 
        content.slice(arrayStart + 1);
}

/**
 * Extract a friendly identifier from the repository URL
 * @param {string} url - Repository URL
 * @returns {string} - Repository identifier
 */
function getRepoIdentifier(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        if (pathParts.length >= 3) {
            // For GitHub URLs, return owner/repo format
            return `${pathParts[1]}/${pathParts[2]}`;
        }
        return url.replace(/https?:\/\//, '');
    } catch (error) {
        return url;
    }
}
