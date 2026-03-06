#!/bin/bash

# Thesis Management System - Workflow Start Script
# This script manages the Docker-based development environment.

set -e

# Configuration
PROJECT_NAME="thesismgr"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Thesis Management System Automation ===${NC}"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: docker-compose is not installed.${NC}"
        exit 1
    else
        DOCKER_BE="docker compose"
    fi
else
    DOCKER_BE="docker-compose"
fi

show_help() {
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up        Start the project (builds if necessary)"
    echo "  down      Stop and remove containers"
    echo "  restart   Restart the project"
    echo "  build     Rebuild containers"
    echo "  logs      Follow logs"
    echo "  status    Check container status"
    echo "  shell     Open a shell in a service (e.g. ./start.sh shell backend)"
    echo "  help      Show this help"
    echo ""
    echo "Default command is 'up'."
}

case "$1" in
    up|"" )
        echo -e "${GREEN}Starting $PROJECT_NAME...${NC}"
        $DOCKER_BE up -d
        echo -e "${GREEN}Services are running:${NC}"
        $DOCKER_BE ps
        echo -e "${YELLOW}Show logs with: ./start.sh logs${NC}"
        ;;
    down )
        echo -e "${YELLOW}Stopping $PROJECT_NAME...${NC}"
        $DOCKER_BE down
        ;;
    restart )
        echo -e "${BLUE}Restarting $PROJECT_NAME...${NC}"
        $DOCKER_BE restart
        ;;
    build )
        echo -e "${BLUE}Building $PROJECT_NAME containers...${NC}"
        $DOCKER_BE build
        ;;
    logs )
        echo -e "${BLUE}Attaching to logs...${NC}"
        $DOCKER_BE logs -f
        ;;
    status )
        $DOCKER_BE ps
        ;;
    shell )
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: ./start.sh shell [backend|frontend|mongo]${NC}"
            exit 1
        fi
        $DOCKER_BE exec -it "$2" /bin/sh || $DOCKER_BE exec -it "$2" /bin/bash
        ;;
    help|* )
        show_help
        ;;
esac
