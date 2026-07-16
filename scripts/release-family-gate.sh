#!/usr/bin/env bash

set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

artifact_dir="${RELEASE_GATE_ARTIFACT_DIR:-$repository_root/release-gate-artifacts}"
if [[ "$artifact_dir" != /* ]]; then
  artifact_dir="$repository_root/$artifact_dir"
fi
mkdir -p "$artifact_dir"

compose_file="$repository_root/docker-compose.family.yml"
compose_project="${RELEASE_GATE_COMPOSE_PROJECT:-family-growth-gate-${GITHUB_RUN_ID:-local}-$$}"
compose_project="$(printf '%s' "$compose_project" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-')"
compose_touched=0

choose_port() {
  node -e 'const net=require("net");const server=net.createServer();server.listen(0,"127.0.0.1",()=>{process.stdout.write(String(server.address().port));server.close();});'
}

export FAMILY_GATEWAY_HOST_PORT="${FAMILY_GATEWAY_HOST_PORT:-$(choose_port)}"
export FAMILY_MONGO_HOST_PORT="${FAMILY_MONGO_HOST_PORT:-$(choose_port)}"
export FAMILY_GATEWAY_BASE_URL="${FAMILY_GATEWAY_BASE_URL:-http://127.0.0.1:${FAMILY_GATEWAY_HOST_PORT}}"

compose_family() {
  docker compose --project-name "$compose_project" --file "$compose_file" "$@"
}

run_step() {
  local name="$1"
  shift
  printf '\n==> %s\n' "$name"
  "$@" 2>&1 | tee "$artifact_dir/${name}.log"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if (( compose_touched )); then
    compose_family ps --all > "$artifact_dir/compose-family-ps.txt" 2>&1 || true
    compose_family logs --no-color > "$artifact_dir/compose-family.log" 2>&1 || true
    if ! compose_family down --remove-orphans >> "$artifact_dir/compose-family-teardown.log" 2>&1; then
      printf 'Compose teardown failed; see compose-family-teardown.log\n' >&2
      status=1
    fi
  fi

  printf 'status=%s\ncommit=%s\n' "$status" "$(git rev-parse HEAD 2>/dev/null || printf unknown)" \
    > "$artifact_dir/release-gate-summary.txt"
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run_step 01-root-clean-install npm ci
run_step 02-lint npm run lint
run_step 03-family-docs npm run docs:family:check
run_step 04-family-regression npm run test:family-regression
run_step 05-task11-integration npm run test:family-flow:integration
run_step 06-task12-integration-first npm run test:task12:integration
run_step 07-task12-integration-second npm run test:task12:integration
run_step 08-frontend-clean-install npm ci --prefix frontend/web
run_step 09-frontend-tests npm run test:ci --prefix frontend/web -- --runInBand
run_step 10-frontend-build npm run build --prefix frontend/web

if [[ "${RELEASE_GATE_INSTALL_BROWSER_DEPS:-0}" == "1" ]]; then
  run_step 11-playwright-browser npx playwright install --with-deps chromium
else
  run_step 11-playwright-browser npx playwright install chromium
fi
run_step 12-task11-e2e npm run test:family-flow:e2e
run_step 13-task12-e2e npm run test:task12:e2e

compose_touched=1
run_step 14-compose-config compose_family config --quiet
run_step 15-compose-build compose_family build
run_step 16-compose-start compose_family up -d --wait --wait-timeout "${RELEASE_GATE_HEALTH_TIMEOUT_SECONDS:-240}"
run_step 17-compose-smoke node scripts/compose-family-smoke.js
run_step 18-git-clean bash scripts/check-git-clean.sh

printf '\nFamily release gate passed. Evidence: %s\n' "$artifact_dir"
