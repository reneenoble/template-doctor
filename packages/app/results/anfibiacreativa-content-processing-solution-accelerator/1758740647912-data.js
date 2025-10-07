window.reportData = {
  repoUrl: 'https://github.com/microsoft/content-processing-solution-accelerator',
  ruleSet: 'dod',
  timestamp: '2025-09-24T19:04:07.910Z',
  compliance: {
    issues: [
      {
        id: 'missing-repo-topics',
        severity: 'error',
        message: 'Missing required topics: azd-template, azure-developer-cli',
        error: 'Repository should include the following topics: azd-template, azure-developer-cli',
      },
      {
        id: 'missing-workflow-.github\\/workflows\\/azure-dev.yml',
        severity: 'error',
        message: 'Missing required GitHub workflow: azure-dev.yml',
        error: 'Missing required GitHub workflow: azure-dev.yml',
      },
      {
        id: 'devcontainer-missing-azd',
        severity: 'warning',
        message: 'Dev Container configuration might not include azd',
        error:
          'The .devcontainer configuration should include the Azure Developer CLI (azd) for a consistent development experience',
      },
      {
        id: 'readme-missing-heading-features',
        severity: 'error',
        message: 'README.md is missing required h2 heading: Features',
        error: 'README.md does not contain required h2 heading: Features',
      },
      {
        id: 'readme-missing-heading-getting-started',
        severity: 'error',
        message: 'README.md is missing required h2 heading: Getting Started',
        error: 'README.md does not contain required h2 heading: Getting Started',
      },
      {
        id: 'readme-missing-heading-resources',
        severity: 'error',
        message: 'README.md is missing required h2 heading: Resources',
        error: 'README.md does not contain required h2 heading: Resources',
      },
      {
        id: 'readme-missing-heading-guidance',
        severity: 'error',
        message: 'README.md is missing required h2 heading: Guidance',
        error: 'README.md does not contain required h2 heading: Guidance',
      },
      {
        id: 'readme-missing-architecture-diagram-heading',
        severity: 'error',
        message: 'README.md is missing required h2 heading: Architecture',
        error: 'README.md does not contain required h2 heading: Architecture',
      },
      {
        id: 'azure-yaml-missing-services',
        severity: 'error',
        message: 'No "services:" defined in azure.yaml',
        error: 'File azure.yaml does not define required "services:" section',
      },
    ],
    compliant: [
      {
        id: 'repo-description',
        category: 'repositoryMetadata',
        message: 'Repository has a description',
        details: {
          description:
            'Programmatically extract data and apply schemas to unstructured documents across text-based and multi-modal content using Azure AI Foundry, Azure OpenAI, Azure AI Content Understanding, and Cosmos DB.',
        },
      },
      {
        id: 'file-README.md',
        category: 'requiredFile',
        message: 'Required file found: README.md',
        details: {
          fileName: 'README.md',
        },
      },
      {
        id: 'file-azure.yaml',
        category: 'requiredFile',
        message: 'Required file found: azure.yaml',
        details: {
          fileName: 'azure.yaml',
        },
      },
      {
        id: 'file-LICENSE',
        category: 'requiredFile',
        message: 'Required file found: LICENSE',
        details: {
          fileName: 'LICENSE',
        },
      },
      {
        id: 'file-SECURITY.md',
        category: 'requiredFile',
        message: 'Required file found: SECURITY.md',
        details: {
          fileName: 'SECURITY.md',
        },
      },
      {
        id: 'file-CONTRIBUTING.md',
        category: 'requiredFile',
        message: 'Required file found: CONTRIBUTING.md',
        details: {
          fileName: 'CONTRIBUTING.md',
        },
      },
      {
        id: 'file-CODE_OF_CONDUCT.md',
        category: 'requiredFile',
        message: 'Required file found: CODE_OF_CONDUCT.md',
        details: {
          fileName: 'CODE_OF_CONDUCT.md',
        },
      },
      {
        id: 'folder-infra',
        category: 'requiredFolder',
        message: 'Required folder found: infra/',
        details: {
          folderPath: 'infra',
          fileCount: 18,
        },
      },
      {
        id: 'folder-.github',
        category: 'requiredFolder',
        message: 'Required folder found: .github/',
        details: {
          folderPath: '.github',
          fileCount: 18,
        },
      },
      {
        id: 'issue-template',
        category: 'repositoryManagement',
        message: 'Repository has GitHub issue templates',
        details: {
          found: true,
        },
      },
      {
        id: 'bicep-files-exist',
        category: 'bicepFiles',
        message: 'Bicep files found in infra/ directory: 9 files',
        details: {
          count: 9,
          files: [
            'infra/main.bicep',
            'infra/modules/account/main.bicep',
            'infra/modules/account/modules/dependencies.bicep',
            'infra/modules/account/modules/keyVaultExport.bicep',
            'infra/modules/account/modules/project.bicep',
            'infra/modules/container-registry.bicep',
            'infra/modules/key-vault.bicep',
            'infra/modules/log-analytics-workspace.bicep',
            'infra/modules/managed-identity.bicep',
          ],
        },
      },
      {
        id: 'azure-yaml-exists',
        category: 'azureYaml',
        message: 'Found azure.yaml file: azure.yaml',
        details: {
          fileName: 'azure.yaml',
        },
      },
      {
        id: 'bicep-uses-managed-identity-infra/main.bicep',
        category: 'bicepSecurity',
        message: 'Good practice: infra/main.bicep uses Managed Identity for Azure authentication',
        details: {
          file: 'infra/main.bicep',
          authMethod: 'ManagedIdentity',
        },
      },
      {
        id: 'bicep-uses-managed-identity-infra/modules/account/modules/project.bicep',
        category: 'bicepSecurity',
        message:
          'Good practice: infra/modules/account/modules/project.bicep uses Managed Identity for Azure authentication',
        details: {
          file: 'infra/modules/account/modules/project.bicep',
          authMethod: 'ManagedIdentity',
        },
      },
      {
        id: 'ai-model-deprecation',
        category: 'aiModel',
        message: 'Test AI model deprecation: No deprecated model references found',
        details: {
          modelsChecked: ['gpt-3.5-turbo', 'text-davinci-003'],
        },
      },
      {
        id: 'compliance-summary',
        category: 'meta',
        message: 'Compliance: 63%',
        details: {
          issueCount: 9,
          compliantCount: 15,
          totalChecks: 24,
          percentageCompliant: 63,
        },
      },
    ],
    percentage: 63,
    summary: 'Issues found - Compliance: 63%',
    categories: {
      repositoryManagement: {
        enabled: true,
        issues: [
          {
            id: 'missing-repo-topics',
            severity: 'error',
            message: 'Missing required topics: azd-template, azure-developer-cli',
            error:
              'Repository should include the following topics: azd-template, azure-developer-cli',
          },
          {
            id: 'missing-workflow-.github\\/workflows\\/azure-dev.yml',
            severity: 'error',
            message: 'Missing required GitHub workflow: azure-dev.yml',
            error: 'Missing required GitHub workflow: azure-dev.yml',
          },
          {
            id: 'devcontainer-missing-azd',
            severity: 'warning',
            message: 'Dev Container configuration might not include azd',
            error:
              'The .devcontainer configuration should include the Azure Developer CLI (azd) for a consistent development experience',
          },
          {
            id: 'readme-missing-heading-features',
            severity: 'error',
            message: 'README.md is missing required h2 heading: Features',
            error: 'README.md does not contain required h2 heading: Features',
          },
          {
            id: 'readme-missing-heading-getting-started',
            severity: 'error',
            message: 'README.md is missing required h2 heading: Getting Started',
            error: 'README.md does not contain required h2 heading: Getting Started',
          },
          {
            id: 'readme-missing-heading-resources',
            severity: 'error',
            message: 'README.md is missing required h2 heading: Resources',
            error: 'README.md does not contain required h2 heading: Resources',
          },
          {
            id: 'readme-missing-heading-guidance',
            severity: 'error',
            message: 'README.md is missing required h2 heading: Guidance',
            error: 'README.md does not contain required h2 heading: Guidance',
          },
          {
            id: 'readme-missing-architecture-diagram-heading',
            severity: 'error',
            message: 'README.md is missing required h2 heading: Architecture',
            error: 'README.md does not contain required h2 heading: Architecture',
          },
        ],
        compliant: [
          {
            id: 'repo-description',
            category: 'repositoryMetadata',
            message: 'Repository has a description',
            details: {
              description:
                'Programmatically extract data and apply schemas to unstructured documents across text-based and multi-modal content using Azure AI Foundry, Azure OpenAI, Azure AI Content Understanding, and Cosmos DB.',
            },
          },
          {
            id: 'file-README.md',
            category: 'requiredFile',
            message: 'Required file found: README.md',
            details: {
              fileName: 'README.md',
            },
          },
          {
            id: 'file-azure.yaml',
            category: 'requiredFile',
            message: 'Required file found: azure.yaml',
            details: {
              fileName: 'azure.yaml',
            },
          },
          {
            id: 'file-LICENSE',
            category: 'requiredFile',
            message: 'Required file found: LICENSE',
            details: {
              fileName: 'LICENSE',
            },
          },
          {
            id: 'file-SECURITY.md',
            category: 'requiredFile',
            message: 'Required file found: SECURITY.md',
            details: {
              fileName: 'SECURITY.md',
            },
          },
          {
            id: 'file-CONTRIBUTING.md',
            category: 'requiredFile',
            message: 'Required file found: CONTRIBUTING.md',
            details: {
              fileName: 'CONTRIBUTING.md',
            },
          },
          {
            id: 'file-CODE_OF_CONDUCT.md',
            category: 'requiredFile',
            message: 'Required file found: CODE_OF_CONDUCT.md',
            details: {
              fileName: 'CODE_OF_CONDUCT.md',
            },
          },
          {
            id: 'folder-infra',
            category: 'requiredFolder',
            message: 'Required folder found: infra/',
            details: {
              folderPath: 'infra',
              fileCount: 18,
            },
          },
          {
            id: 'folder-.github',
            category: 'requiredFolder',
            message: 'Required folder found: .github/',
            details: {
              folderPath: '.github',
              fileCount: 18,
            },
          },
          {
            id: 'issue-template',
            category: 'repositoryManagement',
            message: 'Repository has GitHub issue templates',
            details: {
              found: true,
            },
          },
        ],
        summary: '56% compliant',
        percentage: 56,
      },
      functionalRequirements: {
        enabled: true,
        issues: [],
        compliant: [],
        summary: 'No checks in this category',
        percentage: 0,
      },
      deployment: {
        enabled: true,
        issues: [
          {
            id: 'azure-yaml-missing-services',
            severity: 'error',
            message: 'No "services:" defined in azure.yaml',
            error: 'File azure.yaml does not define required "services:" section',
          },
        ],
        compliant: [
          {
            id: 'bicep-files-exist',
            category: 'bicepFiles',
            message: 'Bicep files found in infra/ directory: 9 files',
            details: {
              count: 9,
              files: [
                'infra/main.bicep',
                'infra/modules/account/main.bicep',
                'infra/modules/account/modules/dependencies.bicep',
                'infra/modules/account/modules/keyVaultExport.bicep',
                'infra/modules/account/modules/project.bicep',
                'infra/modules/container-registry.bicep',
                'infra/modules/key-vault.bicep',
                'infra/modules/log-analytics-workspace.bicep',
                'infra/modules/managed-identity.bicep',
              ],
            },
          },
          {
            id: 'azure-yaml-exists',
            category: 'azureYaml',
            message: 'Found azure.yaml file: azure.yaml',
            details: {
              fileName: 'azure.yaml',
            },
          },
        ],
        summary: '67% compliant',
        percentage: 67,
      },
      security: {
        enabled: true,
        issues: [],
        compliant: [
          {
            id: 'bicep-uses-managed-identity-infra/main.bicep',
            category: 'bicepSecurity',
            message:
              'Good practice: infra/main.bicep uses Managed Identity for Azure authentication',
            details: {
              file: 'infra/main.bicep',
              authMethod: 'ManagedIdentity',
            },
          },
          {
            id: 'bicep-uses-managed-identity-infra/modules/account/modules/project.bicep',
            category: 'bicepSecurity',
            message:
              'Good practice: infra/modules/account/modules/project.bicep uses Managed Identity for Azure authentication',
            details: {
              file: 'infra/modules/account/modules/project.bicep',
              authMethod: 'ManagedIdentity',
            },
          },
        ],
        summary: '100% compliant',
        percentage: 100,
      },
      testing: {
        enabled: false,
        issues: [],
        compliant: [],
        summary: 'No checks in this category',
        percentage: 0,
      },
      ai: {
        enabled: true,
        issues: [],
        compliant: [
          {
            id: 'ai-model-deprecation',
            category: 'aiModel',
            message: 'Test AI model deprecation: No deprecated model references found',
            details: {
              modelsChecked: ['gpt-3.5-turbo', 'text-davinci-003'],
            },
          },
        ],
        summary: '100% compliant',
        percentage: 100,
      },
    },
    globalChecks: [
      {
        id: 'ai-model-deprecation',
        status: 'passed',
        details: {
          modelsChecked: ['gpt-3.5-turbo', 'text-davinci-003'],
        },
      },
    ],
  },
};
