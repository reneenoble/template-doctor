# Automated Deprecated Models Updates

Template Doctor includes an automated system to keep the list of deprecated AI models up-to-date. This document explains how the automation works and how to manage it.

## GitHub Action Workflow

A GitHub Action workflow automatically updates the deprecated models list based on Microsoft's official documentation. The workflow runs twice monthly and creates a pull request when changes are detected.

### Workflow Details

- **File Location**: `.github/workflows/update-deprecated-models.yml`
- **Schedule**: Runs on the 1st and 15th of each month at 12:00 UTC (approximately every 2 weeks)
- **Manual Trigger**: Can also be triggered manually from the GitHub Actions tab

### How It Works

1. The workflow checks out the repository
2. Sets up Node.js and installs dependencies
3. Runs the `fetch-deprecated-models.js` script with the `--include-all-models` flag
4. Checks if the config.json file has been modified
5. If changes are detected, creates a pull request with the updates

### Pull Request Details

When changes are detected, the workflow creates a pull request with:

- **Title**: "Update deprecated models list"
- **Branch**: `auto/update-deprecated-models`
- **Labels**: `automated-pr`, `dependencies`
- **Description**: Information about the updates and source of the data

## Managing the Automation

### Reviewing Pull Requests

When the workflow creates a pull request, someone should review it to ensure:

1. The changes are legitimate (not mistakenly adding/removing models)
2. The format is correct
3. There are no unexpected side effects

### Disabling the Automation

If you need to disable the automated updates:

1. Go to the repository settings
2. Navigate to "Actions" under "Code and automation"
3. Either disable the specific workflow or all workflows

### Triggering a Manual Update

To manually trigger an update:

1. Go to the "Actions" tab in the repository
2. Select the "Update Deprecated Models" workflow
3. Click "Run workflow" and select the branch to run it on

## Troubleshooting

### Common Issues

- **No Pull Request Created**: If the workflow runs but no PR is created, check the workflow logs to see if any changes were detected.
- **Script Errors**: Check the workflow logs for any errors in the script execution.
- **Rate Limiting**: If the workflow fails due to GitHub API rate limiting, you may need to adjust the workflow schedule.

### Workflow Logs

To view the workflow logs:

1. Go to the "Actions" tab in the repository
2. Click on the latest "Update Deprecated Models" workflow run
3. Expand the job and steps to see detailed logs

## Customizing the Automation

### Changing the Schedule

To change how often the workflow runs, edit the `cron` expression in the workflow file:

```yaml
schedule:
  - cron: '0 12 1,15 * *'  # Runs on the 1st and 15th at 12:00 UTC
```

For example, to run monthly on the 1st:

```yaml
schedule:
  - cron: '0 12 1 * *'  # Runs on the 1st of each month at 12:00 UTC
```

### Modifying Script Parameters

The workflow currently uses the `--include-all-models` flag to include all model types. To change this behavior, edit the script invocation in the workflow file:

```yaml
- name: Fetch deprecated models
  run: node scripts/fetch-deprecated-models.js --include-all-models
```

For example, to only include currently deprecated models and not future ones:

```yaml
- name: Fetch deprecated models
  run: node scripts/fetch-deprecated-models.js
```

## Related Documentation

- [Deprecated Models Updater Script](../development/DEPRECATED_MODELS_UPDATER.md) - Details about the script used by this workflow
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - GitHub's official documentation on Actions