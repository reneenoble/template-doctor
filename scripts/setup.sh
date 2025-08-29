#!/usr/bin/env bash
set -euo pipefail

# Path to repo root (resolve even if run from elsewhere)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE. Copy .env.example to .env and fill it in."
  exit 1
fi

# Export variables from .env
export $(grep -v '^#' "$ENV_FILE" | xargs)

# ==========================
# Derived values
# ==========================
IDENTITY_NAME="template-doctor-identity-UAMIOIDC"   # fixed UAMI name
RESOURCE_GROUP="${ACA_RESOURCE_GROUP}"     # reuse ACA RG
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"

# ==========================
# Safety check
# ==========================
EXISTING=$(az identity list \
  --resource-group "$RESOURCE_GROUP" \
  --subscription "$SUBSCRIPTION_ID" \
  --query "[?name=='$IDENTITY_NAME'].name" -o tsv)

if [ -n "$EXISTING" ]; then
  echo "⚠️  A Managed Identity named '$IDENTITY_NAME' already exists in RG '$RESOURCE_GROUP'."
  read -p "Do you want to continue and reuse it? (y/N) " -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborting."
    exit 1
  fi
fi

# ==========================
# Create / get UAMI
# ==========================
echo "🔹 Ensuring User Assigned Managed Identity: $IDENTITY_NAME exists"

az identity create \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --subscription "$SUBSCRIPTION_ID" || true

CLIENT_ID=$(az identity show \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query clientId -o tsv)

TENANT_ID=$(az identity show \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query tenantId -o tsv)

echo "✅ Managed Identity ready:"
echo "CLIENT_ID=$CLIENT_ID"
echo "TENANT_ID=$TENANT_ID"

# ==========================
# Assign RBAC role
# ==========================
echo "🔹 Assigning Contributor role to identity..."
az role assignment create \
  --assignee "$CLIENT_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID" || true

# ==========================
# Add Federated Credential (all branches in workflow repo)
# ==========================
# ==========================
# Add Federated Credential
# ==========================
echo "🔹 Adding federated credential for main branch in $GITHUB_OWNER/$GITHUB_REPO..."

az identity federated-credential create \
  --name "gh-actions-main" \
  --identity-name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --issuer "https://token.actions.githubusercontent.com" \
  --subject "repo:${GITHUB_OWNER}/${GITHUB_REPO}:ref:refs/heads/main" \
  --audiences "api://AzureADTokenExchange" || true

echo "✅ Federated credential added for main branch"

# ==========================
# Update .env with new values
# ==========================
echo "🔹 Updating .env with new AZURE_CLIENT_ID and AZURE_TENANT_ID"

sed -i.bak "s|^AZURE_CLIENT_ID=.*|AZURE_CLIENT_ID=$CLIENT_ID|" "$ENV_FILE"
sed -i.bak "s|^AZURE_TENANT_ID=.*|AZURE_TENANT_ID=$TENANT_ID|" "$ENV_FILE"

echo ""
echo "🎉 Setup complete! Your .env has been updated."
echo "➡️  Add these values as GitHub Secrets in your repo:"
echo "   AZURE_CLIENT_ID = $CLIENT_ID"
echo "   AZURE_TENANT_ID = $TENANT_ID"
echo "   AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
