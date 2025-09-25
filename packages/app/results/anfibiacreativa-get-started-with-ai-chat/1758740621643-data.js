window.reportData = {
  "repoUrl": "https://github.com/Azure-Samples/get-started-with-ai-chat",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:03:41.640Z",
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
        "id": "repo-description",
        "category": "repositoryMetadata",
        "message": "Repository has a description",
        "details": {
          "description": "Basic sample for deploying chat web apps with Azure AI Foundry and SDKs"
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
          "fileCount": 51
        }
      },
      {
        "id": "folder-.github",
        "category": "requiredFolder",
        "message": "Required folder found: .github/",
        "details": {
          "folderPath": ".github",
          "fileCount": 6
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
        "message": "Bicep files found in infra/ directory: 48 files",
        "details": {
          "count": 48,
          "files": [
            "infra/api.bicep",
            "infra/core/ai/cognitiveservices.bicep",
            "infra/core/config/configstore.bicep",
            "infra/core/database/cosmos/cosmos-account.bicep",
            "infra/core/database/cosmos/mongo/cosmos-mongo-account.bicep",
            "infra/core/database/cosmos/mongo/cosmos-mongo-db.bicep",
            "infra/core/database/cosmos/sql/cosmos-sql-account.bicep",
            "infra/core/database/cosmos/sql/cosmos-sql-db.bicep",
            "infra/core/database/cosmos/sql/cosmos-sql-role-assign.bicep",
            "infra/core/database/cosmos/sql/cosmos-sql-role-def.bicep",
            "infra/core/database/mysql/flexibleserver.bicep",
            "infra/core/database/postgresql/flexibleserver.bicep",
            "infra/core/database/sqlserver/sqlserver.bicep",
            "infra/core/gateway/apim.bicep",
            "infra/core/host/ai-environment.bicep",
            "infra/core/host/aks-agent-pool.bicep",
            "infra/core/host/aks-managed-cluster.bicep",
            "infra/core/host/aks.bicep",
            "infra/core/host/appservice-appsettings.bicep",
            "infra/core/host/appservice.bicep",
            "infra/core/host/appserviceplan.bicep",
            "infra/core/host/container-app-upsert.bicep",
            "infra/core/host/container-app.bicep",
            "infra/core/host/container-apps-environment.bicep",
            "infra/core/host/container-apps.bicep",
            "infra/core/host/container-registry.bicep",
            "infra/core/host/functions.bicep",
            "infra/core/host/ml-online-endpoint.bicep",
            "infra/core/host/staticwebapp.bicep",
            "infra/core/monitor/applicationinsights-dashboard.bicep",
            "infra/core/monitor/applicationinsights.bicep",
            "infra/core/monitor/loganalytics.bicep",
            "infra/core/monitor/monitoring.bicep",
            "infra/core/networking/cdn-endpoint.bicep",
            "infra/core/networking/cdn-profile.bicep",
            "infra/core/networking/cdn.bicep",
            "infra/core/search/search-services.bicep",
            "infra/core/security/aks-managed-cluster-access.bicep",
            "infra/core/security/appinsights-access.bicep",
            "infra/core/security/configstore-access.bicep",
            "infra/core/security/keyvault-access.bicep",
            "infra/core/security/keyvault-secret.bicep",
            "infra/core/security/keyvault.bicep",
            "infra/core/security/registry-access.bicep",
            "infra/core/security/role.bicep",
            "infra/core/storage/storage-account.bicep",
            "infra/core/testing/loadtesting.bicep",
            "infra/main.bicep"
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
        "id": "bicep-uses-managed-identity-infra/core/ai/cognitiveservices.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/core/ai/cognitiveservices.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/core/ai/cognitiveservices.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/core/host/aks-managed-cluster.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/core/host/aks-managed-cluster.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/core/host/aks-managed-cluster.bicep",
          "authMethod": "ManagedIdentity"
        }
      },
      {
        "id": "bicep-uses-managed-identity-infra/core/host/ml-online-endpoint.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/core/host/ml-online-endpoint.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/core/host/ml-online-endpoint.bicep",
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
        "message": "Compliance: 72%",
        "details": {
          "issueCount": 7,
          "compliantCount": 18,
          "totalChecks": 25,
          "percentageCompliant": 72
        }
      }
    ],
    "percentage": 72,
    "summary": "Issues found - Compliance: 72%",
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
            "id": "repo-description",
            "category": "repositoryMetadata",
            "message": "Repository has a description",
            "details": {
              "description": "Basic sample for deploying chat web apps with Azure AI Foundry and SDKs"
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
              "fileCount": 51
            }
          },
          {
            "id": "folder-.github",
            "category": "requiredFolder",
            "message": "Required folder found: .github/",
            "details": {
              "folderPath": ".github",
              "fileCount": 6
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
            "message": "Bicep files found in infra/ directory: 48 files",
            "details": {
              "count": 48,
              "files": [
                "infra/api.bicep",
                "infra/core/ai/cognitiveservices.bicep",
                "infra/core/config/configstore.bicep",
                "infra/core/database/cosmos/cosmos-account.bicep",
                "infra/core/database/cosmos/mongo/cosmos-mongo-account.bicep",
                "infra/core/database/cosmos/mongo/cosmos-mongo-db.bicep",
                "infra/core/database/cosmos/sql/cosmos-sql-account.bicep",
                "infra/core/database/cosmos/sql/cosmos-sql-db.bicep",
                "infra/core/database/cosmos/sql/cosmos-sql-role-assign.bicep",
                "infra/core/database/cosmos/sql/cosmos-sql-role-def.bicep",
                "infra/core/database/mysql/flexibleserver.bicep",
                "infra/core/database/postgresql/flexibleserver.bicep",
                "infra/core/database/sqlserver/sqlserver.bicep",
                "infra/core/gateway/apim.bicep",
                "infra/core/host/ai-environment.bicep",
                "infra/core/host/aks-agent-pool.bicep",
                "infra/core/host/aks-managed-cluster.bicep",
                "infra/core/host/aks.bicep",
                "infra/core/host/appservice-appsettings.bicep",
                "infra/core/host/appservice.bicep",
                "infra/core/host/appserviceplan.bicep",
                "infra/core/host/container-app-upsert.bicep",
                "infra/core/host/container-app.bicep",
                "infra/core/host/container-apps-environment.bicep",
                "infra/core/host/container-apps.bicep",
                "infra/core/host/container-registry.bicep",
                "infra/core/host/functions.bicep",
                "infra/core/host/ml-online-endpoint.bicep",
                "infra/core/host/staticwebapp.bicep",
                "infra/core/monitor/applicationinsights-dashboard.bicep",
                "infra/core/monitor/applicationinsights.bicep",
                "infra/core/monitor/loganalytics.bicep",
                "infra/core/monitor/monitoring.bicep",
                "infra/core/networking/cdn-endpoint.bicep",
                "infra/core/networking/cdn-profile.bicep",
                "infra/core/networking/cdn.bicep",
                "infra/core/search/search-services.bicep",
                "infra/core/security/aks-managed-cluster-access.bicep",
                "infra/core/security/appinsights-access.bicep",
                "infra/core/security/configstore-access.bicep",
                "infra/core/security/keyvault-access.bicep",
                "infra/core/security/keyvault-secret.bicep",
                "infra/core/security/keyvault.bicep",
                "infra/core/security/registry-access.bicep",
                "infra/core/security/role.bicep",
                "infra/core/storage/storage-account.bicep",
                "infra/core/testing/loadtesting.bicep",
                "infra/main.bicep"
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
            "id": "bicep-uses-managed-identity-infra/core/ai/cognitiveservices.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/core/ai/cognitiveservices.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/core/ai/cognitiveservices.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/core/host/aks-managed-cluster.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/core/host/aks-managed-cluster.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/core/host/aks-managed-cluster.bicep",
              "authMethod": "ManagedIdentity"
            }
          },
          {
            "id": "bicep-uses-managed-identity-infra/core/host/ml-online-endpoint.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/core/host/ml-online-endpoint.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/core/host/ml-online-endpoint.bicep",
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
