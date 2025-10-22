# OAuth Configuration Guide

This document explains how GitHub OAuth authentication works in Template Doctor for both local development and production environments.

## Critical Port Requirement

**⚠️ IMPORTANT**: For OAuth to work correctly, both the frontend and backend MUST run on the same port that matches your GitHub OAuth app's callback URL configuration.

- **Docker/Preview (Recommended)**: Both services run on port 3000
- **GitHub OAuth App**: Callback URL must be `http://localhost:3000/callback.html`
- **Configuration**: Both `GITHUB_CLIENT_ID` and OAuth callback must use port 3000

**Why?** OAuth redirects the user back to the callback URL. If the frontend is on port 4000 but OAuth expects port 3000, authentication will fail with a redirect mismatch error.

## How redirectUri Works

The GitHub OAuth authentication system requires a redirectUri to handle the callback after a user authorizes the application. Here's how it works in Template Doctor:

### Default Dynamic Behavior

By default, Template Doctor dynamically builds the redirectUri based on the current environment:

```javascript
redirectUri: window.location.origin + getBasePath() + '/callback.html';
```

This means:

- In local development (Docker/Preview): `http://localhost:3000/callback.html`
- In production (GitHub Pages): `https://your-username.github.io/template-doctor/callback.html`
- In production (Azure): `https://your-staticwebapp.azurestaticapps.net/callback.html`

**Note**: The legacy development setup using separate ports (frontend on 4000, backend on 3001) is no longer recommended due to OAuth complexity. Use the combined Docker setup on port 3000 instead.

### Configuration Options

You can override this behavior in two ways:

1. **Leave it empty in config.json (recommended)**:

   ```json
   {
     "githubOAuth": {
       "redirectUri": ""
     }
   }
   ```

   With an empty string, the system will use the dynamic redirectUri based on the current environment.

2. **Specify a custom redirectUri**:
   ```json
   {
     "githubOAuth": {
       "redirectUri": "https://specific-domain.com/callback.html"
     }
   }
   ```
   This is useful for scenarios where you need a specific callback URL that differs from the dynamic one.

## GitHub OAuth App Setup

When registering your GitHub OAuth App:

1. For local development (Docker/Preview):
   - Set the callback URL to: `http://localhost:3000/callback.html`
   - Both frontend and backend will run on port 3000

2. For production:
   - Set the callback URL to match your production environment:
     - GitHub Pages: `https://your-username.github.io/template-doctor/callback.html`
     - Azure: `https://your-staticwebapp.azurestaticapps.net/callback.html`

3. For multiple environments:
   - You can register multiple OAuth apps with different callback URLs
   - Use environment variables to configure the appropriate client ID for each environment
   - **Each OAuth app must match the port where your application is served**

## Environment Variable Configuration

The OAuth client ID and secret are provided through environment variables:

- For local development: Set in the consolidated `.env` file at the root of the project
- For GitHub Pages: Configure as GitHub repository secrets
- For Azure: Configure in App Settings

Example in the `.env` file:

```
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret
```

See the [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md) for a complete list of all environment variables used in the project.

## Troubleshooting

If you encounter OAuth redirect issues:

1. **Port Mismatch**: Verify that both frontend and backend are running on the SAME port (3000 for Docker/Preview)
2. **Callback URL**: Check the browser console for the actual redirectUri being used
3. **OAuth App Settings**: Verify that the redirectUri matches one of the callback URLs in your GitHub OAuth App settings
4. **Config File**: Ensure `config.json` either has an empty redirectUri or one that matches your OAuth App settings
5. **Cache**: Clear browser cache and cookies if testing changes to the OAuth configuration
6. **Different Ports Error**: If you see "redirect_uri_mismatch", you're likely running frontend and backend on different ports - use Docker Compose to run both on port 3000
