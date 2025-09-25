window.reportData = {
  "repoUrl": "https://github.com/microsoft/Multi-Agent-Custom-Automation-Engine-Solution-Accelerator",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:05:20.108Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-repo-topics",
        "severity": "error",
        "message": "Missing required topics: azd-template, azure-developer-cli",
        "error": "Repository should include the following topics: azd-template, azure-developer-cli"
      },
      {
        "id": "readme-missing-heading-features",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Features",
        "error": "README.md does not contain required h2 heading: Features"
      },
      {
        "id": "readme-missing-heading-getting-started",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Getting Started",
        "error": "README.md does not contain required h2 heading: Getting Started"
      },
      {
        "id": "readme-missing-heading-resources",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Resources",
        "error": "README.md does not contain required h2 heading: Resources"
      },
      {
        "id": "readme-missing-heading-guidance",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Guidance",
        "error": "README.md does not contain required h2 heading: Guidance"
      },
      {
        "id": "readme-missing-architecture-diagram-heading",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Architecture",
        "error": "README.md does not contain required h2 heading: Architecture"
      },
      {
        "id": "azure-yaml-missing-services",
        "severity": "error",
        "message": "No \"services:\" defined in azure.yaml",
        "error": "File azure.yaml does not define required \"services:\" section"
      }
    ],
    "compliant": [
      {
        "id": "repo-description",
        "category": "repositoryMetadata",
        "message": "Repository has a description",
        "details": {
          "description": "The Multi-Agent Custom Automation Engine Solution Accelerator is an AI-driven system that manages a group of AI agents to accomplish tasks based on user input. Powered by Semantic Kernel, Azure Foundry, Azure Cosmos DB, and infrastructure services, it provides a reference application, allowing you to hit the ground running."
        }
      },
      {
        "id": "file-README.md",
        "category": "requiredFile",
        "message": "Required file found: README.md",
        "details": {
          "fileName": "README.md"
        }
      },
      {
        "id": "file-azure.yaml",
        "category": "requiredFile",
        "message": "Required file found: azure.yaml",
        "details": {
          "fileName": "azure.yaml"
        }
      },
      {
        "id": "file-LICENSE",
        "category": "requiredFile",
        "message": "Required file found: LICENSE",
        "details": {
          "fileName": "LICENSE"
        }
      },
      {
        "id": "file-SECURITY.md",
        "category": "requiredFile",
        "message": "Required file found: SECURITY.md",
        "details": {
          "fileName": "SECURITY.md"
        }
      },
      {
        "id": "file-CONTRIBUTING.md",
        "category": "requiredFile",
        "message": "Required file found: CONTRIBUTING.md",
        "details": {
          "fileName": "CONTRIBUTING.md"
        }
      },
      {
        "id": "file-CODE_OF_CONDUCT.md",
        "category": "requiredFile",
        "message": "Required file found: CODE_OF_CONDUCT.md",
        "details": {
          "fileName": "CODE_OF_CONDUCT.md"
        }
      },
      {
        "id": "workflow-.github/workflows/azure-dev.yml",
        "category": "requiredWorkflow",
        "message": "Required workflow file found: .github/workflows/azure-dev.yml",
        "details": {
          "fileName": ".github/workflows/azure-dev.yml",
          "patternMatched": ".github\\/workflows\\/azure-dev.yml"
        }
      },
      {
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 53
        }
      },
      {
        "id": "folder-.github",
        "category": "requiredFolder",
        "message": "Required folder found: .github/",
        "details": {
          "folderPath": ".github",
          "fileCount": 25
        }
      },
      {
        "id": "issue-template",
        "category": "repositoryManagement",
        "message": "Repository has GitHub issue templates",
        "details": {
          "found": true
        }
      },
      {
        "id": "devcontainer-azd",
        "category": "repositoryManagement",
        "message": "Dev Container includes Azure Developer CLI (azd)",
        "details": {
          "file": ".devcontainer/devcontainer.json"
        }
      },
      {
        "id": "bicep-files-exist",
        "category": "bicepFiles",
        "message": "Bicep files found in infra/ directory: 24 files",
        "details": {
          "count": 24,
          "files": [
            "infra/main.bicep",
            "infra/main_custom.bicep",
            "infra/modules/ai-project.bicep",
            "infra/modules/ai-services-deployments.bicep",
            "infra/modules/aifp-connections.bicep",
            "infra/modules/web-sites.bicep",
            "infra/modules/web-sites.config.bicep",
            "infra/old/00-older/deploy_ai_foundry.bicep",
            "infra/old/00-older/deploy_keyvault.bicep",
            "infra/old/00-older/deploy_managed_identity.bicep",
            "infra/old/00-older/macae-dev.bicep",
            "infra/old/00-older/macae.bicep",
            "infra/old/00-older/main.bicep",
            "infra/old/00-older/main2.bicep",
            "infra/old/00-older/resources.bicep",
            "infra/old/08-2025/main.bicep",
            "infra/old/08-2025/modules/account/main.bicep",
            "infra/old/08-2025/modules/account/modules/dependencies.bicep",
            "infra/old/08-2025/modules/account/modules/keyVaultExport.bicep",
            "infra/old/08-2025/modules/account/modules/project.bicep",
            "infra/old/08-2025/modules/ai-hub.bicep",
            "infra/old/08-2025/modules/container-app-environment.bicep",
            "infra/old/08-2025/modules/fetch-container-image.bicep",
            "infra/old/08-2025/modules/role.bicep"
          ]
        }
      },
      {
        "id": "azure-yaml-exists",
        "category": "azureYaml",
        "message": "Found azure.yaml file: azure.yaml",
        "details": {
          "fileName": "azure.yaml"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/main.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/main.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/main.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/main_custom.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/main_custom.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/main_custom.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/modules/ai-project.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/modules/ai-project.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/modules/ai-project.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/old/00-older/deploy_ai_foundry.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/old/00-older/deploy_ai_foundry.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/old/00-older/deploy_ai_foundry.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/old/00-older/main.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/old/00-older/main.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/old/00-older/main.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/old/08-2025/main.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/old/08-2025/main.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/old/08-2025/main.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/old/08-2025/modules/account/modules/project.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/old/08-2025/modules/account/modules/project.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/old/08-2025/modules/account/modules/project.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "ai-model-deprecation",
        "category": "aiModel",
        "message": "Test AI model deprecation: No deprecated model references found",
        "details": {
          "modelsChecked": [
            "gpt-3.5-turbo",
            "text-davinci-003"
          ]
        }
      },
      {
        "id": "compliance-summary",
        "category": "meta",
        "message": "Compliance: 76%",
        "details": {
          "issueCount": 7,
          "compliantCount": 22,
          "totalChecks": 29,
          "percentageCompliant": 76
        }
      }
    ],
    "percentage": 76,
    "summary": "Issues found - Compliance: 76%",
    "categories": {
      "repositoryManagement": {
        "enabled": true,
        "issues": [
          {
            "id": "missing-repo-topics",
            "severity": "error",
            "message": "Missing required topics: azd-template, azure-developer-cli",
            "error": "Repository should include the following topics: azd-template, azure-developer-cli"
          },
          {
            "id": "readme-missing-heading-features",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Features",
            "error": "README.md does not contain required h2 heading: Features"
          },
          {
            "id": "readme-missing-heading-getting-started",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Getting Started",
            "error": "README.md does not contain required h2 heading: Getting Started"
          },
          {
            "id": "readme-missing-heading-resources",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Resources",
            "error": "README.md does not contain required h2 heading: Resources"
          },
          {
            "id": "readme-missing-heading-guidance",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Guidance",
            "error": "README.md does not contain required h2 heading: Guidance"
          },
          {
            "id": "readme-missing-architecture-diagram-heading",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Architecture",
            "error": "README.md does not contain required h2 heading: Architecture"
          }
        ],
        "compliant": [
          {
            "id": "repo-description",
            "category": "repositoryMetadata",
            "message": "Repository has a description",
            "details": {
              "description": "The Multi-Agent Custom Automation Engine Solution Accelerator is an AI-driven system that manages a group of AI agents to accomplish tasks based on user input. Powered by Semantic Kernel, Azure Foundry, Azure Cosmos DB, and infrastructure services, it provides a reference application, allowing you to hit the ground running."
            }
          },
          {
            "id": "file-README.md",
            "category": "requiredFile",
            "message": "Required file found: README.md",
            "details": {
              "fileName": "README.md"
            }
          },
          {
            "id": "file-azure.yaml",
            "category": "requiredFile",
            "message": "Required file found: azure.yaml",
            "details": {
              "fileName": "azure.yaml"
            }
          },
          {
            "id": "file-LICENSE",
            "category": "requiredFile",
            "message": "Required file found: LICENSE",
            "details": {
              "fileName": "LICENSE"
            }
          },
          {
            "id": "file-SECURITY.md",
            "category": "requiredFile",
            "message": "Required file found: SECURITY.md",
            "details": {
              "fileName": "SECURITY.md"
            }
          },
          {
            "id": "file-CONTRIBUTING.md",
            "category": "requiredFile",
            "message": "Required file found: CONTRIBUTING.md",
            "details": {
              "fileName": "CONTRIBUTING.md"
            }
          },
          {
            "id": "file-CODE_OF_CONDUCT.md",
            "category": "requiredFile",
            "message": "Required file found: CODE_OF_CONDUCT.md",
            "details": {
              "fileName": "CODE_OF_CONDUCT.md"
            }
          },
          {
            "id": "workflow-.github/workflows/azure-dev.yml",
            "category": "requiredWorkflow",
            "message": "Required workflow file found: .github/workflows/azure-dev.yml",
            "details": {
              "fileName": ".github/workflows/azure-dev.yml",
              "patternMatched": ".github\\/workflows\\/azure-dev.yml"
            }
          },
          {
            "id": "folder-infra",
            "category": "requiredFolder",
            "message": "Required folder found: infra/",
            "details": {
              "folderPath": "infra",
              "fileCount": 53
            }
          },
          {
            "id": "folder-.github",
            "category": "requiredFolder",
            "message": "Required folder found: .github/",
            "details": {
              "folderPath": ".github",
              "fileCount": 25
            }
          },
          {
            "id": "issue-template",
            "category": "repositoryManagement",
            "message": "Repository has GitHub issue templates",
            "details": {
              "found": true
            }
          },
          {
            "id": "devcontainer-azd",
            "category": "repositoryManagement",
            "message": "Dev Container includes Azure Developer CLI (azd)",
            "details": {
              "file": ".devcontainer/devcontainer.json"
            }
          }
        ],
        "summary": "67% compliant",
        "percentage": 67
      },
      "functionalRequirements": {
        "enabled": true,
        "issues": [],
        "compliant": [],
        "summary": "No checks in this category",
        "percentage": 0
      },
      "deployment": {
        "enabled": true,
        "issues": [
          {
            "id": "azure-yaml-missing-services",
            "severity": "error",
            "message": "No \"services:\" defined in azure.yaml",
            "error": "File azure.yaml does not define required \"services:\" section"
          }
        ],
        "compliant": [
          {
            "id": "bicep-files-exist",
            "category": "bicepFiles",
            "message": "Bicep files found in infra/ directory: 24 files",
            "details": {
              "count": 24,
              "files": [
                "infra/main.bicep",
                "infra/main_custom.bicep",
                "infra/modules/ai-project.bicep",
                "infra/modules/ai-services-deployments.bicep",
                "infra/modules/aifp-connections.bicep",
                "infra/modules/web-sites.bicep",
                "infra/modules/web-sites.config.bicep",
                "infra/old/00-older/deploy_ai_foundry.bicep",
                "infra/old/00-older/deploy_keyvault.bicep",
                "infra/old/00-older/deploy_managed_identity.bicep",
                "infra/old/00-older/macae-dev.bicep",
                "infra/old/00-older/macae.bicep",
                "infra/old/00-older/main.bicep",
                "infra/old/00-older/main2.bicep",
                "infra/old/00-older/resources.bicep",
                "infra/old/08-2025/main.bicep",
                "infra/old/08-2025/modules/account/main.bicep",
                "infra/old/08-2025/modules/account/modules/dependencies.bicep",
                "infra/old/08-2025/modules/account/modules/keyVaultExport.bicep",
                "infra/old/08-2025/modules/account/modules/project.bicep",
                "infra/old/08-2025/modules/ai-hub.bicep",
                "infra/old/08-2025/modules/container-app-environment.bicep",
                "infra/old/08-2025/modules/fetch-container-image.bicep",
                "infra/old/08-2025/modules/role.bicep"
              ]
            }
          },
          {
            "id": "azure-yaml-exists",
            "category": "azureYaml",
            "message": "Found azure.yaml file: azure.yaml",
            "details": {
              "fileName": "azure.yaml"
            }
          }
        ],
        "summary": "67% compliant",
        "percentage": 67
      },
      "security": {
        "enabled": true,
        "issues": [],
        "compliant": [
          {
            "id": "bicep-uses-managed-identity-infra/main.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/main.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/main.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/main_custom.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/main_custom.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/main_custom.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/modules/ai-project.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/modules/ai-project.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/modules/ai-project.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/old/00-older/deploy_ai_foundry.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/old/00-older/deploy_ai_foundry.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/old/00-older/deploy_ai_foundry.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/old/00-older/main.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/old/00-older/main.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/old/00-older/main.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/old/08-2025/main.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/old/08-2025/main.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/old/08-2025/main.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/old/08-2025/modules/account/modules/project.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/old/08-2025/modules/account/modules/project.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/old/08-2025/modules/account/modules/project.bicep",
              "authMethod": "ManagedIdentity"
            }
          }
        ],
        "summary": "100% compliant",
        "percentage": 100
      },
      "testing": {
        "enabled": false,
        "issues": [],
        "compliant": [],
        "summary": "No checks in this category",
        "percentage": 0
      },
      "ai": {
        "enabled": true,
        "issues": [],
        "compliant": [
          {
            "id": "ai-model-deprecation",
            "category": "aiModel",
            "message": "Test AI model deprecation: No deprecated model references found",
            "details": {
              "modelsChecked": [
                "gpt-3.5-turbo",
                "text-davinci-003"
              ]
            }
          }
        ],
        "summary": "100% compliant",
        "percentage": 100
      }
    },
    "globalChecks": [
      {
        "id": "ai-model-deprecation",
        "status": "passed",
        "details": {
          "modelsChecked": [
            "gpt-3.5-turbo",
            "text-davinci-003"
          ]
        }
      }
    ]
  }
};
