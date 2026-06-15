#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/health_check.sh — Verify all SupportMitra services are healthy
#
# Usage:
#   bash scripts/health_check.sh              # check localhost (dev)
#   bash scripts/health_check.sh prod         # check production domain
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

MODE="${1:-dev}"

if [[ "$MODE" == "prod" ]]; then
    BASE_URL="https://supportmitra.in"
else
    BASE_URL="http://localhost:8000"
fi

PASS=0
FAIL=0

check() {
    local NAME="$1"
    local URL="$2"
    local EXPECTED="${3:-200}"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "$EXPECTED" ]]; then
        echo "  [OK]   $NAME — HTTP $HTTP_CODE"
        ((PASS++)) || true
    else
        echo "  [FAIL] $NAME — expected $EXPECTED, got $HTTP_CODE (URL: $URL)"
        ((FAIL++)) || true
    fi
}

echo ""
echo "SupportMitra Health Check — $MODE ($BASE_URL)"
echo "─────────────────────────────────────────────"

# ── API health endpoint ───────────────────────────────────────────────────────
check "API health"       "$BASE_URL/api/health/"              200

# ── Auth endpoints (should return 400/401, not 500) ──────────────────────────
check "Auth register"    "$BASE_URL/api/auth/register/"        405   # GET → method not allowed
check "Auth login"       "$BASE_URL/api/auth/login/"           405

# ── Protected endpoints (should return 401, not 500) ─────────────────────────
check "Tickets list"     "$BASE_URL/api/tickets/"              401
check "My profile"       "$BASE_URL/api/customers/me/"         401

# ── Static files (only in prod via nginx) ─────────────────────────────────────
if [[ "$MODE" == "prod" ]]; then
    check "Frontend (SPA)" "https://supportmitra.in/"          200
    check "HTTPS redirect" "http://supportmitra.in/"           301
fi

# ── Docker container status ───────────────────────────────────────────────────
echo ""
echo "Docker container status:"
docker compose ps --format "  {{.Name}}\t{{.Status}}" 2>/dev/null || echo "  (docker compose not available)"

echo ""
echo "─────────────────────────────────────────────"
echo "Result: $PASS passed, $FAIL failed"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo "Some checks failed. Investigate with:"
    echo "  docker compose logs backend"
    echo "  docker compose logs celery"
    exit 1
fi

echo "All checks passed."
