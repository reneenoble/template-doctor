#!/usr/bin/env node
import { analyzeTemplate } from "./analyzeTemplate.js";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateDashboard } from "./dashboardGenerator.js";
import { openDashboard, serveDashboard } from "./dashboardServer.js";
import { createGitHubIssue, testAzdProvision, getAzdProvisionStatus } from "./mcpClient.js";

dotenv.config();

const [,, command, ...args] = process.argv;

// Common argument parsing
const repoArg = args.find(a => a.startsWith("--repo="));
const repoUrl = repoArg?.split("=")[1];
const openDashboardFlag = args.includes("--open-dashboard");
const serveFlag = args.includes("--serve");
const portArg = args.find(a => a.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3000;
const createIssueFlag = args.includes("--create-issue");

// Handle different commands
async function run() {
  // If no specific command is provided, use the default analyze command
  const resolvedCommand = command?.startsWith("--") ? "analyze" : command || "analyze";

  switch (resolvedCommand) {
    case "analyze":
      await analyzeCommand();
      break;
    case "create-issue":
      await createIssueCommand();
      break;
    case "provision":
      await provisionCommand();
      break;
    case "status":
      await statusCommand();
      break;
    case "list":
    case "templates":
      await listCommand();
      break;
    case "rebuild":
    case "update-index":
      await rebuildCommand();
      break;
    case "help":
    default:
      showHelp();
      break;
  }
}

function showHelp() {
  console.log("Template Doctor CLI");
  console.log("===================\n");
  console.log("Usage:");
  console.log("  template-doctor <command> [options]\n");
  console.log("Commands:");
  console.log("  analyze            Analyze a template repository (default)");
  console.log("  create-issue       Create a GitHub issue with analysis results");
  console.log("  provision          Start an AZD provision test");
  console.log("  status             Check the status of an AZD provision job");
  console.log("  list, templates    List all analyzed templates and open dashboard");
  console.log("  rebuild            Regenerate the template index dashboard");
  console.log("  help               Show this help message\n");
  console.log("Options:");
  console.log("  --repo=<url>       URL of the GitHub repository to analyze");
  console.log("  --serve            Start a local server to view the dashboard");
  console.log("  --open-dashboard   Open the dashboard in the default browser");
  console.log("  --port=<number>    Specify the port for the dashboard server (default: 3000)");
  console.log("  --create-issue     Automatically create a GitHub issue with results");
  console.log("  --job-id=<id>      Specify the job ID for the 'status' command");
  console.log("  --env=<name>       Specify the environment name for provisioning (default: 'dev')");
  process.exit(1);
}

async function analyzeCommand() {
  if (!repoUrl) {
    console.error("❌ Missing required argument: --repo=https://github.com/user/repo");
    showHelp();
    return;
  }
  
  // If openDashboardFlag is set, open the dashboard in the browser

  try {
    const result = await analyzeTemplate(repoUrl);

    const resultsDir = path.resolve("results");
    if (!existsSync(resultsDir)) {
      await mkdir(resultsDir, { recursive: true });
    }
    const outputPath = path.resolve(resultsDir, `${Date.now()}-analysis.json`);
    await writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(`✅ Analysis complete. Output saved to: ${outputPath}`);

    // Generate the dashboard
    const dashboardPath = await generateDashboard(result, outputPath);
    console.log(`🎨 Dashboard generated at: ${dashboardPath}`);
    
    // If create issue flag is set, create a GitHub issue
    if (createIssueFlag) {
      await createIssueFromResults(result);
    }

    // Always make sure the index file is updated with the new template
    console.log("🔄 Updating template index...");
    
    // Import the updateIndexFile function from dashboardGenerator
    const { updateIndexFile } = await import("./dashboardGenerator.js");
    
    // Regenerate the index file
    await updateIndexFile(resultsDir);
    console.log("✅ Template index updated successfully");
    
    // If serve flag is set or open dashboard flag is set, start the server
    if (serveFlag || openDashboardFlag) {
      try {
        // Handle serving the dashboard
    if (openDashboardFlag) {
      // Start server and open the dashboard in the browser
      // Always open the specific dashboard path for the analysis
      const serverInfo = await openDashboard(dashboardPath, port);
      console.log(`🚀 Dashboard opened at: ${serverInfo.url}`);
      console.log(`� Analyzing template: ${repoUrl}`);
          
          // Keep the server running until the user presses Ctrl+C
          console.log("\n👀 Press Ctrl+C to stop the server and exit");
        } else {
          // Just serve the dashboard without opening
          const serverInfo = await serveDashboard(dashboardPath, port);
          console.log(`🚀 Dashboard available at: ${serverInfo.url}`);
          console.log("\n👀 Press Ctrl+C to stop the server and exit");
        }
      } catch (err) {
        console.error("❌ Failed to start dashboard server:", err instanceof Error ? err.message : err);
        // Still show file path as fallback
        console.log(`📄 You can open the dashboard file directly: file://${dashboardPath}`);
      }
    } else {
      // Just show the file path if not serving
      console.log(`📄 Open dashboard: file://${dashboardPath}`);
    }
  } catch (err) {
    console.error("❌ Analysis failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

async function createIssueCommand() {
  if (!repoUrl) {
    console.error("❌ Missing required argument: --repo=https://github.com/user/repo");
    showHelp();
    return;
  }

  try {
    console.log("🔍 Analyzing repository...");
    const result = await analyzeTemplate(repoUrl);
    
    await createIssueFromResults(result);
  } catch (err) {
    console.error("❌ Failed to create issue:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

async function createIssueFromResults(result: any) {
  try {
    console.log("📝 Creating GitHub issue...");
    
    const issueTitle = `Template Doctor Analysis: ${result.compliance.summary}`;
    
    // Format the issue body with the compliance results
    let issueBody = `# Template Doctor Analysis\n\n`;
    issueBody += `Analyzed on: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    issueBody += `## Summary\n\n`;
    issueBody += `- Compliance: ${result.compliance.compliant.find((item: any) => item.category === 'meta')?.details?.percentageCompliant || 0}%\n`;
    issueBody += `- Issues Found: ${result.compliance.issues.length}\n`;
    issueBody += `- Passed Checks: ${result.compliance.compliant.filter((item: any) => item.category !== 'meta').length}\n\n`;
    
    if (result.compliance.issues.length > 0) {
      issueBody += `## Issues to Fix\n\n`;
      result.compliance.issues.forEach((issue: any, index: number) => {
        issueBody += `${index + 1}. **${issue.message}**\n`;
        if (issue.error) {
          issueBody += `   - ${issue.error}\n`;
        }
        issueBody += `\n`;
      });
    }
    
    const response = await createGitHubIssue(result.repoUrl, issueTitle, issueBody);
    console.log(`✅ GitHub issue created: ${response.html_url}`);
    console.log(`   Issue number: #${response.number}`);
    
    return response;
  } catch (err) {
    console.error("❌ Failed to create GitHub issue:", err instanceof Error ? err.message : err);
    throw err;
  }
}

async function provisionCommand() {
  if (!repoUrl) {
    console.error("❌ Missing required argument: --repo=https://github.com/user/repo");
    showHelp();
    return;
  }

  const envArg = args.find(a => a.startsWith("--env="));
  const environment = envArg ? envArg.split("=")[1] : "dev";

  try {
    console.log(`🚀 Starting AZD provision test for ${repoUrl} (environment: ${environment})...`);
    
    const response = await testAzdProvision(repoUrl, environment);
    console.log(`✅ AZD provision job started. Run ID: ${response.runId}`);
    console.log(`   Use 'template-doctor status --job-id=${response.runId}' to check the status.`);
    
    return response;
  } catch (err) {
    console.error("❌ Failed to start AZD provision test:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

async function statusCommand() {
  const jobIdArg = args.find(a => a.startsWith("--job-id="));
  const jobId = jobIdArg?.split("=")[1];

  if (!jobId) {
    console.error("❌ Missing required argument: --job-id=<id>");
    showHelp();
    return;
  }

  try {
    console.log(`🔍 Checking status of job: ${jobId}...`);
    
    const status = await getAzdProvisionStatus(jobId);
    console.log(`Status: ${status.status.toUpperCase()}`);
    
    if (status.progress) {
      console.log(`Progress: ${status.progress}`);
    }
    
    if (status.success !== undefined) {
      console.log(`Success: ${status.success ? 'Yes' : 'No'}`);
    }
    
    if (status.logs) {
      console.log("\nLogs:");
      console.log(status.logs);
    }
    
    if (status.error) {
      console.error("\nError:", status.error);
    }
    
    return status;
  } catch (err) {
    console.error("❌ Failed to get job status:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// This function is used in the CLI to extract repository information
// It's kept for reference and potential future use
/*
function extractRepoFullName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)(\.git)?/);
  if (!match) throw new Error("Invalid GitHub URL");
  return match[1];
}
*/

/**
 * Command to list all templates and open the template index dashboard
 */
async function listCommand() {
  try {
    const resultsDir = path.resolve("results");
    if (!existsSync(resultsDir)) {
      console.error("❌ No results directory found. Run an analysis first with 'template-doctor analyze --repo=<url>')");
      return;
    }

    console.log("📊 Opening template dashboard...");
    
    const indexPath = path.join(resultsDir, "template-index.html");
    
    if (!existsSync(indexPath)) {
      console.error("❌ No template index found. Run an analysis first with 'template-doctor analyze --repo=<url>'");
      return;
    }
    
    // Serve or open the template index
    try {
      if (openDashboardFlag) {
        const serverInfo = await openDashboard(indexPath, port);
        console.log(`🚀 Template index opened at: ${serverInfo.url}`);
        console.log("\n👀 Press Ctrl+C to stop the server and exit");
      } else if (serveFlag) {
        const serverInfo = await serveDashboard(indexPath, port);
        console.log(`🚀 Template index available at: ${serverInfo.url}`);
        console.log("\n👀 Press Ctrl+C to stop the server and exit");
      } else {
        console.log(`📄 Template index available at: file://${indexPath}`);
      }
    } catch (err) {
      console.error("❌ Failed to start dashboard server:", err instanceof Error ? err.message : err);
      // Still show file path as fallback
      console.log(`📄 You can open the template index file directly: file://${indexPath}`);
    }
  } catch (err) {
    console.error("❌ Failed to list templates:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

/**
 * Command to rebuild the template index dashboard
 */
async function rebuildCommand() {
  try {
    const resultsDir = path.resolve("results");
    if (!existsSync(resultsDir)) {
      console.error("❌ No results directory found. Run an analysis first with 'template-doctor analyze --repo=<url>')");
      return;
    }

    console.log("🔄 Rebuilding template index dashboard...");
    
    // Import the updateIndexFile function from dashboardGenerator
    const { updateIndexFile } = await import("./dashboardGenerator.js");
    
    // Regenerate the index file
    await updateIndexFile(resultsDir);
    
    console.log("✅ Template index dashboard rebuilt successfully.");

    const indexPath = path.join(resultsDir, "template-index.html");
    
    if (!existsSync(indexPath)) {
      console.error("❌ Failed to create template index.");
      return;
    }

    // Serve or open the template index
    try {
      if (openDashboardFlag) {
        const serverInfo = await openDashboard(indexPath, port);
        console.log(`🚀 Template index opened at: ${serverInfo.url}`);
        console.log("\n👀 Press Ctrl+C to stop the server and exit");
      } else if (serveFlag) {
        const serverInfo = await serveDashboard(indexPath, port);
        console.log(`🚀 Template index available at: ${serverInfo.url}`);
        console.log("\n👀 Press Ctrl+C to stop the server and exit");
      } else {
        console.log(`📄 Template index available at: file://${indexPath}`);
      }
    } catch (err) {
      console.error("❌ Failed to start dashboard server:", err instanceof Error ? err.message : err);
      // Still show file path as fallback
      console.log(`📄 You can open the template index file directly: file://${indexPath}`);
    }
  } catch (err) {
    console.error("❌ Failed to rebuild template index:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run the CLI
run().catch(err => {
  console.error("❌ Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
