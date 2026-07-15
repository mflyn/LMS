# Task 6 Report: Shared Web Media Collections and Child API

## Scope

Implemented shared private-media rules, image/PDF collection behavior, injected
draft cleanup, and child-authenticated media and canonical mistake API methods.

## Implementation

- Shared rules own accepted MIME types, the 10 MiB limit, and purpose-specific
  collection limits: 10 per mistake group and 100 per task.
- Sequential batch upload preserves prior successes, identifies the failed
  filename, and stops later uploads until a new selection.
- Images use explicit authorized previews. PDFs show sanitized descriptor data,
  size and page count, and expose an explicit authorized download without an
  iframe or persisted signed URL.
- The single-media field remains image-only and reuses the shared validation.
- `useDraftMedia` accepts a parent or child delete function and retains drafts
  until cancel/unmount or a successful owner commit.
- Child media calls derive identity from the child bearer session, never send a
  `childId`, and mistake mutations allow only canonical attachment arrays.

## Verification

```sh
npm run test:ci --prefix frontend/web -- --runInBand \
  PrivateMediaCollectionField useDraftMedia childApi Task9TodayTasks
```

Passed: 4 suites, 36 tests.
