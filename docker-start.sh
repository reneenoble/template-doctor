#!/bin/bash
# Start Template Doctor in Docker containers
# Usage: ./docker-start.sh [--build] [--logs]

set -e

cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Template Doctor - Docker Startup${NC}"
echo

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with your configuration."
    echo "You can copy .env.example as a starting point."
    exit 1
fi

# Build the server first (needed for Docker)
echo -e "${YELLOW}📦 Building Express server...${NC}"
cd packages/server
npm run build
cd ../..
echo -e "${GREEN}✅ Server built${NC}"
echo

# Build the frontend (needed for Docker)
echo -e "${YELLOW}📦 Building frontend app...${NC}"
cd packages/app
npm run build
cd ../..
echo -e "${GREEN}✅ Frontend built${NC}"
echo

# Parse arguments
BUILD_FLAG=""
LOGS_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD_FLAG="--build"
            shift
            ;;
        --logs)
            LOGS_FLAG="--follow"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--build] [--logs]"
            exit 1
            ;;
    esac
done

# Start containers
if [ -n "$BUILD_FLAG" ]; then
    echo -e "${YELLOW}🔨 Building and starting containers...${NC}"
    docker-compose up -d --build
else
    echo -e "${YELLOW}🚀 Starting containers...${NC}"
    docker-compose up -d
fi

echo
echo -e "${GREEN}✅ Containers started!${NC}"
echo
echo "Services:"
echo -e "  ${GREEN}🖥️  Frontend:${NC} http://localhost:4000"
echo -e "  ${GREEN}⚙️  Backend:${NC}  http://localhost:3001"
echo -e "  ${GREEN}❤️  Health:${NC}   http://localhost:3001/api/health"
echo
echo "Commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop:          docker-compose down"
echo "  Restart:       docker-compose restart"
echo "  Rebuild:       ./docker-start.sh --build"
echo

# Show logs if requested
if [ -n "$LOGS_FLAG" ]; then
    echo -e "${YELLOW}📋 Showing logs (Ctrl+C to exit)...${NC}"
    echo
    docker-compose logs -f
else
    echo "Checking container health..."
    sleep 3
    docker-compose ps
fi
