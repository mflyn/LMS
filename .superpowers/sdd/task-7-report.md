# Task 7 Report: Parent and Child Mistake Workflows

## Scope

Implemented parent and child image/PDF attachment collections for mistake
questions and answers, retained legacy scalar compatibility, and exposed task
attachments to children through read-only child-authorized access.

## Implementation

- Parent mistake create/edit sends canonical ordered arrays only and lazily
  normalizes legacy scalar records when the editor opens.
- Parent list rows show question and answer attachment counts without requesting
  signed access URLs.
- Child create forms and review rows own independent draft lifecycles and use
  child-session media APIs without accepting or sending `childId`.
- Review payloads include only attachment groups changed by the child.
- Failed owner mutations retain form and draft state; successful mutations
  commit drafts; cancel/unmount removes unbound drafts.
- Owner save/close/cancel controls are disabled while uploads are in flight.
- Child task pages expose returned task images and PDFs as read-only authorized
  media; task completion still cannot upload attachments.
- Shared CSS constrains native file inputs and long names at 360 px and keeps
  child media controls at a 44 px minimum target height.

## Verification

```sh
npm run test:ci --prefix frontend/web -- --runInBand
npm run build --prefix frontend/web
```

Passed: 27 suites, 174 tests; optimized production build compiled successfully.

Browser QA at desktop and 360 px confirmed no horizontal overflow, long-name
wrapping, explicit PDF download links, 44 px child controls, and no console
errors. The temporary QA route was removed before the final gate.
