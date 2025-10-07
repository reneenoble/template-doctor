import {
    AnalyzerOptions,
    AnalyzerConfig,
    AnalysisResult,
    AnalysisIssue,
    CompliantItem,
    GitHubFile,
    MarkdownHeading,
} from "./types";

/**
 * Parse markdown headings with their levels and check for images
 */
function parseMarkdownHeadings(markdown: string): MarkdownHeading[] {
    const headings: MarkdownHeading[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(markdown)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const nextLines = markdown.substring(match.index + match[0].length);
        const hasImage = /^\s*!\[.*?\]\(.*?\)/m.test(
            nextLines.split("\n").slice(0, 5).join("\n"),
        );
        headings.push({ level, text, hasImage });
    }

    return headings;
}

/**
 * Check README requirements (headings and architecture diagram)
 */
function checkReadmeRequirements(
    readmeContent: string,
    issues: AnalysisIssue[],
    compliant: CompliantItem[],
    config: AnalyzerConfig,
): void {
    const headings = parseMarkdownHeadings(readmeContent);

    if (config.readmeRequirements?.requiredHeadings) {
        for (const requiredHeading of config.readmeRequirements
            .requiredHeadings) {
            const headingMatch = headings.find(
                (h) =>
                    h.level === 2 &&
                    h.text.toLowerCase() === requiredHeading.toLowerCase(),
            );

            if (!headingMatch) {
                issues.push({
                    id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, "-")}`,
                    severity: "error",
                    message: `README.md is missing required h2 heading: ${requiredHeading}`,
                    error: `README.md does not contain required h2 heading: ${requiredHeading}`,
                });
            } else {
                compliant.push({
                    id: `readme-heading-${requiredHeading.toLowerCase().replace(/\s+/g, "-")}`,
                    category: "readmeHeading",
                    message: `README.md contains required h2 heading: ${requiredHeading}`,
                    details: {
                        heading: requiredHeading,
                        level: headingMatch.level,
                    },
                });
            }
        }
    }

    if (config.readmeRequirements?.architectureDiagram) {
        const { heading, requiresImage } =
            config.readmeRequirements.architectureDiagram;
        const architectureHeading = headings.find(
            (h) =>
                h.level === 2 && h.text.toLowerCase() === heading.toLowerCase(),
        );

        if (!architectureHeading) {
            issues.push({
                id: "readme-missing-architecture-diagram-heading",
                severity: "error",
                message: `README.md is missing required h2 heading: ${heading}`,
                error: `README.md does not contain required h2 heading: ${heading}`,
            });
        } else {
            compliant.push({
                id: "readme-architecture-diagram-heading",
                category: "readmeHeading",
                message: `README.md contains required h2 heading: ${heading}`,
                details: { heading, level: architectureHeading.level },
            });

            if (requiresImage && !architectureHeading.hasImage) {
                issues.push({
                    id: "readme-missing-architecture-diagram-image",
                    severity: "error",
                    message:
                        "Architecture Diagram section does not contain an image",
                    error: "README.md has Architecture Diagram heading but is missing an image",
                });
            } else if (requiresImage && architectureHeading.hasImage) {
                compliant.push({
                    id: "readme-architecture-diagram-image",
                    category: "readmeImage",
                    message: "Architecture Diagram section contains an image",
                    details: { heading },
                });
            }
        }
    }
}

/**
 * Check for Managed Identity in Bicep content
 */
function checkForManagedIdentity(content: string): boolean {
    const patterns = [
        /identity:\s*{\s*type:\s*['"]SystemAssigned['"]/i,
        /identity:\s*{\s*type:\s*['"]UserAssigned['"]/i,
        /'Microsoft\.ManagedIdentity\/userAssignedIdentities'/i,
    ];
    return patterns.some((p) => p.test(content));
}

/**
 * Detect insecure authentication methods in Bicep
 */
function detectAuthenticationMethods(content: string): string[] {
    const methods: string[] = [];
    const patterns = [
        {
            name: "Connection String",
            regex: /connectionString|ConnectionString/g,
        },
        {
            name: "Access Key",
            regex: /accessKey|AccessKey|accountKey|AccountKey/g,
        },
        {
            name: "SAS Token",
            regex: /sasToken|SasToken|sharedAccessSignature/g,
        },
        { name: "Storage Account Key", regex: /storageAccountKey|listKeys\(/g },
    ];

    for (const { name, regex } of patterns) {
        if (regex.test(content)) {
            methods.push(name);
        }
    }

    return methods;
}

/**
 * Analyze authentication in Bicep file
 */
function analyzeAuthenticationMethods(
    content: string,
    file: string,
    issues: AnalysisIssue[],
    compliant: CompliantItem[],
    config: AnalyzerConfig,
): void {
    const securityChecks = config.bicepChecks?.securityBestPractices;
    if (!securityChecks) return;

    const hasManagedIdentity = checkForManagedIdentity(content);
    const authMethods = detectAuthenticationMethods(content);

    if (hasManagedIdentity) {
        compliant.push({
            id: `bicep-managed-identity-${file}`,
            category: "security",
            message: `${file} uses Managed Identity for authentication`,
            details: { file },
        });
    }

    if (authMethods.length > 0 && !hasManagedIdentity) {
        issues.push({
            id: `bicep-insecure-auth-${file}`,
            severity: "warning",
            message: `${file} may use insecure authentication: ${authMethods.join(", ")}`,
            error: "Consider using Managed Identity instead of connection strings or access keys",
            details: { file, methods: authMethods },
        });
    }
}

/**
 * Main analyzer function - performs full DoD validation
 * @param repoUrl The URL of the GitHub repository
 * @param files Array of GitHub file objects with contents
 * @param options Analyzer options
 * @returns Analysis result with issues and compliant items
 */
export async function runAnalyzer(
    repoUrl: string,
    files: GitHubFile[],
    options: AnalyzerOptions = {},
): Promise<AnalysisResult> {
    console.log(`[analyzer-core] Analyzing repo: ${repoUrl}`);
    console.log(`[analyzer-core] Options: ${JSON.stringify(options)}`);
    console.log(`[analyzer-core] Analyzing ${files.length} files`);

    // Default DoD configuration
    const config: AnalyzerConfig = options.config || {
        requiredFiles: ["README.md", "azure.yaml", "LICENSE"],
        requiredFolders: ["infra", ".github"],
        requiredWorkflowFiles: [
            {
                pattern: /\.github\/workflows\/azure-dev\.yml/i,
                message: "Missing required GitHub workflow: azure-dev.yml",
            },
        ],
        readmeRequirements: {
            requiredHeadings: ["Prerequisites", "Getting Started"],
            architectureDiagram: {
                heading: "Architecture",
                requiresImage: true,
            },
        },
        bicepChecks: {
            requiredResources: [],
            securityBestPractices: true,
        },
        azureYamlRules: {
            mustDefineServices: true,
        },
    };

    const issues: AnalysisIssue[] = [];
    const compliant: CompliantItem[] = [];

    // Check for README.md
    const readmeFile = files.find(
        (f) => f.path && f.path.toLowerCase() === "readme.md",
    );
    if (readmeFile) {
        compliant.push({
            id: "has-readme",
            category: "documentation",
            message: "Repository has a README.md file",
            details: { fileName: "README.md" },
        });

        // Check README content for headings if available
        if (readmeFile.content) {
            const readmeContent = Buffer.from(
                readmeFile.content,
                "base64",
            ).toString("utf-8");
            checkReadmeRequirements(readmeContent, issues, compliant, config);
        }
    } else {
        issues.push({
            id: "missing-readme",
            severity: "error",
            category: "documentation",
            message: "Repository is missing a README.md file",
            error: "File README.md not found in repository",
        });
    }

    // Check for LICENSE file
    const licenseFile = files.find(
        (f) =>
            f.path &&
            (f.path.toLowerCase() === "license" ||
                f.path.toLowerCase() === "license.md"),
    );
    if (licenseFile) {
        compliant.push({
            id: "has-license",
            category: "documentation",
            message: "Repository has a LICENSE file",
            details: { fileName: "LICENSE" },
        });
    } else {
        issues.push({
            id: "missing-license",
            severity: "warning",
            category: "documentation",
            message: "Repository is missing a LICENSE file",
            error: "No LICENSE file found in repository",
        });
    }

    // Check for azure.yaml
    const azureYaml = files.find(
        (f) =>
            f.path &&
            (f.path.toLowerCase() === "azure.yaml" ||
                f.path.toLowerCase() === "azure.yml"),
    );
    if (azureYaml) {
        compliant.push({
            id: "has-azure-yaml",
            category: "azd",
            message: "Repository has azure.yaml file",
            details: { fileName: azureYaml.path },
        });

        // Check azure.yaml content for services section if available
        if (azureYaml.content && config.azureYamlRules?.mustDefineServices) {
            const azureYamlContent = Buffer.from(
                azureYaml.content,
                "base64",
            ).toString("utf-8");
            if (!/services\s*:/i.test(azureYamlContent)) {
                issues.push({
                    id: "azure-yaml-missing-services",
                    severity: "error",
                    message: `No "services:" defined in ${azureYaml.path}`,
                    error: `File ${azureYaml.path} does not define required "services:" section`,
                });
            } else {
                compliant.push({
                    id: "azure-yaml-services-defined",
                    category: "azureYaml",
                    message: `"services:" section found in ${azureYaml.path}`,
                    details: { fileName: azureYaml.path },
                });
            }
        }
    } else {
        issues.push({
            id: "missing-azure-yaml",
            severity: "error",
            category: "azd",
            message: "Missing azure.yaml or azure.yml file",
            error: "No azure.yaml file found - required for Azure Developer CLI",
        });
    }

    // Check for required workflow files
    if (config.requiredWorkflowFiles) {
        const normalized = files.map((f) => f.path?.toLowerCase() || "");
        for (const workflowFile of config.requiredWorkflowFiles) {
            const matchingFile = normalized.find((file) =>
                workflowFile.pattern.test(file),
            );
            if (!matchingFile) {
                issues.push({
                    id: `missing-workflow-${workflowFile.pattern.source}`,
                    severity: "error",
                    message: workflowFile.message,
                    error: workflowFile.message,
                });
            } else {
                compliant.push({
                    id: `workflow-${matchingFile}`,
                    category: "requiredWorkflow",
                    message: `Required workflow file found: ${matchingFile}`,
                    details: {
                        fileName: matchingFile,
                        patternMatched: workflowFile.pattern.source,
                    },
                });
            }
        }
    }

    // Check for .github folder
    const hasGithub = files.some(
        (f) => f.path && f.path.toLowerCase().startsWith(".github/"),
    );
    if (hasGithub) {
        compliant.push({
            id: "has-github-folder",
            category: "infrastructure",
            message: "Required folder found: .github/",
            details: { folderPath: ".github" },
        });
    } else {
        issues.push({
            id: "missing-github-folder",
            severity: "error",
            category: "infrastructure",
            message: "Missing required folder: .github/",
            error: "No .github/ folder found",
        });
    }

    // Check for infra folder
    const hasInfra = files.some(
        (f) => f.path && f.path.toLowerCase().startsWith("infra/"),
    );
    if (hasInfra) {
        const infraFiles = files.filter(
            (f) => f.path && f.path.toLowerCase().startsWith("infra/"),
        );
        compliant.push({
            id: "has-infra",
            category: "infrastructure",
            message: `Infrastructure folder found with ${infraFiles.length} files`,
            details: { folderPath: "infra", fileCount: infraFiles.length },
        });

        // Check Bicep files
        const bicepFiles = infraFiles.filter(
            (f) => f.path && f.path.endsWith(".bicep"),
        );
        if (bicepFiles.length === 0) {
            issues.push({
                id: "missing-bicep",
                severity: "error",
                message: "No Bicep files found in infra/",
                error: "No Bicep files found in the infra/ directory",
            });
        } else {
            compliant.push({
                id: "bicep-files-exist",
                category: "bicepFiles",
                message: `Bicep files found in infra/ directory: ${bicepFiles.length} files`,
                details: {
                    count: bicepFiles.length,
                    files: bicepFiles.map((f) => f.path),
                },
            });

            // Analyze each Bicep file for security if content available
            for (const file of bicepFiles) {
                if (file.content) {
                    const content = Buffer.from(
                        file.content,
                        "base64",
                    ).toString("utf-8");
                    analyzeAuthenticationMethods(
                        content,
                        file.path,
                        issues,
                        compliant,
                        config,
                    );
                }
            }
        }
    } else {
        issues.push({
            id: "missing-infra",
            severity: "error",
            category: "infrastructure",
            message: "Missing required folder: infra/",
            error: "No infra/ folder found",
        });
    }

    // Calculate compliance percentage
    const totalChecks = issues.length + compliant.length;
    const percentageCompliant =
        totalChecks > 0
            ? Math.round((compliant.length / totalChecks) * 100)
            : 0;

    compliant.push({
        id: "compliance-summary",
        category: "meta",
        message: `Compliance: ${percentageCompliant}%`,
        details: {
            issueCount: issues.length,
            compliantCount: compliant.length,
            totalChecks,
            percentageCompliant,
        },
    });

    const summary =
        issues.length === 0
            ? "No issues found 🎉"
            : `Issues found - Compliance: ${percentageCompliant}%`;

    // Build categories object by grouping issues/compliant by category field
    const categories: Record<
        string,
        {
            enabled: boolean;
            issues: AnalysisIssue[];
            compliant: CompliantItem[];
            percentage: number;
        }
    > = {};

    // Define category mapping with enabled status
    const categoryKeys = [
        "repositoryManagement",
        "functionalRequirements",
        "deployment",
        "security",
        "testing",
        "agents",
    ];

    // Initialize categories
    for (const key of categoryKeys) {
        categories[key] = {
            enabled: true,
            issues: [],
            compliant: [],
            percentage: 0,
        };
    }

    // Group issues by category (map common patterns to standard category keys)
    const categoryMap: Record<string, string> = {
        file: "repositoryManagement",
        folder: "repositoryManagement",
        missing: "repositoryManagement",
        required: "repositoryManagement",
        readme: "functionalRequirements",
        documentation: "functionalRequirements",
        workflow: "deployment",
        infra: "deployment",
        infrastructure: "deployment",
        azure: "deployment",
        bicep: "deployment",
        bicepFiles: "deployment",
        security: "security",
        auth: "security",
        authentication: "security",
        testing: "testing",
        test: "testing",
        agents: "agents",
        meta: "meta", // Don't include meta in category tiles
    };

    // Distribute issues to categories
    for (const issue of issues) {
        const cat = issue.category || "general";
        const mappedCat = categoryMap[cat] || "repositoryManagement";
        if (categories[mappedCat]) {
            categories[mappedCat].issues.push(issue);
        }
    }

    // Distribute compliant items to categories
    for (const item of compliant) {
        const cat = item.category || "general";
        const mappedCat = categoryMap[cat] || "repositoryManagement";
        if (mappedCat !== "meta" && categories[mappedCat]) {
            categories[mappedCat].compliant.push(item);
        }
    }

    // Calculate percentage for each category
    for (const key of Object.keys(categories)) {
        const cat = categories[key];
        const total = cat.issues.length + cat.compliant.length;
        cat.percentage =
            total > 0 ? Math.round((cat.compliant.length / total) * 100) : 0;
    }

    // Return in the format expected by the frontend
    return {
        repoUrl,
        ruleSet: options.ruleSet || "dod",
        timestamp: new Date().toISOString(),
        compliance: {
            issues,
            compliant,
            percentage: percentageCompliant,
            summary,
            categories,
        },
    };
}
