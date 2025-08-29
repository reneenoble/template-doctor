# Environment Variables Documentation

This document provides an overview of the environment variables used in the Template Doctor project. We've consolidated the environment variables into a single `.env` file at the root of the project for easier management.

## Environment Variable Consolidation

Previously, environment variables were spread across multiple `.env` files:
- `/.env` (root)
- `/packages/app/.env`
- `/packages/api/.env`

These have now been consolidated into a single `.env` file at the root level. This approach simplifies setup and ensures consistency across different parts of the application.

## Available Environment Variables

### GitHub Authentication

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GH_WORKFLOW_TOKEN` | GitHub personal access token used for API calls | Yes | API, GitHub Action |
| `GITHUB_CLIENT_ID` | OAuth client ID for GitHub authentication | Yes | Frontend, API |
| `GITHUB_CLIENT_SECRET` | OAuth client secret for GitHub authentication | Yes | API (github-oauth-token) |

### Azure Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Yes | API, Functions |
| `AZURE_TENANT_ID` | Azure tenant ID | Yes | API, Functions |
| `AZURE_CLIENT_ID` | Azure managed identity client ID | For ACA | Functions |

### Azure Functions Configuration (Local Development)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AzureWebJobsStorage` | Storage connection string for Azure Functions | For local dev | Functions |
| `FUNCTIONS_WORKER_RUNTIME` | Runtime for Azure Functions (node) | For Functions | Functions |

## Setup Instructions

1. Copy the `.env.example` file to `.env` at the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values for the environment variables in the `.env` file.

3. For local development of Azure Functions, you'll need the Azure Functions Core Tools installed and running with the storage emulator:
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

## GitHub OAuth Configuration

For the OAuth flow to work correctly, you need to:

1. Create a GitHub OAuth App in your GitHub Developer Settings
2. Set the Authorization callback URL to match your deployment URL + `/callback.html`
3. Fill in the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your `.env` file

See the [OAuth Setup Guide](./oauth-setup.md) for more detailed instructions.

## Environment-Specific Configuration

For production deployments, configure the environment variables in your hosting environment:

- **Azure Static Web Apps**: Configure Application Settings in the Azure Portal

## Security Considerations

- Never commit your `.env` file to version control
- Use secrets management for production deployments
- Rotate credentials regularly
- Consider using managed identities in Azure where possible