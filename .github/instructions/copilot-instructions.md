---
applyTo: "**"
---

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Template-Doctor Project Context and Coding Guidelines

This document provides context about the Template-Doctor project, its architecture, coding standards, and guidelines for AI-assisted code generation and review.

## ⚠️ CRITICAL: Mission-Critical Production Application

**Template-Doctor is a PRODUCTION-GRADE, MISSION-CRITICAL application used by Microsoft teams and the Azure community.**

### STRICTLY FORBIDDEN - Zero Tolerance Policy:

- ❌ **NO MOCKS** - Never generate mock implementations
- ❌ **NO STUBS** - Never create stub functions that don't implement full logic
- ❌ **NO PLACEHOLDERS** - Never use placeholder code, comments like "TODO", or incomplete implementations
- ❌ **NO EMULATION** - Never simulate or emulate real functionality
- ❌ **NO FAKE DATA** - Never generate fake or sample data instead of real implementations
- ❌ **NO TEMPORARY CODE** - Never write "temporary" solutions with plans to "fix later"
- ❌ **NO HALF-IMPLEMENTATIONS** - Every function must be complete and production-ready

### Production Code Requirements:

- ✅ **FULL IMPLEMENTATIONS ONLY** - Every function must be complete, tested, and production-ready
- ✅ **REAL INTEGRATIONS** - All external service integrations must be fully functional
- ✅ **COMPLETE ERROR HANDLING** - Robust error handling with proper logging and user feedback
- ✅ **SECURITY FIRST** - Follow security best practices without compromise
- ✅ **PERFORMANCE OPTIMIZED** - Code must be efficient and scalable
- ✅ **FULLY TESTED** - All code must have comprehensive tests before deployment

**Rationale**: This application is used by real teams to validate production templates. Mock implementations or stubs could lead to:

- Incorrect validation results affecting production deployments
- Security vulnerabilities in production templates
- Loss of trust from the community
- Wasted developer time debugging fake implementations

**If you cannot implement something fully and correctly, DO NOT IMPLEMENT IT AT ALL. Ask for clarification or additional context instead.**

## Project Overview

Template-Doctor is an open-source tool designed to help developers validate, analyze, and manage project templates. It provides a web-based interface and a set of APIs to facilitate template validation, analysis, and integration with GitHub workflows.

**Primary Reference Document**: See [AGENTS.md](/docs/development/AGENTS.md) for comprehensive architecture, development workflow, and AI agent guidelines.

## Architecture

- **Frontend**: Built with TypeScript, providing a user-friendly interface for template management.
- **Backend**: Transitioned from Azure Functions to an Express server, handling API requests and business logic.
- **Database**: Utilizes a database for storing template metadata, analysis results, and user settings.
- **CI/CD**: Integrated with GitHub Actions for continuous integration and deployment.

For detailed architecture information, migration status, and development patterns, refer to:

- [AGENTS.md](/docs/development/AGENTS.md) - Primary AI agent guide
- [docs/development/architecture.md](/docs/development/architecture.md) - Detailed architecture
- [docs/development/EXPRESS_MIGRATION_MATRIX.md](/docs/development/EXPRESS_MIGRATION_MATRIX.md) - Migration tracking

## Coding Standards

- **Language**: TypeScript is the primary language for both frontend and backend.
- **Style Guide**: Follow the Airbnb TypeScript style guide. Use Prettier for code formatting.
- **Error Handling**: Implement robust error handling and logging. Use try-catch blocks where appropriate.
- **Testing**: Write unit and integration tests for all new features. Use Vitest for testing and Playwright for end-to-end tests.
- **Documentation**: Document all functions, classes, and modules using JSDoc comments.
- **Production Quality**: All code must be production-ready - no mocks, stubs, or placeholders.

## Guidelines for AI-Assisted Code Generation and Review

- **Understand Context**: Always consider the project architecture and existing code patterns before generating new code. Consult [AGENTS.md](/docs/development/AGENTS.md) for current context.
- **Maintain Consistency**: Ensure that generated code adheres to the established coding standards and style guide.
- **Focus on Functionality**: Generated code must be fully functional, efficient, and production-ready - never use mocks or stubs.
- **Security**: Be mindful of security best practices, especially when handling user data and external integrations.
- **Review Thoroughly**: Always review AI-generated code for correctness, potential bugs, and adherence to project guidelines.
- **Collaboration**: Encourage collaboration between AI-generated code and human developers to ensure the best outcomes.
- **No Shortcuts**: Never take shortcuts with mock implementations. If full implementation is not possible, request clarification.

## Critical Workflows

### Before Making Changes:

1. Read [AGENTS.md](/docs/development/AGENTS.md) for current project state and context
2. Check migration status and active work in progress
3. Verify no conflicts with ongoing migrations
4. Ensure all dependencies are properly configured

### Code Quality Checklist:

- [ ] Full implementation (no mocks/stubs/placeholders)
- [ ] Comprehensive error handling using the Notification system in place (no alerts, etc)
- [ ] Security best practices applied
- [ ] Unit and integration tests written
- [ ] Performance considerations addressed
- [ ] Documentation updated (JSDoc and relevant .md files)
- [ ] Playwright tests pass for UI changes
- [ ] No hardcoded values (use environment variables)

**MAKE SURE TO NEVER COMMIT SECRETS, GITHUB TOKENS, ETC!**

- [] Always scan code to make sure we're not committing secrets or passwords

## Additional Resources

- [AGENTS.md](/docs/development/AGENTS.md) - **PRIMARY REFERENCE** - Start here for all development work
- [docs/development/](/docs/development/) - Development documentation
- [docs/usage/](/docs/usage/) - Usage guides and setup instructions
- [CONTRIBUTING.md](/CONTRIBUTING.md) - Contribution guidelines
