import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import serveStatic from 'serve-static';
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
      
      // Get the directory of the dashboard file
      const dashboardDir = path.dirname(dashboardPath);
      
      // Serve the dashboard directory
      app.use(serveStatic(dashboardDir));
      
      // Serve the assets directory
      const assetsDir = path.resolve(__dirname, '..', 'assets');
      app.use('/assets', serveStatic(assetsDir));
      
      // Serve the dashboard at root
      app.get('/', (req, res) => {
        res.sendFile(dashboardPath);
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
  const serverInfo = await serveDashboard(dashboardPath, port);
  
  // Open the dashboard in the default browser
  await open(serverInfo.url);
  
  return serverInfo;
}
