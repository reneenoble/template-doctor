window.reportData = {
  "repoUrl": "https://github.com/Azure-Samples/cargotracker-liberty-aks-azd",
  "ruleSet": "dod",
  "timestamp": "2025-09-24T19:02:52.053Z",
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
        "id": "missing-CODE_OF_CONDUCT.md",
        "severity": "error",
        "message": "Missing required file: CODE_OF_CONDUCT.md",
        "error": "File CODE_OF_CONDUCT.md not found in repository"
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
          "fileCount": 32
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
        "message": "Bicep files found in infra/ directory: 22 files",
        "details": {
          "count": 22,
          "files": [
            "infra/azure.liberty.aks/mainTemplate.bicep",
            "infra/azure.liberty.aks/modules/_azure-resoruces/_appgateway.bicep",
            "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvault/_keyvaultWithExistingCert.bicep",
            "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvault/_keyvaultWithNewCert.bicep",
            "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvaultForGateway.bicep",
            "infra/azure.liberty.aks/modules/_azure-resoruces/_vnetAppGateway.bicep",
            "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-networking.bicep",
            "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-preflight.bicep",
            "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-primary.bicep",
            "infra/azure.liberty.aks/modules/_deployment-scripts/_ds_enable_agic.bicep",
            "infra/azure.liberty.aks/modules/_deployment-scripts/_ds_query_available_private_ip_from_subnet.bicep",
            "infra/azure.liberty.aks/modules/_pids/_empty.bicep",
            "infra/azure.liberty.aks/modules/_rolesAssignment/_acrPullRoleAssignment.bicep",
            "infra/azure.liberty.aks/modules/_rolesAssignment/_agicRoleAssignment.bicep",
            "infra/azure.liberty.aks/modules/_rolesAssignment/_roleAssignmentinSubscription.bicep",
            "infra/azure.liberty.aks/modules/_uamiAndRoles.bicep",
            "infra/main.bicep",
            "infra/shared/cognitiveservices.bicep",
            "infra/shared/flexibleserver.bicep",
            "infra/shared/monitoring.bicep",
            "infra/shared/openaiRoleAssignment.bicep",
            "infra/shared/userAssignedIdentity.bicep"
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
        "id": "bicep-uses-managed-identity-infra/azure.liberty.aks/mainTemplate.bicep",
        "category": "bicepSecurity",
        "message": "Good practice: infra/azure.liberty.aks/mainTemplate.bicep uses Managed Identity for Azure authentication",
        "details": {
          "file": "infra/azure.liberty.aks/mainTemplate.bicep",
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
        "message": "Compliance: 83%",
        "details": {
          "issueCount": 4,
          "compliantCount": 19,
          "totalChecks": 23,
          "percentageCompliant": 83
        }
      }
    ],
    "percentage": 83,
    "summary": "Issues found - Compliance: 83%",
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
            "id": "missing-CODE_OF_CONDUCT.md",
            "severity": "error",
            "message": "Missing required file: CODE_OF_CONDUCT.md",
            "error": "File CODE_OF_CONDUCT.md not found in repository"
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
              "fileCount": 32
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
            "message": "Bicep files found in infra/ directory: 22 files",
            "details": {
              "count": 22,
              "files": [
                "infra/azure.liberty.aks/mainTemplate.bicep",
                "infra/azure.liberty.aks/modules/_azure-resoruces/_appgateway.bicep",
                "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvault/_keyvaultWithExistingCert.bicep",
                "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvault/_keyvaultWithNewCert.bicep",
                "infra/azure.liberty.aks/modules/_azure-resoruces/_keyvaultForGateway.bicep",
                "infra/azure.liberty.aks/modules/_azure-resoruces/_vnetAppGateway.bicep",
                "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-networking.bicep",
                "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-preflight.bicep",
                "infra/azure.liberty.aks/modules/_deployment-scripts/_ds-primary.bicep",
                "infra/azure.liberty.aks/modules/_deployment-scripts/_ds_enable_agic.bicep",
                "infra/azure.liberty.aks/modules/_deployment-scripts/_ds_query_available_private_ip_from_subnet.bicep",
                "infra/azure.liberty.aks/modules/_pids/_empty.bicep",
                "infra/azure.liberty.aks/modules/_rolesAssignment/_acrPullRoleAssignment.bicep",
                "infra/azure.liberty.aks/modules/_rolesAssignment/_agicRoleAssignment.bicep",
                "infra/azure.liberty.aks/modules/_rolesAssignment/_roleAssignmentinSubscription.bicep",
                "infra/azure.liberty.aks/modules/_uamiAndRoles.bicep",
                "infra/main.bicep",
                "infra/shared/cognitiveservices.bicep",
                "infra/shared/flexibleserver.bicep",
                "infra/shared/monitoring.bicep",
                "infra/shared/openaiRoleAssignment.bicep",
                "infra/shared/userAssignedIdentity.bicep"
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
            "id": "bicep-uses-managed-identity-infra/azure.liberty.aks/mainTemplate.bicep",
            "category": "bicepSecurity",
            "message": "Good practice: infra/azure.liberty.aks/mainTemplate.bicep uses Managed Identity for Azure authentication",
            "details": {
              "file": "infra/azure.liberty.aks/mainTemplate.bicep",
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
