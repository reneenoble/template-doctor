#!/bin/bash
# Stop Template Doctor Docker containers
# Usage: ./docker-stop.sh [--clean]

set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Stopping Template Doctor containers...${NC}"

if [ "$1" == "--clean" ]; then
    echo -e "${YELLOW}🧹 Cleaning up volumes and networks...${NC}"
    docker-compose down -v --remove-orphans
    echo -e "${GREEN}✅ Containers stopped and cleaned${NC}"
else
    docker-compose down
    echo -e "${GREEN}✅ Containers stopped${NC}"
fi

echo
echo "To start again: ./docker-start.sh"
echo "To rebuild:     ./docker-start.sh --build"
