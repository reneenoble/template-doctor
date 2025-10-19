#!/bin/bash
# Quick deployment script for Template Doctor using Azure Developer CLI

set -e

echo "🚀 Template Doctor - Azure Deployment"
echo "======================================"
echo ""

# Check if azd is installed
if ! command -v azd &> /dev/null; then
    echo "❌ Azure Developer CLI (azd) not found"
    echo "📥 Installing azd..."
    curl -fsSL https://aka.ms/install-azd.sh | bash
    export PATH="$HOME/.azd/bin:$PATH"
fi

# Check if logged in
if ! azd auth login --check-status &> /dev/null; then
    echo "🔐 Please log in to Azure..."
    azd auth login
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your GitHub credentials:"
    echo "   GITHUB_CLIENT_ID=Iv1.xxxxxxxx"
    echo "   GITHUB_CLIENT_SECRET=xxxxxxxx"
    echo "   GITHUB_TOKEN=ghp_xxxxxxxx"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

# Verify GitHub credentials are set
source .env
if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GitHub credentials not found in .env"
    echo ""
    echo "Add these to your .env file:"
    echo "  GITHUB_CLIENT_ID=your-oauth-client-id"
    echo "  GITHUB_CLIENT_SECRET=your-oauth-client-secret"
    echo "  GITHUB_TOKEN=ghp_your-personal-access-token"
    echo ""
    echo "Create OAuth app: https://github.com/settings/developers"
    echo "Create PAT: https://github.com/settings/tokens/new (scopes: repo, workflow, read:org)"
    exit 1
fi

echo "✅ GitHub credentials found in .env"
echo "   CLIENT_ID: ${GITHUB_CLIENT_ID:0:10}..."
echo "   TOKEN: ${GITHUB_TOKEN:0:10}..."
echo ""

# Prompt for environment name
read -p "Enter environment name (e.g., dev, staging, production) [dev]: " ENV_NAME
ENV_NAME=${ENV_NAME:-dev}

# Check if environment exists
if azd env list 2>/dev/null | grep -q "^${ENV_NAME}$"; then
    echo "✅ Using existing environment: ${ENV_NAME}"
    azd env select "${ENV_NAME}"
else
    echo "📝 Creating new environment: ${ENV_NAME}"
    azd env new "${ENV_NAME}"
fi

echo ""
echo "🏗️  Provisioning Azure infrastructure..."
echo "   (GitHub credentials will be read from .env automatically)"
azd provision

echo ""
echo "🐳 Building and deploying Docker container..."
azd deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Application URL:"
azd env get-value SERVICE_WEB_URI
echo ""
echo "🔧 Next steps:"
echo "1. Update GitHub OAuth app callback URL to:"
echo "   $(azd env get-value SERVICE_WEB_URI)/callback.html"
echo ""
echo "2. View logs:"
echo "   azd monitor --logs"
echo ""
echo "3. Open application:"
echo "   open $(azd env get-value SERVICE_WEB_URI)"
