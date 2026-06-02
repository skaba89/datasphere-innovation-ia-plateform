#!/usr/bin/env bash
# DataSphere Innovation — Production Deployment Script
# Usage: ./ops/deploy.sh [--no-migrate] [--skip-tests]
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC}  $1"; exit 1; }

echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DataSphere Innovation — Production Deploy         ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"

# ── Args ──────────────────────────────────────────────────────────────────────
RUN_MIGRATE=true
RUN_TESTS=true
for arg in "$@"; do
  [[ "$arg" == "--no-migrate" ]] && RUN_MIGRATE=false
  [[ "$arg" == "--skip-tests" ]] && RUN_TESTS=false
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo "── Pre-flight checks ──"

[[ -f .env.prod ]] || fail ".env.prod not found. Copy from .env.prod.example"
ok ".env.prod found"

source .env.prod 2>/dev/null || true
[[ -n "${SECRET_KEY:-}" && "$SECRET_KEY" != "REPLACE_WITH_64_CHAR_RANDOM_HEX" ]] || fail "SECRET_KEY not set in .env.prod"
ok "SECRET_KEY is set"

[[ -n "${POSTGRES_PASSWORD:-}" && "$POSTGRES_PASSWORD" != "REPLACE_WITH_STRONG_PASSWORD" ]] || fail "POSTGRES_PASSWORD not set"
ok "POSTGRES_PASSWORD is set"

command -v docker &>/dev/null || fail "Docker not installed"
ok "Docker available"

docker compose version &>/dev/null || fail "Docker Compose v2 not available"
ok "Docker Compose v2 available"

# ── Tests ─────────────────────────────────────────────────────────────────────
if [[ "$RUN_TESTS" == "true" ]]; then
  echo -e "\n── Running test suite ──"
  cd platform/backend
  DATABASE_URL="sqlite:///:memory:" SECRET_KEY="ci-test-key" SCHEDULER_ENABLED=false \
    pytest tests/ -q --tb=short 2>&1 | tail -5
  ok "All tests passed"
  cd ../..
else
  warn "Tests skipped (--skip-tests)"
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo -e "\n── Building Docker images ──"
docker compose -f docker-compose.prod.yml build --no-cache
ok "Images built"

# ── Deploy ────────────────────────────────────────────────────────────────────
echo -e "\n── Starting services ──"
docker compose -f docker-compose.prod.yml up -d --remove-orphans
ok "Services started"

# Wait for backend health
echo -e "\n── Waiting for backend health check ──"
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml exec -T backend curl -sf http://localhost:8000/api/v1/health &>/dev/null; then
    ok "Backend is healthy"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "Backend did not become healthy in time"
  fi
  sleep 3
  echo -n "."
done

# ── Migrate ───────────────────────────────────────────────────────────────────
if [[ "$RUN_MIGRATE" == "true" ]]; then
  echo -e "\n── Running database migrations ──"
  docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
  ok "Migrations applied"
else
  warn "Migrations skipped (--no-migrate)"
fi

# ── Status ────────────────────────────────────────────────────────────────────
echo -e "\n── Service status ──"
docker compose -f docker-compose.prod.yml ps

echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment completed successfully!               ${NC}"
echo -e "${GREEN}  API:      https://datasphere-innovation.fr/api/v1${NC}"
echo -e "${GREEN}  Frontend: https://datasphere-innovation.fr       ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"
