# Deprecated Models Updater Script

This documentation explains how to use the `fetch-deprecated-models.js` script to keep Template Doctor's deprecated model list up-to-date with Microsoft's official documentation.

## Overview

Template Doctor has a feature that scans repositories for references to deprecated OpenAI models. The list of deprecated models is configured in `config.json` under the `deprecatedModels` key. This script automates the process of fetching the latest deprecated models from Microsoft's documentation.

## How It Works

1. The script fetches HTML content from Microsoft's model lifecycle documentation
2. It parses the tables in the documentation to identify multiple date types:
   - Model names (from the "Model" column)
   - Legacy dates (from the "Legacy" column)
   - Deprecation dates (from the "Deprecation" column) 
   - Retirement dates (from the "Retirement" column)
3. For each model, it checks if any of the dates indicate the model is deprecated:
   - If any date is in the past, the model is considered deprecated
   - If the `--include-future` flag is used, models with future deprecation dates are also included
4. It filters the results to only include models with names that match known patterns (gpt-, text-, etc.)
5. The script can either update the configuration file directly or output the results for manual updates

## Prerequisites

- Node.js installed on your system

## Usage

### Basic Usage

From the root of the Template Doctor repository, run:

```bash
node scripts/fetch-deprecated-models.js
```

This will:
1. Fetch the Microsoft model retirement documentation page
2. Extract model names from the tables on the page
3. Update your local `packages/app/config.json` file with the extracted models

### Dry Run Mode

If you want to see what models would be fetched without updating the config:

```bash
node scripts/fetch-deprecated-models.js --dry-run
```

This will display the extracted models without modifying your configuration file.

### Include Future Deprecations

By default, the script only includes models that are already deprecated (retirement date is today or in the past). If you want to include models with future retirement dates:

```bash
node scripts/fetch-deprecated-models.js --include-future
```

### Include All Models

By default, the script only includes models with name patterns that match known AI models (like gpt-, text-, Phi-, etc.). If you want to include all deprecated models regardless of their name patterns:

```bash
node scripts/fetch-deprecated-models.js --include-all-models
```

This is useful for capturing new model families that don't match the predefined patterns.

### JSON Output

To get just the JSON array of deprecated models (useful for piping to other tools):

```bash
node scripts/fetch-deprecated-models.js --json
```

## Integration with Template Doctor

The script directly updates the `deprecatedModels` array in the Template Doctor configuration file. After running the script, Template Doctor will use this updated list when scanning repositories.

### Manual Configuration

If the script cannot update the configuration automatically, it will display the list of models that you can manually add to your `config.json` file:

```json
{
  "azureDeveloperCliEnabled": true,
  "archiveEnabled": false,
  "defaultRuleSet": "dod",
  "deprecatedModels": [
    "gpt-3.5-turbo",
    "text-davinci-003",
    "...other models..."
  ]
}
```

## Handling Complex Table Structures

The script is designed to handle different table structures found in Microsoft's documentation:

1. It automatically identifies which columns contain model names and various date types
2. It supports extracting model names from within links and other HTML elements
3. It processes multiple date columns (Legacy, Deprecation, Retirement) to determine model status
4. It provides detailed logging to help troubleshoot any parsing issues

When a table contains multiple date columns, the script prioritizes them in this order:
1. Retirement Date - If present and in the past, the model is considered deprecated
2. Deprecation Date - If present and in the past, the model is considered deprecated
3. Legacy Date - If present and in the past, the model is considered deprecated

## Scheduling Updates

### Automated GitHub Action

Template Doctor includes a GitHub Action workflow that automatically updates the deprecated models list twice a month. See [Automated Deprecated Models Updates](./AUTOMATED_DEPRECATED_MODELS.md) for details on how this works.

### Manual Scheduling

If you prefer to schedule updates manually, you can use cron jobs on Linux/macOS or Task Scheduler on Windows.

Example cron entry to run weekly on Mondays at 9 AM:

```
0 9 * * 1 cd /path/to/template-doctor && node scripts/fetch-deprecated-models.js
```

## Adding to CI/CD

This script can be added to a CI/CD pipeline to automatically keep the deprecated models list up-to-date. Here's an example GitHub Actions workflow:

```yaml
name: Update Deprecated Models

on:
  schedule:
    - cron: '0 0 * * 0'  # Run weekly on Sundays at midnight
  workflow_dispatch:     # Allow manual triggers

jobs:
  update-models:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - name: Fetch deprecated models
        run: node scripts/fetch-deprecated-models.js
      - name: Check for changes
        id: git-check
        run: |
          git diff --quiet packages/app/config.json || echo "changes=true" >> $GITHUB_OUTPUT
      - name: Create Pull Request
        if: steps.git-check.outputs.changes == 'true'
        uses: peter-evans/create-pull-request@v4
        with:
          commit-message: 'chore: update deprecated models list'
          title: 'Update deprecated models list'
          body: 'Automatically generated PR to update the list of deprecated models from Microsoft documentation.'
          branch: 'auto/update-deprecated-models'
```

## Troubleshooting

If the script fails to extract models, it might be due to changes in the structure of Microsoft's documentation page. In such cases:

1. Check if the URL is still valid (currently using: `https://learn.microsoft.com/azure/ai-foundry/concepts/model-lifecycle-retirement`)
2. Run with verbose output to see detailed logging about table parsing:
   ```bash
   node scripts/fetch-deprecated-models.js --dry-run
   ```
3. Examine the HTML structure of the page and update the extraction logic in the script if needed
4. Manually update the `deprecatedModels` array in `config.json` as a temporary solution

## Contributing

If you find issues with the script or have suggestions for improvement, please open an issue or pull request on the Template Doctor repository.