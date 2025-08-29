# Setup Instructions: User Assigned Managed Identity (UAMI) for GitHub Actions

This document explains how to set up a **User Assigned Managed Identity (UAMI)** with a **federated credential** for this repo’s GitHub Actions workflows.  
This replaces the older Service Principal + Federated Credential approach.

---

## 1. Prerequisites
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed  
- Logged into the correct Azure tenant and subscription:

```sh
  az login
  az account set --subscription <your-subscription-id>
  ```

## 2. Configure .env

Copy the template file:

`cp .env.example .env`


Open .env and update these values:

# Azure Configuration
AZURE_SUBSCRIPTION_ID=your_subscription_id_here
AZURE_TENANT_ID=your_tenant_id_here
ACA_RESOURCE_GROUP=your_aca_resource_group_here

# GitHub Repo for OIDC
GITHUB_OWNER=your_github_org_or_user
GITHUB_REPO=template-doctor


The .env file should not be committed. Only .env.example should be in Git.

## 3. Run the Setup Script

From the repo root, run:

`./scripts/setup.sh`

or 

`npm run setup:uami`


This script will:

- Check if a UAMI named template-doctor-identity already exists in your resource group.
If it exists, it prompts before continuing.

- Create the UAMI (or reuse existing)

- Assign Contributor role at the subscription level

- Add a federated credential for all branches in your workflow repo (GITHUB_OWNER/GITHUB_REPO)

- Update .env with the new AZURE_CLIENT_ID and AZURE_TENANT_ID

### Safety Check

If a UAMI with the same name already exists, the script will show:

```bash
⚠️  A Managed Identity named 'template-doctor-identity' already exists in RG 'my-rg'.
Do you want to continue and reuse it? (y/N)


Press y to continue and reuse the identity.

Press any other key to abort.
```

## 4. Update GitHub Secrets

After running the script, add the following GitHub Secrets to your repository:

AZURE_CLIENT_ID (from updated .env)

AZURE_TENANT_ID (from updated .env)

AZURE_SUBSCRIPTION_ID (from .env)

These secrets allow your GitHub Actions workflows to authenticate to Azure via the UAMI.

## 5. Notes

Each installation of this repo’s workflow provisions its own UAMI.

The federated credential is tied to the workflow repo, not to the ephemeral repos cloned by the action.

The script can be safely run from any branch. Feature branches do not interfere with main.




