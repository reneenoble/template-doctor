#!/usr/bin/env bash
#
# Template Doctor - Full Setup Script
# ====================================
# This script guides you through the complete setup process for Template Doctor:
# 1. Prerequisites check
# 2. GitHub OAuth App creation
# 3. GitHub PAT creation
# 4. MongoDB setup
# 5. Environment configuration
# 6. UAMI setup (optional, for GitHub Actions)
# 7. Azure deployment with azd
#
# Usage: ./scripts/full-setup.sh
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
UAMI_DONE=false

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
    
    # Check Azure CLI
    print_step "Checking Azure CLI..."
    if command -v az &> /dev/null; then
        local az_version=$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "unknown")
        print_success "Azure CLI installed (version: $az_version)"
    else
        print_error "Azure CLI not found"
        print_info "Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
        all_good=false
    fi
    
    # Check Azure Developer CLI
    print_step "Checking Azure Developer CLI (azd)..."
    if command -v azd &> /dev/null; then
        local azd_version=$(azd version 2>/dev/null | head -1 || echo "unknown")
        print_success "Azure Developer CLI installed ($azd_version)"
    else
        print_error "Azure Developer CLI (azd) not found"
        print_info "Install: curl -fsSL https://aka.ms/install-azd.sh | bash"
        all_good=false
    fi
    
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
    
    print_info "You need to create a GitHub OAuth App for user authentication."
    echo ""
    echo "This will be used for:"
    echo "  • User login to Template Doctor"
    echo "  • GitHub issue creation"
    echo "  • User-specific repository access"
    echo ""
    
    if ask_yes_no "Have you already created a GitHub OAuth App?"; then
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
    else
        echo ""
        print_info "Let's create a GitHub OAuth App:"
        echo ""
        echo "1. Open: ${CYAN}https://github.com/settings/developers${NC}"
        echo "2. Click '${BOLD}New OAuth App${NC}'"
        echo "3. Fill in:"
        echo "   ${BOLD}Application name:${NC} Template Doctor (Production)"
        echo "   ${BOLD}Homepage URL:${NC} https://your-app-url (update after deployment)"
        echo "   ${BOLD}Authorization callback URL:${NC} https://your-app-url/callback.html"
        echo "4. Click '${BOLD}Register application${NC}'"
        echo "5. Copy the ${BOLD}Client ID${NC} (starts with Ov or Iv)"
        echo "6. Click '${BOLD}Generate a new client secret${NC}'"
        echo "7. Copy the ${BOLD}Client Secret${NC} (you won't see it again!)"
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
    fi
    
    wait_for_enter
}

# =============================================================================
# GitHub Personal Access Token
# =============================================================================

setup_github_pat() {
    print_section "Step 3: GitHub Personal Access Token (PAT)"
    
    print_info "You need a GitHub PAT for backend operations."
    echo ""
    echo "This will be used for:"
    echo "  • Repository cloning and analysis"
    echo "  • Creating PRs to save results"
    echo "  • Workflow dispatch (azd validation)"
    echo "  • Handling SAML/SSO repositories"
    echo ""
    
    if ask_yes_no "Do you already have a suitable GitHub PAT?"; then
        echo ""
        read -sp "GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN
        echo ""
        
        if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
            print_warning "Token doesn't start with 'ghp_' - are you sure it's correct?"
            if ! ask_yes_no "Continue anyway?"; then
                exit 1
            fi
        fi
        
        GITHUB_PAT_DONE=true
        print_success "GitHub PAT saved!"
    else
        echo ""
        print_info "Let's create a GitHub Personal Access Token:"
        echo ""
        echo "1. Open: ${CYAN}https://github.com/settings/tokens/new${NC}"
        echo "2. Give it a name: ${BOLD}Template Doctor Azure Deployment${NC}"
        echo "3. Set expiration: ${BOLD}90 days${NC} or longer"
        echo "4. Select these scopes:"
        echo "   ${BOLD}☑ repo${NC} - Full control of private repositories"
        echo "   ${BOLD}☑ workflow${NC} - Update GitHub Action workflows"
        echo "   ${BOLD}☑ read:org${NC} - Read org and team membership"
        echo "5. Click '${BOLD}Generate token${NC}'"
        echo "6. Copy the token (starts with ghp_)"
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
        
        # Ask if they want to use the same token for workflow dispatch
        echo ""
        if ask_yes_no "Use the same token for workflow dispatch (azd validation)?" "y"; then
            GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
        else
            echo ""
            read -sp "Workflow Token (ghp_...): " GH_WORKFLOW_TOKEN
            echo ""
        fi
        
        GITHUB_PAT_DONE=true
        print_success "GitHub PAT configured!"
    fi
    
    # Default GH_WORKFLOW_TOKEN to GITHUB_TOKEN if not set
    if [[ -z "${GH_WORKFLOW_TOKEN:-}" ]]; then
        GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
    fi
    
    wait_for_enter
}

# =============================================================================
# MongoDB Setup
# =============================================================================

setup_mongodb() {
    print_section "Step 4: MongoDB Database Setup"
    
    print_info "Template Doctor requires MongoDB for storing analysis results."
    echo ""
    echo "Choose one of these options:"
    echo "  ${BOLD}A)${NC} Use existing MongoDB (Atlas, Cosmos DB, etc.)"
    echo "  ${BOLD}B)${NC} Create new Azure Cosmos DB (MongoDB API) - automated by azd"
    echo ""
    
    read -p "Your choice [A/b]: " -r
    
    if [[ "$REPLY" =~ ^[Bb]$ ]]; then
        print_step "Will create new Cosmos DB during 'azd provision'"
        print_info "Uncomment the Cosmos DB section in infra/main.bicep before provisioning"
        MONGODB_URI="<will-be-created-by-azd>"
        MONGODB_DONE=true
    else
        echo ""
        print_step "Using existing MongoDB"
        echo ""
        print_info "Enter your MongoDB connection string:"
        echo "Format: mongodb+srv://user:password@cluster.mongodb.net/?options"
        echo ""
        print_warning "NOTE: For local dev, docker-compose.yml will respect this MONGODB_URI from .env"
        echo "      For production, set it as an environment variable in your Container App"
        echo ""
        
        read -p "MongoDB URI: " MONGODB_URI
        
        if [[ ! "$MONGODB_URI" =~ ^mongodb ]]; then
            print_error "MongoDB URI must start with 'mongodb://' or 'mongodb+srv://'"
            exit 1
        fi
        
        MONGODB_DONE=true
        print_success "MongoDB configured!"
    fi
    
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
    
    read -p "Enter your GitHub username: " ADMIN_GITHUB_USER
    
    if [[ -z "$ADMIN_GITHUB_USER" ]]; then
        print_error "Admin username is required"
        exit 1
    fi
    
    # Ask if they want to add more admins
    ADMIN_GITHUB_USERS="$ADMIN_GITHUB_USER"
    
    if ask_yes_no "Add more admin users?"; then
        echo ""
        print_info "Enter additional usernames separated by commas (e.g., user1,user2,user3)"
        read -p "Additional admins: " ADDITIONAL_ADMINS
        
        if [[ -n "$ADDITIONAL_ADMINS" ]]; then
            ADMIN_GITHUB_USERS="$ADMIN_GITHUB_USER,$ADDITIONAL_ADMINS"
        fi
    fi
    
    print_success "Admin users: $ADMIN_GITHUB_USERS"
    wait_for_enter
}

# =============================================================================
# Azure Location Selection
# =============================================================================

select_azure_location() {
    print_section "Step 6: Azure Region Selection"
    
    print_info "Select an Azure region for deployment:"
    echo ""
    echo "  1) swedencentral (recommended - low cost)"
    echo "  2) eastus"
    echo "  3) westus2"
    echo "  4) westeurope"
    echo "  5) northeurope"
    echo "  6) Other (manual entry)"
    echo ""
    
    read -p "Your choice [1-6]: " -r
    
    case "$REPLY" in
        1) AZURE_LOCATION="swedencentral" ;;
        2) AZURE_LOCATION="eastus" ;;
        3) AZURE_LOCATION="westus2" ;;
        4) AZURE_LOCATION="westeurope" ;;
        5) AZURE_LOCATION="northeurope" ;;
        6) 
            read -p "Enter Azure location: " AZURE_LOCATION
            ;;
        *) 
            AZURE_LOCATION="swedencentral"
            print_info "Using default: swedencentral"
            ;;
    esac
    
    print_success "Azure location: $AZURE_LOCATION"
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
GH_WORKFLOW_TOKEN=$GH_WORKFLOW_TOKEN

# Admin Access Control
ADMIN_GITHUB_USERS=$ADMIN_GITHUB_USERS

# Database
MONGODB_URI=$MONGODB_URI

############################################
# Azure Configuration
############################################
AZURE_LOCATION=$AZURE_LOCATION

############################################
# Optional Settings (defaults)
############################################
DEFAULT_RULE_SET=dod
REQUIRE_AUTH_FOR_RESULTS=true
AUTO_SAVE_RESULTS=false
ARCHIVE_ENABLED=false
ARCHIVE_COLLECTION=aigallery
DISPATCH_TARGET_REPO=Template-Doctor/template-doctor
ISSUE_AI_ENABLED=false

EOF
    
    ENV_CONFIGURED=true
    print_success ".env file created successfully!"
    print_info "Location: $ENV_FILE"
    
    # Validate the env file
    echo ""
    print_step "Validating configuration..."
    if "$REPO_ROOT/scripts/validate-env.sh"; then
        print_success "Configuration is valid!"
    else
        print_warning "Validation had warnings - review above"
    fi
    
    wait_for_enter
}

# =============================================================================
# UAMI Setup (Optional for GitHub Actions)
# =============================================================================

setup_uami() {
    print_section "Step 8: User Assigned Managed Identity (Optional)"
    
    print_info "UAMI enables GitHub Actions workflows to deploy to Azure without storing credentials."
    echo ""
    echo "This is optional and only needed if you plan to:"
    echo "  • Use GitHub Actions for CI/CD"
    echo "  • Deploy to Azure from workflows"
    echo ""
    
    if ! ask_yes_no "Set up UAMI for GitHub Actions?"; then
        print_info "Skipping UAMI setup"
        return
    fi
    
    echo ""
    print_step "Checking Azure login status..."
    
    if ! az account show &> /dev/null; then
        print_warning "Not logged into Azure"
        print_step "Logging in to Azure..."
        az login
    else
        local account_name=$(az account show --query name -o tsv)
        print_success "Logged in to Azure as: $account_name"
    fi
    
    echo ""
    print_step "UAMI requires additional information:"
    echo ""
    
    read -p "Azure Subscription ID: " AZURE_SUBSCRIPTION_ID
    read -p "Azure Resource Group (where Container App will be): " AZURE_RESOURCE_GROUP
    read -p "GitHub Owner (org or user): " GITHUB_OWNER
    read -p "GitHub Repository name: " GITHUB_REPO
    
    # Update .env with these values
    cat >> "$ENV_FILE" << EOF

############################################
# UAMI Configuration (for GitHub Actions)
############################################
AZURE_SUBSCRIPTION_ID=$AZURE_SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP=$AZURE_RESOURCE_GROUP
GITHUB_OWNER=$GITHUB_OWNER
GITHUB_REPO=$GITHUB_REPO
EOF
    
    # Run the UAMI setup script
    print_step "Running UAMI setup script..."
    
    if [[ -f "$REPO_ROOT/scripts/setup.sh" ]]; then
        bash "$REPO_ROOT/scripts/setup.sh"
        UAMI_DONE=true
        
        echo ""
        print_success "UAMI setup complete!"
        print_info "Remember to add these GitHub Secrets to your repository:"
        echo "  • AZURE_CLIENT_ID"
        echo "  • AZURE_TENANT_ID"
        echo "  • AZURE_SUBSCRIPTION_ID"
    else
        print_error "UAMI setup script not found at scripts/setup.sh"
    fi
    
    wait_for_enter
}

# =============================================================================
# Azure Deployment
# =============================================================================

deploy_to_azure() {
    print_section "Step 9: Azure Deployment"
    
    print_info "Ready to deploy Template Doctor to Azure using azd!"
    echo ""
    echo "This will:"
    echo "  1. Initialize azd environment"
    echo "  2. Provision Azure resources (Container Apps, Container Registry, Log Analytics)"
    echo "  3. Build and deploy the Docker image"
    echo ""
    
    if ! ask_yes_no "Proceed with Azure deployment?" "y"; then
        print_info "Skipping deployment - you can run it later with: azd up"
        return
    fi
    
    # Check if already logged in to Azure
    print_step "Checking Azure authentication..."
    if ! azd auth login --check-status &> /dev/null; then
        print_warning "Not logged in to Azure via azd"
        print_step "Logging in..."
        azd auth login
    else
        print_success "Already logged in to azd"
    fi
    
    # Initialize azd if needed
    echo ""
    print_step "Initializing azd environment..."
    
    if [[ ! -d "$REPO_ROOT/.azure" ]]; then
        print_info "First time setup - creating environment"
        azd init
    else
        print_info "azd environment already exists"
        if ask_yes_no "Create a new environment?"; then
            read -p "Environment name (e.g., production, staging): " ENV_NAME
            azd env new "$ENV_NAME"
        fi
    fi
    
    # Run azd provision
    echo ""
    print_step "Provisioning Azure resources..."
    print_warning "This may take 5-10 minutes..."
    
    if azd provision; then
        print_success "Azure resources provisioned successfully!"
        
        # Get the deployed URL
        SERVICE_WEB_URI=$(azd env get-values | grep SERVICE_WEB_URI | cut -d'=' -f2 | tr -d '"')
        
        echo ""
        print_success "Deployment URL: $SERVICE_WEB_URI"
        echo ""
        print_warning "IMPORTANT: Update your GitHub OAuth App callback URL!"
        echo ""
        echo "  1. Go to: ${CYAN}https://github.com/settings/developers${NC}"
        echo "  2. Select your OAuth App"
        echo "  3. Update ${BOLD}Authorization callback URL${NC} to:"
        echo "     ${GREEN}${SERVICE_WEB_URI}/callback.html${NC}"
        echo ""
        
        wait_for_enter
        
        # Deploy the application
        echo ""
        print_step "Building and deploying application..."
        
        if [[ -f "$REPO_ROOT/scripts/deploy.sh" ]]; then
            bash "$REPO_ROOT/scripts/deploy.sh"
            print_success "Application deployed!"
        else
            print_warning "deploy.sh script not found - you'll need to deploy manually"
        fi
        
    else
        print_error "Provisioning failed - check errors above"
        exit 1
    fi
    
    wait_for_enter
}

# =============================================================================
# Post-Deployment Verification
# =============================================================================

verify_deployment() {
    print_section "Step 10: Post-Deployment Verification"
    
    print_info "Let's verify your deployment is working correctly."
    echo ""
    
    SERVICE_WEB_URI=$(azd env get-values 2>/dev/null | grep SERVICE_WEB_URI | cut -d'=' -f2 | tr -d '"' || echo "")
    
    if [[ -z "$SERVICE_WEB_URI" ]]; then
        print_warning "Could not get deployed URL - skipping verification"
        return
    fi
    
    print_step "Testing deployment..."
    echo ""
    echo "  URL: $SERVICE_WEB_URI"
    echo ""
    
    # Test if the site is accessible
    if curl -sf "$SERVICE_WEB_URI" > /dev/null 2>&1; then
        print_success "Site is accessible!"
    else
        print_warning "Site may not be ready yet (can take a few minutes)"
    fi
    
    echo ""
    print_info "Manual verification steps:"
    echo ""
    echo "  ${BOLD}1. Test OAuth Login:${NC}"
    echo "     • Open: $SERVICE_WEB_URI"
    echo "     • Click 'Sign in with GitHub'"
    echo "     • Verify you can log in"
    echo ""
    echo "  ${BOLD}2. Test Template Analysis:${NC}"
    echo "     • Enter a GitHub repo URL"
    echo "     • Click 'Scan Template'"
    echo "     • Wait for analysis to complete"
    echo ""
    echo "  ${BOLD}3. Test Database:${NC}"
    echo "     • Verify scan results appear without hard refresh"
    echo "     • Check that tiles show up on homepage"
    echo ""
    echo "  ${BOLD}4. Test Leaderboards (Admin):${NC}"
    echo "     • Navigate to /leaderboards"
    echo "     • Verify toggle switch appears (Demo Data ↔ Live Database)"
    echo "     • Demo mode: Shows sample data from JSON"
    echo "     • Live mode: Shows real database data or placeholders if empty"
    echo ""
    
    if ask_yes_no "Open the deployed site in your browser?"; then
        if command -v open &> /dev/null; then
            open "$SERVICE_WEB_URI"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$SERVICE_WEB_URI"
        else
            print_info "Please open manually: $SERVICE_WEB_URI"
        fi
    fi
    
    wait_for_enter
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_section "Setup Complete! 🎉"
    
    echo -e "${GREEN}${BOLD}Congratulations! Template Doctor is now set up.${NC}"
    echo ""
    
    if [[ "$GITHUB_OAUTH_DONE" == true ]]; then
        print_success "GitHub OAuth App configured"
    fi
    
    if [[ "$GITHUB_PAT_DONE" == true ]]; then
        print_success "GitHub Personal Access Token configured"
    fi
    
    if [[ "$MONGODB_DONE" == true ]]; then
        print_success "MongoDB database configured"
    fi
    
    if [[ "$ENV_CONFIGURED" == true ]]; then
        print_success ".env file created and validated"
    fi
    
    if [[ "$UAMI_DONE" == true ]]; then
        print_success "UAMI configured for GitHub Actions"
    fi
    
    echo ""
    print_info "Next steps:"
    echo ""
    echo "  ${BOLD}For local development:${NC}"
    echo "    docker-compose up                  # Recommended: runs Express + Vite in containers"
    echo ""
    echo "    # Or manually (two terminals required):"
    echo "    # Terminal 1: cd packages/server && npm run dev     # Express on port 3001"
    echo "    # Terminal 2: cd packages/app && npm run dev        # Vite on port 4000"
    echo ""
    echo "  ${BOLD}For Azure updates:${NC}"
    echo "    ./scripts/deploy.sh      # Runs pre-deploy checks, builds & deploys (recommended)"
    echo "    azd provision            # Update infrastructure only"
    echo ""
    echo "  ${BOLD}Documentation:${NC}"
    echo "    docs/deployment/DEPLOYMENT_CHECKLIST.md"
    echo "    docs/deployment/AZD_DEPLOYMENT.md"
    echo "    docs/usage/README.md"
    echo ""
    
    if [[ -n "${SERVICE_WEB_URI:-}" ]]; then
        echo "  ${BOLD}Your deployment:${NC}"
        echo "    ${GREEN}$SERVICE_WEB_URI${NC}"
        echo ""
    fi
    
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
    select_azure_location
    create_env_file
    
    # Optional UAMI setup
    setup_uami
    
    # Deploy to Azure
    deploy_to_azure
    
    # Verify deployment
    verify_deployment
    
    # Print summary
    print_summary
}

# Run main function
main
