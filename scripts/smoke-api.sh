#!/usr/bin/env bash
set -euo pipefail

# Template Doctor API Smoke Test Script (Express Migration)
# Loads variables from .env (if present) and runs a suite of curl checks against the Express server.
# Usage:
#   ./scripts/smoke-api.sh              # assumes host at http://localhost:3001 (Express)
#   BASE=http://alt:3001 ./scripts/smoke-api.sh
#   DRY_RUN=1 ./scripts/smoke-api.sh    # only print commands
#
# Required (or resolved from .env):
#   GITHUB_TOKEN or GH_WORKFLOW_TOKEN (for authenticated endpoints)
#   GITHUB_OWNER / GITHUB_REPO (for workflow + PR operations)
# Optional:
#   TEMPLATE_REPO_URL (target template), defaults to https://github.com/Azure-Samples/todo-nodejs-mongo
#   RULE_SET (defaults to dod)
#
# Exit codes:
#   0 success, non-zero on first failing required check.

COLOR_OK="\033[32m"; COLOR_ERR="\033[31m"; COLOR_DIM="\033[2m"; COLOR_RST="\033[0m"

log() { echo -e "${COLOR_DIM}[$(date +%H:%M:%S)]${COLOR_RST} $*"; }
ok()  { echo -e "${COLOR_OK}✔${COLOR_RST} $*"; }
err() { echo -e "${COLOR_ERR}✖ $*${COLOR_RST}" >&2; }

# 1. Load .env if present (simple KEY=VALUE lines; ignores comments)
if [[ -f .env ]]; then
  log "Loading .env"
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/#.*//' | xargs -0 echo || true)
fi

# Default to Express server port (3001), but allow override via env
BASE=${BASE:-http://localhost:3001}
# If BASE was set to Azure Functions port in .env, warn and override for Express
if [[ $BASE == "http://localhost:7071" ]]; then
  log "Note: BASE in .env points to Azure Functions (7071), using Express port (3001) instead"
  BASE="http://localhost:3001"
fi
GITHUB_TOKEN=${GITHUB_TOKEN:-${GH_WORKFLOW_TOKEN:-}}
GITHUB_OWNER=${GITHUB_OWNER:-${GITHUB_REPO_OWNER:-${OWNER:-}}}
GITHUB_REPO=${GITHUB_REPO:-template-doctor}
TEMPLATE_REPO_URL=${TEMPLATE_REPO_URL:-https://github.com/Azure-Samples/todo-nodejs-mongo}
RULE_SET=${RULE_SET:-dod}
TIMESTAMP=$(date +%s)

if [[ -z ${GITHUB_OWNER} ]]; then
  GITHUB_OWNER="Template-Doctor" # fallback
fi

if ! command -v curl >/dev/null; then err "curl not found"; exit 2; fi
if ! command -v jq >/dev/null; then log "jq not found: output will be raw"; fi

DRY_RUN=${DRY_RUN:-0}
run() {
  if [[ $DRY_RUN == 1 ]]; then
    echo "[DRY] $*"
  else
    eval "$@"
  fi
}

section() { echo -e "\n${COLOR_DIM}=== $* ===${COLOR_RST}"; }

fail() { err "$1"; exit 1; }

# Helper to require 2xx status
curl_json() {
  local name=$1; shift
  local cmd=(curl -s -w "\n%{http_code}" "$@")
  local out http
  out=$("${cmd[@]}") || fail "Curl failed: $name"
  http=$(echo "$out" | tail -n1)
  body=$(echo "$out" | sed '$d')
  if [[ ! $http =~ ^2 ]]; then
    err "$name HTTP $http"; echo "$body" >&2; exit 1
  fi
  echo "$body"
}

section "0. Health check"
HEALTH=$(curl_json health "-H" "Accept: application/json" "$BASE/api/health")
ok "Server health check passed"
if command -v jq >/dev/null; then
  echo "$HEALTH" | jq '.'
fi

section "1. Client Settings"
BODY=$(curl_json client-settings "-H" "Accept: application/json" "$BASE/api/v4/client-settings")
ok "client-settings returned payload (size ${#BODY})"
if command -v jq >/dev/null; then
  OAUTH_ID=$(echo "$BODY" | jq -r '.githubOAuth.clientId // empty')
  [[ -n $OAUTH_ID ]] && log "OAuth Client ID: $OAUTH_ID"
fi

section "2. GitHub OAuth Token Exchange"
OAUTH_RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/v4/github-oauth-token?code=test123") || true
OAUTH_CODE=$(echo "$OAUTH_RESP" | tail -n1)
if [[ $OAUTH_CODE == 400 || $OAUTH_CODE == 401 || $OAUTH_CODE == 502 ]]; then
  ok "github-oauth-token returned expected error ($OAUTH_CODE) for invalid code"
else
  log "github-oauth-token HTTP $OAUTH_CODE (may vary based on GitHub OAuth app config)"
fi

section "3. Analyze template"
ANALYZE=$(curl_json analyze -X POST "$BASE/api/v4/analyze-template" \
  -H "Content-Type: application/json" \
  -d "{\"repoUrl\":\"$TEMPLATE_REPO_URL\",\"ruleSet\":\"$RULE_SET\"}")
ok "analyze-template endpoint accepted request"
if command -v jq >/dev/null; then
  echo "$ANALYZE" | jq -C '.' | head -20 || echo "$ANALYZE"
fi

section "4. Validation: Template"
VAL_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/validate-template" \
  -H "Content-Type: application/json" \
  -d "{\"targetRepoUrl\":\"$TEMPLATE_REPO_URL\"}") || true
VAL_CODE=$(echo "$VAL_RESP" | tail -n1)
VAL_BODY=$(echo "$VAL_RESP" | sed '$d')
if [[ $VAL_CODE =~ ^2 ]]; then
  ok "validate-template HTTP $VAL_CODE"
  RUN_ID=$(echo "$VAL_BODY" | jq -r '.runId // empty' 2>/dev/null || echo '')
  [[ -n $RUN_ID ]] && log "Validation runId: $RUN_ID"
else
  log "validate-template HTTP $VAL_CODE (may require GH_WORKFLOW_TOKEN)"
fi

section "5. Validation: Docker Image"
DOCKER_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v4/validation-docker-image" \
  -H "Content-Type: application/json" \
  -d "{\"targetRepoUrl\":\"$TEMPLATE_REPO_URL\"}")
ok "validation-docker-image HTTP $DOCKER_CODE"

section "6. Validation: OSSF Scorecard"
OSSF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v4/validation-ossf" \
  -H "Content-Type: application/json" \
  -d "{\"targetRepoUrl\":\"$TEMPLATE_REPO_URL\"}")
ok "validation-ossf HTTP $OSSF_CODE"

section "7. Validation: Status Check"
if [[ -n ${RUN_ID:-} ]]; then
  STATUS_RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/v4/validation-status?runId=$RUN_ID")
  STATUS_CODE=$(echo "$STATUS_RESP" | tail -n1)
  ok "validation-status HTTP $STATUS_CODE"
else
  log "Skipping validation-status (no runId from validate-template)"
fi

section "8. Validation: Cancel"
if [[ -n ${RUN_ID:-} ]]; then
  CANCEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v4/validation-cancel" \
    -H "Content-Type: application/json" \
    -d "{\"workflowOrgRepo\":\"$GITHUB_OWNER/$GITHUB_REPO\",\"workflowRunId\":12345}")
  ok "validation-cancel HTTP $CANCEL_CODE"
else
  log "Skipping validation-cancel (no runId)"
fi

section "9. Validation: Callback Webhook"
CALLBACK_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v4/validation-callback" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"test-run-123\",\"status\":\"completed\",\"conclusion\":\"success\"}")
ok "validation-callback HTTP $CALLBACK_CODE"

section "10. Issue Creation"
if [[ -n $GITHUB_TOKEN ]]; then
  ISSUE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/issue-create" \
    -H "Content-Type: application/json" \
    -d "{\"owner\":\"$GITHUB_OWNER\",\"repo\":\"$GITHUB_REPO\",\"title\":\"[Smoke Test] Template Analysis $(date +%Y-%m-%d)\",\"body\":\"Automated smoke test issue\",\"labels\":[\"smoke-test\",\"automated\"]}")
  ISSUE_CODE=$(echo "$ISSUE_RESP" | tail -n1)
  if [[ $ISSUE_CODE =~ ^2 ]]; then
    ok "issue-create HTTP $ISSUE_CODE"
    ISSUE_BODY=$(echo "$ISSUE_RESP" | sed '$d')
    if command -v jq >/dev/null; then
      ISSUE_NUM=$(echo "$ISSUE_BODY" | jq -r '.issueNumber // empty')
      [[ -n $ISSUE_NUM ]] && log "Created issue #$ISSUE_NUM"
    fi
  else
    log "issue-create HTTP $ISSUE_CODE (may require valid token/permissions)"
  fi
else
  log "Skipping issue-create (no GITHUB_TOKEN)"
fi

section "11. Add Template PR"
if [[ -n $GITHUB_TOKEN ]]; then
  PR_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/add-template-pr" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\":$TIMESTAMP,\"repoUrl\":\"$TEMPLATE_REPO_URL\",\"ruleSet\":\"$RULE_SET\",\"compliance\":{\"percentage\":85,\"issues\":2,\"passed\":12}}")
  PR_CODE=$(echo "$PR_RESP" | tail -n1)
  if [[ $PR_CODE =~ ^2 ]]; then
    ok "add-template-pr HTTP $PR_CODE"
    PR_BODY=$(echo "$PR_RESP" | sed '$d')
    if command -v jq >/dev/null; then
      PR_URL=$(echo "$PR_BODY" | jq -r '.prUrl // empty')
      [[ -n $PR_URL ]] && log "Created PR: $PR_URL"
    fi
  else
    log "add-template-pr HTTP $PR_CODE (may require write permissions)"
  fi
else
  log "Skipping add-template-pr (no GITHUB_TOKEN)"
fi

section "12. Archive Collection"
ARCHIVE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/archive-collection" \
  -H "Content-Type: application/json" \
  -d "{\"collection\":\"smoke-test\",\"repoUrl\":\"$TEMPLATE_REPO_URL\",\"repoName\":\"test-repo\",\"analysisId\":\"smoke-$TIMESTAMP\",\"username\":\"smoketest\",\"timestamp\":\"$TIMESTAMP\",\"metadata\":{\"test\":true}}")
ARCHIVE_CODE=$(echo "$ARCHIVE_RESP" | tail -n1)
ok "archive-collection HTTP $ARCHIVE_CODE"

section "14. Workflow Trigger"
TRIGGER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/workflow-trigger" \
  -H "Content-Type: application/json" \
  -d "{\"workflowOrgRep\":\"$GITHUB_OWNER/$GITHUB_REPO\",\"workflowId\":\"validate.yml\",\"workflowInput\":{\"testId\":\"smoke-$TIMESTAMP\"},\"runIdInputProperty\":\"testId\"}")
TRIGGER_CODE=$(echo "$TRIGGER_RESP" | tail -n1)
ok "workflow-trigger HTTP $TRIGGER_CODE"

section "15. Workflow Run Status"
STATUS_WF_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/workflow-run-status" \
  -H "Content-Type: application/json" \
  -d "{\"workflowOrgRep\":\"$GITHUB_OWNER/$GITHUB_REPO\",\"workflowRunId\":\"12345\"}")
STATUS_WF_CODE=$(echo "$STATUS_WF_RESP" | tail -n1)
ok "workflow-run-status HTTP $STATUS_WF_CODE"

section "16. Workflow Run Artifacts"
ARTIFACTS_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/workflow-run-artifacts" \
  -H "Content-Type: application/json" \
  -d "{\"workflowOrgRep\":\"$GITHUB_OWNER/$GITHUB_REPO\",\"workflowRunId\":\"12345\"}")
ARTIFACTS_CODE=$(echo "$ARTIFACTS_RESP" | tail -n1)
ok "workflow-run-artifacts HTTP $ARTIFACTS_CODE"

section "17. Setup Configuration Overrides"
# GET /api/v4/setup (should return empty if no config exists)
SETUP_GET=$(curl_json setup-get "$BASE/api/v4/setup")
ok "setup GET returned payload"
if command -v jq >/dev/null; then
  OVERRIDE_COUNT=$(echo "$SETUP_GET" | jq -r '.count // 0')
  log "Current overrides count: $OVERRIDE_COUNT"
fi

# POST /api/v4/setup (will fail without authorization, which is expected)
SETUP_POST_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v4/setup" \
  -H "Content-Type: application/json" \
  -d '{"user":"smoke-test","overrides":{"test":"value"}}') || true
SETUP_POST_CODE=$(echo "$SETUP_POST_RESP" | tail -n1)
if [[ $SETUP_POST_CODE == 403 ]]; then
  ok "setup POST correctly rejected unauthorized user (403)"
elif [[ $SETUP_POST_CODE == 200 ]]; then
  ok "setup POST accepted (user in SETUP_ALLOWED_USERS)"
else
  log "setup POST returned HTTP $SETUP_POST_CODE"
fi

section "18. Negative tests"
PUT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/v4/client-settings" || true)
if [[ $PUT_CODE == 405 || $PUT_CODE == 400 || $PUT_CODE == 404 ]]; then
  ok "negative PUT produced expected non-2xx ($PUT_CODE)"
else
  log "Unexpected code for negative test: $PUT_CODE"
fi

UNKNOWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v4/does-not-exist" || true)
[[ $UNKNOWN_CODE == 404 ]] && ok "unknown route 404" || log "Unexpected code for unknown route: $UNKNOWN_CODE"

section "Summary"
ok "Smoke script completed successfully!"
echo -e "${COLOR_OK}✅ All 17 endpoint categories tested (including setup)${COLOR_RST}"
echo -e "${COLOR_DIM}Express server: $BASE${COLOR_RST}"
echo -e "${COLOR_DIM}Test timestamp: $(date)${COLOR_RST}"

