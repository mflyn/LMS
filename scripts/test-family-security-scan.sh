#!/usr/bin/env bash

set -Eeuo pipefail

fail() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "${RUN_FAMILY_SECURITY_SCAN:-0}" == "1" ]] \
  || fail "SECURITY_SCAN_SKIPPED:EXPLICIT_OPT_IN_REQUIRED" 2
command -v docker >/dev/null 2>&1 || fail "SECURITY_SCAN_FAILED:DOCKER_UNAVAILABLE"
docker info >/dev/null 2>&1 || fail "SECURITY_SCAN_FAILED:DOCKER_UNAVAILABLE"

minimum_memory_bytes="${FAMILY_SECURITY_SCAN_MIN_MEMORY_BYTES:-10737418240}"
docker_memory_bytes="$(docker info --format '{{.MemTotal}}' 2>/dev/null || true)"
[[ "$minimum_memory_bytes" =~ ^[0-9]+$ && "$docker_memory_bytes" =~ ^[0-9]+$ ]] \
  || fail "SECURITY_SCAN_FAILED:MEMORY_CAPACITY_UNKNOWN"
if (( docker_memory_bytes < minimum_memory_bytes )) \
  && [[ "${FAMILY_SECURITY_SCAN_ALLOW_LOW_MEMORY:-0}" != "1" ]]; then
  fail "SECURITY_SCAN_SKIPPED:INSUFFICIENT_DOCKER_MEMORY" 2
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

compose_project="${FAMILY_SECURITY_SCAN_PROJECT:-family-security-scan-${GITHUB_RUN_ID:-local}-$$}"
compose_project="$(printf '%s' "$compose_project" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-')"
artifact_dir="${FAMILY_SECURITY_SCAN_ARTIFACT_DIR:-${TMPDIR:-/tmp}/${compose_project}}"
mkdir -p "$artifact_dir"
compose_touched=0

choose_port() {
  node -e 'const net=require("net");const server=net.createServer();server.listen(0,"127.0.0.1",()=>{process.stdout.write(String(server.address().port));server.close();});'
}

export FAMILY_GATEWAY_HOST_PORT="${FAMILY_GATEWAY_HOST_PORT:-$(choose_port)}"
export FAMILY_MONGO_HOST_PORT="${FAMILY_MONGO_HOST_PORT:-$(choose_port)}"
export FAMILY_GATEWAY_BASE_URL="${FAMILY_GATEWAY_BASE_URL:-http://127.0.0.1:${FAMILY_GATEWAY_HOST_PORT}}"

compose_secure() {
  docker compose \
    --project-name "$compose_project" \
    --file "$repository_root/docker-compose.family.yml" \
    --file "$repository_root/docker-compose.security.yml" \
    "$@"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if (( compose_touched )); then
    compose_secure ps --all --format json > "$artifact_dir/compose-status.json" 2>/dev/null || true
    if ! compose_secure down --volumes --remove-orphans >/dev/null 2>&1; then
      printf 'SECURITY_SCAN_FAILED:TEARDOWN_FAILED\n' >&2
      status=1
    fi
  fi
  printf 'status=%s\ncommit=%s\n' "$status" "$(git rev-parse HEAD 2>/dev/null || printf unknown)" \
    > "$artifact_dir/security-scan-summary.txt"
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose_touched=1
compose_secure config --quiet
compose_secure up -d --build --wait \
  --wait-timeout "${FAMILY_SECURITY_SCAN_HEALTH_TIMEOUT_SECONDS:-420}"
node scripts/compose-family-security-smoke.js
