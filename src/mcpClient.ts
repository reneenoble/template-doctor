import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

// Load environment variables
dotenv.config();

// NOTE: This file was updated to use Octokit for direct GitHub API access
// instead of relying on an MCP server. To use this:
//
// 1. Create a GitHub Personal Access Token with 'repo' scope permissions
// 2. Set it as an environment variable: GITHUB_TOKEN=your_token_here
// 3. For AZD provision testing, create a GitHub Actions workflow in your repository
//    that triggers on the 'repository_dispatch' event with type 'azd-provision-test'

/**
 * Client for interacting with GitHub API using Octokit
 */

// Initialize Octokit with the GitHub token
function getOctokit(): Octokit {
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set. Please set it to a valid GitHub Personal Access Token.');
  }
  
  return new Octokit({
    auth: githubToken
  });
}

/**
 * Creates a GitHub issue based on template analysis results
 * @param repoUrl GitHub repository URL
 * @param issueTitle Issue title
 * @param issueBody Issue body
 * @param labels Optional labels to add to the issue
 * @param checkForDuplicates Whether to check for duplicate issues before creating
 * @returns Created issue information
 */
export async function createGitHubIssue(
  repoUrl: string, 
  issueTitle: string, 
  issueBody: string, 
  labels: string[] = ["template-doctor"],
  checkForDuplicates: boolean = false
): Promise<{ html_url: string; number: number; updated?: boolean }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();

    // Check for duplicate issues if requested
    if (checkForDuplicates) {
      try {
        // Extract date from title if it exists in [YYYY-MM-DD] format
        const dateMatch = issueTitle.match(/\[(\d{4}-\d{2}-\d{2})\]/);
        const dateStr = dateMatch ? dateMatch[1] : null;
        
        // Get existing issues
        const issues = await getGitHubIssues(repoUrl, 'open');
        
        // Look for similar issues
        const similarIssues = issues.issues.filter(issue => {
          if (dateStr) {
            // If we have a date in the new title, look for matching date
            return issue.title.includes(dateStr);
          }
          
          // Otherwise look for similar title (without the date part)
          const baseTitle = issueTitle.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
          const issueBaseTitle = issue.title.replace(/\[\d{4}-\d{2}-\d{2}\]/, '').trim();
          
          return issueBaseTitle.includes(baseTitle) || baseTitle.includes(issueBaseTitle);
        });
        
        if (similarIssues.length > 0) {
          // Update the first similar issue instead of creating a new one
          console.log(`Found similar issue #${similarIssues[0].number}. Updating instead of creating.`);
          const response = await updateGitHubIssue(repoUrl, similarIssues[0].number, issueTitle, issueBody);
          return { ...response, updated: true };
        }
      } catch (error) {
        // If we can't check for duplicates, just proceed with creation
        console.warn("Could not check for duplicate issues, proceeding with creation:", error);
      }
    }
    
    // Create the issue using Octokit
    const response = await octokit.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels
    });
    
    return {
      html_url: response.data.html_url,
      number: response.data.number,
      updated: false
    };
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    throw error;
  }
}

/**
 * Updates an existing GitHub issue
 */
export async function updateGitHubIssue(
  repoUrl: string,
  issueNumber: number,
  issueTitle: string,
  issueBody: string
): Promise<{ html_url: string; number: number }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Update the issue using Octokit
    const response = await octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      title: issueTitle,
      body: issueBody
    });
    
    return {
      html_url: response.data.html_url,
      number: response.data.number
    };
  } catch (error) {
    console.error("Failed to update GitHub issue:", error);
    throw error;
  }
}

/**
 * Tests AZD provisioning using GitHub Actions
 * This creates a repository dispatch event to trigger a workflow in the repo
 */
export async function testAzdProvision(
  repoUrl: string, 
  environment: string = "dev"
): Promise<{ runId: string }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Create a unique run ID
    const runId = `azd-provision-${Date.now()}`;
    
    // Log what we're doing
    console.log(`Starting AZD provision test for ${repoUrl} in ${environment} environment`);
    console.log(`Note: GitHub Actions workflow must exist in the repository to handle this test`);
    
    try {
      // Create a repository dispatch event to trigger a workflow
      await octokit.repos.createDispatchEvent({
        owner,
        repo,
        event_type: 'azd-provision-test',
        client_payload: {
          environment,
          runId
        }
      });
      
      console.log(`Dispatched 'azd-provision-test' event to ${owner}/${repo}`);
      console.log(`This will trigger any workflows configured to handle this event type`);
      
      // Create an issue to track the provision test
      await createGitHubIssue(
        repoUrl,
        `AZD Provision Test - ${environment}`,
        `# AZD Provision Test\n\nTest ID: ${runId}\nEnvironment: ${environment}\nStarted: ${new Date().toISOString()}\n\nThis issue will be updated with results when the test completes.`,
        ["azd-provision-test"]
      );
    } catch (error) {
      console.warn("Could not dispatch repository event. This is expected if you don't have write permissions to the repository.");
      console.log("Continuing with run ID for tracking purposes only.");
    }
    
    return { runId };
  } catch (error) {
    console.error("Failed to start AZD provisioning:", error);
    throw error;
  }
}

/**
 * Gets the status of an AZD provisioning job
 * Without the MCP server, this method checks GitHub Actions workflow runs
 */
export async function getAzdProvisionStatus(runId: string): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  progress?: string;
  success?: boolean;
  logs?: string;
  error?: string;
}> {
  try {
    // Since we no longer have an MCP server to track the status,
    // we'll need to rely on GitHub issues to track this
    console.log(`Checking status for AZD provision test ${runId}`);
    console.log(`Note: Without the MCP server, detailed status is not available`);
    console.log(`Check the GitHub repository for workflow runs and issues with label 'azd-provision-test'`);
    
    // Return a placeholder status
    return {
      status: "pending",
      progress: "GitHub Actions workflow may be running. Check the repository's Actions tab.",
      success: undefined,
      logs: "Logs not available without MCP server. Please check GitHub Actions logs."
    };
  } catch (error) {
    console.error("Failed to get AZD provision status:", error);
    throw error;
  }
}

/**
 * Gets open GitHub issues for a repository
 * This helps prevent duplicate issue creation
 */
export async function getGitHubIssues(
  repoUrl: string,
  state: 'open' | 'closed' | 'all' = 'open',
  labels: string[] = []
): Promise<{ issues: Array<{ title: string; body: string; html_url: string; number: number; labels?: string[] }> }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Get issues from the repository
    const params: any = {
      owner,
      repo,
      state,
      per_page: 100 // Limit to most recent 100 issues for performance
    };
    
    // Add labels filter if provided
    if (labels && labels.length > 0) {
      params.labels = labels.join(',');
    }
    
    const response = await octokit.issues.listForRepo(params);
    
    // Return simplified issue data
    return {
      issues: response.data.map(issue => ({
        title: issue.title,
        body: issue.body || '',
        html_url: issue.html_url,
        number: issue.number,
        labels: issue.labels?.map(label => typeof label === 'string' ? label : label.name || '')
      }))
    };
  } catch (error) {
    console.error("Failed to fetch GitHub issues:", error);
    throw error;
  }
}

/**
 * Creates a sub-issue linked to a parent issue 
 * @param repoUrl GitHub repository URL
 * @param issueTitle Issue title
 * @param issueBody Issue body
 * @param parentIssueNumber The number of the parent issue to link this to
 * @param issueId Optional unique ID for the issue for deduplication
 * @param labels Optional labels to add to the issue
 * @returns Created issue information
 */
export async function createSubIssue(
  repoUrl: string,
  issueTitle: string,
  issueBody: string,
  parentIssueNumber: number,
  issueId?: string,
  labels: string[] = ["Template Doctor Issue"]
): Promise<{ html_url: string; number: number; updated?: boolean }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
    // Add a reference to the parent issue
    const bodyWithReference = `${issueBody}\n\n_This issue is part of [Template Doctor Full Scan #${parentIssueNumber}](${repoUrl}/issues/${parentIssueNumber})._`;
    
    // Add a unique identifier if provided
    const finalBody = issueId ? 
      `${bodyWithReference}\n\n<!-- Issue ID: ${issueId} -->` : 
      bodyWithReference;
    
    // Check for duplicate issues with the same ID
    if (issueId) {
      try {
        const issues = await getGitHubIssues(repoUrl, 'open');
        
        // Look for issues with the same ID
        const existingIssue = issues.issues.find(issue => {
          const idMatch = issue.body.match(/<!-- Issue ID: (.+?) -->/);
          return idMatch && idMatch[1] === issueId;
        });
        
        if (existingIssue) {
          // Update the existing issue instead of creating a new one
          console.log(`Found existing issue #${existingIssue.number} with ID ${issueId}. Updating instead of creating.`);
          const response = await updateGitHubIssue(repoUrl, existingIssue.number, issueTitle, finalBody);
          return { ...response, updated: true };
        }
      } catch (error) {
        // If we can't check for duplicates, just proceed with creation
        console.warn("Could not check for duplicate issues, proceeding with creation:", error);
      }
    }
    
    // Create the issue
    const response = await octokit.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: finalBody,
      labels
    });
    
    return {
      html_url: response.data.html_url,
      number: response.data.number,
      updated: false
    };
  } catch (error) {
    console.error("Failed to create sub-issue:", error);
    throw error;
  }
}
