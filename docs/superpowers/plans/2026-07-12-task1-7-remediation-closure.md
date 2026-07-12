# Task 1-7 Remediation Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selectively migrate the valid uncommitted Task 1-7 test-quality and configuration/infrastructure remediations onto the latest `main` without reverting Task 8-11 frontend work.

**Architecture:** Keep the current family frontend test baseline unchanged, add only the missing repository-cleanliness gate and backend coverage tests, then introduce explicit gateway port parsing, route-level sensitive throttling, and a family-only local deployment profile. Each production behavior is introduced after a focused failing test and verified against the full family and Task 11 gates.

**Tech Stack:** Node.js, Express, Jest, Create React App, Docker Compose, Kubernetes Kustomize, GitHub Actions.

---

## File Map

- `scripts/check-git-clean.sh`: fail CI when tests leave tracked or untracked artifacts.
- `.github/workflows/ci-cd.yml`: run the clean-worktree check after backend, frontend, and Task 11 tests.
- `backend/jest.family-common.config.js`: enforce measured per-file coverage thresholds.
- `backend/common/**/__tests__`, `backend/services/**/__tests__`: close reviewed backend boundary gaps.
- `backend/gateway/port.js`: single gateway port precedence and validation boundary.
- `backend/common/middleware/sensitiveRateLimit.js`: reusable route-level sensitive limiter adapter.
- `backend/common/createBaseApp.js`: construct and expose the sensitive limiter.
- `backend/services/user-service/routes/auth.js`, `children.js`: protect registration, login, child PIN login, and PIN update routes.
- `docker-compose.family.yml`, `backend/Makefile`, root `package.json`: family-only local runtime and commands.
- `deployment/kubernetes/*`, compose files, env documentation: align port and family deployment boundaries.
- `docs/development/family-growth-*-remediation.md`: record what was migrated, superseded, and verified.

## Task 1: Establish Clean Baseline

- [ ] Run `npm ci` at the repository root.
- [ ] Run `npm run test:family-regression` and record the suite/test count.
- [ ] Run `npm run test:task11` and record the suite/test count.
- [ ] Run `npm ci --prefix frontend/web && npm run test:ci --prefix frontend/web`.
- [ ] Confirm `git status --short` contains only this plan.

## Task 2: Add Repository Cleanliness Gate

- [ ] Add a shell contract test that creates a temporary tracked/untracked change and proves `scripts/check-git-clean.sh` fails, then restores the checkout.
- [ ] Run the focused test and confirm it fails because the script is absent.
- [ ] Add `scripts/check-git-clean.sh` using `git status --porcelain --untracked-files=all`.
- [ ] Run the focused test and confirm clean and dirty cases pass.
- [ ] Add the CI step after all test-producing steps, preserving the current Task 11 gate.

## Task 3: Close Backend Test-Quality Gaps

- [ ] Add or merge focused cases for Mongo error normalization, timeout validation, award retry boundaries, notification query timeout degradation, and family access authorization.
- [ ] Run each focused suite before production changes; retain only tests that fail for a currently missing contract.
- [ ] Add measured file-level coverage thresholds to `backend/jest.family-common.config.js`.
- [ ] Run `npx jest --config=backend/jest.family-common.config.js --coverage --runInBand --silent` and adjust thresholds only from observed coverage.
- [ ] Remove `backend/jest.config.simple.js` and `backend/jest.setup.simple.js` after proving no script/config references them.
- [ ] Commit as `test: close task1-7 quality remediation`.

## Task 4: Unify Gateway Port Configuration

- [ ] Add `backend/gateway/__tests__/portConfig.test.js` for `GATEWAY_PORT > PORT > config.port`, invalid values, and missing values.
- [ ] Run the focused test and confirm failure because `backend/gateway/port.js` is absent.
- [ ] Implement `resolveGatewayPort` and use it from gateway startup/export paths.
- [ ] Update env, Compose, Kubernetes, and deployment contract tests to use `GATEWAY_PORT=3000` consistently.
- [ ] Run gateway and deployment focused suites.

## Task 5: Add Sensitive Endpoint Throttling

- [ ] Add `backend/common/__tests__/createBaseApp.test.js` cases proving the sensitive limiter is separate and configurable.
- [ ] Add user-service route tests or static route-contract assertions for registration, login, child PIN login, and PIN update.
- [ ] Run focused tests and confirm the sensitive limiter contract is missing.
- [ ] Implement `sensitiveRateLimit.js`, expose the limiter from `createBaseApp`, and mount it on the four endpoint groups.
- [ ] Run common and user-service focused suites.

## Task 6: Add Family-Only Local Deployment

- [ ] Extend deployment contract tests for obsolete env files, unused middleware/Jest configs, family Compose membership, optional legacy data proxy, Make targets, and Kubernetes family resources.
- [ ] Run the contract suite and confirm the new assertions fail.
- [ ] Add `docker-compose.family.yml`, `backend/Makefile`, and root family Docker scripts.
- [ ] Remove obsolete `.env.backup`, `.env.new`, and unused `security.js`.
- [ ] Make the legacy data proxy conditional on `DATA_SERVICE_URL`; keep it explicit in full Compose and absent in family Compose/Kubernetes.
- [ ] Remove school-only services from the family Kubernetes base and document overlay expectations.
- [ ] Run deployment, gateway, notification, and Compose/Kustomize validation.
- [ ] Commit as `feat: close task1-7 configuration remediation`.

## Task 7: Documentation and Full Gate

- [ ] Add both remediation records with status `VERIFIED_AND_MERGED_PENDING_PR` and clearly mark Task 8-11 frontend substitutions.
- [ ] Update `docs/development/README.md` and environment documentation.
- [ ] Run `npm run test:family-regression`.
- [ ] Run `npm run test:task11`.
- [ ] Run `npm run test:ci --prefix frontend/web`.
- [ ] Run the family-common coverage gate and focused deployment suites.
- [ ] Run Docker Compose and `kubectl kustomize` validation when the tools are available.
- [ ] Run `git diff --check` and `bash scripts/check-git-clean.sh` after committing.
- [ ] Push `codex/task1-7-remediation-closure`, create a PR, wait for required checks, merge it, and verify the remote `main` tree.

## Explicit Exclusions

- Do not copy the dirty workspace versions of `frontend/web/package.json`, lockfile, smoke test, setup file, or legacy test filenames; Task 8-11 already contain the maintained versions.
- Do not merge the dirty workspace `.github/workflows/ci-cd.yml` wholesale; only add the clean-worktree step to the current workflow.
- Do not copy old endpoint files wholesale; merge the narrow behavior into current Task 11 code.
- Do not modify or clean the original `/Users/linmingfeng/GitHub PRJ/LMS` worktree.
