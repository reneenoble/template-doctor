import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import serveStatic from 'serve-static';
import { existsSync } from 'fs';
import { Server } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerInfo {
  url: string;
  server: Server;
  close: () => void;
}

interface ServerError extends Error {
  code?: string;
}

/**
 * Serves a dashboard on localhost with the specified port
 * @param dashboardPath - Path to the dashboard HTML file
 * @param port - Port to serve the dashboard on
 * @returns Server information
 */
export async function serveDashboard(dashboardPath: string, port = 3000): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    try {
      const app = express();
      
      // Get the directory of the dashboard file (results dir or a repo subdir)
      const dashboardDir = path.dirname(dashboardPath);
      
      // Get the base results directory (go up one level if in a repo subdir)
      const resultsBaseDir = path.resolve(dashboardDir, '..');
      const isRepoSubdir = path.basename(resultsBaseDir) === 'results';
      const resultsDir = isRepoSubdir ? resultsBaseDir : dashboardDir;
      
      console.log(`Serving entire results directory: ${resultsDir}`);
      
      // Serve the entire results directory and all subdirectories
      app.use(serveStatic(resultsDir));
      
      // Serve the assets directory
      const assetsDir = path.resolve(__dirname, '..', 'assets');
      app.use('/assets', serveStatic(assetsDir));
      
      // Serve the index at root or redirect to index if we're opening a specific report
      app.get('/', (_req, res) => {
        // Check if we have a template-index.html file in the results directory
        const indexPath = path.join(resultsDir, 'template-index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.sendFile(dashboardPath);
        }
      });

      // Add middleware to inject a back button into HTML files
      app.use((req, res, next) => {
        // Store the original send method
        const originalSend = res.send;
        
        // Override send method
        res.send = function(body) {
          // Only process HTML files
          if (typeof body === 'string' && req.path.endsWith('.html') && !req.path.includes('template-index.html')) {
            // Add a back button to the HTML content
            const backButton = `
              <div style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
                <a href="/template-index.html" style="display: inline-block; padding: 8px 16px; background-color: #0078d4; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
                  <span style="margin-right: 5px;">&#8592;</span> Back to Index
                </a>
              </div>
            `;
            
            // Insert the back button after the opening body tag
            body = body.replace('<body>', '<body>' + backButton);
          }
          
          // Call the original send method
          return originalSend.call(this, body);
        };
        
        next();
      });
      
      // Start the server
      const server = app.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`🌐 Dashboard server running at: ${url}`);
        
        resolve({
          url,
          server,
          close: () => {
            server.close();
            console.log('Dashboard server closed');
          }
        });
      });
      
      // Handle server errors
      server.on('error', (err: ServerError) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is already in use, trying ${port + 1}...`);
          // Try again with the next port
          serveDashboard(dashboardPath, port + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Opens a dashboard in the default browser
 * @param dashboardPath - Path to the dashboard HTML file
 * @param port - Port to serve the dashboard on
 * @returns Server information
 */
export async function openDashboard(dashboardPath: string, port = 3000): Promise<ServerInfo> {
  console.log(`Opening dashboard at ${dashboardPath} on port ${port}`);
  const serverInfo = await serveDashboard(dashboardPath, port);
  
  // Calculate the relative URL path from the absolute file path
  // This ensures we navigate to the correct dashboard file and not just the root
  
  // Get the relative path for URL construction
  // We need to ensure this generates a proper URL that the browser can access
  let urlPath;
  
  if (path.basename(dashboardPath) === 'template-index.html') {
    // For the template index, just use the index
    urlPath = 'template-index.html';
  } else {
    // For repo-specific dashboards, preserve the full path from the results dir
    // First get the repo name from the path
    const pathParts = dashboardPath.split(path.sep);
    const repoIndex = pathParts.findIndex(p => p === 'results') + 1;
    if (repoIndex > 0 && repoIndex < pathParts.length) {
      // Construct the path starting from the repo name folder
      urlPath = pathParts.slice(repoIndex).join('/');
    } else {
      // Fallback to just the file name
      urlPath = path.basename(dashboardPath);
    }
  }
  
  // Build the URL with the relative path
  const dashboardUrl = `${serverInfo.url}/${urlPath}`;
  
  // Open the dashboard in the default browser
  console.log(`Opening URL in browser: ${dashboardUrl}`);
  await open(dashboardUrl);
  
  return serverInfo;
}
