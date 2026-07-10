# Task 8 Parent Web Shell Gate Record

**Status:** READY FOR PR REVIEW
**Date:** 2026-07-10
**Scope:** `FR-UI-001` parent Web shell only. Task 9 business pages, Task 10 child entry, and Task 11 E2E remain out of scope.
**Design:** `docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md`
**Test cases:** `docs/development/family-growth-task8-test-cases.md`

## Delivered Boundary

- Parent session storage uses `family-growth.parent-session.v1`; child storage remains a distinct reserved key.
- `/app/*` is parent protected, `/family/setup` handles only a documented missing-family response, and `/app` redirects to `/app/today`.
- The common parent shell provides a labelled child selector, family navigation, retry state, and mobile navigation trigger.
- Legacy school paths redirect into the protected family entry and do not import school pages into the Task 8 application composition.
- Legacy school tests are isolated under `frontend/web/src/__tests__/legacy/`; the default CI path runs only current family-growth tests.

## Automated Evidence

| Command | Result |
| --- | --- |
| `cd frontend/web && npm ci && npm run test:ci` | PASS: 7 suites, 22 tests. |
| `cd frontend/web && npm run build` | PASS: optimized production build completed. |
| `npm run test:family-regression` | PASS: 52 suites, 652 tests across 6 family projects. |
| `git diff --check` | PASS: no whitespace errors. |

The CI `test` job now runs the same clean frontend install and `npm run test:ci` command after the family backend regression.

## Browser Evidence

The local Web application was inspected in the in-app browser at `/login` on a desktop viewport and at `360x800`. A local stub provided only demo parent/family responses for this UI check:

- The parent login heading, labelled username/password inputs, submit button, and register link render correctly.
- At 360px, form controls remain inside the viewport without horizontal overflow or clipped text.
- With the demo parent session, `/app/today` shows the parent shell, the 360px navigation trigger expands all seven routes, and changing the labelled child selector updates the current child from 小明 to 小红.

## Review Notes and Residual Risk

- `npm audit` reports inherited CRA dependency issues: frontend reports 61 vulnerabilities and the root install reports 30. This Task 8 change does not add a runtime dependency; the work needs a separate CRA/dependency modernization task, not an unreviewed `npm audit fix --force` inside the UI-shell delivery.
- CRA reports that the checked-in Browserslist data is stale. This does not change the successful build but should be refreshed with the future dependency-maintenance task.
- Full authenticated browser E2E remains Task 11. Task 8's mocked contract integration tests prove the accepted route, state, and access boundaries.

## Exit Criteria

This gate may be marked passed only after the final diff check, implementation review, PR CI, and merge to `main` all succeed.
