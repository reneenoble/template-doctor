import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Generates an HTML dashboard from the analysis results
 * @param analysisResults - The analysis results JSON object
 * @param outputPath - The directory where the dashboard should be saved
 * @returns Path to the generated dashboard HTML file
 */
export async function generateDashboard(analysisResults: any, outputPath: string): Promise<string> {
  try {
    // Get the directory name using import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Read the dashboard template
    const templatePath = path.resolve(__dirname, 'templates', 'dashboard.html');
    let dashboardTemplate = await fs.readFile(templatePath, 'utf8');

    // Generate the dashboard HTML file
    const dashboardFilename = path.basename(outputPath, '.json') + '-dashboard.html';
    const dashboardPath = path.join(path.dirname(outputPath), dashboardFilename);
    
    // Create a data.js file with the report data
    const dataJsFilename = path.basename(outputPath, '.json') + '-data.js';
    const dataJsPath = path.join(path.dirname(outputPath), dataJsFilename);
    
    // Ensure the results directory exists
    const resultsDir = path.dirname(outputPath);
    await fs.mkdir(resultsDir, { recursive: true });
    
    // Check if there's existing historical data
    const historyFilePath = path.join(resultsDir, 'history.json');
    let historyData = [];
    
    try {
      const historyExists = await fs.stat(historyFilePath).then(() => true).catch(() => false);
      if (historyExists) {
        const historyContent = await fs.readFile(historyFilePath, 'utf8');
        historyData = JSON.parse(historyContent);
      }
    } catch (err) {
      console.warn('Could not read history file, starting with empty history', err);
    }
    
    // Add current analysis to history
    const historyEntry = {
      timestamp: analysisResults.timestamp,
      percentage: analysisResults.compliance.compliant.find((item: any) => item.category === 'meta')?.details?.percentageCompliant || 0,
      issues: analysisResults.compliance.issues.length,
      passed: analysisResults.compliance.compliant.filter((item: any) => item.category !== 'meta').length
    };
    
    historyData.push(historyEntry);
    
    // Keep only the last 10 entries
    if (historyData.length > 10) {
      historyData = historyData.slice(historyData.length - 10);
    }
    
    // Write the updated history
    await fs.writeFile(historyFilePath, JSON.stringify(historyData, null, 2));
    
    // Add history to the report data
    const reportDataWithHistory = {
      ...analysisResults,
      history: historyData
    };
    
    // Write the data to a separate JavaScript file with proper JSON escaping
    // Use a simpler approach to avoid parsing errors
    await fs.writeFile(dataJsPath, `window.reportData = ${JSON.stringify(reportDataWithHistory, null, 2)};`);
    
    // Add a script tag to load the data file before the closing body tag
    dashboardTemplate = dashboardTemplate.replace('</body>', `<script src="${path.basename(dataJsFilename)}"></script></body>`);
    
    // Create the dashboard HTML file
    await fs.writeFile(dashboardPath, dashboardTemplate);

    return dashboardPath;
  } catch (err) {
    console.error('Error generating dashboard:', err);
    throw err;
  }
}
