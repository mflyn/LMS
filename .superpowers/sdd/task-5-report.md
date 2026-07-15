# Task 5 Report: Multi-Reference Mistake Saga

## Scope

Extended the recoverable mistake media saga to ordered collections and made
owner publication plus state-event persistence one local MongoDB transaction.

## Implementation

- Binding identity remains `(field, mediaId)` and commands may repeat a logical
  singular field for multiple media IDs.
- The pending owner stores desired order, prior binding generations, the full
  non-media patch, actor audit data, and state-event intent.
- Additions are prepared and committed before local publication. Removals are
  unbound only after the local owner/event transaction commits.
- Reorder-only updates make no prepare/commit calls. Stable prepare rejection
  restores the previous owner state; retryable failures remain resumable.
- State events are idempotent by operation ID. Transaction failure publishes
  neither owner changes nor an event, and recovery emits exactly one event.
- A dedicated `analytics-attachments` Jest project is part of the root family
  regression without adding a scanner or extra database lifecycle to the
  lightweight analytics startup project.

## Verification

```sh
npx jest --config=backend/services/analytics-service/jest.attachments.config.js \
  --runInBand
```

Passed: 2 suites, 27 tests.

```sh
npx jest --config=backend/services/analytics-service/jest.config.js \
  --runInBand backend/services/analytics-service/__tests__/weeklyReports.test.js
```

Passed: 1 suite, 18 tests.

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js \
  --runInBand --testPathPattern=mediaReferences
```

Passed: 1 suite, 19 tests. No real ClamAV daemon was started.
