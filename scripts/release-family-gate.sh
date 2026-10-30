#!/usr/bin/env bash

release_gate_init() {
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
compose_args=(--project-name "$compose_project" --file "$compose_file")
if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}${RELEASE_GATE_ENV_FILE:-}" ]]; then
  if [[ ! "$compose_project" =~ ^family-growth-isolated-[a-z0-9-]+$ ]] ||
     [[ ! -f "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" || ! -f "${RELEASE_GATE_ENV_FILE:-}" ]]; then
    printf 'Isolation requires a dedicated project, override and env file\n' >&2
    return 1
  fi
  compose_args+=(--file "$RELEASE_GATE_COMPOSE_OVERRIDE" --env-file "$RELEASE_GATE_ENV_FILE")
  local kind existing
  for kind in container network volume; do
    if [[ "$kind" == container ]]; then
      existing="$(docker container ls --all -q --filter "label=com.docker.compose.project=$compose_project")" || return 1
    else
      existing="$(docker "$kind" ls -q --filter "label=com.docker.compose.project=$compose_project")" || return 1
    fi
    if [[ -n "$existing" ]]; then
      printf 'Isolation project already has resources; refusing reuse\n' >&2
      return 1
    fi
  done
  local names name
  for kind in container network volume image; do
    case "$kind" in
      container) names="$(docker container ls --all --format '{{.Names}}')" || return 1 ;;
      image) names="$(docker image ls --format '{{.Repository}}:{{.Tag}}')" || return 1 ;;
      *) names="$(docker "$kind" ls --format '{{.Name}}')" || return 1 ;;
    esac
    while IFS= read -r name; do
      if [[ "$name" == "$compose_project" || "$name" == "$compose_project"[-_]* ]]; then
        printf 'Isolation resource name already exists; refusing reuse\n' >&2
        return 1
      fi
    done <<< "$names"
  done
  # Export before run_step's pipeline subshell so build and start share one ledger.
  export RELEASE_GATE_BUILD_DIRECTORY="${RELEASE_GATE_BUILD_DIRECTORY:-$artifact_dir/retained-build}"
  case "$RELEASE_GATE_BUILD_DIRECTORY" in
    "$repository_root"|"$repository_root"/*|*/../*|*/./*)
      printf 'Retained build directory must be outside the checkout\n' >&2; return 1 ;;
    /*) ;;
    *) printf 'Retained build directory must be absolute and outside the checkout\n' >&2; return 1 ;;
  esac
fi
export FAMILY_GATEWAY_HOST_PORT="${FAMILY_GATEWAY_HOST_PORT:-$(choose_port)}"
export FAMILY_MONGO_HOST_PORT="${FAMILY_MONGO_HOST_PORT:-$(choose_port)}"
export FAMILY_GATEWAY_BASE_URL="${FAMILY_GATEWAY_BASE_URL:-http://127.0.0.1:${FAMILY_GATEWAY_HOST_PORT}}"
if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
  export FAMILY_GATEWAY_BASE_URL="http://127.0.0.1:${FAMILY_GATEWAY_HOST_PORT}"
fi
}

choose_port() {
  node -e 'const net=require("net");const server=net.createServer();server.listen(0,"127.0.0.1",()=>{process.stdout.write(String(server.address().port));server.close();});'
}

compose_family() {
  docker compose "${compose_args[@]}" "$@"
}

validate_compose_family() {
  compose_family config --quiet
  if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
    compose_family config --format json | node "$repository_root/scripts/check-release-isolation.js" \
      "$compose_project" "$FAMILY_GATEWAY_HOST_PORT"
  fi
}

build_compose_family() {
  if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
    node "$repository_root/scripts/release-isolated-compose.js" build "${compose_args[@]}"
  else
    compose_family build
  fi
}

start_compose_family() {
  if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
    node "$repository_root/scripts/release-isolated-compose.js" start "${compose_args[@]}"
  else
    compose_family up -d --wait --wait-timeout "${RELEASE_GATE_HEALTH_TIMEOUT_SECONDS:-240}"
  fi
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
    if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
      local ids id
      if ids="$(docker container ls --all -q --filter "label=com.docker.compose.project=$compose_project" --filter "label=lms.isolation.run=$compose_project")"; then
        while IFS= read -r id; do
          [[ -z "$id" ]] && continue
          docker stop "$id" >> "$artifact_dir/compose-family-teardown.log" 2>&1 || status=1
        done <<< "$ids"
        if ids="$(docker container ls --all -q --filter "label=com.docker.compose.project=$compose_project" --filter "label=lms.isolation.run=$compose_project")"; then
          while IFS= read -r id; do
            [[ -z "$id" ]] && continue
            docker rm "$id" >> "$artifact_dir/compose-family-teardown.log" 2>&1 || status=1
          done <<< "$ids"
        else status=1; fi
      else status=1; fi
    fi
    if ! compose_family down --remove-orphans >> "$artifact_dir/compose-family-teardown.log" 2>&1; then
      printf 'Compose teardown failed; see compose-family-teardown.log\n' >&2
      status=1
    fi
    if [[ -n "${RELEASE_GATE_COMPOSE_OVERRIDE:-}" ]]; then
      local kind remaining
      for kind in container network; do
        if [[ "$kind" == container ]]; then
          remaining="$(docker container ls --all -q --filter "label=com.docker.compose.project=$compose_project")" || status=1
        else
          remaining="$(docker network ls -q --filter "label=com.docker.compose.project=$compose_project")" || status=1
        fi
        if [[ -n "$remaining" ]]; then
          printf 'Isolation teardown has remaining %s resources\n' "$kind" >&2
          status=1
        fi
      done
    fi
  fi

  printf 'status=%s\ncommit=%s\n' "$status" "$(git rev-parse HEAD 2>/dev/null || printf unknown)" \
    > "$artifact_dir/release-gate-summary.txt"
  exit "$status"
}

release_gate_main() {
release_gate_init
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
run_step 07b-self-directed-integration npm run test:t2:integration
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
run_step 13b-self-directed-e2e env T2_WEB_BUILD="$repository_root/frontend/web/build" npm run test:t2:e2e

run_step 14-compose-config validate_compose_family
compose_touched=1
run_step 15-compose-build build_compose_family
run_step 16-compose-start start_compose_family
run_step 17-compose-smoke node scripts/compose-family-smoke.js
run_step 18-git-clean bash scripts/check-git-clean.sh

printf '\nFamily release gate passed. Evidence: %s\n' "$artifact_dir"
}

# Sourcing exposes the same stage helpers without running or skipping a release.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  release_gate_main "$@"
fi
