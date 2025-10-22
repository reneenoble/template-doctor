# Template Doctor Documentation

This directory contains 24 active documentation files, organized into logical categories for easy navigation.

**62% reduction** - Condensed from 63 files by archiving 38 historical/completed documents to `docs/archive/` (gitignored, local-only).

## 🚀 Getting Started

Start here for quick setup and deployment:

- [Quick Start](../QUICKSTART.md) - 5-minute setup guide
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Simple deployment walkthrough for local and production
- [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions

## 🔧 Setup & Deployment

Complete setup and deployment guides:

- [Azure Deployment](setup/azure-deployment.md) - Deploy with Azure Developer CLI
- [Database Setup](setup/database-setup.md) - Production Cosmos DB with Managed Identity
- [Cosmos Portal Setup](setup/cosmos-portal.md) - Manual Cosmos DB configuration via Azure Portal
- [Managed Identity Setup](setup/managed-identity.md) - User-Assigned Managed Identity (UAMI) configuration

## ✨ Features

Feature-specific documentation:

- [Security Analysis](features/security-analysis.md) - Bicep security best practices checks
- [AI Issue Suggestions](features/ai-issue-suggestions.md) - AI-powered GitHub issue enrichment
- [AZD Validation](features/azd-validation.md) - Azure Developer CLI template validation
- [Deprecated Models](features/deprecated-models.md) - Automated model version tracking and warnings
- [Model Updater](features/model-updater.md) - Keep deprecated model list up-to-date
- [Ruleset Validation](features/ruleset-validation.md) - Documentation ruleset validation
- [Batch Scanning (SAML)](features/batch-scanning-saml.md) - Batch scanning with SAML/SSO authentication

## 📖 Guides

How-to guides for common tasks:

- [GitHub Actions](guides/github-actions.md) - CI/CD integration setup
- [Batch Scanning](guides/batch-scanning.md) - Bulk template analysis workflow
- [Docker](guides/docker.md) - Docker deployment and development
- [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions

## 📚 Reference

Technical reference documentation:

- [Architecture](reference/architecture.md) - System architecture, data flows, and component interactions
- [Environment Variables](reference/environment-variables.md) - Complete configuration reference
- [OAuth Setup](reference/oauth-setup.md) - GitHub OAuth app configuration
- [OAuth API](reference/oauth-api.md) - API authentication and authorization
- [Database Schema](reference/database-schema.md) - MongoDB/Cosmos DB schema and collections
- [Testing](reference/testing.md) - Testing strategy, coverage, and best practices
- [Workflows](reference/workflows.md) - GitHub Actions CI/CD workflows
- [Logging Migration](reference/logging-migration.md) - Pino structured logging implementation

## 🗂️ Archive

38 historical documents are preserved in `docs/archive/` (gitignored, local-only):

- **Migration Docs** (6): Azure Functions → Express, database migrations (completed)
- **Implementation Docs** (8): Completed feature implementations, checklists, plans
- **Consolidated Docs** (5): Merged into current docs (AGENTS.md, setup guides)
- **Deployment Guides** (4): Superseded by current deployment docs
- **Usage Guides** (3): Consolidated or replaced
- **Implementation Details** (7): Phase completion docs, feature details
- **Original Specs** (5): Historical architecture and specifications

See [archive/README.md](archive/README.md) for complete list and details.

## 📊 Documentation Statistics

- **Active Documents**: 24 files
- **Archived Documents**: 38 files (local-only, gitignored)
- **Reduction**: 62% (from 63 total files)
- **Last Updated**: 2025

## 🔗 Quick Links

- **Main README**: [../README.md](../README.md)
- **AI Agents Guide**: [../AGENTS.md](../AGENTS.md)
- **Contributing**: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Infrastructure**: [../infra/README.md](../infra/README.md)
