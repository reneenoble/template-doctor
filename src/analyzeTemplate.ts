import { listRepoFiles, fetchFileContent, getDefaultBranch } from "./githubClient.js";
import config from "./config/dod-rules.js";
import { TemplateConfig } from "./config/config-types.js";
import path from "path";

type Issue = { id: string; severity: "error" | "warning"; message: string, error?: string };
type ReadmeHeading = { level: number; text: string; hasImage?: boolean };

export async function analyzeTemplate(repoUrl: string): Promise<{
  repoUrl: string;
  timestamp: string;
  compliance: {
    issues: Issue[];
    summary: string;
  };
}> {
  const repoFullName = extractRepoFullName(repoUrl);
  const defaultBranch = await getDefaultBranch(repoFullName);
  const files = await listRepoFiles(repoFullName, defaultBranch);
  const issues: Issue[] = [];

  const normalized = files.map((f) => f.toLowerCase());

  for (const file of config.requiredFiles) {
    if (!normalized.includes(file.toLowerCase())) {
      issues.push({
        id: `missing-${file}`,
        severity: "error",
        message: `Missing required file: ${file}`,
        error: `File ${file} not found in repository`,
      });
    }
  }

  // Check for required workflow files using patterns
  if (config.requiredWorkflowFiles) {
    for (const workflowFile of config.requiredWorkflowFiles) {
      if (!normalized.some(file => workflowFile.pattern.test(file))) {
        issues.push({
          id: `missing-workflow-${workflowFile.pattern.source}`,
          severity: "error",
          message: workflowFile.message,
          error: workflowFile.message
        });
      }
    }
  }

  // Check for required documentation files that can exist in multiple locations
  if (config.requiredDocFiles) {
    for (const docFile of config.requiredDocFiles) {
      if (!normalized.some(file => docFile.patterns.some(pattern => pattern.test(file)))) {
        issues.push({
          id: `missing-doc-${docFile.patterns[0].source}`,
          severity: "error",
          message: docFile.message,
          error: docFile.message
        });
      }
    }
  }

  for (const folder of config.requiredFolders) {
    if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + "/"))) {
      issues.push({
        id: `missing-folder-${folder}`,
        severity: "error",
        message: `Missing required folder: ${folder}/`,
        error: `Folder ${folder} not found in repository`
      });
    }
  }

  // Check README.md content for required headings and architecture diagram
  if (config.readmeRequirements && normalized.some(f => f === "readme.md")) {
    try {
      const readmeContent = await fetchFileContent(repoFullName, "README.md", defaultBranch);
      await checkReadmeRequirements(readmeContent, issues);
    } catch (err) {
      issues.push({
        id: "readme-read-error",
        severity: "warning",
        message: "Could not read README.md",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const deprecatedModels = config.openai?.deprecatedModels ?? [];

  const bicepFiles = files.filter((f) => f.startsWith("infra/") && f.endsWith(".bicep"));
  if (bicepFiles.length === 0) {
    issues.push({
      id: "missing-bicep",
      severity: "error",
      message: "No Bicep files found in infra/",
      error: "No Bicep files found in the infra/ directory"
    });
  } else {
    for (const file of bicepFiles) {
      try {
        const content = await fetchFileContent(repoFullName, file, defaultBranch);

        for (const resource of config.bicepChecks.requiredResources) {
          if (!content.includes(resource)) {
            issues.push({
              id: `bicep-missing-${resource.toLowerCase()}`,
              severity: "error",
              message: `Missing resource "${resource}" in ${file}`,
              error: `File ${file} does not contain required resource ${resource}`
            });
          }
        }

        for (const model of deprecatedModels) {
          const modelRegex = new RegExp(`["']?${model}["']?`, "i");
          if (modelRegex.test(content)) {
            issues.push({
              id: `bicep-deprecated-model-${model}`,
              severity: "error",
              message: `Deprecated OpenAI model "${model}" used in ${file}`,
              error: `File ${file} contains deprecated model ${model}`
            });
          }
        }
      } catch(err) {
        console.error(`Failed to read Bicep file: ${file}`);
        console.error(`Error: ${err instanceof Error ? err.message : err}  `);
        issues.push({
          id: `error-reading-${file}`,
          severity: "warning",
          message: `Failed to read ${file}`,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  const azureYamlPath = files.find(f => f === "azure.yaml" || f === "azure.yml");
  if (azureYamlPath) {
    try {
      const azureYamlContent = await fetchFileContent(repoFullName, azureYamlPath, defaultBranch);
      if (config.azureYamlRules?.mustDefineServices && !/services\s*:/i.test(azureYamlContent)) {
        issues.push({
          id: "azure-yaml-missing-services",
          severity: "error",
          message: `No "services:" defined in ${azureYamlPath}`,
          error: `File ${azureYamlPath} does not define required "services:" section`
        });
      }
    } catch {
      issues.push({
        id: "azure-yaml-read-error",
        severity: "warning",
        message: `Could not read ${azureYamlPath}`,
        error: `Failed to read file ${azureYamlPath}`
      });
    }
  } else {
    issues.push({
      id: "missing-azure-yaml",
      severity: "error",
      message: "Missing azure.yaml or azure.yml file",
      error: "No azure.yaml or azure.yml file found in repository"
    });
  }

  const summary = issues.length === 0 ? "No issues found 🎉" : "Issues found";

  const result = {
    repoUrl,
    timestamp: new Date().toISOString(),
    compliance: {
      issues,
      summary
    }
  };

  return result;
}

function extractRepoFullName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)(\.git)?/);
  if (!match) throw new Error("Invalid GitHub URL");
  return match[1];
}

/**
 * Parses markdown content and extracts headings with their levels
 * @param markdown Markdown content
 * @returns Array of headings with their levels and texts
 */
function parseMarkdownHeadings(markdown: string): ReadmeHeading[] {
  const headings: ReadmeHeading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    
    // Check if there's an image immediately after this heading
    const nextLines = markdown.substring(match.index + match[0].length);
    const hasImage = /^\s*!\[.*?\]\(.*?\)/m.test(nextLines.split('\n').slice(0, 5).join('\n'));
    
    headings.push({
      level,
      text,
      hasImage
    });
  }
  
  return headings;
}

/**
 * Checks README.md content for required headings and architecture diagram
 * @param readmeContent README.md content
 * @param issues Array to add issues to
 */
async function checkReadmeRequirements(readmeContent: string, issues: Issue[]): Promise<void> {
  const headings = parseMarkdownHeadings(readmeContent);
  
  // Check for required headings (h2)
  if (config.readmeRequirements?.requiredHeadings) {
    for (const requiredHeading of config.readmeRequirements.requiredHeadings) {
      if (!headings.some(h => h.level === 2 && h.text.toLowerCase() === requiredHeading.toLowerCase())) {
        issues.push({
          id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
          severity: "error",
          message: `README.md is missing required h2 heading: ${requiredHeading}`,
          error: `README.md does not contain required h2 heading: ${requiredHeading}`
        });
      }
    }
  }
  
  // Check for architecture diagram heading and image
  if (config.readmeRequirements?.architectureDiagram) {
    const { heading, requiresImage } = config.readmeRequirements.architectureDiagram;
    const architectureHeading = headings.find(h => 
      h.level === 2 && h.text.toLowerCase() === heading.toLowerCase()
    );
    
    if (!architectureHeading) {
      issues.push({
        id: 'readme-missing-architecture-diagram-heading',
        severity: "error",
        message: `README.md is missing required h2 heading: ${heading}`,
        error: `README.md does not contain required h2 heading: ${heading}`
      });
    } else if (requiresImage && !architectureHeading.hasImage) {
      issues.push({
        id: 'readme-missing-architecture-diagram-image',
        severity: "error",
        message: `Architecture Diagram section does not contain an image`,
        error: `README.md has Architecture Diagram heading but is missing an image`
      });
    }
  }
}
