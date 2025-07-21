import https from "https";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Client for interacting with the Model Context Protocol (MCP) server
 * for awesome-azd-template-testing repository
 */

interface MCPRequestOptions {
  method: string;
  path: string;
  data?: any;
}

/**
 * Makes a request to the MCP server
 */
async function makeMCPRequest<T>(options: MCPRequestOptions): Promise<T> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || "https://awesome-azd-template-testing.azurewebsites.net";
  const mcpApiKey = process.env.MCP_API_KEY;
  
  if (!mcpApiKey) {
    throw new Error('MCP_API_KEY environment variable is not set');
  }
  
  const url = new URL(options.path, mcpServerUrl);
  
  return new Promise((resolve, reject) => {
    const reqOptions = {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": mcpApiKey
      }
    };
    
    const req = https.request(url, reqOptions, (res) => {
      let data = "";
      
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Invalid JSON response from MCP server: ${data}`));
          }
        } else {
          reject(new Error(`MCP Server error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on("error", (error) => {
      reject(new Error(`Error connecting to MCP server: ${error.message}`));
    });
    
    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
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
    const repoFullName = `${owner}/${repo}`;
    
    const response = await makeMCPRequest<{ html_url: string; number: number }>({
      method: "POST",
      path: "/api/github-issue",
      data: {
        repoUrl: repoUrl,
        repositoryFullName: repoFullName,
        title: issueTitle,
        body: issueBody,
        labels
      }
    });
    
    return response;
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    throw error;
  }
}

/**
 * Tests AZD provisioning through the MCP server
 */
export async function testAzdProvision(
  repoUrl: string, 
  environment: string = "dev"
): Promise<{ runId: string }> {
  try {
    const response = await makeMCPRequest<{ runId: string }>({
      method: "POST",
      path: "/api/provision",
      data: {
        repoUrl,
        environment
      }
    });
    
    return response;
  } catch (error) {
    console.error("Failed to start AZD provisioning:", error);
    throw error;
  }
}

/**
 * Gets the status of an AZD provisioning job
 */
export async function getAzdProvisionStatus(runId: string): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  progress?: string;
  success?: boolean;
  logs?: string;
  error?: string;
}> {
  try {
    const response = await makeMCPRequest<{
      status: "pending" | "running" | "completed" | "failed";
      progress?: string;
      success?: boolean;
      logs?: string;
      error?: string;
    }>({
      method: "GET",
      path: `/api/provision-status?runId=${runId}`
    });
    
    return response;
  } catch (error) {
    console.error("Failed to get AZD provision status:", error);
    throw error;
  }
}
