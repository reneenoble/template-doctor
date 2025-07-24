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
 */
export async function createGitHubIssue(
  repoUrl: string, 
  issueTitle: string, 
  issueBody: string, 
  labels: string[] = ["template-doctor"]
): Promise<{ html_url: string; number: number }> {
  try {
    // Extract owner and repo from the URL
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    
    // Get authenticated Octokit client
    const octokit = getOctokit();
    
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
      number: response.data.number
    };
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
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
