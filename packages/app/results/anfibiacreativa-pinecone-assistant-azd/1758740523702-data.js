window.reportData = {
  "repoUrl": "https://github.com/pinecone-io/pinecone-assistant-azd",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:02:03.699Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-repo-topics",
        "severity": "error",
        "message": "Missing required topics: azd-template, azure-developer-cli",
        "error": "Repository should include the following topics: azd-template, azure-developer-cli"
      },
      {
        "id": "missing-SECURITY.md",
        "severity": "error",
        "message": "Missing required file: SECURITY.md",
        "error": "File SECURITY.md not found in repository"
      },
      {
        "id": "missing-CONTRIBUTING.md",
        "severity": "error",
        "message": "Missing required file: CONTRIBUTING.md",
        "error": "File CONTRIBUTING.md not found in repository"
      },
      {
        "id": "missing-CODE_OF_CONDUCT.md",
        "severity": "error",
        "message": "Missing required file: CODE_OF_CONDUCT.md",
        "error": "File CODE_OF_CONDUCT.md not found in repository"
      },
      {
        "id": "missing-issue-template",
        "severity": "warning",
        "message": "Missing GitHub issue templates",
        "error": "Repository should include issue templates to standardize bug reports and feature requests"
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
          "description": "An Azure Developer template to launch a new Pinecone Assistant using Azure blob storage as the source."
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
          "fileCount": 12
        }
      },
      {
        "id": "folder-.github",
        "category": "requiredFolder",
        "message": "Required folder found: .github/",
        "details": {
          "folderPath": ".github",
          "fileCount": 1
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
        "message": "Bicep files found in infra/ directory: 10 files",
        "details": {
          "count": 10,
          "files": [
            "infra/cdn/cdn.bicep",
            "infra/containers/container-app-environment.bicep",
            "infra/containers/container-app.bicep",
            "infra/containers/container-registry.bicep",
            "infra/insights/application-insights.bicep",
            "infra/insights/log-analytics-workspace.bicep",
            "infra/main.bicep",
            "infra/security/keyvault.bicep",
            "infra/security/user-assigned-identity.bicep",
            "infra/web-app.bicep"
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
        "id": "azure-yaml-services-defined",
        "category": "azureYaml",
        "message": "\"services:\" section found in azure.yaml",
        "details": {
          "fileName": "azure.yaml"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/containers/container-app.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/containers/container-app.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/containers/container-app.bicep",
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
        "message": "Compliance: 57%",
        "details": {
          "issueCount": 10,
          "compliantCount": 13,
          "totalChecks": 23,
          "percentageCompliant": 57
        }
      }
    ],
    "percentage": 57,
    "summary": "Issues found - Compliance: 57%",
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
            "id": "missing-SECURITY.md",
            "severity": "error",
            "message": "Missing required file: SECURITY.md",
            "error": "File SECURITY.md not found in repository"
          },
          {
            "id": "missing-CONTRIBUTING.md",
            "severity": "error",
            "message": "Missing required file: CONTRIBUTING.md",
            "error": "File CONTRIBUTING.md not found in repository"
          },
          {
            "id": "missing-CODE_OF_CONDUCT.md",
            "severity": "error",
            "message": "Missing required file: CODE_OF_CONDUCT.md",
            "error": "File CODE_OF_CONDUCT.md not found in repository"
          },
          {
            "id": "missing-issue-template",
            "severity": "warning",
            "message": "Missing GitHub issue templates",
            "error": "Repository should include issue templates to standardize bug reports and feature requests"
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
              "description": "An Azure Developer template to launch a new Pinecone Assistant using Azure blob storage as the source."
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
              "fileCount": 12
            }
          },
          {
            "id": "folder-.github",
            "category": "requiredFolder",
            "message": "Required folder found: .github/",
            "details": {
              "folderPath": ".github",
              "fileCount": 1
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
        "summary": "44% compliant",
        "percentage": 44
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
        "issues": [],
        "compliant": [
          {
            "id": "bicep-files-exist",
            "category": "bicepFiles",
            "message": "Bicep files found in infra/ directory: 10 files",
            "details": {
              "count": 10,
              "files": [
                "infra/cdn/cdn.bicep",
                "infra/containers/container-app-environment.bicep",
                "infra/containers/container-app.bicep",
                "infra/containers/container-registry.bicep",
                "infra/insights/application-insights.bicep",
                "infra/insights/log-analytics-workspace.bicep",
                "infra/main.bicep",
                "infra/security/keyvault.bicep",
                "infra/security/user-assigned-identity.bicep",
                "infra/web-app.bicep"
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
            "id": "azure-yaml-services-defined",
            "category": "azureYaml",
            "message": "\"services:\" section found in azure.yaml",
            "details": {
              "fileName": "azure.yaml"
            }
          }
        ],
        "summary": "100% compliant",
        "percentage": 100
      },
      "security": {
        "enabled": true,
        "issues": [],
        "compliant": [
          {
            "id": "bicep-uses-managed-identity-infra/containers/container-app.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/containers/container-app.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/containers/container-app.bicep",
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
