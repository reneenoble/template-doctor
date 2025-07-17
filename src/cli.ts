#!/usr/bin/env node
import { analyzeTemplate } from "./analyzeTemplate.js";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateDashboard } from "./dashboardGenerator.js";
import { openDashboard, serveDashboard } from "./dashboardServer.js";

dotenv.config();

const [,, ...args] = process.argv;

const repoArg = args.find(a => a.startsWith("--repo="));
const repoUrl = repoArg?.split("=")[1];
const openDashboardFlag = args.includes("--open-dashboard");
const serveFlag = args.includes("--serve");
const portArg = args.find(a => a.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3000;

if (!repoUrl) {
  console.error("❌ Usage: template-doctor --repo=https://github.com/user/repo [options]");
  console.error("\nOptions:");
  console.error("  --serve           Start a local server to view the dashboard");
  console.error("  --open-dashboard  Open the dashboard in the default browser");
  console.error("  --port=<number>   Specify the port for the dashboard server (default: 3000)");
  process.exit(1);
}

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
  
  // If serve flag is set or open dashboard flag is set, start the server
  if (serveFlag || openDashboardFlag) {
    try {
      // Handle serving the dashboard
      if (openDashboardFlag) {
        // Start server and open the dashboard in the browser
        const serverInfo = await openDashboard(dashboardPath, port);
        console.log(`🚀 Dashboard opened at: ${serverInfo.url}`);
        
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
