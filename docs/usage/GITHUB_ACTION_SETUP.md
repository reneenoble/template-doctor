# GitHub Action Setup for Template Doctor

This guide explains how to enable the "Save Results" flow that opens a pull request with the generated scan results.

Most organizations can use the default GITHUB_TOKEN. Some enterprises block PR creation by Actions. If you don't control the org or this policy is locked down, use the Bot Token fallback described below.

## 1) Basic setup (GITHUB_TOKEN)

- The workflow `.github/workflows/submit-analysis.yml` listens for a `repository_dispatch` event of type `template-analysis-completed`.
- It generates result files and creates a PR with `peter-evans/create-pull-request`.
- Minimum permissions:
  - In the workflow file (already present):
    ```yaml
    permissions:
      contents: write
      pull-requests: write
    ```
  - In Org AND Repo settings → Actions → General → Workflow permissions:
    - Read and write permissions
    - Allow GitHub Actions to create and approve pull requests (must be checked if using `GITHUB_TOKEN`).

If the org has that checkbox disabled and you cannot change it, use the Bot Token fallback.

## 2) Bot Token fallback (recommended for orgs you don't own)

Some organizations restrict GITHUB_TOKEN from creating PRs. Template Doctor includes a safe fallback to a personal access token (PAT) stored as a secret called `ACTIONS_BOT_TOKEN`.

- In `.github/workflows/submit-analysis.yml`, PR creation is split into two steps:
  - Uses `ACTIONS_BOT_TOKEN` if present
  - Falls back to `GITHUB_TOKEN` otherwise

### Steps

1. Create a bot/service account
   - Either a dedicated GitHub user or an internal automation account with access to your repo.

2. Generate a fine-grained PAT
   - Scope it only to the target repository (e.g., `Template-Doctor/template-doctor`).
   - Permissions:
     - Contents: Read & Write
     - Pull requests: Read & Write
   - If your organization requires SSO, click "Authorize" for the org after creating the token.

3. Add the token as a repo secret
   - Go to Repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: `ACTIONS_BOT_TOKEN`
   - Value: paste the PAT

4. Re-run "Save Results"
   - Trigger a scan and click "Save Results" in the UI. The workflow will use `ACTIONS_BOT_TOKEN` and should create the PR successfully.

### Security tips

- Prefer a fine-grained PAT over classic tokens. Limit the repo scope and permissions to only what is required.
- Rotate the token periodically and remove it when not needed.
- Keep branch protection rules as desired; they don't block PR creation.

## 3) Auto-approve (optional)

If you use an auto-approve step, the same restriction applies. Either:
- Enable the "Allow GitHub Actions to create and approve pull requests" setting, or
- Use a PAT (e.g., `ACTIONS_BOT_TOKEN`) in that step as well.

## 4) Dispatch source and repository selection

- The dispatch to start this workflow is sent by Template Doctor's server function using `GH_WORKFLOW_TOKEN`.
- Target repository resolution precedence:
  1. `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME`
  2. `GITHUB_REPOSITORY` (owner/repo)
  3. `GITHUB_ACTION_REPO` (server-side override)
- Set these where the API runs (local functions or your production environment).

## 5) Troubleshooting

- Error: "GitHub Actions is not permitted to create or approve pull requests."
  - Cause: Org policy blocks PR creation via GITHUB_TOKEN.
  - Fix: Enable the checkbox in Org/Repo settings OR set up `ACTIONS_BOT_TOKEN` as described above.

- Error: 404 from the submit endpoint
  - Ensure the API is deployed and the frontend points to the correct `apiBase`.

- Error: 401/403 from GitHub
  - Check that `GH_WORKFLOW_TOKEN` has `repo` and `workflow` scopes and is authorized for the org (SSO).

