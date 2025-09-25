window.reportData = {
  "repoUrl": "https://github.com/neondatabase-labs/rag-neon-postgres-openai-azure-python",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:04:41.252Z",
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
        "id": "repo-description",
        "category": "repositoryMetadata",
        "message": "Repository has a description",
        "details": {
          "description": "A RAG app to ask questions about rows in a Neon Serverless Postgres database table. Try the live demo using the link"
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
        "id": "folder-infra",
        "category": "requiredFolder",
        "message": "Required folder found: infra/",
        "details": {
          "folderPath": "infra",
          "fileCount": 16
        }
      },
      {
        "id": "folder-.github",
        "category": "requiredFolder",
        "message": "Required folder found: .github/",
        "details": {
          "folderPath": ".github",
          "fileCount": 9
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
        "message": "Bicep files found in infra/ directory: 15 files",
        "details": {
          "count": 15,
          "files": [
            "infra/backend-dashboard.bicep",
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/database/neon/serverlessPostgres.bicep",
            "infra/core/host/container-app-upsert.bicep",
            "infra/core/host/container-app.bicep",
            "infra/core/host/container-apps-environment.bicep",
            "infra/core/host/container-apps.bicep",
            "infra/core/host/container-registry.bicep",
            "infra/core/monitor/applicationinsights.bicep",
            "infra/core/monitor/loganalytics.bicep",
            "infra/core/monitor/monitoring.bicep",
            "infra/core/security/registry-access.bicep",
            "infra/core/security/role.bicep",
            "infra/main.bicep",
            "infra/web.bicep"
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
        "message": "Compliance: 82%",
        "details": {
          "issueCount": 4,
          "compliantCount": 18,
          "totalChecks": 22,
          "percentageCompliant": 82
        }
      }
    ],
    "percentage": 82,
    "summary": "Issues found - Compliance: 82%",
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
            "id": "repo-description",
            "category": "repositoryMetadata",
            "message": "Repository has a description",
            "details": {
              "description": "A RAG app to ask questions about rows in a Neon Serverless Postgres database table. Try the live demo using the link"
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
            "id": "folder-infra",
            "category": "requiredFolder",
            "message": "Required folder found: infra/",
            "details": {
              "folderPath": "infra",
              "fileCount": 16
            }
          },
          {
            "id": "folder-.github",
            "category": "requiredFolder",
            "message": "Required folder found: .github/",
            "details": {
              "folderPath": ".github",
              "fileCount": 9
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
        "summary": "78% compliant",
        "percentage": 78
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
            "message": "Bicep files found in infra/ directory: 15 files",
            "details": {
              "count": 15,
              "files": [
                "infra/backend-dashboard.bicep",
                "infra/core/ai/cognitiveservices.bicep",
                "infra/core/database/neon/serverlessPostgres.bicep",
                "infra/core/host/container-app-upsert.bicep",
                "infra/core/host/container-app.bicep",
                "infra/core/host/container-apps-environment.bicep",
                "infra/core/host/container-apps.bicep",
                "infra/core/host/container-registry.bicep",
                "infra/core/monitor/applicationinsights.bicep",
                "infra/core/monitor/loganalytics.bicep",
                "infra/core/monitor/monitoring.bicep",
                "infra/core/security/registry-access.bicep",
                "infra/core/security/role.bicep",
                "infra/main.bicep",
                "infra/web.bicep"
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
        "compliant": [],
        "summary": "No checks in this category",
        "percentage": 0
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
