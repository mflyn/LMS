# Family Growth Seven-Stage Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven reviewed release gaps in strict sequence, merging each independently verified stage into `main` before starting the next stage.

**Architecture:** Keep the existing service ownership boundaries and add explicit production composition roots, MongoDB transactions for cross-document invariants, one canonical public contract, and user-facing coverage for every implemented MVP requirement. Each stage uses a dedicated `codex/` branch and leaves an independently testable merge on `main`.

**Tech Stack:** Node.js 22, Express 4, MongoDB/Mongoose, Jest, React/CRA, Docker Compose.

## Global Constraints

- Preserve all unrelated changes already present in the native `main` checkout.
- Use failing tests before behavior changes; configuration-only edits must be covered by static contract tests.
- Do not mark the v1.6 baseline approved until all seven stages and the final clean-room gate pass.
- Merge one stage into `main` before creating the next stage branch.

---

### Stage 1: Production Containers and Media Composition

**Files:** Dockerfiles, both Compose files, root dependency manifest, resource/user/homework server entrypoints, and their startup/deployment tests.

- [ ] Extend `task6Deployment.test.js` so service build contexts must be repository-root, Dockerfiles must use Node 22 and preserve `backend/common`, and the runtime dependency set must include `socket.io`.
- [ ] Add startup tests proving resource media routes and user/homework media consumers are composed by the default production app factory.
- [ ] Run the focused tests and observe failures caused by the current subdirectory contexts and uncomposed services.
- [ ] Implement root-context Dockerfiles and explicit `createProductionApp()` factories for resource, user, and homework services.
- [ ] Add the Ubuntu Compose/environment files, validate both Compose configurations, then run focused and family regression tests.
- [ ] Commit, merge `codex/fix-1-production-runtime` into `main`, and re-run the stage gate on the merged commit.

### Stage 2: Transactional Invariants and Pending Star Archive

**Files:** `familyController.js`, `familyMistakes.js`, `growthTasks.js`, transaction helpers, model indexes, and route integration tests.

- [ ] Add failure-injection tests showing family/child creation cannot leave partial relationships.
- [ ] Add a test showing a mistake state write and its history event commit or roll back together.
- [ ] Add a test that deleting `confirmed + pending` returns `409 STAR_AWARD_PENDING` without changing the task.
- [ ] Implement replica-set-backed transactions and the archive guard; add an auditable relationship repair command.
- [ ] Run focused, family regression, and Task 11 integration gates; commit and merge stage 2 into `main`.

### Stage 3: Canonical API Contracts

**Files:** family/auth/notification/child routes, controllers, shared contract constants, API documentation, and contract tests.

- [ ] Preserve and review any pre-existing logout work from the native checkout before editing.
- [ ] Add contract tests for family name/timezone validation, idempotent authenticated logout, canonical reminder fields/order, shared read-boundary use, and child profile field names.
- [ ] Implement the canonical contracts and stable error envelopes; update API examples and traceability.
- [ ] Run service contract, family regression, and Task 11 gates; commit and merge stage 3 into `main`.

### Stage 4: Missing Parent Features

**Files:** family API client, navigation/routes, child editor/avatar UI, knowledge-point UI, styles, accessibility tests, and frontend integration tests.

- [ ] Add failing UI tests for editing the full child profile, avatar draft lifecycle, and knowledge-point create/filter/update flows.
- [ ] Implement the API client functions and accessible responsive pages/dialogs.
- [ ] Run focused frontend tests, all family frontend tests, production build, and backend family regression; commit and merge stage 4 into `main`.

### Stage 5: Static and Frontend Test Quality

**Files:** `eslint.config.js`, frontend router tests, async resource tests, and test setup console guards.

- [ ] Add an ESLint 9 flat configuration and fix all in-scope lint failures.
- [ ] Make `/app` redirect assertions await navigation completion.
- [ ] Remove React `act()` and router warnings and fail tests on unexpected `console.error`.
- [ ] Run lint, full frontend tests, production build, and family regression; commit and merge stage 5 into `main`.

### Stage 6: Reproducible Release Gate

**Files:** CI/release scripts, Compose smoke runner, and gate tests.

- [ ] Add a clean-install release command covering lint, backend family regression, Task 11 integration/E2E, frontend tests/build, Compose build/start/health, and a media-backed family smoke flow.
- [ ] Ensure failures preserve diagnostics and always tear down containers without deleting persistent user volumes.
- [ ] Run the gate in a clean checkout; commit the reproducible gate and merge stage 6 into `main`.

### Stage 7: Evidence and Baseline Closure

**Files:** requirement traceability, design asset index, gate reports, deployment guide, and v1.6 manifest.

- [ ] Reconcile every requirement with the merged implementation and fresh test evidence.
- [ ] Replace obsolete gate counts and risks, record the final `main` evidence commit, and keep status `READY_FOR_REVIEW` until reviewer signatures exist.
- [ ] Run link/placeholder/contract scans and the complete release gate.
- [ ] Commit and merge stage 7 into `main`, then perform a requirement-by-requirement completion audit.
