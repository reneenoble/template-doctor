window.reportData = {
  "repoUrl": "https://github.com/Azure-Samples/signalr-ai-streaming",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:02:12.602Z",
  "compliance": {
    "issues": [
      {
        "id": "missing-repo-description",
        "severity": "error",
        "message": "Repository description is missing",
        "error": "The repository should have a clear description explaining the purpose and technologies used"
      },
      {
        "id": "missing-repo-topics",
        "severity": "error",
        "message": "Missing required topics: azd-template, azure-developer-cli",
        "error": "Repository should include the following topics: azd-template, azure-developer-cli"
      },
      {
        "id": "missing-LICENSE",
        "severity": "error",
        "message": "Missing required file: LICENSE",
        "error": "File LICENSE not found in repository"
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
        "id": "missing-workflow-.github\\/workflows\\/azure-dev.yml",
        "severity": "error",
        "message": "Missing required GitHub workflow: azure-dev.yml",
        "error": "Missing required GitHub workflow: azure-dev.yml"
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
        "id": "file-SECURITY.md",
        "category": "requiredFile",
        "message": "Required file found: SECURITY.md",
        "details": {
          "fileName": "SECURITY.md"
        }
      },
      {
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 14
        }
      },
      {
        "id": "folder-.github",
        "category": "requiredFolder",
        "message": "Required folder found: .github/",
        "details": {
          "folderPath": ".github",
          "fileCount": 5
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
        "id": "readme-heading-features",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Features",
        "details": {
          "heading": "Features",
          "level": 2
        }
      },
      {
        "id": "readme-heading-getting-started",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Getting Started",
        "details": {
          "heading": "Getting Started",
          "level": 2
        }
      },
      {
        "id": "readme-heading-resources",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Resources",
        "details": {
          "heading": "Resources",
          "level": 2
        }
      },
      {
        "id": "readme-heading-guidance",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Guidance",
        "details": {
          "heading": "Guidance",
          "level": 2
        }
      },
      {
        "id": "bicep-files-exist",
        "category": "bicepFiles",
        "message": "Bicep files found in infra/ directory: 12 files",
        "details": {
          "count": 12,
          "files": [
            "infra/app/AIStreaming.bicep",
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/security/registry-access.bicep",
            "infra/core/security/role.bicep",
            "infra/core/signalr/siganlr.bicep",
            "infra/main.bicep",
            "infra/modules/fetch-container-image.bicep",
            "infra/shared/apps-env.bicep",
            "infra/shared/dashboard-web.bicep",
            "infra/shared/keyvault.bicep",
            "infra/shared/monitoring.bicep",
            "infra/shared/registry.bicep"
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
        "id": "bicep-uses-managed-identity-infra/app/AIStreaming.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/app/AIStreaming.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/app/AIStreaming.bicep",
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
        "message": "Compliance: 70%",
        "details": {
          "issueCount": 7,
          "compliantCount": 16,
          "totalChecks": 23,
          "percentageCompliant": 70
        }
      }
    ],
    "percentage": 70,
    "summary": "Issues found - Compliance: 70%",
    "categories": {
      "repositoryManagement": {
        "enabled": true,
        "issues": [
          {
            "id": "missing-repo-description",
            "severity": "error",
            "message": "Repository description is missing",
            "error": "The repository should have a clear description explaining the purpose and technologies used"
          },
          {
            "id": "missing-repo-topics",
            "severity": "error",
            "message": "Missing required topics: azd-template, azure-developer-cli",
            "error": "Repository should include the following topics: azd-template, azure-developer-cli"
          },
          {
            "id": "missing-LICENSE",
            "severity": "error",
            "message": "Missing required file: LICENSE",
            "error": "File LICENSE not found in repository"
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
            "id": "missing-workflow-.github\\/workflows\\/azure-dev.yml",
            "severity": "error",
            "message": "Missing required GitHub workflow: azure-dev.yml",
            "error": "Missing required GitHub workflow: azure-dev.yml"
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
            "id": "file-SECURITY.md",
            "category": "requiredFile",
            "message": "Required file found: SECURITY.md",
            "details": {
              "fileName": "SECURITY.md"
            }
          },
          {
            "id": "folder-infra",
            "category": "requiredFolder",
            "message": "Required folder found: infra/",
            "details": {
              "folderPath": "infra",
              "fileCount": 14
            }
          },
          {
            "id": "folder-.github",
            "category": "requiredFolder",
            "message": "Required folder found: .github/",
            "details": {
              "folderPath": ".github",
              "fileCount": 5
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
            "id": "readme-heading-features",
            "category": "readmeHeading",
            "message": "README.md contains required h2 heading: Features",
            "details": {
              "heading": "Features",
              "level": 2
            }
          },
          {
            "id": "readme-heading-getting-started",
            "category": "readmeHeading",
            "message": "README.md contains required h2 heading: Getting Started",
            "details": {
              "heading": "Getting Started",
              "level": 2
            }
          },
          {
            "id": "readme-heading-resources",
            "category": "readmeHeading",
            "message": "README.md contains required h2 heading: Resources",
            "details": {
              "heading": "Resources",
              "level": 2
            }
          },
          {
            "id": "readme-heading-guidance",
            "category": "readmeHeading",
            "message": "README.md contains required h2 heading: Guidance",
            "details": {
              "heading": "Guidance",
              "level": 2
            }
          }
        ],
        "summary": "61% compliant",
        "percentage": 61
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
            "message": "Bicep files found in infra/ directory: 12 files",
            "details": {
              "count": 12,
              "files": [
                "infra/app/AIStreaming.bicep",
                "infra/core/ai/cognitiveservices.bicep",
                "infra/core/security/registry-access.bicep",
                "infra/core/security/role.bicep",
                "infra/core/signalr/siganlr.bicep",
                "infra/main.bicep",
                "infra/modules/fetch-container-image.bicep",
                "infra/shared/apps-env.bicep",
                "infra/shared/dashboard-web.bicep",
                "infra/shared/keyvault.bicep",
                "infra/shared/monitoring.bicep",
                "infra/shared/registry.bicep"
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
            "id": "bicep-uses-managed-identity-infra/app/AIStreaming.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/app/AIStreaming.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/app/AIStreaming.bicep",
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
