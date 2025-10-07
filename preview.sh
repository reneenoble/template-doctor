#!/bin/bash
# Start Template Doctor in preview mode (production build on port 3000)
# This is for testing OAuth with a dedicated OAuth app

set -e

cd "$(dirname "$0")/packages/app"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🏗️  Template Doctor - Preview Mode${NC}"
echo

# Copy preview config
echo -e "${YELLOW}📝 Using preview configuration (port 3000)...${NC}"
cp config.preview.json config.json
echo -e "${GREEN}✅ Config updated${NC}"
echo

# Build the app
echo -e "${YELLOW}📦 Building frontend...${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo

# Start preview server
echo -e "${GREEN}🚀 Starting preview server on port 3000...${NC}"
echo
echo -e "  ${GREEN}🖥️  Frontend:${NC} http://localhost:3000"
echo -e "  ${GREEN}🔐 OAuth Callback:${NC} http://localhost:3000/callback.html"
echo -e "  ${GREEN}⚙️  Backend:${NC} http://localhost:3001 (must be running separately)"
echo
echo "Make sure Express server is running:"
echo "  cd packages/server && npm run dev"
echo
echo "Configure GitHub OAuth app with:"
echo "  Homepage URL: http://localhost:3000"
echo "  Callback URL: http://localhost:3000/callback.html"
echo

npm run preview
