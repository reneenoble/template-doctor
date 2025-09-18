# Azure Developer

## Overview

Template Doctor supports an optional, globally-configurable Azure Developer CLI (AZD) analysis mode and an AI model deprecation check. These work together to provide targeted validations when the deployment method is Azure Developer CLI.

- Global switch: `azureDeveloperCliEnabled` (default: true)
- Functional checks under AZD:
  - Verify `azure.yaml` or `azure.yml` exists (Functional category)
  - Verify `services:` are defined inside `azure.yaml`/`azure.yml` (Functional category)
  - Deployment with Azure Developer CLI (azd) is enabled and tested as part of the validation workflow
- AI checks under AZD:
  - "Test AI model deprecation" populates the new `AI` compliance category
  - Visible in the modal under "Global checks" when AZD is enabled
  - Toggle default ON; can be disabled by the user
  - Auto-disabled if the template doesn't appear AI-powered (heuristic)AI Model Deprecation Checks

## Overview

Template Doctor supports an optional, globally-configurable Azure Developer CLI (AZD) analysis mode and an AI model deprecation check. These work together to provide targeted validations when the deployment method is Azure Developer CLI.

- Global switch: `azureDeveloperCliEnabled` (default: true)
- Functional checks under AZD:
  - Verify `azure.yaml` or `azure.yml` exists (Functional category)
  - Verify `services:` are defined inside `azure.yaml`/`azure.yml` (Functional category)
  - Deployment with Azure Developer CLI (azd) is enabled and tested as part of the validation workflow
- AI checks under AZD:
  - "Test AI model deprecation" populates the new `AI` compliance category
  - Visible in the modal under "Global checks" when AZD is enabled
  - Toggle default ON; can be disabled by the user
  - Auto-disabled if the template doesn't appear AI-powered (heuristic)

This document describes how Template Doctor handles Azure Developer CLI-specific checks and the AI model deprecation check, including global configuration and UI behavior.

## Overview

Template Doctor supports an optional, globally-configurable Azure Developer CLI (AZD) analysis mode and an AI model deprecation check. These work together to provide targeted validations when the deployment method is Azure Developer CLI.

- Global switch: `azureDeveloperCliEnabled` (default: true)
- Functional checks under AZD:
  - Verify `azure.yaml` or `azure.yml` exists (Functional category)
  - Verify `services:` are defined inside `azure.yaml`/`azure.yml` (Functional category)
- AI checks under AZD:
  - "Test AI model deprecation" populates the new `AI` compliance category
  - Visible in the modal under “Global checks” when AZD is enabled
  - Toggle default ON; can be disabled by the user
  - Auto-disabled if the template doesn’t appear AI-powered (heuristic)

If the AZD switch is disabled, the Global checks UI is hidden and AZD/AI checks are not executed.

## Configuration (config.json)

Configure AZD and AI checks using `packages/app/config.json` (or environment-based mapping via the unified ConfigLoader/runtime-config).

Supported keys:

- `azureDeveloperCliEnabled` (boolean, default: true)
  - Controls visibility and execution of AZD-related checks and the Global checks UI.
- `aiDeprecationCheckEnabled` (boolean, default: true)
  - Optional user/session preference persisted by the modal toggle for the AI check.
  - When false, the AI deprecation check will not run even if AZD is enabled.
- `deprecatedModels` (string[])
  - Optional list of deprecated model names to search for in your repository. If omitted, a conservative default list is used (e.g., `gpt-3.5-turbo`, `text-davinci-003`).

Example `config.json`:

```json
{
  "azureDeveloperCliEnabled": true,
  "archiveEnabled": false,
  "archiveCollection": "aigallery",
  "defaultRuleSet": "dod",
  "deprecatedModels": ["gpt-3.5-turbo", "text-davinci-003"]
}
```

Environment variable mapping (when supported by your hosting):
- `AZURE_DEVELOPER_CLI_ENABLED`: "true"/"false" — maps to `azureDeveloperCliEnabled`

## Modal UI Behavior

When `azureDeveloperCliEnabled` is true:
- The ruleset modal shows a section "Global checks" with an "AI model deprecation (Az Dev CLI only)" toggle.
- The toggle defaults to ON.
- The toggle may auto-disable if the repository doesn’t appear AI-powered based on a heuristic:
  - Detects AI SDKs in `package.json` dependencies (e.g., `openai`, `@azure/openai`, `@azure/ai-inference`, `langchain`, `semantic-kernel`) or entries in `requirements.txt`.

When `azureDeveloperCliEnabled` is false:
- The "Global checks" section is hidden.
- AZD and AI checks are not executed.

## Analyzer Behavior

- Functional category (only when `azureDeveloperCliEnabled` is true):
  - `azure.yaml`/`azure.yml` presence: compliant/issue
  - `services:` defined in `azure.yaml`/`azure.yml`: compliant/issue
  - Deployment test: runs `azd up` as part of the validation-template workflow when templates use Bicep (not Terraform)
- AI category (only when `azureDeveloperCliEnabled` is true AND AI toggle is ON AND `azure.yaml`/`azure.yml` exists):
  - Runs the AI model deprecation scan and records results in `compliance.categories.ai`
  - A status summary is also exposed in `compliance.globalChecks` as `ai-model-deprecation` with `status: "passed"|"failed"`

Current model detection:
- The AI deprecation check scans a capped set of text files (md, js, ts, py, json, yml, yaml) for model name occurrences from `deprecatedModels`.
- You can override the list via `deprecatedModels` in `config.json`.

Planned refinement:
- Add deeper scanning of Bicep templates to detect Azure OpenAI model configuration and compare against the official retirements list:
  https://learn.microsoft.com/azure/ai-foundry/openai/concepts/model-retirements?tabs=text

## Results Schema

- `compliance.categories.ai` — New category added for AI checks (same shape as other categories).
- `compliance.globalChecks[]` — Includes a minimal entry for `ai-model-deprecation` when the check runs:
  ```json
  {
    "id": "ai-model-deprecation",
    "status": "passed|failed",
    "details": { /* matches found or modelsChecked */ }
  }
  ```

## Troubleshooting

- Global checks UI is missing:
  - Ensure `azureDeveloperCliEnabled` is true in `config.json` or set `AZURE_DEVELOPER_CLI_ENABLED=true`.
- AI toggle is disabled:
  - The app may not detect AI SDKs. Add the relevant dependencies or set the toggle ON (when enabled) to force it.
- The AI check doesn’t run:
  - Confirm all three conditions: `azureDeveloperCliEnabled` true, `azure.yaml`/`azure.yml` present, and AI toggle ON.

## Testing

- Playwright tests can assert:
  - Visibility of the Global checks section based on `azureDeveloperCliEnabled`.
  - Presence or absence of `compliance.categories.ai` based on toggle and repo content.
- From repo root you can run a targeted test with arg forwarding:
  ```bash
  npm run test -- "-g" "should handle search functionality" packages/app/tests/app.spec.js
  ```