# Task 11 Family Growth End-to-End Acceptance Design

**Document status:** APPROVED DESIGN / IMPLEMENTATION BASELINE  
**Date:** 2026-07-12  
**Requirement:** `FR-FLOW-001`  
**Depends on:** accepted Task 5 through Task 10 baselines  
**Scope:** backend-backed family MVP integration, cross-role browser acceptance, and a repeatable manual demo

## 1. Purpose

Task 11 proves that the family growth tracker works as one product rather than as a collection of independently tested services. The acceptance path starts from a new parent account and ends with child task completion, parent confirmation, growth evidence, reporting, reminders, and idempotent reward redemption.

The gate uses disposable local infrastructure and public gateway APIs. It does not depend on a shared environment, public endpoint, pre-existing account, or manually seeded database.

## 2. Accepted Product Flow

The automated flow must cover:

1. Register a parent and create a family.
2. Create two child profiles and set a 4-to-6 digit PIN for each.
3. Create one task in each development dimension: academic, physical, artistic, labor, and social.
4. Sign in as the first child and complete at least four tasks, including a measurable physical task.
5. Return as the parent and confirm completed tasks; confirming a task twice creates one star ledger entry.
6. Record growth logs and one academic mistake.
7. Upload private media, bind it as growth evidence, obtain signed access, reject sibling or cross-family access, and soft-delete it.
8. Read a deterministic weekly report and prove a persisted prior-week report is unchanged by late activity.
9. Configure and read reminders, proving family-timezone deduplication.
10. Create and redeem a reward; replaying the same idempotency key does not double-spend stars.
11. Prove a child session cannot enter parent routes, request sibling resources, or continue after its PIN reset invalidates the token.

## 3. Scope Boundaries

### 3.1 Included

- Parent Web child profile and PIN management required to execute the accepted flow.
- User-service application/startup separation so tests can import the real application without connecting or listening.
- A reusable Task 11 runtime that starts real family services and the API gateway against a transaction-capable disposable MongoDB replica set.
- A backend integration suite using public gateway endpoints.
- Playwright Chromium tests against the real CRA frontend and real backend runtime.
- A click-by-click manual demo script and a mandatory CI gate.

### 3.2 Excluded

- Mobile implementation or mobile E2E.
- School teacher, class, course, and administrator workflows.
- Push, email, SMS, RabbitMQ delivery, or production scheduler verification.
- Docker image modernization and production deployment validation.
- Performance and ZAP security scans, which remain explicit release workflows.
- A public test-data creation endpoint.

## 4. Architecture

### 4.1 Runtime Topology

The Task 11 harness runs the following components on loopback ports selected at runtime:

```text
Playwright Chromium
        |
CRA development server (/api proxy)
        |
API gateway
        |
        +-- user-service
        +-- homework-service
        +-- progress-service
        +-- resource-service
        +-- analytics-service
        +-- notification-service
        |
MongoMemoryReplSet + temporary private-media directory
```

All HTTP calls from tests use public gateway paths. Direct service calls are allowed only inside the runtime adapter for internal service-to-service capabilities that production already models, such as media reference binding and star awards.

### 4.2 Why In-Process Service Composition

The repository's Docker stack includes legacy services, Node 14 images, and infrastructure that is unrelated to the family MVP. A local Docker daemon is also not a reliable developer prerequisite. Task 11 therefore composes exported Express applications in one Node process while preserving real HTTP boundaries through independent loopback listeners.

This is not a mocked backend. The real routers, middleware, models, persistence, gateway identity envelope, transaction code, and HTTP clients execute. Only external delivery systems and wall-clock/random inputs are controlled.

### 4.3 Service Startup Contract

Every service used by the harness must be import-safe:

- `createApp(options)` builds and returns the Express application.
- `connectDatabase(uri)` establishes persistence and performs service-specific readiness checks.
- `startServer(options)` connects, listens, and returns handles that can be closed.
- Importing a module must not connect, call `process.exit`, install duplicate process handlers, or listen on a port.

User-service currently violates this contract and must be refactored without changing its production route surface. Existing services that already export an app or factory retain their established pattern.

### 4.4 Dependency Composition

The runtime must explicitly compose capabilities that default service entrypoints omit:

- user-service child routes use the family controller and optional avatar media service.
- homework growth-task routes receive the attachment media service and star-award client.
- resource-service receives private upload, signed capability, media reference, and internal reference routers backed by a temporary `0700` directory.
- analytics-service receives mistake-media and weekly-report routers.
- notification-service receives a family notification router with a deterministic `now` source and real task/report repositories.

Secrets are generated for the test process and shared consistently by the gateway and services. No secret value is printed in normal or failure logs.

## 5. Parent Child Management

### 5.1 Route and Navigation

Add `/app/children` to the parent shell as `孩子`. Remove `/children` from the legacy redirect list because it becomes an intentional family route.

The page is work-focused and contains:

- an unframed create-child form;
- a list of current children;
- one PIN set/reset action per child;
- visible success/error status associated with the relevant form or row.

No PIN value is returned or displayed after submission.

### 5.2 API Contract

Extend `familyApi` with:

- `createChild(payload)` -> `POST /api/children`;
- `setChildPin(childId, pin)` -> `POST /api/children/:childId/pin`.

After child creation, the page calls `FamilyContext.reload()` so the global selector and page list use the same server state. PIN operations update only operation status and do not mutate cached child identity.

### 5.3 Validation

- Required child name is trimmed.
- Optional birth date, grade, school, and development preferences follow the accepted backend contract.
- PIN must contain 4 to 6 ASCII digits.
- Server validation and authorization errors remain visible and retryable where appropriate.
- Duplicate submission is disabled while the request is in flight.

## 6. Test Runtime and Data Lifecycle

### 6.1 Lifecycle

The runtime performs these ordered operations:

1. Allocate a `MongoMemoryReplSet` using `wiredTiger`.
2. Create a private temporary media directory.
3. Set test-only service URLs and shared secrets before loading service modules.
4. Connect the shared Mongoose connection once.
5. Compose and listen to service applications, then the gateway.
6. Optionally start the CRA development server for browser tests.
7. Execute tests against the gateway/frontend URL.
8. Close browser, frontend, gateway, service listeners, Mongoose, replica set, and temporary files in reverse order.

Shutdown runs in `finally`/global teardown even after assertion failure. Open handles or leaked child processes fail the gate.

### 6.2 Isolation

- Each suite receives a unique database name and media directory.
- Each browser test receives unique parent credentials and family names.
- Tests do not rely on execution order.
- Deterministic date tests inject or freeze time at the service boundary.
- Retry is not an acceptance strategy; flaky reruns are diagnostic only and do not turn a failed first execution into a passing gate.

### 6.3 Seed Policy

The happy path creates all user-visible entities through public APIs or UI actions. Direct model inserts are restricted to focused negative fixtures that cannot be created through public product behavior, and each such use must be named in the test.

## 7. Backend Acceptance Suite

Create a single orchestration-focused integration suite under the root backend test project. It must use HTTP through the gateway and retain response IDs for later steps.

Assertions include:

- all five dimensions persist and can be queried for the correct child;
- child completion records measurable output and cannot mutate parent-only fields;
- repeated confirmation produces exactly one award ledger record;
- growth logs and mistakes remain child/family scoped;
- signed media access succeeds only for an authorized current identity;
- weekly report values and persisted historical snapshots are deterministic;
- reminder output contains no duplicate semantic reminder keys;
- reward redemption replays the original result for one idempotency key and debits once;
- sibling and cross-family requests return stable `403` errors;
- resetting the PIN increments token version and makes the prior child token stale.

## 8. Browser Acceptance

### 8.1 Happy Path

Playwright uses accessible roles and labels, not CSS implementation details. It performs registration, family setup, two-child creation, PIN setup, five-task creation, child login/completion, parent login/confirmation, log/mistake/media entry, report/reminder inspection, and reward redemption.

The browser flow may call a public API only for assertions or setup that has no product UI in the approved MVP. Parent child/PIN management is not such an exception and is implemented in the UI.

### 8.2 Negative Cases

Focused browser cases prove:

- child identity opening `/app/*` reaches parent login and never renders parent navigation;
- a child request for a sibling task/profile is rejected and no sibling data renders;
- after a parent resets the PIN, an existing child session is expired and returns to `/child/login`.

Backend integration tests remain authoritative for exhaustive status and idempotency permutations.

### 8.3 Browser Quality

The happy path runs in Chromium at desktop. A focused parent children-page and child navigation smoke also runs at 360px width. Tests fail on uncaught page errors and relevant console errors. Screenshots and traces are retained only on failure in CI.

## 9. CI and Commands

Add root commands with distinct responsibilities:

- `test:family-flow:integration` for the gateway-backed backend suite;
- `test:family-flow:e2e` for Playwright Chromium;
- `test:task11` for the complete Task 11 gate.

The pull-request `test` job must install Chromium and run `test:task11` after existing family regression and frontend tests. The gate is mandatory; `continue-on-error`, `passWithNoTests`, ignored failures, and unconditional retries are prohibited.

Playwright reports and runtime logs are CI artifacts only on failure and must not contain bearer tokens, PINs, signing secrets, private filenames, or signed media URLs.

## 10. Documentation and Traceability

Task 11 creates or updates:

- this detailed design;
- `docs/development/family-growth-task11-test-cases.md`;
- `docs/development/family-tracker-demo-script.md`;
- `docs/development/family-growth-task11-gate.md` after execution;
- PRD and requirement traceability only after all gates pass.

`FR-FLOW-001` moves from `planned` to `implemented` and from `PLANNED_TASK_5_PLUS` to `COVERED` only after the implementation PR is merged and remote `main` is re-audited.

## 11. Acceptance Criteria

Task 11 is complete only when:

1. Parent child/PIN management is usable and tested.
2. User-service and the Task 11 runtime are import-safe and close all resources.
3. Backend integration covers the complete data and security loop.
4. Playwright covers the real cross-role browser loop and focused negative cases.
5. The manual demo script matches automated behavior.
6. Existing family regression, frontend tests/build, Task 11 tests, and repository hygiene checks pass.
7. The implementation PR passes mandatory CI and is merged into `main`.
8. Remote `main` contains the gate evidence and traceability closure for `FR-FLOW-001`.
