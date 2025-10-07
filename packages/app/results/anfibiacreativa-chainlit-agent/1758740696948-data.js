window.reportData = {
  repoUrl: 'https://github.com/zhenbzha/chainlit-agent',
  ruleSet: 'dod',
  timestamp: '2025-09-24T19:04:56.946Z',
  compliance: {
    issues: [
      {
        id: 'missing-repo-description',
        severity: 'error',
        message: 'Repository description is missing',
        error:
          'The repository should have a clear description explaining the purpose and technologies used',
      },
      {
        id: 'missing-repo-topics',
        severity: 'error',
        message: 'Missing required topics: azd-template, azure-developer-cli',
        error: 'Repository should include the following topics: azd-template, azure-developer-cli',
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
        id: 'workflow-.github/workflows/azure-dev.yml',
        category: 'requiredWorkflow',
        message: 'Required workflow file found: .github/workflows/azure-dev.yml',
        details: {
          fileName: '.github/workflows/azure-dev.yml',
          patternMatched: '.github\\/workflows\\/azure-dev.yml',
        },
      },
      {
        id: 'folder-infra',
        category: 'requiredFolder',
        message: 'Required folder found: infra/',
        details: {
          folderPath: 'infra',
          fileCount: 31,
        },
      },
      {
        id: 'folder-.github',
        category: 'requiredFolder',
        message: 'Required folder found: .github/',
        details: {
          folderPath: '.github',
          fileCount: 4,
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
        id: 'devcontainer-azd',
        category: 'repositoryManagement',
        message: 'Dev Container includes Azure Developer CLI (azd)',
        details: {
          file: '.devcontainer/devcontainer.json',
        },
      },
      {
        id: 'readme-heading-features',
        category: 'readmeHeading',
        message: 'README.md contains required h2 heading: Features',
        details: {
          heading: 'Features',
          level: 2,
        },
      },
      {
        id: 'readme-heading-getting-started',
        category: 'readmeHeading',
        message: 'README.md contains required h2 heading: Getting Started',
        details: {
          heading: 'Getting Started',
          level: 2,
        },
      },
      {
        id: 'readme-heading-resources',
        category: 'readmeHeading',
        message: 'README.md contains required h2 heading: Resources',
        details: {
          heading: 'Resources',
          level: 2,
        },
      },
      {
        id: 'readme-heading-guidance',
        category: 'readmeHeading',
        message: 'README.md contains required h2 heading: Guidance',
        details: {
          heading: 'Guidance',
          level: 2,
        },
      },
      {
        id: 'bicep-files-exist',
        category: 'bicepFiles',
        message: 'Bicep files found in infra/ directory: 25 files',
        details: {
          count: 25,
          files: [
            'infra/app/api.bicep',
            'infra/app/web.bicep',
            'infra/core/ai/cognitiveservices.bicep',
            'infra/core/ai/hub-dependencies.bicep',
            'infra/core/ai/hub.bicep',
            'infra/core/ai/project.bicep',
            'infra/core/host/ai-environment.bicep',
            'infra/core/host/container-app-upsert.bicep',
            'infra/core/host/container-app.bicep',
            'infra/core/host/container-apps-environment.bicep',
            'infra/core/host/container-apps.bicep',
            'infra/core/host/container-registry.bicep',
            'infra/core/monitor/applicationinsights-dashboard.bicep',
            'infra/core/monitor/applicationinsights.bicep',
            'infra/core/monitor/loganalytics.bicep',
            'infra/core/monitor/monitoring.bicep',
            'infra/core/search/search-services.bicep',
            'infra/core/security/keyvault-access.bicep',
            'infra/core/security/keyvault-secret.bicep',
            'infra/core/security/keyvault.bicep',
            'infra/core/security/managed-identity.bicep',
            'infra/core/security/registry-access.bicep',
            'infra/core/security/role.bicep',
            'infra/core/storage/storage-account.bicep',
            'infra/main.bicep',
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
        id: 'azure-yaml-services-defined',
        category: 'azureYaml',
        message: '"services:" section found in azure.yaml',
        details: {
          fileName: 'azure.yaml',
        },
      },
      {
        id: 'bicep-uses-managed-identity-infra/core/ai/hub.bicep',
        category: 'bicepSecurity',
        message:
          'Good practice: infra/core/ai/hub.bicep uses Managed Identity for Azure authentication',
        details: {
          file: 'infra/core/ai/hub.bicep',
          authMethod: 'ManagedIdentity',
        },
      },
      {
        id: 'bicep-uses-managed-identity-infra/core/ai/project.bicep',
        category: 'bicepSecurity',
        message:
          'Good practice: infra/core/ai/project.bicep uses Managed Identity for Azure authentication',
        details: {
          file: 'infra/core/ai/project.bicep',
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
        message: 'Compliance: 88%',
        details: {
          issueCount: 3,
          compliantCount: 21,
          totalChecks: 24,
          percentageCompliant: 88,
        },
      },
    ],
    percentage: 88,
    summary: 'Issues found - Compliance: 88%',
    categories: {
      repositoryManagement: {
        enabled: true,
        issues: [
          {
            id: 'missing-repo-description',
            severity: 'error',
            message: 'Repository description is missing',
            error:
              'The repository should have a clear description explaining the purpose and technologies used',
          },
          {
            id: 'missing-repo-topics',
            severity: 'error',
            message: 'Missing required topics: azd-template, azure-developer-cli',
            error:
              'Repository should include the following topics: azd-template, azure-developer-cli',
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
            id: 'workflow-.github/workflows/azure-dev.yml',
            category: 'requiredWorkflow',
            message: 'Required workflow file found: .github/workflows/azure-dev.yml',
            details: {
              fileName: '.github/workflows/azure-dev.yml',
              patternMatched: '.github\\/workflows\\/azure-dev.yml',
            },
          },
          {
            id: 'folder-infra',
            category: 'requiredFolder',
            message: 'Required folder found: infra/',
            details: {
              folderPath: 'infra',
              fileCount: 31,
            },
          },
          {
            id: 'folder-.github',
            category: 'requiredFolder',
            message: 'Required folder found: .github/',
            details: {
              folderPath: '.github',
              fileCount: 4,
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
            id: 'devcontainer-azd',
            category: 'repositoryManagement',
            message: 'Dev Container includes Azure Developer CLI (azd)',
            details: {
              file: '.devcontainer/devcontainer.json',
            },
          },
          {
            id: 'readme-heading-features',
            category: 'readmeHeading',
            message: 'README.md contains required h2 heading: Features',
            details: {
              heading: 'Features',
              level: 2,
            },
          },
          {
            id: 'readme-heading-getting-started',
            category: 'readmeHeading',
            message: 'README.md contains required h2 heading: Getting Started',
            details: {
              heading: 'Getting Started',
              level: 2,
            },
          },
          {
            id: 'readme-heading-resources',
            category: 'readmeHeading',
            message: 'README.md contains required h2 heading: Resources',
            details: {
              heading: 'Resources',
              level: 2,
            },
          },
          {
            id: 'readme-heading-guidance',
            category: 'readmeHeading',
            message: 'README.md contains required h2 heading: Guidance',
            details: {
              heading: 'Guidance',
              level: 2,
            },
          },
        ],
        summary: '83% compliant',
        percentage: 83,
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
        issues: [],
        compliant: [
          {
            id: 'bicep-files-exist',
            category: 'bicepFiles',
            message: 'Bicep files found in infra/ directory: 25 files',
            details: {
              count: 25,
              files: [
                'infra/app/api.bicep',
                'infra/app/web.bicep',
                'infra/core/ai/cognitiveservices.bicep',
                'infra/core/ai/hub-dependencies.bicep',
                'infra/core/ai/hub.bicep',
                'infra/core/ai/project.bicep',
                'infra/core/host/ai-environment.bicep',
                'infra/core/host/container-app-upsert.bicep',
                'infra/core/host/container-app.bicep',
                'infra/core/host/container-apps-environment.bicep',
                'infra/core/host/container-apps.bicep',
                'infra/core/host/container-registry.bicep',
                'infra/core/monitor/applicationinsights-dashboard.bicep',
                'infra/core/monitor/applicationinsights.bicep',
                'infra/core/monitor/loganalytics.bicep',
                'infra/core/monitor/monitoring.bicep',
                'infra/core/search/search-services.bicep',
                'infra/core/security/keyvault-access.bicep',
                'infra/core/security/keyvault-secret.bicep',
                'infra/core/security/keyvault.bicep',
                'infra/core/security/managed-identity.bicep',
                'infra/core/security/registry-access.bicep',
                'infra/core/security/role.bicep',
                'infra/core/storage/storage-account.bicep',
                'infra/main.bicep',
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
            id: 'azure-yaml-services-defined',
            category: 'azureYaml',
            message: '"services:" section found in azure.yaml',
            details: {
              fileName: 'azure.yaml',
            },
          },
        ],
        summary: '100% compliant',
        percentage: 100,
      },
      security: {
        enabled: true,
        issues: [],
        compliant: [
          {
            id: 'bicep-uses-managed-identity-infra/core/ai/hub.bicep',
            category: 'bicepSecurity',
            message:
              'Good practice: infra/core/ai/hub.bicep uses Managed Identity for Azure authentication',
            details: {
              file: 'infra/core/ai/hub.bicep',
              authMethod: 'ManagedIdentity',
            },
          },
          {
            id: 'bicep-uses-managed-identity-infra/core/ai/project.bicep',
            category: 'bicepSecurity',
            message:
              'Good practice: infra/core/ai/project.bicep uses Managed Identity for Azure authentication',
            details: {
              file: 'infra/core/ai/project.bicep',
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
