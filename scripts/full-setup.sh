#!/usr/bin/env bash
#
# Template Doctor - Full Setup Script (Improved)
# ===============================================
# This script guides you through the complete setup process for Template Doctor.
#
# Usage: ./scripts/full-setup-improved.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Path to repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# Track setup state
GITHUB_OAUTH_DONE=false
GITHUB_PAT_DONE=false
MONGODB_DONE=false
ENV_CONFIGURED=false

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║                                                          ║${NC}"
    echo -e "${CYAN}${BOLD}║        Template Doctor - Full Setup Wizard              ║${NC}"
    echo -e "${CYAN}${BOLD}║                                                          ║${NC}"
    echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}${BOLD}  $1${NC}"
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

wait_for_enter() {
    echo ""
    read -p "Press ENTER to continue..." -r
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ "$default" == "y" ]]; then
        read -p "$prompt [Y/n] " -r
        [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]
    else
        read -p "$prompt [y/N] " -r
        [[ "$REPLY" =~ ^[Yy]$ ]]
    fi
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    print_section "Step 1: Prerequisites Check"
    
    local all_good=true
    
    # Check Docker
    print_step "Checking Docker..."
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            local docker_version=$(docker --version | cut -d' ' -f3 | tr -d ',')
            print_success "Docker installed and running (version: $docker_version)"
        else
            print_warning "Docker installed but not running"
            print_info "Start Docker Desktop or docker daemon"
            all_good=false
        fi
    else
        print_error "Docker not found"
        print_info "Install: https://www.docker.com/products/docker-desktop"
        all_good=false
    fi
    
    # Check Node.js (optional but recommended)
    print_step "Checking Node.js..."
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        print_success "Node.js installed ($node_version)"
    else
        print_warning "Node.js not found (optional but recommended for local dev)"
    fi
    
    echo ""
    
    if [[ "$all_good" != true ]]; then
        print_error "Some prerequisites are missing. Please install them and run this script again."
        exit 1
    fi
    
    print_success "All prerequisites satisfied!"
    wait_for_enter
}

# =============================================================================
# GitHub OAuth App Setup
# =============================================================================

setup_github_oauth() {
    print_section "Step 2: GitHub OAuth App Setup"
    
    print_info "You need a GitHub OAuth App for user authentication."
    echo ""
    echo "This will be used for:"
    echo "  • User login to Template Doctor"
    echo "  • GitHub issue creation"
    echo "  • User-specific repository access"
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Create new GitHub OAuth App (guided setup)"
    echo -e "  ${BOLD}2)${NC} I already have OAuth credentials"
    echo -e "  ${BOLD}3)${NC} I will add values manually to .env later"
    echo ""
    
    read -p "Your choice [1-3]: " -r
    
    case "$REPLY" in
        1)
            echo ""
            print_info "Let's create a GitHub OAuth App:"
            echo ""
            echo -e "1. Open: ${CYAN}https://github.com/settings/developers${NC}"
            echo -e "2. Click '${BOLD}New OAuth App${NC}'"
            echo -e "3. Fill in:"
            echo -e "   ${BOLD}Application name:${NC} Template Doctor"
            echo -e "   ${BOLD}Homepage URL:${NC} http://localhost:3000 (for local dev)"
            echo -e "   ${BOLD}Authorization callback URL:${NC} http://localhost:3000/callback.html"
            echo -e "4. Click '${BOLD}Register application${NC}'"
            echo -e "5. Copy the ${BOLD}Client ID${NC} (starts with Ov or Iv)"
            echo -e "6. Click '${BOLD}Generate a new client secret${NC}'"
            echo -e "7. Copy the ${BOLD}Client Secret${NC} (you won't see it again!)"
            echo ""
            print_warning "NOTE: For production, create a separate OAuth app with production URL"
            echo ""
            
            wait_for_enter
            
            echo ""
            read -p "GitHub Client ID: " GITHUB_CLIENT_ID
            read -sp "GitHub Client Secret: " GITHUB_CLIENT_SECRET
            echo ""
            
            if [[ -z "$GITHUB_CLIENT_ID" || -z "$GITHUB_CLIENT_SECRET" ]]; then
                print_error "Both Client ID and Secret are required"
                exit 1
            fi
            
            GITHUB_OAUTH_DONE=true
            print_success "OAuth App configured!"
            ;;
            
        2)
            echo ""
            print_step "Great! Enter your OAuth App credentials:"
            echo ""
            
            read -p "GitHub Client ID (starts with Ov or Iv): " GITHUB_CLIENT_ID
            read -sp "GitHub Client Secret: " GITHUB_CLIENT_SECRET
            echo ""
            
            if [[ -z "$GITHUB_CLIENT_ID" || -z "$GITHUB_CLIENT_SECRET" ]]; then
                print_error "Both Client ID and Secret are required"
                exit 1
            fi
            
            GITHUB_OAUTH_DONE=true
            print_success "OAuth credentials saved!"
            ;;
            
        3)
            GITHUB_CLIENT_ID="<add-manually>"
            GITHUB_CLIENT_SECRET="<add-manually>"
            GITHUB_OAUTH_DONE=true
            print_info "Skipping OAuth setup - remember to add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env"
            ;;
            
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    wait_for_enter
}

# =============================================================================
# GitHub Personal Access Token
# =============================================================================

setup_github_pat() {
    print_section "Step 3: GitHub Personal Access Tokens"
    
    print_info "Template Doctor needs GitHub PATs for backend operations."
    echo ""
    echo "We need tokens for:"
    echo "  • ${BOLD}GITHUB_TOKEN${NC} - General repository access (clone, analyze, PR creation)"
    echo "  • ${BOLD}GITHUB_TOKEN_ANALYZER${NC} - Analyzer-specific operations"
    echo "  • ${BOLD}GH_WORKFLOW_TOKEN${NC} - Workflow dispatch for validations"
    echo ""
    echo "Required scopes: ${BOLD}repo${NC}, ${BOLD}workflow${NC}, ${BOLD}read:org${NC}"
    echo ""
    print_info "${BOLD}NOTE:${NC} You can use the same token for all three variables unless you need different scopes."
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Create new GitHub PAT (guided setup)"
    echo -e "  ${BOLD}2)${NC} I already have a GitHub PAT"
    echo -e "  ${BOLD}3)${NC} I will add values manually to .env later"
    echo ""
    
    read -p "Your choice [1-3]: " -r
    
    case "$REPLY" in
        1)
            echo ""
            print_info "Let's create a GitHub Personal Access Token:"
            echo ""
            echo -e "1. Open: ${CYAN}https://github.com/settings/tokens/new${NC}"
            echo -e "2. Give it a name: ${BOLD}Template Doctor${NC}"
            echo -e "3. Set expiration: ${BOLD}90 days${NC} or longer"
            echo -e "4. Select these scopes:"
            echo -e "   ${BOLD}☑ repo${NC} - Full control of private repositories"
            echo -e "   ${BOLD}☑ workflow${NC} - Update GitHub Action workflows"
            echo -e "   ${BOLD}☑ read:org${NC} - Read org and team membership"
            echo -e "5. Click '${BOLD}Generate token${NC}'"
            echo -e "6. Copy the token (starts with ghp_)"
            echo ""
            print_warning "You won't be able to see this token again!"
            echo ""
            
            wait_for_enter
            
            echo ""
            read -sp "GitHub Personal Access Token: " GITHUB_TOKEN
            echo ""
            
            if [[ -z "$GITHUB_TOKEN" ]]; then
                print_error "GitHub token is required"
                exit 1
            fi
            
            # Use same token for all three by default
            echo ""
            if ask_yes_no "Use the same token for GITHUB_TOKEN_ANALYZER and GH_WORKFLOW_TOKEN?" "y"; then
                GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                print_info "Using same token for all GitHub operations"
            else
                echo ""
                print_step "Enter separate tokens (or press Enter to use same):"
                echo ""
                read -sp "GITHUB_TOKEN_ANALYZER (Enter for same): " GITHUB_TOKEN_ANALYZER
                echo ""
                if [[ -z "$GITHUB_TOKEN_ANALYZER" ]]; then
                    GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                fi
                
                read -sp "GH_WORKFLOW_TOKEN (Enter for same): " GH_WORKFLOW_TOKEN
                echo ""
                if [[ -z "$GH_WORKFLOW_TOKEN" ]]; then
                    GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                fi
            fi
            
            GITHUB_PAT_DONE=true
            print_success "GitHub PATs configured!"
            ;;
            
        2)
            echo ""
            print_step "Enter your GitHub PAT:"
            echo ""
            
            read -sp "GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN
            echo ""
            
            if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
                print_warning "Token doesn't start with 'ghp_' - are you sure it's correct?"
                if ! ask_yes_no "Continue anyway?"; then
                    exit 1
                fi
            fi
            
            echo ""
            if ask_yes_no "Use the same token for GITHUB_TOKEN_ANALYZER and GH_WORKFLOW_TOKEN?" "y"; then
                GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
            else
                echo ""
                read -sp "GITHUB_TOKEN_ANALYZER (Enter for same): " GITHUB_TOKEN_ANALYZER
                echo ""
                if [[ -z "$GITHUB_TOKEN_ANALYZER" ]]; then
                    GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                fi
                
                read -sp "GH_WORKFLOW_TOKEN (Enter for same): " GH_WORKFLOW_TOKEN
                echo ""
                if [[ -z "$GH_WORKFLOW_TOKEN" ]]; then
                    GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                fi
            fi
            
            GITHUB_PAT_DONE=true
            print_success "GitHub PATs saved!"
            ;;
            
        3)
            GITHUB_TOKEN="<add-manually>"
            GITHUB_TOKEN_ANALYZER="<add-manually>"
            GH_WORKFLOW_TOKEN="<add-manually>"
            GITHUB_PAT_DONE=true
            print_info "Skipping GitHub PAT setup - remember to add tokens to .env"
            ;;
            
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    wait_for_enter
}

# =============================================================================
# MongoDB Setup
# =============================================================================

setup_mongodb() {
    print_section "Step 4: MongoDB Database Setup"
    
    print_info "Template Doctor requires MongoDB for storing analysis results."
    echo ""
    echo "Choose your deployment target:"
    echo -e "  ${BOLD}1)${NC} Local development (Docker Compose) - ${CYAN}Recommended${NC}"
    echo -e "  ${BOLD}2)${NC} Production (Azure Cosmos DB with Managed Identity)"
    echo -e "  ${BOLD}3)${NC} Custom MongoDB (provide connection string)"
    echo -e "  ${BOLD}4)${NC} I will configure manually later"
    echo ""
    
    read -p "Your choice [1-4]: " -r
    
    case "$REPLY" in
        1)
            print_step "Configuring for local development..."
            echo ""
            print_info "For local development, Template Doctor uses:"
            echo -e "  • MongoDB container via docker-compose"
            echo -e "  • Database: ${BOLD}template-doctor${NC}"
            echo -e "  • Connection: ${CYAN}mongodb://mongodb:27017/template-doctor${NC}"
            echo ""
            print_success "No configuration needed - docker-compose handles this automatically!"
            echo ""
            print_info "To start local development:"
            echo -e "  ${BOLD}docker-compose --profile combined up${NC}"
            echo ""
            
            # Don't set MONGODB_URI for local - let docker-compose default handle it
            MONGODB_URI=""
            MONGODB_DONE=true
            ;;
            
        2)
            print_step "Configuring for Azure Cosmos DB (Production)..."
            echo ""
            print_info "Production deployment uses Azure Cosmos DB with Managed Identity (MI)."
            echo ""
            echo "Steps:"
            echo -e "  1. Create Azure Cosmos DB account (MongoDB API) in Azure Portal"
            echo -e "  2. Create database: ${BOLD}template-doctor${NC}"
            echo -e "  3. Enable Managed Identity on your Container App"
            echo -e "  4. Grant Container App's MI these roles on Cosmos DB:"
            echo -e "     • ${BOLD}Cosmos DB Built-in Data Contributor${NC}"
            echo -e "  5. DO NOT use connection strings - MI handles authentication"
            echo ""
            print_warning "IMPORTANT: Use Managed Identity, NOT connection strings for production!"
            echo ""
            print_info "Documentation:"
            echo "  • Cosmos DB setup: docs/deployment/COSMOS_DB_PORTAL_SETUP.md"
            echo "  • MI configuration: https://learn.microsoft.com/azure/container-apps/managed-identity"
            echo ""
            
            MONGODB_URI="<use-managed-identity-in-production>"
            MONGODB_DONE=true
            ;;
            
        3)
            print_step "Using custom MongoDB..."
            echo ""
            print_info "Enter your MongoDB connection string:"
            echo -e "Format: ${CYAN}mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/?options${NC}"
            echo ""
            
            read -p "MongoDB URI: " MONGODB_URI
            
            if [[ ! "$MONGODB_URI" =~ ^mongodb ]]; then
                print_error "MongoDB URI must start with 'mongodb://' or 'mongodb+srv://'"
                exit 1
            fi
            
            MONGODB_DONE=true
            print_success "MongoDB configured!"
            ;;
            
        4)
            MONGODB_URI="<add-manually>"
            MONGODB_DONE=true
            print_info "Skipping MongoDB setup - remember to configure in .env"
            ;;
            
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    wait_for_enter
}

# =============================================================================
# Admin User Setup
# =============================================================================

setup_admin_user() {
    print_section "Step 5: Admin User Configuration"
    
    print_info "Who should have admin access to Template Doctor?"
    echo ""
    echo "Admin users can:"
    echo "  • Access /leaderboard endpoints"
    echo "  • View /api/v4/admin/* endpoints"
    echo "  • Manage system configuration"
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Enter admin usernames now"
    echo -e "  ${BOLD}2)${NC} I will configure manually later"
    echo ""
    
    read -p "Your choice [1-2]: " -r
    
    case "$REPLY" in
        1)
            echo ""
            print_step "Enter GitHub usernames (comma-separated):"
            print_info "Example: user1,user2,user3"
            echo ""
            
            read -p "Admin GitHub users: " ADMIN_GITHUB_USERS
            
            if [[ -z "$ADMIN_GITHUB_USERS" ]]; then
                print_warning "No admin users specified - you can add them to .env later"
                ADMIN_GITHUB_USERS=""
            else
                print_success "Admin users: $ADMIN_GITHUB_USERS"
            fi
            ;;
            
        2)
            ADMIN_GITHUB_USERS="<add-manually>"
            print_info "Skipping admin setup - remember to add ADMIN_GITHUB_USERS to .env"
            ;;
            
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    wait_for_enter
}

# =============================================================================
# Workflow Dispatch Repository
# =============================================================================

setup_dispatch_repo() {
    print_section "Step 6: GitHub Actions Workflow Configuration"
    
    print_info "Where should GitHub Actions workflows run?"
    echo ""
    echo "Template Doctor triggers GitHub Actions workflows for:"
    echo "  • Template validation (azd-validation)"
    echo "  • Docker image scanning"
    echo "  • OSSF scorecard checks"
    echo ""
    echo -e "The ${BOLD}DISPATCH_TARGET_REPO${NC} is where these workflows execute."
    echo ""
    print_info "This should typically be YOUR fork or the repository you're working with."
    echo ""
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Enter repository now (format: owner/repo)"
    echo -e "  ${BOLD}2)${NC} I will configure manually later"
    echo ""
    
    read -p "Your choice [1-2]: " -r
    
    case "$REPLY" in
        1)
            echo ""
            read -p "Repository (format: owner/repo): " DISPATCH_TARGET_REPO
            
            if [[ ! "$DISPATCH_TARGET_REPO" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
                print_error "Invalid format - must be owner/repo"
                exit 1
            fi
            
            print_success "Dispatch target: $DISPATCH_TARGET_REPO"
            ;;
            
        2)
            DISPATCH_TARGET_REPO="<add-manually>"
            print_info "Skipping dispatch repo setup - remember to add DISPATCH_TARGET_REPO to .env"
            ;;
            
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    wait_for_enter
}

# =============================================================================
# Create .env File
# =============================================================================

create_env_file() {
    print_section "Step 7: Creating .env File"
    
    if [[ -f "$ENV_FILE" ]]; then
        print_warning ".env file already exists!"
        if ! ask_yes_no "Overwrite it?"; then
            print_info "Keeping existing .env file"
            return
        fi
        mv "$ENV_FILE" "${ENV_FILE}.backup.$(date +%s)"
        print_info "Backed up existing .env file"
    fi
    
    print_step "Creating .env file with your configuration..."
    
    # Prepare MongoDB line based on whether URI was set
    if [[ -n "$MONGODB_URI" ]]; then
        MONGODB_LINE="MONGODB_URI=$MONGODB_URI"
    else
        MONGODB_LINE="# MONGODB_URI - Leave unset for local dev (docker-compose default)"
    fi
    
    cat > "$ENV_FILE" << EOF
###################################################################################################
# Template Doctor - Environment Configuration
# Generated by full-setup.sh on $(date)
###################################################################################################

############################################
# GitHub OAuth / API Authentication (REQUIRED)
############################################
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_TOKEN_ANALYZER=$GITHUB_TOKEN_ANALYZER
GH_WORKFLOW_TOKEN=$GH_WORKFLOW_TOKEN

# Admin Access Control (comma-separated GitHub usernames)
ADMIN_GITHUB_USERS=$ADMIN_GITHUB_USERS

# Database
$MONGODB_LINE
MONGODB_DATABASE=template-doctor

############################################
# Server Configuration
############################################
# Express Server Port (backend + frontend combined)
PORT=3000

# Frontend Vite Dev Server Port (if running separately)
VITE_PORT=3000

# Legacy compatibility
SERVE_FRONTEND=true
BASE=http://localhost:7071

############################################
# Application Defaults
############################################
DEFAULT_RULE_SET=dod
REQUIRE_AUTH_FOR_RESULTS=true
AUTO_SAVE_RESULTS=false
ARCHIVE_ENABLED=true
ARCHIVE_COLLECTION=gallery
ARCHIVE_REPO_SLUG=Template-Doctor/centralized-collections-archive
ISSUE_AI_ENABLED=false
DEPRECATED_MODELS=gpt-3.5-turbo,model-old-x

# Target repository for GitHub Actions workflow dispatch
DISPATCH_TARGET_REPO=$DISPATCH_TARGET_REPO

EOF
    
    ENV_CONFIGURED=true
    print_success ".env file created successfully!"
    print_info "Location: $ENV_FILE"
    
    # Show what needs manual configuration
    if grep -q "<add-manually>" "$ENV_FILE"; then
        echo ""
        print_warning "The following values need manual configuration:"
        grep "<add-manually>" "$ENV_FILE" | sed 's/=.*//' | while read -r var; do
            echo "  • $var"
        done
        echo ""
        print_info "Edit $ENV_FILE to add these values"
    fi
    
    wait_for_enter
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_section "Setup Complete! 🎉"
    
    echo -e "${GREEN}${BOLD}Template Doctor setup is complete!${NC}"
    echo ""
    
    print_info "What's configured:"
    echo ""
    
    if [[ "$GITHUB_OAUTH_DONE" == true ]]; then
        print_success "GitHub OAuth App"
    fi
    
    if [[ "$GITHUB_PAT_DONE" == true ]]; then
        print_success "GitHub Personal Access Tokens"
    fi
    
    if [[ "$MONGODB_DONE" == true ]]; then
        print_success "MongoDB Database"
    fi
    
    if [[ "$ENV_CONFIGURED" == true ]]; then
        print_success ".env file created"
    fi
    
    echo ""
    print_info "Next steps for LOCAL DEVELOPMENT:"
    echo ""
    echo -e "  ${BOLD}1. Start with Docker Compose (Recommended):${NC}"
    echo -e "     ${CYAN}docker-compose --profile combined up${NC}"
    echo ""
    echo "     This starts:"
    echo "       • MongoDB container"
    echo "       • Express backend + Vite frontend on port 3000"
    echo ""
    echo -e "  ${BOLD}2. Access the application:${NC}"
    echo -e "     ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo -e "  ${BOLD}3. Test OAuth login:${NC}"
    echo "     • Click 'Sign in with GitHub'"
    echo "     • Authorize the app"
    echo ""
    
    echo ""
    print_info "For PRODUCTION deployment:"
    echo ""
    echo -e "  ${BOLD}1. Set up User-Assigned Managed Identity (UAMI):${NC}"
    echo "     • Create UAMI in Azure Portal"
    echo "     • Grant UAMI access to your Azure subscription"
    echo "     • Grant UAMI 'Contributor' role on target resource group"
    echo ""
    print_warning "  ${BOLD}CRITICAL:${NC} Without UAMI, azd deployment will FAIL!"
    echo "     • azd uses UAMI to provision Azure resources"
    echo "     • Container App uses UAMI to access Cosmos DB (no connection strings)"
    echo "     • See: https://learn.microsoft.com/azure/container-apps/managed-identity"
    echo ""
    echo -e "  ${BOLD}2. Set up Azure Cosmos DB:${NC}"
    echo "     • Create Cosmos DB account (MongoDB API) in Azure Portal"
    echo "     • Create database: template-doctor"
    echo "     • Grant UAMI 'Cosmos DB Built-in Data Contributor' role"
    echo "     • See: docs/deployment/COSMOS_DB_PORTAL_SETUP.md"
    echo ""
    echo -e "  ${BOLD}3. Create production OAuth app:${NC}"
    echo "     • New GitHub OAuth app with production URL"
    echo "     • Update callback URL after deployment"
    echo "     • Add credentials to .env before azd deploy"
    echo ""
    echo -e "  ${BOLD}4. Deploy to Azure:${NC}"
    echo "     • azd init"
    echo "     • azd up (will use UAMI for authentication)"
    echo "     • Monitor deployment logs for any UAMI permission issues"
    echo ""
    
    echo ""
    print_info "Documentation:"
    echo "  • docs/usage/DOCKER.md"
    echo "  • docs/deployment/COSMOS_DB_PORTAL_SETUP.md"
    echo "  • README.md"
    echo ""
    
    print_success "Happy template analyzing! 🚀"
    echo ""
}

# =============================================================================
# Main Flow
# =============================================================================

main() {
    print_header
    
    # Change to repo root
    cd "$REPO_ROOT"
    
    # Run setup steps
    check_prerequisites
    setup_github_oauth
    setup_github_pat
    setup_mongodb
    setup_admin_user
    setup_dispatch_repo
    create_env_file
    
    # Print summary
    print_summary
}

# Run main function
main
