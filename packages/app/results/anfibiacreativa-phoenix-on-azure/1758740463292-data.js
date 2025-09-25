window.reportData = {
  "repoUrl": "https://github.com/Arize-ai/phoenix-on-azure",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:01:03.291Z",
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
        "id": "readme-missing-heading-resources",
        "severity": "error",
        "message": "README.md is missing required h2 heading: Resources",
        "error": "README.md does not contain required h2 heading: Resources"
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
          "fileCount": 6
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
        "id": "readme-heading-getting-started",
        "category": "readmeHeading",
        "message": "README.md contains required h2 heading: Getting Started",
        "details": {
          "heading": "Getting Started",
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
        "message": "Bicep files found in infra/ directory: 5 files",
        "details": {
          "count": 5,
          "files": [
            "infra/database/flexibleserver.bicep",
            "infra/host/container-app-env.bicep",
            "infra/host/container-app.bicep",
            "infra/main.bicep",
            "infra/monitor/loganalytics.bicep"
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
        "message": "Compliance: 55%",
        "details": {
          "issueCount": 10,
          "compliantCount": 12,
          "totalChecks": 22,
          "percentageCompliant": 55
        }
      }
    ],
    "percentage": 55,
    "summary": "Issues found - Compliance: 55%",
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
            "id": "readme-missing-heading-resources",
            "severity": "error",
            "message": "README.md is missing required h2 heading: Resources",
            "error": "README.md does not contain required h2 heading: Resources"
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
              "fileCount": 6
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
            "id": "readme-heading-getting-started",
            "category": "readmeHeading",
            "message": "README.md contains required h2 heading: Getting Started",
            "details": {
              "heading": "Getting Started",
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
        "summary": "50% compliant",
        "percentage": 50
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
            "message": "Bicep files found in infra/ directory: 5 files",
            "details": {
              "count": 5,
              "files": [
                "infra/database/flexibleserver.bicep",
                "infra/host/container-app-env.bicep",
                "infra/host/container-app.bicep",
                "infra/main.bicep",
                "infra/monitor/loganalytics.bicep"
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
