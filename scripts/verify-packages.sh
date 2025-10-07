#!/usr/bin/env bash
set -euo pipefail

# Guard script: ensure only the expected set of package directories exist on main.
# Prevents accidental leakage of experimental workspaces.
# Updated for Express migration: expects 'app', 'server', and 'analyzer-core' packages.
# 'api' (Azure Functions) is optional as it's maintained for legacy reference.

EXPECTED_DIRS=(app server analyzer-core)
OPTIONAL_DIRS=(api)

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pkg_dir="$repo_root/packages"

if [ ! -d "$pkg_dir" ]; then
  echo "[verify-packages] packages directory missing" >&2
  exit 1
fi

found=( )
while IFS= read -r d; do
  base="$(basename "$d")"
  found+=("$base")
done < <(find "$pkg_dir" -mindepth 1 -maxdepth 1 -type d | sort)

status=0
for f in "${found[@]}"; do
  allow=0
  # Check expected directories
  for exp in "${EXPECTED_DIRS[@]}"; do
    if [ "$f" = "$exp" ]; then
      allow=1; break
    fi
  done
  # Check optional directories if not already allowed
  if [ $allow -eq 0 ]; then
    for opt in "${OPTIONAL_DIRS[@]}"; do
      if [ "$f" = "$opt" ]; then
        allow=1; break
      fi
    done
  fi
  if [ $allow -eq 0 ]; then
    echo "[verify-packages] Unexpected package directory: $f" >&2
    status=2
  fi
done

if [ $status -ne 0 ]; then
  echo "[verify-packages] Failing due to unexpected package directories." >&2
  echo "Expected: ${EXPECTED_DIRS[*]}" >&2
  echo "Optional: ${OPTIONAL_DIRS[*]}" >&2
  echo "Found   : ${found[*]}" >&2
  exit $status
fi

echo "[verify-packages] OK: packages set matches expected (${EXPECTED_DIRS[*]}) with optional (${OPTIONAL_DIRS[*]})"