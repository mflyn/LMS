# Task 6 Phase 1 Startup Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make resource-service and analytics-service import-safe, explicitly started, transaction-checked where required, and included in the family regression gate.

**Architecture:** Both services expose `createApp`, `connectDatabase`, and `startServer` without connecting, listening, writing files, or installing process handlers during module import. Resource-service preserves legacy resource routes and its legacy public upload directory, while future private media will use a separate non-static root. Analytics creates Socket.IO only from `startServer` and refuses to serve Task 6 writes without a writable transaction-capable replica-set primary.

**Tech Stack:** Node.js 18+, Express 4, Mongoose, Socket.IO, Jest, Supertest

---

### Task 1: Write Startup Contract Tests

**Files:**
- Create: `backend/services/resource-service/__tests__/task6Startup.test.js`
- Create: `backend/services/analytics-service/__tests__/task6Startup.test.js`

- [x] **Step 1: Write resource-service failing tests**

Test the exported contract and inject a fake app/connect function:

```js
test('TC-T6-REG-001 importing resource server has no startup side effects', () => {
  const serverModule = require('../server');
  expect(serverModule.createApp).toEqual(expect.any(Function));
  expect(serverModule.connectDatabase).toEqual(expect.any(Function));
  expect(serverModule.startServer).toEqual(expect.any(Function));
  expect(connect).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
});

test('startServer connects before listening', async () => {
  const order = [];
  const app = { listen: jest.fn(() => ({ close: jest.fn() })) };
  await require('../server').startServer({
    app,
    port: 3005,
    connect: async () => order.push('connect')
  });
  expect(order).toEqual(['connect']);
  expect(app.listen).toHaveBeenCalledWith(3005, expect.any(Function));
});
```

- [x] **Step 2: Write analytics-service failing tests**

```js
test('TC-T6-REG-001 importing analytics server has no startup side effects', () => {
  const serverModule = require('../server');
  expect(serverModule.createApp).toEqual(expect.any(Function));
  expect(serverModule.connectDatabase).toEqual(expect.any(Function));
  expect(serverModule.startServer).toEqual(expect.any(Function));
  expect(connect).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
});

test('rejects standalone MongoDB before listening', async () => {
  const connection = { db: { admin: () => ({ command: async () => ({ isWritablePrimary: true }) }) } };
  await expect(require('../server').assertTransactionCapability(connection))
    .rejects.toThrow('transaction-capable writable replica-set primary');
});
```

- [x] **Step 3: Run tests and verify RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand task6Startup
npx jest --config backend/services/analytics-service/jest.family.config.js --runInBand task6Startup
```

Expected: both commands fail because the family configs and startup exports do not exist and current modules start work during import.

### Task 2: Refactor Resource-Service Startup

**Files:**
- Modify: `backend/services/resource-service/app.js`
- Modify: `backend/services/resource-service/server.js`
- Modify: `backend/services/resource-service/package.json`
- Modify: `backend/services/resource-service/package-lock.json`
- Create: `backend/services/resource-service/jest.family.config.js`

- [x] **Step 1: Export an injectable app factory**

Keep existing public resource routes, but construct middleware inside this function and use the real shared error handler in tests and production:

```js
const createApp = ({ logger = createLogger('resource-service') } = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'resource-service';
  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use('/uploads', express.static(LEGACY_UPLOAD_ROOT));
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/resources/collections', collectionsRouter);
  app.use('/api/resources', resourcesRouter);
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'resource-service' }));
  app.use(errorHandler);
  return app;
};

module.exports = createApp();
module.exports.createApp = createApp;
```

Do not call `mongoose.connect`, `listen`, `mkdirSync`, or register a private media static route from `app.js`.

- [x] **Step 2: Export explicit database and server lifecycle functions**

```js
const connectDatabase = async ({ mongooseInstance = mongoose, mongoURI = process.env.MONGO_URI } = {}) => {
  if (mongooseInstance.connection.readyState === 0) await mongooseInstance.connect(mongoURI);
  return mongooseInstance.connection;
};

const startServer = async ({ app = createApp(), port = Number(process.env.PORT || 3005), connect = connectDatabase } = {}) => {
  await connect();
  return app.listen(port, () => logger.info('Resource service started', { port }));
};

if (require.main === module) startServer().catch(handleStartupFailure);
```

Export the default app plus `createApp`, `connectDatabase`, and `startServer`. Move `mongoose` from devDependencies to dependencies because production startup requires it.

- [x] **Step 3: Add the focused family Jest project**

```js
module.exports = {
  displayName: 'resource-family',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/task6Startup.test.js'],
  clearMocks: true,
  restoreMocks: true
};
```

- [x] **Step 4: Run resource tests and verify GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand task6Startup
```

Expected: PASS with no open handle or network connection.

### Task 3: Refactor Analytics-Service Startup

**Files:**
- Create: `backend/services/analytics-service/app.js`
- Modify: `backend/services/analytics-service/server.js`
- Modify: `backend/services/analytics-service/routes/behavior.js`
- Modify: `backend/services/analytics-service/routes/long-term-trends.js`
- Modify: `backend/services/analytics-service/routes/performance.js`
- Modify: `backend/services/analytics-service/routes/progress.js`
- Modify: `backend/services/analytics-service/routes/reports.js`
- Modify: `backend/services/analytics-service/routes/trends.js`
- Modify: `backend/services/analytics-service/routes/user-behavior.js`
- Create: `backend/services/analytics-service/jest.family.config.js`

- [x] **Step 1: Move Express construction to `createApp`**

```js
const createApp = ({ logger = createLogger('analytics-service'), io = null } = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'analytics-service';
  app.locals.io = io;
  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use('/api/analytics/progress', progressRouter);
  app.use('/api/analytics/reports', reportsRouter);
  app.use('/api/analytics/trends', trendsRouter);
  app.use('/api/analytics/long-term-trends', longTermTrendsRouter);
  app.use('/api/analytics/behavior', behaviorRouter);
  app.use('/api/analytics/performance', performanceRouter);
  app.use('/api/analytics', integrationRouter);
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'analytics-service' }));
  app.use(errorHandler);
  return app;
};
```

Use the shared logger/error contract. Do not create file transports or directories during import.

- [x] **Step 2: Add topology verification and explicit HTTP/Socket.IO startup**

```js
const assertTransactionCapability = async (connection) => {
  const hello = await connection.db.admin().command({ hello: 1 });
  const ready = Boolean(hello.setName) && hello.isWritablePrimary === true
    && hello.maxWireVersion >= 7 && Number.isFinite(hello.logicalSessionTimeoutMinutes);
  if (!ready) throw new Error('analytics-service requires a transaction-capable writable replica-set primary');
  return hello;
};

const startServer = async ({ port = Number(process.env.PORT || 3006), connect = connectDatabase } = {}) => {
  await connect();
  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server, logger);
  app.locals.io = io;
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
};
```

Only `startServer` creates Socket.IO and listens. Export the default app and all lifecycle functions.

- [x] **Step 3: Add the focused family Jest project**

```js
module.exports = {
  displayName: 'analytics-family',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/task6Startup.test.js'],
  clearMocks: true,
  restoreMocks: true
};
```

- [x] **Step 4: Run analytics tests and verify GREEN**

```bash
npx jest --config backend/services/analytics-service/jest.family.config.js --runInBand task6Startup
```

Expected: PASS; standalone topology is rejected and import opens no handle.

### Task 4: Add Services to the Root Family Gate

**Files:**
- Modify: `backend/jest.config.js`
- Modify: `backend/common/deployment/__tests__/task5Deployment.test.js`
- Modify: `package.json`

- [x] **Step 1: Register focused family projects**

Add these projects:

```js
'<rootDir>/services/resource-service/jest.family.config.js',
'<rootDir>/services/analytics-service/jest.family.config.js'
```

Change `test:family-regression` to select `resource-family analytics-family` in addition to the existing family projects and keep `--runInBand`.

- [x] **Step 2: Run the Phase 1 gate**

```bash
npm run test:family-regression -- --runInBand
git diff --check
```

Expected: all family projects pass; no import-time ports, connections, process exits, or whitespace errors.

- [x] **Step 3: Commit Phase 1**

```bash
git add package.json backend/jest.config.js \
  backend/services/resource-service/app.js \
  backend/services/resource-service/server.js \
  backend/services/resource-service/package.json \
  backend/services/resource-service/package-lock.json \
  backend/services/resource-service/jest.family.config.js \
  backend/services/resource-service/__tests__/task6Startup.test.js \
  backend/services/analytics-service/app.js \
  backend/services/analytics-service/server.js \
  backend/services/analytics-service/routes/behavior.js \
  backend/services/analytics-service/routes/long-term-trends.js \
  backend/services/analytics-service/routes/performance.js \
  backend/services/analytics-service/routes/progress.js \
  backend/services/analytics-service/routes/reports.js \
  backend/services/analytics-service/routes/trends.js \
  backend/services/analytics-service/routes/user-behavior.js \
  backend/services/analytics-service/jest.family.config.js \
  backend/services/analytics-service/__tests__/task6Startup.test.js \
  backend/common/deployment/__tests__/task5Deployment.test.js
git commit -m "refactor: isolate task 6 service startup"
```
