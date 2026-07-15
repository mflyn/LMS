# Task 4 Report: Canonical Mistake Attachment Arrays

## Scope

Implemented ordered `questionMediaIds` and `childAnswerMediaIds` collections,
legacy singular request aliases and response projections, strict per-group
validation, and parent/child attachment permissions within the existing family
scope.

## Implementation

- Canonical arrays preserve first occurrence order, deduplicate case-insensitive
  media IDs, and allow at most 10 unique IDs per group.
- Requests cannot mix an array with its singular alias. Over-limit requests use
  the stable `MEDIA_ATTACHMENT_LIMIT_EXCEEDED` code.
- New writes synchronize the legacy singular projection to the first item;
  legacy-only documents are normalized lazily in public responses.
- Parents and children can manage both question and answer attachments after
  existing family and self-child authorization succeeds.
- Public output exposes only canonical arrays and compatibility projections;
  internal media state remains hidden.

## Verification

```sh
npx jest --config=backend/services/analytics-service/jest.attachments.config.js \
  --runInBand
```

Passed: 2 suites, 27 tests, including parser, model, legacy response, route,
family isolation, and multi-attachment cases.
