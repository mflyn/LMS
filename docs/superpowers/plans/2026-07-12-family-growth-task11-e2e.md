# Task 11 Family Growth End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and merge a deterministic backend-backed parent-to-child family MVP acceptance flow that closes `FR-FLOW-001`.

**Architecture:** Compose the real gateway and six family services on loopback listeners over one disposable `MongoMemoryReplSet`, with injected internal clients and a temporary private-media store. Add the missing parent child/PIN page, then drive the real CRA application with Playwright Chromium; keep focused API integration tests authoritative for data, idempotency, and authorization details.

**Tech Stack:** Node.js 18, Express, Mongoose 8, MongoMemoryReplSet, Jest 29, Supertest/Axios, React 18, Create React App, Testing Library, Playwright Chromium, GitHub Actions.

---

## File Map

### Application composition

- Modify `backend/services/user-service/server.js`: export import-safe `createApp`, `connectDatabase`, and `startServer` functions.
- Modify `backend/services/homework-service/server.js`: move app construction, route injection, logging, MQ, and startup behind factories.
- Modify `backend/gateway/server.js`: export `createApp({ serviceHosts, jwtSecret, identitySecret })` and remove import-time exit behavior.
- Create `backend/services/user-service/__tests__/serverLifecycle.test.js`: guard user-service import/start contract.
- Create `backend/services/homework-service/__tests__/serverLifecycle.test.js`: guard homework route injection and import contract.
- Create `backend/gateway/__tests__/serverLifecycle.test.js`: guard injected host validation and import contract.
- Create `backend/gateway/jest.config.js`: isolate gateway lifecycle tests from legacy setup mocks.
- Modify `backend/gateway/__tests__/familyTask5Routes.test.js`: mock the now-installed proxy module as a real dependency.
- Modify `backend/gateway/__tests__/familyTask6Routes.test.js`: mock the now-installed proxy module as a real dependency.
- Modify `backend/gateway/__tests__/familyTask7Routes.test.js`: mock the now-installed proxy module as a real dependency.
- Modify root `package.json` and `package-lock.json`: declare Express 4 and the gateway proxy as direct runtime dependencies.

### Parent child management

- Modify `frontend/web/src/services/familyApi.js`: add child create and PIN methods.
- Create `frontend/web/src/pages/family/ChildrenPage.js`: parent child list/create/PIN workflow.
- Modify `frontend/web/src/App.js`: mount `/app/children`.
- Modify `frontend/web/src/config/familyNavigation.js`: add parent navigation and remove the legacy `/children` redirect.
- Modify `frontend/web/src/family-shell.css`: stable children form/list and responsive layout.
- Create `frontend/web/src/__tests__/family/familyApi.task11.test.js`: parent child API contract tests.
- Create `frontend/web/src/__tests__/family/Task11Children.test.js`: page, context refresh, validation, and error tests.
- Modify `frontend/web/src/__tests__/family/FamilyNavigation.test.js`: assert the new route and navigation boundary.

### Task 11 runtime and tests

- Create `backend/tests/task11/testEnvironment.js`: test secrets, deterministic identifiers, and environment setup before module loading.
- Create `backend/tests/task11/serviceRuntime.js`: replica set, service composition, loopback listeners, internal clients, and teardown.
- Create `backend/tests/task11/apiClient.js`: public gateway parent/child HTTP helpers without secret logging.
- Create `backend/tests/task11/family-growth-demo-flow.integration.test.js`: complete backend closed loop.
- Create `backend/tests/task11/jest.config.js`: isolated serial Task 11 integration project.
- Create `frontend/web/src/setupProxy.js`: proxy `/api` to `FAMILY_GATEWAY_URL` for E2E, retaining port 8000 as development default.
- Create `tests/e2e/task11/startFamilyApp.js`: start runtime and CRA, wait for readiness, and close both on signals.
- Create `tests/e2e/task11/family-growth-flow.spec.js`: real cross-role happy path.
- Create `tests/e2e/task11/family-growth-security.spec.js`: parent-route, sibling, stale-token, and mobile checks.
- Create `playwright.config.js`: Chromium-only mandatory project, failure-only trace/screenshot/video.
- Modify root `package.json` and `package-lock.json`: Playwright and Task 11 commands.
- Modify `frontend/web/package.json` and `frontend/web/package-lock.json`: explicit `http-proxy-middleware` dependency.
- Modify `.github/workflows/ci-cd.yml`: install Chromium and execute the Task 11 gate.

### Acceptance evidence

- Create `docs/development/family-tracker-demo-script.md`: manual flow matching automation.
- Create `docs/development/family-growth-task11-gate.md`: exact commands, counts, CI, and merge evidence.
- Modify `docs/product/family-learning-tracker.md`: mark `FR-FLOW-001` implemented only at closure.
- Modify `docs/development/family-growth-requirement-traceability.md`: map `FR-FLOW-001` to Task 11 evidence.
- Modify `.gitignore`: ignore Playwright reports, test results, and runtime artifacts.

## Task 1: Make Core HTTP Applications Import-Safe

**Files:**
- Create: `backend/services/user-service/__tests__/serverLifecycle.test.js`
- Create: `backend/services/homework-service/__tests__/serverLifecycle.test.js`
- Create: `backend/gateway/__tests__/serverLifecycle.test.js`
- Create: `backend/gateway/jest.config.js`
- Modify: `backend/gateway/__tests__/familyTask5Routes.test.js`
- Modify: `backend/gateway/__tests__/familyTask6Routes.test.js`
- Modify: `backend/gateway/__tests__/familyTask7Routes.test.js`
- Modify: `backend/services/user-service/server.js`
- Modify: `backend/services/homework-service/server.js`
- Modify: `backend/gateway/server.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write failing import-safety tests**

Use `jest.isolateModules()` with spies for `mongoose.connect`, `express.application.listen`, `process.exit`, and process-handler setup. Assert a plain `require('../server')` calls none of them and exports these exact methods:

```js
expect(serverModule).toEqual(expect.objectContaining({
  createApp: expect.any(Function),
  connectDatabase: expect.any(Function),
  startServer: expect.any(Function)
}));
```

For the gateway, call `createApp` with explicit service URLs and assert `/health` returns `api-gateway`; call it with a missing required host and assert it throws `Missing gateway service host: data` rather than exiting.

- [ ] **Step 2: Run tests and verify red state**

Run:

```bash
npx jest --config=backend/services/user-service/jest.config.js --runInBand serverLifecycle
npx jest --config=backend/services/homework-service/jest.config.js --runInBand serverLifecycle
npx jest --config=backend/gateway/jest.config.js --runInBand serverLifecycle
```

Expected: failures show missing factories and current import-time side effects.

If root module resolution cannot load the gateway, install the gateway's declared runtime dependencies at the root composition boundary:

```bash
npm install --save express@^4.21.2 express-http-proxy@^1.6.3
```

Express must remain on major version 4 because the shared `xss-clean` middleware writes `req.query`, which is read-only in Express 5.

- [ ] **Step 3: Refactor user-service around explicit lifecycle functions**

Implement these signatures and preserve the existing route/error ordering:

```js
const createApp = ({ routes = createRoutes(), appLogger = logger } = {}) => {
  const app = createBaseApp({ serviceName: 'user-service', enableSessions: false });
  app.locals.logger = appLogger;
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
};

const connectDatabase = async ({ mongooseInstance = mongoose, mongoURI = config.mongoURI } = {}) => {
  if (!mongoURI) throw new Error('mongoURI for user-service is required');
  if (mongooseInstance.connection.readyState === 0) await mongooseInstance.connect(mongoURI);
  return mongooseInstance.connection;
};

const startServer = async ({ app = createApp(), port = config.port, connect = connectDatabase } = {}) => {
  await connect();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });
};
```

Install process exception handling and invoke `startServer()` only inside `if (require.main === module)`.
Retain compatibility by exporting the default app and attaching lifecycle methods as properties:

```js
const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
module.exports.connectDatabase = connectDatabase;
module.exports.startServer = startServer;
```

- [ ] **Step 4: Refactor homework-service with injected growth router**

Implement `createApp({ growthTaskRouter = createGrowthTaskRouter(), homeworkRouter = homeworkRoutes, appLogger = logger, initializeQueue = initializeMessageQueue })`. Do not validate star-client environment, add file transports, install process handlers, connect Mongo, initialize MQ, or listen during import. Production `startServer` performs validation, database connection, queue initialization, and listener creation in that order.

The runtime must be able to inject:

```js
createGrowthTaskRouter({ awardTaskStar, attachmentMediaService })
```

Retain `module.exports = app` for existing Supertest suites and attach lifecycle methods to that app export.

- [ ] **Step 5: Refactor gateway into an injected factory**

Move proxy registration inside `createApp`. Validate `user` and `data` hosts as required and mount optional family hosts only when supplied. Build authentication from the injected JWT and identity secrets. Keep public `/api/auth`, protected family routes, and unsigned media-content capability route behavior unchanged.
Retain the default gateway app export and attach `createApp`/`startServer` properties so production and existing imports remain compatible.

- [ ] **Step 6: Run focused and family regression tests**

Run the three focused commands from Step 2, then:

```bash
npm run test:family-regression -- --runInBand
```

Expected: lifecycle suites and all family regression projects pass with no open-handle warning.

- [ ] **Step 7: Commit lifecycle refactor**

```bash
git add package.json package-lock.json backend/services/user-service/server.js backend/services/user-service/__tests__/serverLifecycle.test.js backend/services/homework-service/server.js backend/services/homework-service/__tests__/serverLifecycle.test.js backend/gateway/server.js backend/gateway/jest.config.js backend/gateway/__tests__/serverLifecycle.test.js backend/gateway/__tests__/familyTask5Routes.test.js backend/gateway/__tests__/familyTask6Routes.test.js backend/gateway/__tests__/familyTask7Routes.test.js docs/superpowers/plans/2026-07-12-family-growth-task11-e2e.md
git commit -m "refactor: make family service startup testable"
```

## Task 2: Add Parent Child and PIN Management

**Files:**
- Create: `frontend/web/src/__tests__/family/familyApi.task11.test.js`
- Create: `frontend/web/src/__tests__/family/Task11Children.test.js`
- Create: `frontend/web/src/pages/family/ChildrenPage.js`
- Modify: `frontend/web/src/services/familyApi.js`
- Modify: `frontend/web/src/App.js`
- Modify: `frontend/web/src/config/familyNavigation.js`
- Modify: `frontend/web/src/family-shell.css`
- Modify: `frontend/web/src/__tests__/family/FamilyNavigation.test.js`

- [ ] **Step 1: Write failing API contract tests**

Set a parent session, mock Axios, and assert exact calls:

```js
await createChild({ name: ' 小明 ', grade: '三年级' });
expect(axios.post).toHaveBeenCalledWith('/api/children', { name: ' 小明 ', grade: '三年级' }, parentConfig);

await setChildPin('child-a1', '2468');
expect(axios.post).toHaveBeenCalledWith('/api/children/child-a1/pin', { pin: '2468' }, parentConfig);
```

Also assert `familyId` is stripped and `childId` is URL-encoded.

- [ ] **Step 2: Write failing children-page tests**

Render the real `App` at `/app/children` with a parent session. Mock `getMyFamily`, `createChild`, and `setChildPin`; cover `TC-T11-CHILD-001` through `003` and `TC-T11-PIN-001` through `003`, including one assertion that `getMyFamily` is called again after creation.

- [ ] **Step 3: Run focused tests and verify red state**

```bash
npm test --prefix frontend/web -- --watchAll=false familyApi.task11 Task11Children FamilyNavigation
```

Expected: missing exports, route, page, and navigation label fail.

- [ ] **Step 4: Implement API methods and page**

Add:

```js
export const createChild = (payload) => parentPost('/api/children', payload);
export const setChildPin = (childId, pin) => parentPost(
  `/api/children/${encodeURIComponent(childId)}/pin`,
  { pin }
);
```

Build `ChildrenPage` with separate child and per-row PIN pending/error states. Trim names before sending, enforce `^\d{4,6}$`, clear PIN after every request, and await `reload()` after successful child creation.

- [ ] **Step 5: Mount route, navigation, and responsive layout**

Add `{ path: '/app/children', label: '孩子' }`, mount `<Route path="children" element={<ChildrenPage />} />`, remove `/children` from `LEGACY_SCHOOL_PATHS`, and use a two-column desktop/one-column mobile form layout with fixed control heights and no nested cards.

- [ ] **Step 6: Run focused tests and frontend gate**

```bash
npm test --prefix frontend/web -- --watchAll=false familyApi.task11 Task11Children FamilyNavigation
npm run test:ci --prefix frontend/web
npm run build --prefix frontend/web
```

Expected: all commands exit zero and the production build completes.

- [ ] **Step 7: Commit parent prerequisite**

```bash
git add frontend/web/src/services/familyApi.js frontend/web/src/pages/family/ChildrenPage.js frontend/web/src/App.js frontend/web/src/config/familyNavigation.js frontend/web/src/family-shell.css frontend/web/src/__tests__/family/familyApi.task11.test.js frontend/web/src/__tests__/family/Task11Children.test.js frontend/web/src/__tests__/family/FamilyNavigation.test.js
git commit -m "feat: add parent child pin management"
```

## Task 3: Build the Disposable Real-Service Runtime

**Files:**
- Create: `backend/tests/task11/testEnvironment.js`
- Create: `backend/tests/task11/serviceRuntime.js`
- Create: `backend/tests/task11/apiClient.js`
- Create: `backend/tests/task11/runtime.integration.test.js`
- Create: `backend/tests/task11/jest.config.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing runtime lifecycle test**

Start `createFamilyRuntime()`, request gateway `/health` and each service `/health`, then stop. Assert `mongoose.connection.readyState === 0`, every server has `listening === false`, and the private root no longer exists. Repeat teardown after throwing inside a `try/finally` block.

- [ ] **Step 2: Add isolated Jest configuration and red command**

Configure Node environment, `testMatch: ['**/*.integration.test.js']`, 90-second timeout, and serial execution. Add:

```json
"test:family-flow:integration": "jest --config=backend/tests/task11/jest.config.js --runInBand"
```

Run `npm run test:family-flow:integration -- runtime` and expect failure because the runtime module does not exist.

- [ ] **Step 3: Implement deterministic environment setup**

Set `NODE_ENV=test`, generated 32+ character JWT/gateway/media secrets, short internal timeouts, and disabled MQ before requiring product modules. Export `redactRuntimeError(error)` that removes bearer values, PIN fields, signed capability query strings, and private-root paths.

- [ ] **Step 4: Compose resource, homework, analytics, and notification dependencies**

Reuse the proven private-media composition from `resource-service/__tests__/familyMediaPrivacy.test.js`. Build real media reference clients for task attachments and mistake media. Build the homework star client against the runtime progress URL. Build `createFamilyNotificationSourceRepository()` and inject a fixed `now` into `createFamilyNotificationsRouter`, mounted at `/api/notifications`.

- [ ] **Step 5: Implement listener and teardown helpers**

`listen(app)` must call `server.listen(0, '127.0.0.1')` and return `{ server, url }`. `stop()` closes listeners in reverse order, disconnects Mongoose, stops the replica set, removes the private root, and is idempotent. Failed startup calls the same `stop()` before rethrowing a redacted error.

- [ ] **Step 6: Implement the public API client**

Provide `registerParent`, `loginParent`, `asParent(token)`, `loginChild`, and `asChild(token)` wrappers around Axios with `validateStatus: () => true`. Never place auth headers or request bodies into thrown error messages; assertions inspect status and response envelope explicitly.

- [ ] **Step 7: Run runtime twice**

```bash
npm run test:family-flow:integration -- runtime
npm run test:family-flow:integration -- runtime
```

Expected: both runs pass on first execution with no leaked handle warning.

- [ ] **Step 8: Commit runtime**

```bash
git add backend/tests/task11 package.json package-lock.json
git commit -m "test: add disposable family service runtime"
```

## Task 4: Implement the Backend Closed-Loop Acceptance Test

**Files:**
- Create: `backend/tests/task11/family-growth-demo-flow.integration.test.js`
- Modify: `backend/tests/task11/apiClient.js`
- Modify: `backend/tests/task11/serviceRuntime.js`

- [ ] **Step 1: Write the identity and five-dimension flow first**

Use unique email/username values, public API calls, and response IDs. Assert statuses and exact dimension set:

```js
expect(new Set(tasks.map((task) => task.dimension))).toEqual(
  new Set(['academic', 'physical', 'artistic', 'labor', 'social'])
);
```

Run `npm run test:family-flow:integration -- family-growth-demo-flow` and verify the first unsupported runtime dependency fails.

- [ ] **Step 2: Complete task and star idempotency assertions**

Child A completes four tasks with the physical task carrying `actualAmount` and `actualUnit`. Parent confirms one task twice. Query reward ledger and assert one `task_completion` entry for that task and unchanged balance after replay.

- [ ] **Step 3: Add growth log and mistake scope assertions**

Create four dimension logs and one academic mistake. Assert child B and a second family receive `403` or empty family-scoped lists according to the documented endpoint contract, never child A records.

- [ ] **Step 4: Add media privacy lifecycle assertions**

Upload an in-memory JPEG fixture, bind it to a task or mistake, request signed access, fetch bytes through the capability route, reject sibling/cross-family access, soft-delete, then assert subsequent access is unavailable.

- [ ] **Step 5: Add deterministic report and reminder assertions**

Request a fixed current week and verify totals/dimension distribution. Persist the previous week, mutate late source activity, request it again, and compare statistical payloads. Configure Sunday report reminders and assert semantic reminder keys remain unique across the same Shanghai local date.

- [ ] **Step 6: Add reward idempotency and stale-token assertions**

Create an affordable reward, redeem twice with the same UUID, and assert one debit. Attempt a new-key redemption without balance and assert conflict with non-negative balance. Reset child PIN, reuse the old child token, and assert `401 STALE_CHILD_TOKEN`.

- [ ] **Step 7: Run the suite twice and regression once**

```bash
npm run test:family-flow:integration -- family-growth-demo-flow
npm run test:family-flow:integration -- family-growth-demo-flow
npm run test:family-regression -- --runInBand
```

Expected: all first executions pass and the two flow runs report identical assertion counts.

- [ ] **Step 8: Commit backend acceptance**

```bash
git add backend/tests/task11/family-growth-demo-flow.integration.test.js backend/tests/task11/apiClient.js backend/tests/task11/serviceRuntime.js
git commit -m "test: cover family growth backend flow"
```

## Task 5: Add Real Browser Happy-Path Acceptance

**Files:**
- Create: `frontend/web/src/setupProxy.js`
- Create: `tests/e2e/task11/startFamilyApp.js`
- Create: `tests/e2e/task11/family-growth-flow.spec.js`
- Create: `playwright.config.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `frontend/web/package.json`
- Modify: `frontend/web/package-lock.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install explicit test dependencies**

Run:

```bash
npm install --save-dev @playwright/test
npm install --prefix frontend/web --save-dev http-proxy-middleware@^2.0.7
```

Add ignored paths `/playwright-report/`, `/test-results/`, and `/.task11-runtime/`.

- [ ] **Step 2: Write the failing browser happy path**

Use accessible labels/roles to register, create a family, add two children/PINs, add five tasks, switch to a child context, complete one physical task, switch back to parent, and confirm it. Register listeners that fail on `pageerror` and non-allowlisted console errors.

- [ ] **Step 3: Configure dynamic proxy and E2E process**

`setupProxy.js` proxies `/api` to `process.env.FAMILY_GATEWAY_URL || 'http://localhost:8000'`. `startFamilyApp.js` starts `createFamilyRuntime()`, spawns CRA with `PORT=3100`, `BROWSER=none`, and the runtime gateway URL, waits for `/login`, and closes the child process/runtime on `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection`.

- [ ] **Step 4: Configure Playwright**

Use `baseURL: 'http://127.0.0.1:3100'`, Chromium desktop, `workers: 1`, `retries: 0`, and webServer command `node tests/e2e/task11/startFamilyApp.js`. Retain trace, screenshot, and video only on failure.

- [ ] **Step 5: Run and make the happy path green**

```bash
npx playwright install chromium
npx playwright test tests/e2e/task11/family-growth-flow.spec.js --project=chromium
```

Expected: the full browser flow passes once with no relevant console/page errors.

- [ ] **Step 6: Commit browser happy path**

```bash
git add .gitignore package.json package-lock.json frontend/web/package.json frontend/web/package-lock.json frontend/web/src/setupProxy.js playwright.config.js tests/e2e/task11/startFamilyApp.js tests/e2e/task11/family-growth-flow.spec.js
git commit -m "test: add family growth browser acceptance"
```

## Task 6: Add Browser Security and Mobile Checks

**Files:**
- Create: `tests/e2e/task11/family-growth-security.spec.js`
- Modify: `tests/e2e/task11/startFamilyApp.js`
- Modify: `playwright.config.js`

- [ ] **Step 1: Write failing role-isolation tests**

Create separate parent and child browser contexts. With only child storage, open `/app/today` and assert parent login appears and parent navigation does not. Capture child B's ID as parent, then issue child A's request for child B profile/task and assert `403` with no sibling name in the DOM.

- [ ] **Step 2: Write failing stale-session test**

Keep child A logged in, reset its PIN through the parent context, then navigate/reload a protected child route. Assert child storage is removed and `/child/login` renders the stale-session recovery message.

- [ ] **Step 3: Write 360px layout checks**

Open the parent children page and child shell at 360x800. Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, primary controls have non-overlapping bounding boxes, and navigation does not cover focused content.

- [ ] **Step 4: Run focused and complete browser suites**

```bash
npx playwright test tests/e2e/task11/family-growth-security.spec.js --project=chromium
npx playwright test --project=chromium
```

Expected: all cases pass with zero retries and no persistent report artifacts after cleanup.

- [ ] **Step 5: Commit negative acceptance**

```bash
git add tests/e2e/task11/family-growth-security.spec.js tests/e2e/task11/startFamilyApp.js playwright.config.js
git commit -m "test: verify family role isolation in browser"
```

## Task 7: Wire the Mandatory CI Gate and Demo

**Files:**
- Create: `docs/development/family-tracker-demo-script.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci-cd.yml`

- [ ] **Step 1: Add aggregate commands**

Add:

```json
"test:family-flow:e2e": "playwright test --project=chromium",
"test:task11": "npm run test:family-flow:integration && npm run test:family-flow:e2e"
```

- [ ] **Step 2: Add mandatory CI steps**

After frontend CI tests, add:

```yaml
- name: Install Task 11 Browser
  run: npx playwright install --with-deps chromium

- name: Run Task 11 Acceptance
  run: npm run test:task11

- name: Upload Task 11 Failure Evidence
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: task11-failure-evidence
    path: |
      playwright-report
      test-results
```

Do not use `continue-on-error` or retries.

- [ ] **Step 3: Write the manual demo script**

Document prerequisites, exact parent/child clicks, five example tasks, expected statuses, role changes, report/reminder/reward checks, privacy checks, reset instructions, and troubleshooting that does not reveal secrets. Keep values aligned with automated test data.

- [ ] **Step 4: Run the aggregate gate from a clean runtime**

```bash
npm run test:task11
git diff --check
git status --short | rg "(playwright-report|test-results|\.task11-runtime|coverage)"
```

Expected: Task 11 exits zero; diff check and generated-artifact search are silent (exit code 1 from the final `rg` is expected).

- [ ] **Step 5: Commit CI and demo**

```bash
git add package.json package-lock.json .github/workflows/ci-cd.yml docs/development/family-tracker-demo-script.md
git commit -m "ci: require task 11 family acceptance"
```

## Task 8: Run Full Gate and Close Traceability

**Files:**
- Create: `docs/development/family-growth-task11-gate.md`
- Modify: `docs/product/family-learning-tracker.md`
- Modify: `docs/development/family-growth-requirement-traceability.md`

- [ ] **Step 1: Run every local gate and record exact output**

```bash
npm run test:family-regression -- --runInBand
npm run test:ci --prefix frontend/web
npm run build --prefix frontend/web
npm run test:family-flow:integration
npm run test:family-flow:integration
npm run test:family-flow:e2e
git diff --check
git status --short | rg "(playwright-report|test-results|\.task11-runtime|coverage)"
```

Expected: all test/build commands exit zero; both integration runs pass independently; diff check is silent; the final generated-artifact search has no output and exits 1.

- [ ] **Step 2: Write gate evidence before changing requirement status**

Record commit IDs, commands, suite/test counts, first-run results, Chromium version, viewports, CI requirement, security cases, residual risk, and the statement that Docker/deployment scans are outside this MVP gate.

- [ ] **Step 3: Close PRD and traceability**

Change `FR-FLOW-001` from `planned` to `implemented`. Replace `integration planned`, `planned Task 11 cross-role demo flow`, and `PLANNED_TASK_5_PLUS` with the exact backend/Playwright evidence and `COVERED`.

- [ ] **Step 4: Validate closure consistency**

```bash
rg -n "FR-FLOW-001" docs/product/family-learning-tracker.md docs/development/family-growth-requirement-traceability.md docs/development/family-growth-task11-gate.md
rg -n "PLANNED_TASK_5_PLUS" docs/development/family-growth-task11-gate.md docs/development/family-growth-requirement-traceability.md
git diff --check
```

Expected: every Task 11 reference says implemented/covered, and the second search has no output for Task 11 evidence.

- [ ] **Step 5: Commit gate closure**

```bash
git add docs/development/family-growth-task11-gate.md docs/product/family-learning-tracker.md docs/development/family-growth-requirement-traceability.md
git commit -m "docs: close task 11 acceptance gate"
```

## Task 9: Review, PR, CI, Merge, and Remote-Main Audit

**Files:**
- Inspect all commits from `origin/main..HEAD`.
- No product file changes unless review or CI exposes a defect.

- [ ] **Step 1: Self-review scope and secrets**

```bash
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
git diff origin/main...HEAD -- . ':!docs/**' ':!**/__tests__/**' ':!backend/tests/**' ':!tests/**' ':!package-lock.json' ':!frontend/web/package-lock.json' \
  | rg "(Bearer [A-Za-z0-9._-]{20,}|your_jwt_secret|MEDIA_SIGNING_SECRET=['\"][^$])"
```

Expected: scoped Task 11 changes, clean diff, intentional commits, and the final secret scan has no output (exit code 1 from `rg` is expected).

- [ ] **Step 2: Push and create a ready PR**

```bash
git push -u origin codex/task11-family-e2e
gh pr create --base main --head codex/task11-family-e2e --title "feat: complete Task 11 family acceptance flow" --body-file /tmp/task11-pr-body.md
```

The PR body lists requirement, architecture, commands/counts, security cases, UI evidence, and residual risks.

- [ ] **Step 3: Wait for and inspect mandatory checks**

```bash
gh pr checks --watch
```

Expected: family regression, frontend smoke, and Task 11 acceptance are successful. Diagnose any failure from the first failed job; never rerun until the cause is understood and fixed.

- [ ] **Step 4: Merge through GitHub**

```bash
gh pr merge --merge --delete-branch
```

Expected: GitHub reports the PR merged into `main`.

- [ ] **Step 5: Audit remote main without touching the dirty primary checkout**

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
git show origin/main:docs/development/family-growth-task11-gate.md | rg "FR-FLOW-001|COVERED|Playwright"
git show origin/main:docs/development/family-growth-requirement-traceability.md | rg "FR-FLOW-001"
```

Expected: the branch head is an ancestor of remote main and both evidence files show implemented/covered Task 11 state.
