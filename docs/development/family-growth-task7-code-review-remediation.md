# Family Growth Task 7 Code Review Remediation

**Status:** implemented in follow-up branch after the Task 7 v1.5 baseline.

## Scope

This record closes the code-review items found after Task 7 was merged:

- shared family access authorization duplication;
- missing MongoDB connectivity error normalization;
- missing route-level request timeout middleware;
- missing bounded timeout on notification source queries;
- unclear star-award retry and backoff policy;
- inconsistent FamilyMistake state-event compensation order;
- single-database migration planning gap;
- JavaScript-only backend type-safety gap.

## Implemented Changes

### Shared Family Access

`backend/common/utils/familyAccess.js` is the shared parent/child/family authorization helper for family-growth routes.

The analytics mistake route, weekly-report route and notification route must use this helper instead of defining route-local `resolveChildAccess` variants. The helper verifies:

- parent ownership through `ownerParentId` or `memberParentIds`;
- child membership in the resolved family;
- student identity, optional `childId`, and `familyId` consistency.

### Error Contract and Timeout Policy

`backend/common/middleware/errorHandler.js` now normalizes MongoDB connectivity failures to:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "数据库暂时不可用",
    "details": []
  }
}
```

The shared `requestTimeout` middleware defaults to `REQUEST_TIMEOUT_MS=15000` and returns `408 REQUEST_TIMEOUT` if the request remains open past the configured limit. Family-growth services mount it after request tracking.

### Notification Source Query Boundaries

`familyNotificationSourceRepository` applies `maxTimeMS` to every MongoDB source query. The default is `NOTIFICATION_SOURCE_MAX_TIME_MS=3000`.

`deriveFamilyReminders` already catches per-source failures and returns partial reminders with `meta.partial=true` and stable source names only. Query timeout now feeds that existing partial-degradation path instead of risking an unbounded read.

### Star Award Retry Policy

`homework-service` calls `progress-service` with:

- `STAR_AWARD_TIMEOUT_MS`, default `3000`;
- `STAR_AWARD_RETRY_ATTEMPTS`, default `1`;
- `STAR_AWARD_RETRY_BACKOFF_MS`, default `100`;
- `STAR_AWARD_MAX_RETRY_BACKOFF_MS`, default `1000`.

Only transient transport failures and 5xx upstream responses are retried. Malformed success responses and 4xx upstream responses are not retried. Exhausted attempts are still surfaced to callers as `503 STAR_AWARD_PENDING`, preserving the Task 5 API contract.

### FamilyMistake State Event Ordering

PATCH mutations now persist the source mistake first, then write the state event. If the state-event write fails, the route rolls back the source patch and returns `503 STATE_EVENT_UNAVAILABLE`.

This keeps the visible source state and the required state-event trail aligned for state-changing mistake updates.

## Database Boundary Migration Plan

Task 1-7 intentionally share one MongoDB replica set. The migration is not a small refactor, so it is tracked as a staged platform task:

1. **Boundary inventory:** list every cross-service model import and collection read/write owner.
2. **Read API extraction:** replace direct cross-service reads with repository adapters or internal read APIs.
3. **Per-service connection config:** introduce separate logical database names while keeping the same replica set.
4. **Data ownership split:** migrate write-owned collections to service-owned databases.
5. **Gateway and regression gate:** keep the family regression running against both shared-db and split-db configurations before freezing the split baseline.

No Task 8-11 frontend work should depend on direct cross-service database access.

## Backend Type Safety Plan

The backend remains CommonJS JavaScript for Task 1-7. TypeScript migration is deferred, but new family-growth backend changes should add one of:

- Mongoose schema validation for persisted state;
- request parser/DTO functions with tests;
- JSDoc typedefs for non-trivial view or service contracts.

Task 8+ frontend work may use TypeScript if the frontend baseline adopts it. A backend TypeScript conversion should be planned separately after service boundaries are stable.

## Verification

The remediation is covered by focused tests for:

- common error middleware and request timeout;
- shared family access helper;
- notification source repository `maxTimeMS`;
- star-award retry/backoff behavior;
- FamilyMistake state-event ordering and rollback behavior.
