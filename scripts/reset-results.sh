#!/bin/bash
# Script to reset all Template Doctor results while preserving necessary files

RESULTS_DIR="./packages/app/results"
CURRENT_DIR=$(pwd)
SCRIPT_DIR=$(dirname "$0")

# Move to the project root directory if needed
if [[ $CURRENT_DIR != *"template-doctor" ]]; then
  cd "$SCRIPT_DIR/.."
fi

# Ensure we're in the right place
if [ ! -d "$RESULTS_DIR" ]; then
  echo "Error: $RESULTS_DIR directory not found. Make sure you run this script from the project root."
  exit 1
fi

echo "=== Template Doctor Results Reset ==="
echo "This will remove all scan results while preserving application files."
echo "Results directory: $RESULTS_DIR"
echo ""
echo "Current results:"
ls -la $RESULTS_DIR | grep -v "assets\|index\|meta\|scan\|template"
echo ""

# Confirm action
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 0
fi

# Remove repository folders (only folders containing scan results)
echo "Removing repository folders..."
find "$RESULTS_DIR" -maxdepth 1 -type d -not -path "$RESULTS_DIR" -not -path "$RESULTS_DIR/assets" -exec rm -rf {} \;

# Reset scan-meta-backfill.js
echo "Resetting scan-meta-backfill.js..."
cat > "$RESULTS_DIR/scan-meta-backfill.js" << 'EOF'
window.__TD_DYNAMIC_RESULTS = window.__TD_DYNAMIC_RESULTS || [];
console.log("[scan-meta-backfill] Loaded backfill meta entries:", window.__TD_DYNAMIC_RESULTS.length);
EOF

echo "Results reset complete."
echo "You can now generate new scan results."