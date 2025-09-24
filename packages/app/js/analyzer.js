// Template Analyzer - Core logic from analyzeTemplate.ts adapted for browser
//
// Security Best Practices:
// The analyzer now includes enhanced security checks for Azure Bicep files:
// 1. Detection of Managed Identity usage - Identifies when Managed Identity is correctly used
// 2. Detection of insecure authentication methods - Identifies connection strings, access keys, SAS tokens, etc.
// 3. Detection of resources with potentially anonymous access - Identifies Azure resources that should have auth
//
// These checks can be enabled/disabled in the configuration files using the securityBestPractices settings
// in the bicepChecks section. See the config files for examples.

class TemplateAnalyzer {
  constructor() {
    this.githubClient = window.GitHubClient;
    this.ruleSetConfigs = {
      dod: {}, // Will be loaded when needed
      partner: {},
      docs: [],
      custom: {},
    };

    // Load rule set configurations
    this.loadRuleSetConfigs();
  }

  /**
   * Load rule set configurations from static JSON files
   */
  async loadRuleSetConfigs() {
    try {
      // Load DoD (default) config
      const dodResponse = await fetch('./configs/dod-config.json');
      if (!dodResponse.ok) {
        throw new Error(`Failed to load DoD config: ${dodResponse.status}`);
      }
      this.ruleSetConfigs.dod = await dodResponse.json();

      // Convert pattern strings to RegExp objects for workflow files
      if (this.ruleSetConfigs.dod.requiredWorkflowFiles) {
        this.ruleSetConfigs.dod.requiredWorkflowFiles =
          this.ruleSetConfigs.dod.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      // Load Partner config
      const partnerResponse = await fetch('./configs/partner-config.json');
      if (!partnerResponse.ok) {
        throw new Error(`Failed to load Partner config: ${partnerResponse.status}`);
      }
      this.ruleSetConfigs.partner = await partnerResponse.json();

      // Convert pattern strings to RegExp objects for workflow files
      if (this.ruleSetConfigs.partner.requiredWorkflowFiles) {
        this.ruleSetConfigs.partner.requiredWorkflowFiles =
          this.ruleSetConfigs.partner.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      // Load Docs config
      this.ruleSetConfigs.docs = await TemplateAnalyzerDocs.prototype.getConfig();

      // Load Custom config - this will be overridden if the user provides a custom config
      const customResponse = await fetch('./configs/custom-config.json');
      if (!customResponse.ok) {
        throw new Error(`Failed to load Custom config: ${customResponse.status}`);
      }
      this.ruleSetConfigs.custom = await customResponse.json();

      // Convert pattern strings to RegExp objects for workflow files (if any)
      if (this.ruleSetConfigs.custom.requiredWorkflowFiles) {
        this.ruleSetConfigs.custom.requiredWorkflowFiles =
          this.ruleSetConfigs.custom.requiredWorkflowFiles.map((item) => ({
            pattern: new RegExp(item.pattern, 'i'),
            message: item.message,
          }));
      }

      console.log('Rule set configurations loaded');
    } catch (error) {
      console.error('Failed to load rule set configurations:', error);

      // Fallback to hardcoded configs if loading fails
      this.ruleSetConfigs.dod = {
        requiredFiles: ['README.md', 'azure.yaml', 'LICENSE'],
        requiredFolders: ['infra', '.github'],
        requiredWorkflowFiles: [
          {
            pattern: /\.github\/workflows\/azure-dev\.yml/i,
            message: 'Missing required GitHub workflow: azure-dev.yml',
          },
        ],
        readmeRequirements: {
          requiredHeadings: ['Prerequisites', 'Getting Started'],
          architectureDiagram: {
            heading: 'Architecture',
            requiresImage: true,
          },
        },
      };

      this.ruleSetConfigs.partner = {
        ...this.ruleSetConfigs.dod,
        requiredFiles: ['README.md', 'azure.yaml'],
      };

      this.ruleSetConfigs.custom = {
        requiredFiles: ['README.md', 'azure.yaml'],
        requiredFolders: ['infra'],
      };
    }
  }

  /**
   * Get the appropriate configuration based on the selected rule set
   * @param {string} ruleSet - The rule set to use: "dod", "partner", "docs",or "custom"
   * @returns {Object} - The configuration for the selected rule set
   */
  getConfig(ruleSet = 'dod') {
    if (!ruleSet || ruleSet === 'dod') {
      const cfg = window.TemplateDoctorConfig || {};
      if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
        ruleSet = cfg.defaultRuleSet;
      }
    }
    switch (ruleSet) {
      case 'partner':
        return this.ruleSetConfigs.partner;
      case 'custom':
        return this.ruleSetConfigs.custom;
      case 'docs':
        return this.ruleSetConfigs.docs;
      case 'dod':
      default:
        return this.ruleSetConfigs.dod;
    }
  }

  /**
   * Extract owner and repo from a GitHub URL
   * @param {string} url - GitHub repository URL
   * @returns {Object} - Object with owner and repo properties
   */
  extractRepoInfo(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?/);
    if (!match) throw new Error('Invalid GitHub URL');
    return {
      owner: match[1],
      repo: match[2],
      fullName: `${match[1]}/${match[2]}`,
    };
  }

  /**
   * Parse markdown content and extract headings with their levels
   * @param {string} markdown - Markdown content
   * @returns {Array} - Array of headings with their levels and texts
   */
  parseMarkdownHeadings(markdown) {
    const headings = [];
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
        hasImage,
      });
    }

    return headings;
  }

  /**
   * Checks README.md content for required headings and architecture diagram
   * @param {string} readmeContent - README.md content
   * @param {Array} issues - Array to add issues to
   * @param {Array} compliant - Array to add compliant items to
   * @param {Object} config - The configuration to use for the analysis
   */
  checkReadmeRequirements(readmeContent, issues, compliant, config) {
    const headings = this.parseMarkdownHeadings(readmeContent);

    // Check for required headings (h2)
    if (config.readmeRequirements?.requiredHeadings) {
      for (const requiredHeading of config.readmeRequirements.requiredHeadings) {
        const headingMatch = headings.find(
          (h) => h.level === 2 && h.text.toLowerCase() === requiredHeading.toLowerCase(),
        );
        if (!headingMatch) {
          issues.push({
            id: `readme-missing-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
            severity: 'error',
            message: `README.md is missing required h2 heading: ${requiredHeading}`,
            error: `README.md does not contain required h2 heading: ${requiredHeading}`,
          });
        } else {
          compliant.push({
            id: `readme-heading-${requiredHeading.toLowerCase().replace(/\s+/g, '-')}`,
            category: 'readmeHeading',
            message: `README.md contains required h2 heading: ${requiredHeading}`,
            details: {
              heading: requiredHeading,
              level: headingMatch.level,
            },
          });
        }
      }
    }

    // Check for architecture diagram heading and image
    if (config.readmeRequirements?.architectureDiagram) {
      const { heading, requiresImage } = config.readmeRequirements.architectureDiagram;
      const architectureHeading = headings.find(
        (h) => h.level === 2 && h.text.toLowerCase() === heading.toLowerCase(),
      );

      if (!architectureHeading) {
        issues.push({
          id: 'readme-missing-architecture-diagram-heading',
          severity: 'error',
          message: `README.md is missing required h2 heading: ${heading}`,
          error: `README.md does not contain required h2 heading: ${heading}`,
        });
      } else {
        compliant.push({
          id: 'readme-architecture-diagram-heading',
          category: 'readmeHeading',
          message: `README.md contains required h2 heading: ${heading}`,
          details: {
            heading: heading,
            level: architectureHeading.level,
          },
        });

        if (requiresImage && !architectureHeading.hasImage) {
          issues.push({
            id: 'readme-missing-architecture-diagram-image',
            severity: 'error',
            message: `Architecture Diagram section does not contain an image`,
            error: `README.md has Architecture Diagram heading but is missing an image`,
          });
        } else if (requiresImage && architectureHeading.hasImage) {
          compliant.push({
            id: 'readme-architecture-diagram-image',
            category: 'readmeImage',
            message: `Architecture Diagram section contains an image`,
            details: {
              heading: heading,
            },
          });
        }
      }
    }
  }

  /**
   * Analyze a GitHub repository against a rule set
   * @param {string} repoUrl - The GitHub repository URL
   * @param {string} ruleSet - The rule set to use: "dod", "partner", "docs", or "custom"
   * @returns {Promise<Object>} - The analysis result
   */
  async analyzeTemplate(repoUrl, ruleSet = 'dod', selectedCategories = null) {
    if (!ruleSet || ruleSet === 'dod') {
      const cfg = window.TemplateDoctorConfig || {};
      if (cfg.defaultRuleSet && typeof cfg.defaultRuleSet === 'string') {
        ruleSet = cfg.defaultRuleSet;
      }
    }
  // Get the appropriate configuration based on the rule set
    const config = this.getConfig(ruleSet);
    const repoInfo = this.extractRepoInfo(repoUrl);

    // Store custom config details if using custom ruleset
    let customConfig = null;
    if (ruleSet === 'custom') {
      try {
        const savedConfig = localStorage.getItem('td_custom_ruleset');
        if (savedConfig) {
          customConfig = JSON.parse(savedConfig);
        }
      } catch (e) {
        console.error('Error loading custom configuration:', e);
      }
    }

    // UI feedback - this is usually handled by the caller
    console.log(`Analyzing repository ${repoInfo.fullName} with rule set: ${ruleSet}`);

    try {
      // Determine if we should force fork flow: presence of fork=1 flag OR owner mismatch.
      const urlHasForkFlag = /[?&]fork=1\b/.test(repoUrl);
      const currentUsername = this.githubClient.getCurrentUsername
        ? this.githubClient.getCurrentUsername()
        : this.githubClient.auth?.getUsername();
      const ownerMismatch = currentUsername && repoInfo.owner && repoInfo.owner.toLowerCase() !== currentUsername.toLowerCase();

      // Acquire accessible repo meta without triggering upstream GET for org repos.
      const { repo: accessibleRepoMeta } = await this.githubClient.ensureAccessibleRepo(
        repoInfo.owner,
        repoInfo.repo,
        { forceFork: urlHasForkFlag || ownerMismatch }
      );

      // Use accessible (fork or self) namespace for all further content operations.
      const analysisOwner = accessibleRepoMeta.owner?.login || repoInfo.owner;
      const analysisRepo = accessibleRepoMeta.name || repoInfo.repo;

      // Always prefer scanning 'main' branch to standardize results. If missing, fallback to repo default.
      let defaultBranch = 'main';
      let files;
      const listAllWithRetry = async (ref) => {
        try {
          return await this.githubClient.listAllFiles(analysisOwner, analysisRepo, ref);
        } catch (err) {
          // One retry after short delay (fork may still be indexing)
          await new Promise((r) => setTimeout(r, 1200));
            return await this.githubClient.listAllFiles(analysisOwner, analysisRepo, ref);
        }
      };
      try {
        files = await listAllWithRetry('main');
      } catch (e) {
        // Fallback to fork/self default branch metadata if 'main' not present.
        defaultBranch = this.githubClient.getDefaultBranchFromMeta(accessibleRepoMeta);
        if (defaultBranch !== 'main') {
          try {
            files = await listAllWithRetry(defaultBranch);
          } catch (inner) {
            throw inner; // propagate actual failure
          }
        } else {
          throw e; // 'main' expected but retrieval failed; rethrow
        }
      }

      // Start analyzing
      const issues = [];
      const compliant = [];

      // Determine category enablement
  const enabled = normalizeCategorySelection(ruleSet, selectedCategories);
  const cfgGlobal = window.TemplateDoctorConfig || {};
  const azdGloballyEnabled = cfgGlobal.azureDeveloperCliEnabled !== false;

      // Prepare categorized containers
      const categories = {
        repositoryManagement: { enabled: enabled.repositoryManagement, issues: [], compliant: [], summary: '', percentage: 0 },
        functionalRequirements: { enabled: enabled.functionalRequirements, issues: [], compliant: [], summary: '', percentage: 0 },
        deployment: { enabled: enabled.deployment, issues: [], compliant: [], summary: '', percentage: 0 },
        security: { enabled: enabled.security, issues: [], compliant: [], summary: '', percentage: 0 },
        testing: { enabled: enabled.testing, issues: [], compliant: [], summary: '', percentage: 0 },
        ai: { enabled: azdGloballyEnabled, issues: [], compliant: [], summary: '', percentage: 0 },
      };
      
      // Check repository metadata (description and topics)
      if (enabled.repositoryManagement) {
        try {
          // Reuse already-fetched accessible repo metadata; do not re-fetch upstream org.
          const repoMetadata = accessibleRepoMeta;
          
          // Check for repository description
          if (!repoMetadata.description || repoMetadata.description.trim() === '') {
            categories.repositoryManagement.issues.push({
              id: 'missing-repo-description',
              severity: 'error',
              message: 'Repository description is missing',
              error: 'The repository should have a clear description explaining the purpose and technologies used'
            });
          } else {
            categories.repositoryManagement.compliant.push({
              id: 'repo-description',
              category: 'repositoryMetadata',
              message: 'Repository has a description',
              details: {
                description: repoMetadata.description
              }
            });
          }
          
          // Check for required topics
          if (config.repositoryTopics && Array.isArray(config.repositoryTopics)) {
            const repoTopics = repoMetadata.topics || [];
            
            const missingTopics = config.repositoryTopics.filter(topic => 
              !repoTopics.some(repoTopic => repoTopic.toLowerCase() === topic.toLowerCase())
            );
            
            if (missingTopics.length > 0) {
              categories.repositoryManagement.issues.push({
                id: 'missing-repo-topics',
                severity: 'error',
                message: `Missing required topics: ${missingTopics.join(', ')}`,
                error: `Repository should include the following topics: ${config.repositoryTopics.join(', ')}`
              });
            } else {
              categories.repositoryManagement.compliant.push({
                id: 'repo-topics',
                category: 'repositoryMetadata',
                message: 'Repository has all required topics',
                details: {
                  requiredTopics: config.repositoryTopics,
                  allTopics: repoTopics
                }
              });
            }
          }
        } catch (err) {
          console.error('Failed to check repository metadata:', err);
          categories.repositoryManagement.issues.push({
            id: 'repo-metadata-error',
            severity: 'warning',
            message: 'Could not verify repository metadata (description and topics)',
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Run repository-level configuration validations early (docs-config rules)
      // Only run docs-specific repo validations when the docs ruleset is selected
      if (ruleSet === 'docs') {
        // Use the docs ruleset analyzer implementation (defined in ruleset-docs/analyzer.js)
        // Signature: validateDocConfiguration(config, repoInfo, defaultBranch, files, issues, compliant)
        // Diagnostics: track invocations for self-testing
        try {
          window.__TemplateDoctorDocsValidationHits = (window.__TemplateDoctorDocsValidationHits || 0) + 1;
          window.__TemplateDoctorLastDocsValidation = {
            ts: Date.now(),
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            defaultBranch,
          };
          console.log('[TemplateAnalyzer][docs] Running docs repository configuration validations', window.__TemplateDoctorLastDocsValidation);
          document.dispatchEvent(
            new CustomEvent('template-doctor-docs-validation', {
              detail: window.__TemplateDoctorLastDocsValidation,
            }),
          );
        } catch (e) {
          // Non-fatal
          console.warn('[TemplateAnalyzer][docs] diagnostics tracking failed', e);
        }
        await TemplateAnalyzerDocs.prototype.validateDocConfiguration(
          config,
          repoInfo,
          defaultBranch,
          files,
          categories.repositoryManagement.issues,
          categories.repositoryManagement.compliant,
        );
      }

      // Normalize file paths for case-insensitive comparison
      const normalized = files.map((f) => f.toLowerCase());

      // Check for required files
      if (enabled.repositoryManagement) {
        for (const file of config.requiredFiles) {
        if (!normalized.includes(file.toLowerCase())) {
          categories.repositoryManagement.issues.push({
            id: `missing-${file}`,
            severity: 'error',
            message: `Missing required file: ${file}`,
            error: `File ${file} not found in repository`,
          });
        } else {
          categories.repositoryManagement.compliant.push({
            id: `file-${file}`,
            category: 'requiredFile',
            message: `Required file found: ${file}`,
            details: {
              fileName: file,
            },
          });
        }
        }
      }

      // Check for required workflow files using patterns
      if (enabled.repositoryManagement && config.requiredWorkflowFiles) {
        for (const workflowFile of config.requiredWorkflowFiles) {
          const matchingFile = normalized.find((file) => workflowFile.pattern.test(file));
          if (!matchingFile) {
            categories.repositoryManagement.issues.push({
              id: `missing-workflow-${workflowFile.pattern.source}`,
              severity: 'error',
              message: workflowFile.message,
              error: workflowFile.message,
            });
          } else {
            categories.repositoryManagement.compliant.push({
              id: `workflow-${matchingFile}`,
              category: 'requiredWorkflow',
              message: `Required workflow file found: ${matchingFile}`,
              details: {
                fileName: matchingFile,
                patternMatched: workflowFile.pattern.source,
              },
            });
          }
        }
      }

      // Check for required folders
      if (enabled.repositoryManagement) for (const folder of config.requiredFolders) {
        if (!normalized.some((f) => f.startsWith(folder.toLowerCase() + '/'))) {
          categories.repositoryManagement.issues.push({
            id: `missing-folder-${folder}`,
            severity: 'error',
            message: `Missing required folder: ${folder}/`,
            error: `Folder ${folder} not found in repository`,
          });
        } else {
          const folderFiles = normalized.filter((f) => f.startsWith(folder.toLowerCase() + '/'));
          categories.repositoryManagement.compliant.push({
            id: `folder-${folder}`,
            category: 'requiredFolder',
            message: `Required folder found: ${folder}/`,
            details: {
              folderPath: folder,
              fileCount: folderFiles.length,
            },
          });
        }
      }

      // Check for issue templates
      if (enabled.repositoryManagement) {
        // Check various patterns for issue templates
        const hasIssueTemplate = normalized.some(f => 
          f.includes('.github/issue_template/') || // directory with templates
          f === '.github/issue_template.md' || // single template file
          f === '.github/issue_template.yml' || // single YAML template file
          f === '.github/issue_template.yaml' || // single YAML template file
          f.includes('.github/ISSUE_TEMPLATE/') || // case variations
          f === '.github/ISSUE_TEMPLATE.md' ||
          f === '.github/ISSUE_TEMPLATE.yml' ||
          f === '.github/ISSUE_TEMPLATE.yaml'
        );
        
        if (!hasIssueTemplate) {
          categories.repositoryManagement.issues.push({
            id: 'missing-issue-template',
            severity: 'warning',
            message: 'Missing GitHub issue templates',
            error: 'Repository should include issue templates to standardize bug reports and feature requests'
          });
        } else {
          categories.repositoryManagement.compliant.push({
            id: 'issue-template',
            category: 'repositoryManagement',
            message: 'Repository has GitHub issue templates',
            details: {
              found: true
            }
          });
        }
      }

      // Check for Dev Container configuration
      if (enabled.repositoryManagement) {
        // Check for .devcontainer folder or devcontainer.json file
        const hasDevContainer = normalized.some(f => 
          f.startsWith('.devcontainer/') || 
          f === '.devcontainer.json'
        );
        
        if (!hasDevContainer) {
          categories.repositoryManagement.issues.push({
            id: 'missing-devcontainer',
            severity: 'warning',
            message: 'Missing Dev Container configuration',
            error: 'Repository should include a .devcontainer folder with configuration for consistent development environments'
          });
        } else {
          // Check if devcontainer installs or includes azd
          try {
            // Get devcontainer.json content
            const devContainerFile = files.find(f => 
              f.toLowerCase() === '.devcontainer/devcontainer.json' || 
              f.toLowerCase() === '.devcontainer.json'
            );
            
            if (devContainerFile) {
              const devContainerContent = await this.githubClient.getFileContent(
                repoInfo.owner,
                repoInfo.repo,
                devContainerFile
              );
              
              const hasAzdInstall = devContainerContent.includes('azd') || 
                                    devContainerContent.includes('Azure Developer CLI');
              
              if (hasAzdInstall) {
                categories.repositoryManagement.compliant.push({
                  id: 'devcontainer-azd',
                  category: 'repositoryManagement',
                  message: 'Dev Container includes Azure Developer CLI (azd)',
                  details: {
                    file: devContainerFile
                  }
                });
              } else {
                categories.repositoryManagement.issues.push({
                  id: 'devcontainer-missing-azd',
                  severity: 'warning',
                  message: 'Dev Container configuration might not include azd',
                  error: 'The .devcontainer configuration should include the Azure Developer CLI (azd) for a consistent development experience'
                });
              }
            } else {
              categories.repositoryManagement.compliant.push({
                id: 'devcontainer-exists',
                category: 'repositoryManagement',
                message: 'Dev Container configuration exists',
                details: {
                  found: true
                }
              });
            }
          } catch (err) {
            console.error('Failed to check devcontainer content:', err);
            categories.repositoryManagement.issues.push({
              id: 'devcontainer-check-error',
              severity: 'warning',
              message: 'Could not verify if Dev Container includes azd',
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }

      // Check README.md content for required headings and architecture diagram
      if (
        enabled.repositoryManagement &&
        config.readmeRequirements &&
        normalized.some((f) => f === 'readme.md')
      ) {
        try {
          const readmeContent = await this.githubClient.getFileContent(
            repoInfo.owner,
            repoInfo.repo,
            'README.md',
          );
          this.checkReadmeRequirements(
            readmeContent,
            categories.repositoryManagement.issues,
            categories.repositoryManagement.compliant,
            config,
          );
        } catch (err) {
          categories.repositoryManagement.issues.push({
            id: 'readme-read-error',
            severity: 'warning',
            message: 'Could not read README.md',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Check Bicep files
      const bicepFiles = files.filter((f) => f.startsWith('infra/') && f.endsWith('.bicep'));
      if (enabled.deployment && bicepFiles.length === 0) {
        categories.deployment.issues.push({
          id: 'missing-bicep',
          severity: 'error',
          message: 'No Bicep files found in infra/',
          error: 'No Bicep files found in the infra/ directory',
        });
      } else if (enabled.deployment) {
        categories.deployment.compliant.push({
          id: 'bicep-files-exist',
          category: 'bicepFiles',
          message: `Bicep files found in infra/ directory: ${bicepFiles.length} files`,
          details: {
            count: bicepFiles.length,
            files: bicepFiles,
          },
        });

        // Check each Bicep file for required resources
        for (const file of bicepFiles) {
          try {
            const content = await this.githubClient.getFileContent(
              repoInfo.owner,
              repoInfo.repo,
              file,
            );

            // Check for required resources
            const foundResources = [];
            const missingResources = [];

            // Only check for required resources if the array is not empty
            // This prevents requiring specific resources in all Bicep files
            if (config.bicepChecks.requiredResources && config.bicepChecks.requiredResources.length > 0) {
              for (const resource of config.bicepChecks.requiredResources) {
                if (!content.includes(resource)) {
                  categories.deployment.issues.push({
                    id: `bicep-missing-${resource.toLowerCase()}`,
                    severity: 'error',
                    message: `Missing required resource "${resource}" in ${file}`,
                    error: `File ${file} does not contain the required resource "${resource}" as specified in the configuration`,
                    recommendation: `Add the resource "${resource}" to this Bicep file or update the configuration if this resource is not required in all Bicep files.`
                  });
                  missingResources.push(resource);
                } else {
                  categories.deployment.compliant.push({
                    id: `bicep-resource-${resource.toLowerCase()}-${file}`,
                    category: 'bicepResource',
                    message: `Found required resource "${resource}" in ${file}`,
                    details: {
                      resource: resource,
                      file: file,
                    },
                  });
                  foundResources.push(resource);
                }
              }
            }

            // Check for authentication methods and recommend Managed Identity when appropriate
            if (enabled.security) {
              this.analyzeAuthenticationMethods(
                content,
                file,
                categories.security.issues,
                categories.security.compliant,
              );
            }
          } catch (err) {
            console.error(`Failed to read Bicep file: ${file}`);
            categories.deployment.issues.push({
              id: `error-reading-${file}`,
              severity: 'warning',
              message: `Failed to read ${file}`,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // Check for azure.yaml or azure.yml (deployment category: governs infrastructure orchestration)
      const azureYamlPath = files.find((f) => f === 'azure.yaml' || f === 'azure.yml');
      if (azdGloballyEnabled && enabled.deployment && azureYamlPath) {
        categories.deployment.compliant.push({
          id: 'azure-yaml-exists',
          category: 'azureYaml',
          message: `Found azure.yaml file: ${azureYamlPath}`,
          details: {
            fileName: azureYamlPath,
          },
        });

        try {
          const azureYamlContent = await this.githubClient.getFileContent(
            repoInfo.owner,
            repoInfo.repo,
            azureYamlPath,
          );
          if (
            enabled.deployment &&
            config.azureYamlRules?.mustDefineServices &&
            !/services\s*:/i.test(azureYamlContent)
          ) {
            categories.deployment.issues.push({
              id: 'azure-yaml-missing-services',
              severity: 'error',
              message: `No "services:" defined in ${azureYamlPath}`,
              error: `File ${azureYamlPath} does not define required "services:" section`,
            });
          } else if (enabled.deployment && config.azureYamlRules?.mustDefineServices) {
            categories.deployment.compliant.push({
              id: 'azure-yaml-services-defined',
              category: 'azureYaml',
              message: `"services:" section found in ${azureYamlPath}`,
              details: {
                fileName: azureYamlPath,
              },
            });
          }
        } catch {
          categories.deployment.issues.push({
            id: 'azure-yaml-read-error',
            severity: 'warning',
            message: `Could not read ${azureYamlPath}`,
            error: `Failed to read file ${azureYamlPath}`,
          });
        }
      } else if (azdGloballyEnabled && enabled.deployment) {
        categories.deployment.issues.push({
          id: 'missing-azure-yaml',
          severity: 'error',
          message: 'Missing azure.yaml or azure.yml file',
          error: 'No azure.yaml or azure.yml file found in repository',
        });
      }

      // --- Global checks (conditional) ---
      // Only run the AI model deprecation scan if deployment method is Azure Developer CLI
      // Heuristic: presence of azure.yaml or azure.yml in repo root
      const globalIssues = [];
      const globalCompliant = [];
      const cfgForGlobal = window.TemplateDoctorConfig || {};
      const aiToggleEnabled = cfgForGlobal.aiDeprecationCheckEnabled !== false; // default true
      if (azdGloballyEnabled && azureYamlPath && aiToggleEnabled) {
        try {
          await this.runAIDeprecationCheck(
            files,
            repoInfo,
            categories.ai.issues,
            categories.ai.compliant,
          );
        } catch (e) {
          categories.ai.issues.push({
            id: 'ai-model-deprecation-check-error',
            severity: 'warning',
            message: 'Test AI model deprecation: check failed',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Flatten legacy arrays from categories and merge global checks
      const allIssues = [
        ...categories.repositoryManagement.issues,
        ...categories.functionalRequirements.issues,
        ...categories.deployment.issues,
        ...categories.security.issues,
        ...categories.testing.issues,
        ...categories.ai.issues,
      ];
      const allCompliant = [
        ...categories.repositoryManagement.compliant,
        ...categories.functionalRequirements.compliant,
        ...categories.deployment.compliant,
        ...categories.security.compliant,
        ...categories.testing.compliant,
        ...categories.ai.compliant,
      ];
      
      // Enhance security recommendations with clearer guidance
      this.enhanceSecurityRecommendations(allIssues);

      // Calculate category summaries
      Object.keys(categories).forEach((key) => {
        const c = categories[key];
        const total = c.issues.length + c.compliant.length;
        c.percentage = total > 0 ? Math.round((c.compliant.length / total) * 100) : 0;
        c.summary = total === 0 ? 'No checks in this category' : `${c.percentage}% compliant`;
      });

      // Calculate global summary and compliance percentages
      const summary = allIssues.length === 0 ? 'No issues found 🎉' : 'Issues found';
      const totalChecks = allIssues.length + allCompliant.length;
      const percentageCompliant =
        totalChecks > 0 ? Math.round((allCompliant.length / totalChecks) * 100) : 0;

      // Add metadata to compliant array
      allCompliant.push({
        id: 'compliance-summary',
        category: 'meta',
        message: `Compliance: ${percentageCompliant}%`,
        details: {
          issueCount: allIssues.length,
          compliantCount: allCompliant.length,
          totalChecks: totalChecks,
          percentageCompliant: percentageCompliant,
        },
      });

      // Map minimal global checks status (currently only AI model deprecation)
      const globalChecks = [];
      const aiIssue = categories.ai.issues.find((i) => i.id === 'ai-model-deprecation');
      const aiCompliant = categories.ai.compliant.find((c) => c.id === 'ai-model-deprecation');
      if (aiIssue || aiCompliant) {
        globalChecks.push({
          id: 'ai-model-deprecation',
          status: aiIssue ? 'failed' : 'passed',
          details: aiIssue?.details || aiCompliant?.details || null,
        });
      }

      // Return the analysis result
      const result = {
        repoUrl,
        ruleSet,
        timestamp: new Date().toISOString(),
        compliance: {
          issues: allIssues,
          compliant: allCompliant,
          // Numeric overall compliance percentage for backward compatibility with UI/workflows
          percentage: percentageCompliant,
          summary: `${summary} - Compliance: ${percentageCompliant}%`,
          categories,
          globalChecks,
        },
      };

      // Add custom configuration details if applicable
      if (ruleSet === 'custom' && customConfig) {
        result.customConfig = {
          gistUrl: customConfig.gistUrl || null,
        };
      }

      return result;
    } catch (error) {
      console.error('Error analyzing template:', error);
      throw new Error(`Failed to analyze repository: ${error.message}`);
    }
  }

  /**
   * Always-on: Scan repository for deprecated AI model references.
   * Uses global TemplateDoctorConfig.deprecatedModels (array of strings) if provided,
   * otherwise falls back to a small default set. Adds a single issue or compliant entry.
   */
  async runAIDeprecationCheck(files, repoInfo, issues, compliant) {
    const cfg = window.TemplateDoctorConfig || {};
    const deprecatedModels = Array.isArray(cfg.deprecatedModels)
      ? cfg.deprecatedModels
      : [
          // Conservative defaults; replace via TemplateDoctorConfig.deprecatedModels when needed
          'gpt-3.5-turbo',
          'text-davinci-003',
        ];

    // If no models defined, still report a compliant meta result to indicate the check ran
    if (!deprecatedModels || deprecatedModels.length === 0) {
      compliant.push({
        id: 'ai-model-deprecation',
        category: 'meta',
        message: 'Test AI model deprecation: No deprecated model patterns configured',
        details: { modelsChecked: 0 },
      });
      return;
    }

    // Only scan a reasonable set of text files
    const textExts = ['.md', '.js', '.ts', '.py', '.json', '.yml', '.yaml'];
    const isTextFile = (p) => textExts.some((ext) => p.toLowerCase().endsWith(ext));
    const candidateFiles = files.filter(isTextFile).slice(0, 200); // cap to 200 files for performance

    const found = [];
    for (const path of candidateFiles) {
      try {
        const content = await this.githubClient.getFileContent(
          repoInfo.owner,
          repoInfo.repo,
          path,
        );
        const lower = content.toLowerCase();
        for (const model of deprecatedModels) {
          if (model && lower.includes(String(model).toLowerCase())) {
            found.push({ file: path, model });
          }
        }
      } catch (e) {
        // Non-fatal: skip unreadable file
      }
    }

    if (found.length > 0) {
      issues.push({
        id: 'ai-model-deprecation',
        severity: 'warning',
        message: 'Test AI model deprecation: Found deprecated model references',
        details: { matches: found, modelsChecked: deprecatedModels },
      });
    } else {
      compliant.push({
        id: 'ai-model-deprecation',
        category: 'aiModel',
        message: 'Test AI model deprecation: No deprecated model references found',
        details: { modelsChecked: deprecatedModels },
      });
    }
  }

  /**
   * Evaluate the default branch rule from docs-config.json
   * @param {Object} config - The configuration object
   * @param {Object} repoInfo - The repository information object
   * @param {string} defaultBranch - The default branch of the repository
   * @param {Array} issues - The issues array to populate with any issues found
   * @param {Array} compliant - The compliant array to populate with any compliant items
   */
  evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant) {
    // Guard: only run if docs-config defines a default branch requirement
    const expected = config?.githubRepositoryConfiguration?.defaultBranch?.mustBe;
    if (!expected) return;

    // Compare exact match by default; normalize if case-insensitive comparison desired
    const normalize = (s) => String(s).trim();
    if (normalize(defaultBranch) !== normalize(expected)) {
      issues.push({
        id: `default-branch-not-${expected}`,
        severity: 'error',
        message: `Default branch must be '${expected}'. Current default branch is '${defaultBranch}'.`,
        error: `Default branch is '${defaultBranch}', expected '${expected}'`,
      });
    } else {
      compliant.push({
        id: `default-branch-is-${expected}`,
        category: 'branch',
        message: `Default branch is '${expected}'`,
        details: { defaultBranch },
      });
    }
  }

  /**
   * Analyze authentication methods in Bicep files
   * @param {string} content - The Bicep file content
   * @param {string} file - The file path
   * @param {Array} issues - The issues array to populate with any issues found
   * @param {Array} compliant - The compliant array to populate with any compliant items
   */
  analyzeAuthenticationMethods(content, file, issues, compliant) {
    // Skip if security checks are not enabled in config
    const config = this.getConfig();
    const securityChecks = config.bicepChecks?.securityBestPractices;
    
    if (!securityChecks) {
      return;
    }

    // Check for Managed Identity
    const hasManagedIdentity = this.checkForManagedIdentity(content);

    // Check for other authentication methods (sensitive patterns)
    const authMethods = this.detectAuthenticationMethods(content);
    
    // Check for resources requiring auth (KeyVault, Container Registry, etc.)
    const resourcesRequiringAuth = this.detectResourcesRequiringAuth(content);
    const hasKeyVault = resourcesRequiringAuth.includes('Key Vault');
    const hasContainerRegistry = resourcesRequiringAuth.includes('Container Registry');
    
    // Only proceed with checks if we've detected sensitive authentication patterns or security-sensitive resources
    const hasSensitiveAuth = authMethods.length > 0;
    const hasSecuritySensitiveResource = hasKeyVault || hasContainerRegistry;
    
    // If the file uses Managed Identity, that's a compliant pattern - always acknowledge good practices
    if (hasManagedIdentity) {
      compliant.push({
        id: `bicep-uses-managed-identity-${file}`,
        category: 'bicepSecurity',
        message: `Good practice: ${file} uses Managed Identity for Azure authentication`,
        details: {
          file: file,
          authMethod: 'ManagedIdentity',
        },
      });
    }

    // Only flag insecure auth methods if they're actually detected
    if (securityChecks.detectInsecureAuth && hasSensitiveAuth) {
      const authMethodsList = authMethods.join(', ');
      const errorCode = 'SEC-AUTH-001';

      issues.push({
        id: `bicep-alternative-auth-${file}`,
        code: errorCode, 
        severity: 'warning',
        message: `${errorCode}: Detected ${authMethodsList} in ${file}`,
        error: `File ${file} uses ${authMethodsList} for authentication which may expose secrets`,
        recommendation: `Replace ${authMethodsList} with Managed Identity or Key Vault references for improved security.`,
        impact: 'Using explicit credentials increases risk of credential leakage, credential rotation complexity, and violates security best practices for Azure resources.',
        documentation: 'https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview',
        remediationSteps: [
          "1. Refactor authentication to use Managed Identity where supported",
          "2. For services that don't support Managed Identity, store secrets in Key Vault",
          "3. Use Key Vault references to access secrets securely at runtime",
          "4. Document any security limitations in SECURITY.md"
        ],
        detailedRemediation: `## Using Managed Identity Instead of Keys/Secrets

### Example Conversion
\`\`\`bicep
// BEFORE - Using connection string or keys
resource webApp 'Microsoft.Web/sites@2021-03-01' = {
  name: 'myApp'
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'StorageConnectionString'
          value: 'DefaultEndpointsProtocol=https;AccountName=mystorageacct;AccountKey=\${listKeys(storageAccount.id, \'2021-09-01\').keys[0].value}'
        }
      ]
    }
  }
}

// Attach to window if in browser environment (mirrors github-client-new behavior)
try {
  if (typeof window !== 'undefined' && !window.TemplateAnalyzer) {
    window.TemplateAnalyzer = TemplateAnalyzer; // expose constructor for tests
  }
} catch(_) {}

// AFTER - Using Managed Identity
resource webApp 'Microsoft.Web/sites@2021-03-01' = {
  name: 'myApp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'StorageAccountName'
          value: storageAccount.name
        }
      ]
    }
  }
}

// Add role assignment for the identity
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, storageAccount.id, 'storage-blob-data-contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
\`\`\``,
        securityIssue: true,
      });
    }

    // Only flag KeyVault without auth if it's actually present AND there's no Managed Identity
    if (securityChecks.checkAnonymousAccess && hasKeyVault && !hasManagedIdentity) {
      const errorCode = 'SEC-KV-001';
      
      issues.push({
        id: `bicep-missing-auth-keyVault-${file}`,
        code: errorCode,
        severity: 'warning',
        message: `${errorCode}: Key Vault found without Managed Identity in ${file}`,
        error: `Key Vault resource in ${file} doesn't appear to use Managed Identity for access`,
        recommendation: `Add Managed Identity configuration for secure Key Vault access.`,
        impact: 'Without Managed Identity, applications may use less secure authentication methods to access Key Vault secrets, increasing the risk of credential exposure.',
        documentation: 'https://learn.microsoft.com/en-us/azure/key-vault/general/authentication',
        remediationSteps: [
          "1. Add identity block to resources accessing Key Vault",
          "2. Configure appropriate Key Vault access policies",
          "3. Use the identity for Key Vault operations instead of keys/secrets",
          "4. Document the security model in SECURITY.md"
        ],
        detailedRemediation: `## Configuring Key Vault Access with Managed Identity

### Example Code
\`\`\`bicep
// Define the application with a Managed Identity
resource webApp 'Microsoft.Web/sites@2021-03-01' = {
  name: 'myApp'
  identity: {
    type: 'SystemAssigned'
  }
  // other properties...
}

// Create Key Vault with access policy for the application
resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = {
  name: 'myKeyVault'
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: tenant().tenantId
        objectId: webApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}
\`\`\``,
        securityIssue: true,
      });
    }
    
    // Only flag Container Registry without auth if it's actually present AND there's no Managed Identity
    if (securityChecks.checkAnonymousAccess && hasContainerRegistry && !hasManagedIdentity) {
      const errorCode = 'SEC-ACR-001';
      
      issues.push({
        id: `bicep-missing-auth-containerRegistry-${file}`,
        code: errorCode,
        severity: 'warning',
        message: `${errorCode}: Container Registry found without Managed Identity in ${file}`,
        error: `Container Registry in ${file} doesn't appear to use Managed Identity for access`,
        recommendation: `Add Managed Identity configuration for secure Container Registry access.`,
        impact: 'Using admin credentials for Container Registry increases the attack surface and creates a shared credential risk. Managed Identity provides per-resource authentication.',
        documentation: 'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-managed-identity',
        remediationSteps: [
          "1. Add identity block to resources accessing Container Registry",
          "2. Configure RBAC for Container Registry access",
          "3. Use the identity for image pulls instead of admin credentials",
          "4. Document the security model in SECURITY.md"
        ],
        detailedRemediation: `## Using Managed Identity with Container Registry

### Example Code
\`\`\`bicep
// Define Container Registry with admin disabled
resource acr 'Microsoft.ContainerRegistry/registries@2021-09-01' = {
  name: 'myContainerRegistry'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // Disable admin user in favor of RBAC
  }
}

// Define container app or other service with identity
resource containerApp 'Microsoft.App/containerApps@2022-03-01' = {
  name: 'myContainerApp'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    // configuration
  }
}

// Grant AcrPull role to the identity
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerApp.id, acr.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
\`\`\``,
        securityIssue: true,
      });
    }
  }

  /**
   * Check if the Bicep file uses Managed Identity
   * @param {string} content - The Bicep file content
   * @returns {boolean} - Whether Managed Identity is used
   */
  checkForManagedIdentity(content) {
    // Common patterns for Managed Identity in Bicep files
    const patterns = [
      /identity:\s*\{\s*type:\s*['"]SystemAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]UserAssigned['"]/i,
      /identity:\s*\{\s*type:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]UserAssigned['"]/i,
      /['"]identity['"]\s*:\s*\{\s*['"]type['"]\s*:\s*['"]SystemAssigned,UserAssigned['"]/i,
      /managedIdentities:\s*\{\s*systemAssigned:\s*true/i,
      /managedIdentities:\s*\{\s*userAssignedResourceIds:/i,
    ];

    return patterns.some((pattern) => pattern.test(content));
  }

  /**
   * Detect other authentication methods in Bicep files
   * @param {string} content - The Bicep file content
   * @returns {string[]} - Array of detected authentication methods
   *
   * This method looks for various authentication patterns in Bicep templates that could be
   * replaced with Managed Identity for better security. It detects:
   * 1. Connection strings (potentially containing credentials)
   * 2. Access keys
   * 3. KeyVault secrets referenced without using Managed Identity
   * 4. SAS tokens
   * 5. Storage account keys
   * 6. Connection strings with explicit credentials
   *
   * When these patterns are found, the analyzer will recommend replacing them with
   * Managed Identity for improved security.
   */
  detectAuthenticationMethods(content) {
    const authMethods = [];

    // Helper function to test if content matches any of the patterns
    const matchesAnyPattern = (patterns, text) => {
      return patterns.some(pattern => pattern.test(text));
    };

    // Helper to check if the code is in a commented section - reduce false positives
    const isInComment = (text, matchIndex) => {
      // Check if the match is inside a line comment or multi-line comment
      const lines = text.substring(0, matchIndex).split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Check if it's in a line comment
      if (lastLine.trim().startsWith('//')) {
        return true;
      }
      
      // Check for multi-line comments
      const textBeforeMatch = text.substring(0, matchIndex);
      const lastCommentStart = textBeforeMatch.lastIndexOf('/*');
      const lastCommentEnd = textBeforeMatch.lastIndexOf('*/');
      
      if (lastCommentStart > lastCommentEnd) {
        return true;
      }
      
      return false;
    };

    // Define named patterns for connection strings with credentials
    const connectionStringPatterns = [
      // Pattern 1: Regular property syntax with credentials - explicitly look for sensitive parts
      /connectionString.*=.*['"][^'"]*?(AccountKey=|Password=|pwd=|UserName=|uid=|AccountEndpoint=)[^'"]*?['"]/i,
      // Pattern 2: JSON property syntax with credentials
      /['"]ConnectionString['"].*:.*['"][^'"]*?(AccountKey=|Password=|pwd=|UserName=|uid=|AccountEndpoint=)[^'"]*?['"]/i
    ];
    
    // Check connection strings with more context
    for (const pattern of connectionStringPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip if in comment
        if (!isInComment(content, match.index)) {
          authMethods.push('Connection String with credentials');
          break; // Only report once per type
        }
      }
    }

    // Define named patterns for access keys
    const accessKeyPatterns = [
      // Regular property syntax patterns
      /accessKey\s*:\s*[^;{}]*listKeys\([^)]*\)/i,
      /primaryKey\s*:\s*[^;{}]*listKeys\([^)]*\)/i,
      /secondaryKey\s*:\s*[^;{}]*listKeys\([^)]*\)/i,
      // JSON property syntax patterns
      /['"]accessKey['"].*:.*listKeys\([^)]*\)/i,
      /['"]primaryKey['"].*:.*listKeys\([^)]*\)/i,
      /['"]secondaryKey['"].*:.*listKeys\([^)]*\)/i
    ];
    
    // Check access keys with more context
    for (const pattern of accessKeyPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip if in comment
        if (!isInComment(content, match.index)) {
          authMethods.push('Access Key');
          break; // Only report once per type
        }
      }
    }

    // Check for KeyVault secrets referenced without Managed Identity
    // Find resource blocks that reference KeyVault secrets
    const resourceBlocks = content.match(/resource\s+\w+\s+'[^']*'\s*{[^}]*}/gis) || [];
    
    // Define patterns for KeyVault secrets and identity properties
    const keyVaultSecretPatterns = [
      /keyVault.*\/secrets\//i,
      /['"]secretUri['"]/i
    ];
    
    const identityPatterns = [
      /identity\s*:/i,
      /identity\s*{/i
    ];
    
    let keyVaultSecretWithoutMI = false;
    
    for (const block of resourceBlocks) {
      // Check if block references KeyVault secrets
      if (matchesAnyPattern(keyVaultSecretPatterns, block)) {
        // Check if this block lacks identity property
        if (!matchesAnyPattern(identityPatterns, block)) {
          keyVaultSecretWithoutMI = true;
          break;
        }
      }
    }
    
    if (keyVaultSecretWithoutMI) {
      authMethods.push('KeyVault Secret without Managed Identity');
    }

    // Define patterns for SAS tokens
    const sasTokenPatterns = [
      /sasToken\s*:/i,
      /['"]sasToken['"].*:/i,
      /sharedAccessSignature\s*:/i,
      /SharedAccessKey\s*:/i
    ];
    
    // Check SAS tokens with more context
    for (const pattern of sasTokenPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip if in comment
        if (!isInComment(content, match.index)) {
          authMethods.push('SAS Token');
          break; // Only report once per type
        }
      }
    }

    // Define patterns for Storage Account Keys
    const storageKeyPatterns = [
      /storageAccountKey\s*:/i,
      /['"]storageAccountKey['"].*:/i,
      /listKeys\s*\([^)]*['"]Microsoft\.Storage\/storageAccounts/i
    ];
    
    // Check storage keys with more context
    for (const pattern of storageKeyPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip if in comment
        if (!isInComment(content, match.index)) {
          authMethods.push('Storage Account Key');
          break; // Only report once per type
        }
      }
    }

    return authMethods;
  }

  /**
   * Detect resources that typically require authentication
   * @param {string} content - The Bicep file content
   * @returns {string[]} - Array of resources that typically require authentication
   *
   * This method identifies Azure resources in Bicep templates that typically
   * should use some form of authentication - preferably Managed Identity.
   * This is particularly important for resources like Key Vault that should
   * never be exposed without proper authentication.
   */
  detectResourcesRequiringAuth(content) {
    const resources = [];

    // Focused list of sensitive resources that always require authentication
    const resourcePatterns = [
      { pattern: /Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' },
      { pattern: /resource\s+\w+\s+'Microsoft\.KeyVault\/vaults/i, name: 'Key Vault' },
      { pattern: /type\s*:\s*['"]Microsoft\.KeyVault\/vaults['"]/i, name: 'Key Vault' },
      { pattern: /Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' },
      { pattern: /resource\s+\w+\s+'Microsoft\.ContainerRegistry\/registries/i, name: 'Container Registry' },
      { pattern: /type\s*:\s*['"]Microsoft\.ContainerRegistry\/registries['"]/i, name: 'Container Registry' }
    ];

    for (const { pattern, name } of resourcePatterns) {
      if (pattern.test(content)) {
        resources.push(name);
      }
    }

    return resources;
  }

  /**
   * Run all repository configuration validations together. Keep this minimal so future config checks can be added cleanly.
   * @param {Object} config
   * @param {Object} repoInfo
   * @param {string} defaultBranch
   * @param {Array} issues
   * @param {Array} compliant
   */
  validateRepoConfiguration(config, repoInfo, defaultBranch, issues, compliant) {
    try {
      // Run the existing default branch rule (docs-config defaultBranch.mustBe)
      this.evaluateDefaultBranchRule(config, repoInfo, defaultBranch, issues, compliant);

      // Future repo-level validations (webhooks, deploy keys, actions permissions, branch protection, etc.)
      // can be added here as additional helper calls such as:
      // this.evaluateWebhooksRule(config, repoInfo, issues);
      // this.evaluateDeployKeysRule(config, repoInfo, issues);
    } catch (err) {
      console.error('Error validating repository configuration:', err);
      issues.push({
        id: 'repo-configuration-validation-failed',
        severity: 'warning',
        message: 'Repository configuration validation failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  
  /**
   * Enhance security recommendations with clearer guidance
   * @param {Array} issues - Array of security issues
   */
  enhanceSecurityRecommendations(issues) {
    if (!issues || !Array.isArray(issues)) return;
    
    // Dictionary of error codes and detailed explanations
    const errorCodeDictionary = {
      'SEC-AUTH-001': {
        title: 'Insecure Authentication Method Detected',
        description: 'The template uses authentication methods that may expose secrets or credentials.',
        impact: 'High - Exposed credentials could lead to unauthorized access to Azure resources.',
        bestPractice: 'Use Managed Identity for authentication whenever possible. For services that don\'t support Managed Identity, use Key Vault to store and retrieve secrets securely.',
        documentation: 'https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview',
        remediation: `
## Remediation Steps:
1. **Identify the authentication method**: Review where connection strings, access keys, or SAS tokens are used
2. **Refactor to use Managed Identity**: 
   \`\`\`bicep
   resource webapp 'Microsoft.Web/sites@2021-03-01' = {
     name: webAppName
     // Add identity block
     identity: {
       type: 'SystemAssigned'
     }
     properties: {
       // Other properties...
     }
   }
   \`\`\`
3. **Use Key Vault references for secrets that can't use Managed Identity**:
   \`\`\`bicep
   resource appSettings 'Microsoft.Web/sites/config@2021-03-01' = {
     name: '\${webapp.name}/appsettings'
     properties: {
       'Secret': '@Microsoft.KeyVault(SecretUri=\${keyVault.properties.vaultUri}secrets/mySecret/)'
     }
   }
   \`\`\`
4. **Document your security approach in SECURITY.md**
`
      },
      'SEC-KV-001': {
        title: 'Key Vault Without Managed Identity',
        description: 'A Key Vault resource is present but the template doesn\'t configure Managed Identity for accessing it.',
        impact: 'High - Without Managed Identity, applications may use less secure methods to access secrets.',
        bestPractice: 'Configure Managed Identity for any service accessing Key Vault and use RBAC or Access Policies to control permissions.',
        documentation: 'https://learn.microsoft.com/en-us/azure/key-vault/general/authentication',
        remediation: `
## Remediation Steps:
1. **Add Managed Identity to resource accessing Key Vault**:
   \`\`\`bicep
   resource function 'Microsoft.Web/sites@2021-03-01' = {
     name: functionName
     kind: 'functionapp'
     identity: {
       type: 'SystemAssigned'
     }
     // Other properties...
   }
   \`\`\`

2. **Configure Key Vault access**:
   \`\`\`bicep
   resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2021-06-01-preview' = {
     name: '\${keyVault.name}/add'
     properties: {
       accessPolicies: [
         {
           tenantId: subscription().tenantId
           objectId: myFunction.identity.principalId
           permissions: {
             secrets: [
               'get'
               'list'
             ]
           }
         }
       ]
     }
   }
   \`\`\`

3. **Or use RBAC (recommended for newer Key Vaults)**:
   \`\`\`bicep
   resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
     name: guid(keyVault.id, myFunction.id, 'Key Vault Secrets User')
     scope: keyVault
     properties: {
       roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
       principalId: myFunction.identity.principalId
       principalType: 'ServicePrincipal'
     }
   }
   \`\`\`
`
      },
      'SEC-ACR-001': {
        title: 'Container Registry Without Managed Identity',
        description: 'A Container Registry is present but the template doesn\'t configure Managed Identity for accessing it.',
        impact: 'Medium - Without Managed Identity, applications may use admin credentials to access container images.',
        bestPractice: 'Configure Managed Identity for any service pulling images from Container Registry and use RBAC to control permissions.',
        documentation: 'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-managed-identity',
        remediation: `
## Remediation Steps:
1. **Add Managed Identity to resource accessing Container Registry**:
   \`\`\`bicep
   resource aksCluster 'Microsoft.ContainerService/managedClusters@2021-08-01' = {
     name: clusterName
     location: location
     identity: {
       type: 'SystemAssigned'
     }
     // Other properties...
   }
   \`\`\`

2. **Configure ACR access with RBAC**:
   \`\`\`bicep
   resource acrPullRole 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
     name: guid(containerRegistry.id, aksCluster.id, 'AcrPull')
     scope: containerRegistry
     properties: {
       roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
       principalId: aksCluster.identity.principalId
       principalType: 'ServicePrincipal'
     }
   }
   \`\`\`
`
      }
    };
    
    // Loop through all issues and enhance any security-related ones
    for (const issue of issues) {
      if (!issue.securityIssue) continue;
      
      // Use error code dictionary if available
      if (issue.code && errorCodeDictionary[issue.code]) {
        const errorDetails = errorCodeDictionary[issue.code];
        issue.title = errorDetails.title;
        issue.description = errorDetails.description;
        issue.impact = errorDetails.impact;
        issue.bestPractice = errorDetails.bestPractice;
        issue.documentation = errorDetails.documentation;
        issue.detailedRemediation = errorDetails.remediation;
        
        // Keep the existing recommendation if available, but enhance it
        if (!issue.recommendation) {
          issue.recommendation = errorDetails.bestPractice;
        }
        
        continue;
      }
      
      // Fall back to type-based enhancements for issues without codes
      // Detect the type of security issue
      const isKeyVaultIssue = issue.message?.includes('Key Vault') || issue.error?.includes('Key Vault');
      const isContainerRegistryIssue = issue.message?.includes('Container Registry') || issue.error?.includes('Container Registry');
      const hasConnectionString = issue.message?.includes('Connection String') || issue.error?.includes('Connection String');
      const hasAccessKey = issue.message?.includes('Access Key') || issue.message?.includes('SAS token') || 
                          issue.error?.includes('Access Key') || issue.error?.includes('SAS token');
      
      // Add detailed recommendations based on the issue type
      if (isKeyVaultIssue) {
        issue.recommendation = `
When using Key Vault in production environments:
1. Use Managed Identity for authentication to Key Vault
2. Document access policies and RBAC assignments in the README.md
3. Include Key Vault configuration guidelines in the "Important Security Notice" section
4. Ensure the SECURITY.md file explains the security controls implemented`;
      } else if (isContainerRegistryIssue) {
        issue.recommendation = `
When using Container Registry in production environments:
1. Use Managed Identity for authentication to Container Registry
2. Implement proper RBAC for container image access
3. Document the container security model in the SECURITY.md file
4. Ensure the "Important Security Notice" section covers container security considerations`;
      } else if (hasConnectionString || hasAccessKey) {
        issue.recommendation = `
Best practices for secure authentication:
1. Replace connection strings and access keys with Managed Identity where possible
2. For services that don't support Managed Identity, store secrets in Key Vault
3. Document any security limitations in the SECURITY.md file
4. Add clear security guidance in the "Important Security Notice" section of README.md`;
      }
    }
  }
}

// Helper to normalize selected categories based on preset rules
function normalizeCategorySelection(ruleSet, selected) {
  // If explicit selection provided, honor it
  if (selected && typeof selected === 'object') {
    return {
      repositoryManagement: !!selected.repositoryManagement,
      functionalRequirements: !!selected.functionalRequirements,
      deployment: !!selected.deployment,
      security: !!selected.security,
      testing: !!selected.testing,
    };
  }
  // Defaults per preset requirements
  if (ruleSet === 'partner') {
    return {
      repositoryManagement: false,
      functionalRequirements: true,
      deployment: true,
      security: true,
      testing: false,
    };
  }
  if (ruleSet === 'docs') {
    return {
      repositoryManagement: true,
      functionalRequirements: true,
      deployment: false,
      security: true,
      testing: false,
    };
  }
  if (ruleSet === 'custom') {
    return {
      repositoryManagement: false,
      functionalRequirements: false,
      deployment: false,
      security: false,
      testing: false,
    };
  }
  // Default DoD
  return {
    repositoryManagement: true,
    functionalRequirements: true,
    deployment: true,
    security: true,
    testing: false,
  };
}

// Function to initialize the analyzer
function initializeAnalyzer() {
  console.log('[TemplateAnalyzer] Initializing analyzer with GitHub client:', {
    clientInitialized: !!window.GitHubClient,
    authenticated: window.GitHubClient?.auth?.isAuthenticated() || false,
  });

  // If the analyzer already exists and the token changes, re-initialize it
  if (window.TemplateAnalyzer && window.GitHubClient) {
    window.TemplateAnalyzer.githubClient = window.GitHubClient;
    console.log('[TemplateAnalyzer] Updated existing analyzer with current GitHub client');
  } else {
    // Create new analyzer
    const templateAnalyzer = new TemplateAnalyzer();
    window.TemplateAnalyzer = templateAnalyzer;
    console.log('[TemplateAnalyzer] Analyzer initialized and assigned to window.TemplateAnalyzer');
  }

  // Dispatch event that analyzer is ready
  const event = new CustomEvent('template-analyzer-ready');
  document.dispatchEvent(event);

  return true;
}

// Try to initialize immediately if GitHub client is already available
if (window.GitHubClient) {
  initializeAnalyzer();
} else {
  // Create and export the analyzer instance after a small delay to ensure GitHub client is fully initialized
  console.log(
    '[TemplateAnalyzer] GitHub client not available yet, waiting 1 second before initializing',
  );
  setTimeout(initializeAnalyzer, 1000); // 1 second delay
}

// Add a listener for when the GitHub client becomes authenticated
document.addEventListener('github-auth-changed', () => {
  console.log('[TemplateAnalyzer] GitHub auth changed, re-initializing analyzer');
  initializeAnalyzer();
});

// Add extra initialization safety checks
window.checkAnalyzerReady = function () {
  // Check if analyzer exists
  if (window.TemplateAnalyzer) {
    console.log('[TemplateAnalyzer] Analyzer is already initialized');
    return true;
  }

  // Check for GitHub client
  if (!window.GitHubClient) {
    console.error('[TemplateAnalyzer] GitHub client not available');
    return false;
  }

  // If we got here, we need to initialize the analyzer
  console.log('[TemplateAnalyzer] Analyzer not ready, initializing now');

  // Create the analyzer immediately
  try {
    const templateAnalyzer = new TemplateAnalyzer();
    window.TemplateAnalyzer = templateAnalyzer;
    console.log('[TemplateAnalyzer] Analyzer initialized successfully');

    // Dispatch event that analyzer is ready
    const event = new CustomEvent('template-analyzer-ready');
    document.dispatchEvent(event);

    return true;
  } catch (error) {
    console.error('[TemplateAnalyzer] Failed to initialize analyzer:', error);
    return false;
  }
};
