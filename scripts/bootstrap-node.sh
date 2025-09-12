#!/usr/bin/env bash
set -euo pipefail

# bootstrap-node.sh
# Restores a working Node.js toolchain for this repo.
# 1. Ensures nvm is present (installs if absent)
# 2. Loads nvm into current shell
# 3. Installs & activates Node version from .nvmrc (fallback to engines entry)
# 4. Runs npm install at repo root (respects workspaces)
#
# Usage: ./scripts/bootstrap-node.sh [-f]
#   -f  Force reinstall of the requested Node version
#
# Safe to re-run; it is idempotent unless -f specified.

FORCE=0
while getopts "f" opt; do
  case $opt in
    f) FORCE=1 ;;
  esac
done

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  echo "ERROR: Must run from repo root (package.json not found)" >&2
  exit 1
fi

# Detect desired version
if [ -f .nvmrc ]; then
  REQ_VERSION=$(cat .nvmrc | tr -d ' \t\r\n')
fi

if [ -z "${REQ_VERSION:-}" ]; then
  REQ_VERSION=$(grep -o '"node"[^}]*' package.json | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || true)
fi

if [ -z "${REQ_VERSION:-}" ]; then
  REQ_VERSION="20" # fallback major
fi

echo "==> Target Node version: ${REQ_VERSION}"

# Install nvm if missing
if [ ! -d "$HOME/.nvm" ]; then
  echo "==> nvm not found: installing"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load nvm (covers interactive & CI shells)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion" || true

if ! command -v nvm >/dev/null 2>&1; then
  echo "ERROR: nvm failed to load; ensure your shell sources $HOME/.nvm/nvm.sh" >&2
  exit 1
fi

# Install/Use version
if [ $FORCE -eq 1 ]; then
  echo "==> Forcing reinstall of Node ${REQ_VERSION}"
  nvm uninstall "$REQ_VERSION" >/dev/null 2>&1 || true
fi

if ! nvm ls "$REQ_VERSION" >/dev/null 2>&1; then
  echo "==> Installing Node ${REQ_VERSION}"
  nvm install "$REQ_VERSION"
fi

nvm use "$REQ_VERSION"

echo "==> Active Node: $(node -v) (expected ~${REQ_VERSION})"

# Corepack enable (optional) - future proofing
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi

# Install dependencies
if [ -f package-lock.json ]; then
  echo "==> Installing dependencies (npm ci preferred if lock exists)"
  npm ci || npm install
else
  echo "==> Installing dependencies (no lockfile)"
  npm install
fi

# Verify Playwright requirement
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Installed Node version $(node -v) < 18, Playwright will fail." >&2
  exit 1
fi

echo "==> Node environment ready. You can now run:"
echo "    npx playwright test   (from packages/app)"
echo "    npm run build:full"
