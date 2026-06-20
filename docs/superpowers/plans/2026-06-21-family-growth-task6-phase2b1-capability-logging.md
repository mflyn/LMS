# Task 6 Phase 2B1 Capability and Log Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide deterministic short-lived HMAC media capabilities and ensure request/error logs never contain signed media URLs, signatures, nonces, tokens, credentials, or secrets.

**Architecture:** `mediaCapability` is a pure resource-service module with injected clock and nonce generator; it signs method, canonical path, media ID, expiry, and nonce with an independent secret and verifies in constant time. `logRedaction` is a common pure URL sanitizer used by request and error middleware; signed-content routes log only their path, while other URLs retain non-sensitive parameters and replace sensitive values.

**Tech Stack:** Node.js crypto/URL, shared AppError contract, Jest

---

### Task 1: Add Signed Media Capabilities

**Files:**
- Create: `backend/services/resource-service/services/mediaCapability.js`
- Create: `backend/services/resource-service/__tests__/mediaCapability.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [ ] **Step 1: Write failing capability tests**

```js
const service = createMediaCapabilityService({
  secret: 'test-media-signing-secret-at-least-32-characters',
  maxAgeSeconds: 300,
  now: () => Date.parse('2026-06-21T00:00:00.000Z'),
  randomUUID: () => 'ddda6183-e6e1-47d8-a81d-2f9d834320d4'
});

test('TC-T6-MEDIA-006 issues a capability valid for at most 300 seconds', () => {
  const capability = service.issue(MEDIA_ID);
  expect(capability.url).toMatch(/^\/api\/media\/.+\/content\?/);
  expect(capability.expiresAt).toBe('2026-06-21T00:05:00.000Z');
  expect(service.verify(parse(capability.url))).toBe(true);
});

test.each(['path', 'mediaId', 'expires', 'nonce', 'signature'])(
  'TC-T6-MEDIA-007 rejects tampered %s',
  (field) => expect(() => service.verify(tampered(field))).toThrowError(
    expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 })
  )
);
```

Also cover expired capabilities, expiry beyond configured maximum, malformed media ID/nonce/signature, secrets shorter than 32 characters, and access ages outside `1..300`.

- [ ] **Step 2: Run RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaCapability
```

Expected: FAIL because `mediaCapability` does not exist.

- [ ] **Step 3: Implement issue and verify**

Canonical payload:

```text
GET
/api/media/<mediaId>/content
<mediaId>
<expiresUnixSeconds>
<nonce>
```

`issue` returns only `{ url, expiresAt }`. `verify` validates all fields before computing SHA-256 HMAC and compares equal-length hex buffers with `crypto.timingSafeEqual`. Every malformed, expired, overlong, or mismatched capability throws operational `400 VALIDATION_ERROR` without exposing which signed component failed.

- [ ] **Step 4: Run GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaCapability
```

Expected: all capability cases pass.

### Task 2: Redact Signed URLs and Sensitive Query Values

**Files:**
- Create: `backend/common/utils/logRedaction.js`
- Create: `backend/common/utils/__tests__/logRedaction.test.js`
- Modify: `backend/common/middleware/errorHandler.js`
- Modify: `backend/common/middleware/__tests__/errorHandler.test.js`

- [ ] **Step 1: Write failing pure and middleware tests**

```js
test('TC-T6-MEDIA-015 removes the complete query from signed content URLs', () => {
  expect(redactUrlForLogs(
    `/api/media/${MEDIA_ID}/content?expires=1&nonce=secret-nonce&signature=secret-signature`
  )).toBe(`/api/media/${MEDIA_ID}/content`);
});

test('redacts sensitive values while preserving safe query context', () => {
  expect(redactUrlForLogs('/api/example?page=2&token=abc&signature=def'))
    .toBe('/api/example?page=2&token=%5BREDACTED%5D&signature=%5BREDACTED%5D');
});

test('request and error middleware never log a signed media query', () => {
  req.originalUrl = signedContentUrl;
  requestTracker(req, res, next);
  errorHandler(new BadRequestError('invalid'), req, res, next);
  expect(JSON.stringify(req.app.locals.logger)).not.toContain('signature');
});
```

The middleware assertion inspects logger mock calls, including message strings and metadata URLs, before and after `finish`.

- [ ] **Step 2: Run RED**

```bash
npx jest --config backend/jest.family-common.config.js --runInBand logRedaction errorHandler
```

Expected: FAIL because the sanitizer is absent and middleware logs `req.originalUrl` verbatim.

- [ ] **Step 3: Implement and apply redaction**

`redactUrlForLogs` uses `new URL(value, 'http://local')`, returns pathname only for the signed-content path pattern, and replaces case-insensitive `signature|nonce|token|access_token|credential|secret` values with `[REDACTED]`. Malformed URLs fall back to the path before `?`.

Use one `safeUrl` in both request start/finish logs and in operational/system error logs:

```js
const safeUrl = redactUrlForLogs(req.originalUrl);
logger.info(`请求开始: ${req.method} ${safeUrl}`, { url: safeUrl });
```

- [ ] **Step 4: Run GREEN and regression**

```bash
npx jest --config backend/jest.family-common.config.js --runInBand logRedaction errorHandler
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaCapability
npm run test:family-regression
git diff --check
```

Expected: focused tests and all family projects pass.

- [ ] **Step 5: Commit Phase 2B1**

```bash
git add backend/services/resource-service/services/mediaCapability.js \
  backend/services/resource-service/__tests__/mediaCapability.test.js \
  backend/services/resource-service/jest.family.config.js \
  backend/common/utils/logRedaction.js \
  backend/common/utils/__tests__/logRedaction.test.js \
  backend/common/middleware/errorHandler.js \
  backend/common/middleware/__tests__/errorHandler.test.js \
  docs/superpowers/plans/2026-06-21-family-growth-task6-phase2b1-capability-logging.md
git commit -m "feat: add private media capabilities"
```
