#!/bin/bash
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Template Doctor Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run pre-deployment checklist
echo "🔍 Running pre-deployment validation..."
echo ""
if ! "$SCRIPT_DIR/pre-deploy-checklist.sh"; then
    echo ""
    echo "❌ Pre-deployment checks failed!"
    echo "   Fix the issues above before deploying."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment variables from azd
eval $(azd env get-values)

if [ -z "$AZURE_CONTAINER_REGISTRY_NAME" ]; then
    echo "❌ Error: Azure resources not found."
    echo "   Run 'azd provision' first to create infrastructure."
    exit 1
fi

echo "📦 Building Docker image in Azure Container Registry..."
echo "   Registry: $AZURE_CONTAINER_REGISTRY_NAME"
echo ""

# Generate build timestamp for unique tagging
BUILD_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BUILD_TAG="build-${BUILD_TIMESTAMP}"

echo "   Image tags: latest, ${BUILD_TAG}"
echo ""

# Build with unique tag AND latest (ACR doesn't support --no-cache, but uses fresh context by design)
az acr build \
    --registry "$AZURE_CONTAINER_REGISTRY_NAME" \
    --image "template-doctor/web:latest" \
    --image "template-doctor/web:${BUILD_TAG}" \
    --file Dockerfile.combined \
    .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed in ACR!"
    exit 1
fi

echo ""
echo "✅ Image built successfully with tags: latest, ${BUILD_TAG}"

echo ""
echo "🔄 Updating Container App..."
echo "   App: $SERVICE_WEB_NAME"
echo "   Resource Group: $AZURE_RESOURCE_GROUP"
echo "   Using timestamped image: ${BUILD_TAG}"
echo ""

# Update container app with the TIMESTAMPED image (not :latest) to force pull
# Also set backend URL and deployment timestamp for verification
az containerapp update \
    --name "$SERVICE_WEB_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --image "${AZURE_CONTAINER_REGISTRY_ENDPOINT}/template-doctor/web:${BUILD_TAG}" \
    --set-env-vars "TD_BACKEND_BASE_URL=${SERVICE_WEB_URI}" "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}" "BUILD_TAG=${BUILD_TAG}"

if [ $? -ne 0 ]; then
    echo "❌ Container App update failed!"
    exit 1
fi

echo ""
echo "⏳ Waiting for new revision to be ready..."
sleep 5

# Get the latest revision and check if it's active
REVISION=$(az containerapp revision list \
    --name "$SERVICE_WEB_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query "[0].name" -o tsv)

echo "   Latest revision: $REVISION"

# Verify the new image is deployed
DEPLOYED_IMAGE=$(az containerapp revision show \
    --name "$SERVICE_WEB_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --revision "$REVISION" \
    --query "properties.template.containers[0].image" -o tsv)

echo "   Deployed image: $DEPLOYED_IMAGE"

if [[ "$DEPLOYED_IMAGE" == *"${BUILD_TAG}"* ]]; then
    echo "   ✅ Verified: New image is deployed"
else
    echo "   ⚠️  Warning: Image tag mismatch!"
    echo "      Expected: ${BUILD_TAG}"
    echo "      Deployed: $DEPLOYED_IMAGE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Application URL: $SERVICE_WEB_URI"
echo "🏷️  Build Tag: ${BUILD_TAG}"
echo "� Build Timestamp: ${BUILD_TIMESTAMP}"
echo ""
echo "�📝 Next steps:"
echo "   1. Wait 30-60 seconds for container to fully start"
echo "   2. Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)"
echo "   3. Check build info: ${SERVICE_WEB_URI}/api/health"
echo "   4. Update GitHub OAuth app callback URL if needed:"
echo "      ${SERVICE_WEB_URI}/callback.html"
echo ""
echo "🔍 Verify deployment:"
echo "   curl ${SERVICE_WEB_URI}/api/health | jq '.env.BUILD_TAG'"
echo "   Should return: \"${BUILD_TAG}\""
echo ""
