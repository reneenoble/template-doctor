# Deployment and Publishing Results

This project uses Azure Static Web Apps (SWA) for the frontend and API. New analysis results are added to the repository via a pull request. To make those results visible on the public site, the Static Web App must be deployed.

## How results get published

1. Save Results triggers a GitHub workflow that creates a PR containing your analysis under the `packages/app/results/` directory (and updates `packages/app/results/index-data.js`).
2. Once the PR is merged, the Static Web App needs to be re-deployed for the new files to appear on the site.
3. This repo includes a nightly deployment workflow so the site publishes merged results automatically each day.

## Nightly deployment

- Workflow: `.github/workflows/nightly-swa-deploy.yml`
- Schedule: runs nightly at 02:15 UTC
- Action: deploys the site using `swa deploy --env=PRODUCTION` (as configured by `swa-cli.config.json`).
- Requirement: repository secret `SWA_CLI_DEPLOYMENT_TOKEN` holding your Static Web App deployment token.

How to set the deployment token:

- In the Azure portal for your Static Web App, copy the deployment token.
- In GitHub: Settings → Secrets and variables → Actions → New repository secret
- Name: `SWA_CLI_DEPLOYMENT_TOKEN`
- Value: paste the token, then save.

## Manual deployment (admins)

You can deploy immediately at any time:

- GitHub → Actions → “Nightly Static Web Apps Deploy” → Run workflow

This publishes the current default branch to production using the same workflow.

## User-facing message after Save Results

- After clicking “Save Results” and a successful dispatch, the UI shows a notification:
    - “A pull request is being created with your analysis results. Once the PR is merged, results will appear on the site after the nightly deployment. If you are an admin, you can deploy the site manually to publish immediately.”
- This clarifies that merging the PR and then deploying are required for the results to show up on the site.

## Troubleshooting

- No changes after the nightly run:
    - Ensure the PR was merged to the branch the site deploys from (usually `main`).
    - Confirm `SWA_CLI_DEPLOYMENT_TOKEN` is present and valid.
    - Check the Actions logs for the nightly deploy job.
- Manual deploy fails:
    - Verify the token and that `swa-cli.config.json` points to the correct app/api locations.
    - Confirm you have permissions to run the workflow.

## Related docs

- Save Results workflow: `docs/usage/GITHUB_ACTION_SETUP.md`
- Runtime/environment variables: `docs/development/ENVIRONMENT_VARIABLES.md`
