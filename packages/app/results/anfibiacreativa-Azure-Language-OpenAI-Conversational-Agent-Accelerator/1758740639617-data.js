window.reportData = {
  "repoUrl": "https://github.com/Azure-Samples/Azure-Language-OpenAI-Conversational-Agent-Accelerator",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:03:59.615Z",
  "compliance": {
    "issues": [
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
          "description": "A solution accelerator project harnessing the capabilities of Azure AI Language to augment an existing Azure OpenAI RAG chat app. Utilize Conversational Language Understanding (CLU) and Custom Question Answering (CQA) to dynamically improve a RAG chat experience."
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
          "fileCount": 4
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
        "message": "Bicep files found in infra/ directory: 7 files",
        "details": {
          "count": 7,
          "files": [
            "infra/main.bicep",
            "infra/resources/ai_foundry.bicep",
            "infra/resources/container_instance.bicep",
            "infra/resources/managed_identity.bicep",
            "infra/resources/role_assignments.bicep",
            "infra/resources/search_service.bicep",
            "infra/resources/storage_account.bicep"
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
        "id": "bicep-uses-managed-identity-infra/resources/ai_foundry.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/resources/ai_foundry.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/resources/ai_foundry.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/resources/container_instance.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/resources/container_instance.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/resources/container_instance.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/resources/search_service.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/resources/search_service.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/resources/search_service.bicep",
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
        "message": "Compliance: 88%",
        "details": {
          "issueCount": 3,
          "compliantCount": 22,
          "totalChecks": 25,
          "percentageCompliant": 88
        }
      }
    ],
    "percentage": 88,
    "summary": "Issues found - Compliance: 88%",
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
            "id": "missing-LICENSE",
            "severity": "error",
            "message": "Missing required file: LICENSE",
            "error": "File LICENSE not found in repository"
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
              "description": "A solution accelerator project harnessing the capabilities of Azure AI Language to augment an existing Azure OpenAI RAG chat app. Utilize Conversational Language Understanding (CLU) and Custom Question Answering (CQA) to dynamically improve a RAG chat experience."
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
              "fileCount": 4
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
        "summary": "83% compliant",
        "percentage": 83
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
            "message": "Bicep files found in infra/ directory: 7 files",
            "details": {
              "count": 7,
              "files": [
                "infra/main.bicep",
                "infra/resources/ai_foundry.bicep",
                "infra/resources/container_instance.bicep",
                "infra/resources/managed_identity.bicep",
                "infra/resources/role_assignments.bicep",
                "infra/resources/search_service.bicep",
                "infra/resources/storage_account.bicep"
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
            "id": "bicep-uses-managed-identity-infra/resources/ai_foundry.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/resources/ai_foundry.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/resources/ai_foundry.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/resources/container_instance.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/resources/container_instance.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/resources/container_instance.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/resources/search_service.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/resources/search_service.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/resources/search_service.bicep",
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
