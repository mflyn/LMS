# 家庭成长跟踪基线清单 v1.5

**baselineId:** FGT-MVP-1.5
**status:** APPROVED
**supersedes:** FGT-MVP-1.4
**scope:** Task 7 lightweight family notifications
**codeCandidateCommit:** 41c8b541
**technicalEvidenceCommit:** 41c8b541
**statusUpdatedAt:** 2026-07-09
**owner:** linmingfeng
**technicalReviewer:** Codex
**productApprover:** linmingfeng
**productApprovedAt:** 2026-07-09 (Asia/Shanghai)
**baselineTag:** `family-growth-baseline-v1.5`

本清单不记录自身哈希。`codeCandidateCommit` 是已合并到 `main` 的 Task 7 代码候选；`technicalEvidenceCommit` 是包含 Task 7 gate、测试设计、需求追踪和已合并实现的主干候选提交。Task 7 只关闭轻量家庭提醒能力，不扩展推送通知、邮件、短信、后台调度、月报、AI 推荐或前端 UI。

## Scope Closure

| Requirement | Status | Evidence |
| --- | --- | --- |
| `FR-NOTIFY-001` | CLOSED | `GET /api/notifications/family` returns read-time derived reminders for accessible children; covered by `TC-T7-NOTIFY-001` through `TC-T7-NOTIFY-012` and gateway case `TC-T7-GW-001`. |
| `FR-NOTIFY-002` | CLOSED | `GET/PATCH /api/notifications/settings` manages per-family reminder settings; covered by `TC-T7-SETTINGS-001` through `TC-T7-SETTINGS-004`. |
| `NFR-SEC-001` | CLOSED | Parent, child, sibling, cross-family and anonymous access are covered by `TC-T7-SETTINGS-004`, `TC-T7-NOTIFY-010` and gateway identity tests. |
| `NFR-DATA-001` | CLOSED | Settings are family-owned and reminder source reads are bounded by family/child predicates in source repositories and tests. |
| `NFR-TIME-001` | CLOSED | Optional date derivation and weekly report weekday use family timezone; covered by `TC-T7-NOTIFY-006` and `TC-T7-NOTIFY-009`. |

## Verified Artifacts

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `docs/product/family-learning-tracker.md` | `4a1405f60617a703e69f136636dce8711ee21b83f4fb66ca550b8bc1cc791c10` | IMPLEMENTED |
| `docs/api/family-learning-tracker-api.md` | `769d428d862c348311ffe56a156653612509a77c2137ee518613ed349ec36948` | APPROVED |
| `docs/development/family-growth-requirement-traceability.md` | `f504fac750a3159df721bc860f703a6635fdf20a3d696f456a44b9efff97eeb4` | COVERED |
| `docs/development/family-growth-task7-test-cases.md` | `3f7673a18bae33fd2a079b3be7926ddbaf19b0da84c04a06a35a43bcfc25e908` | VERIFIED |
| `docs/development/family-growth-task7-gate.md` | `051437665ad22d2c248ac132627ea4d562b930d9c7a0a768b48ee7b4f051257b` | PASSED |
| `docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md` | `ed2335d473f8b331051b4819cb2a049e1890fbe6323da563ba4bb377024a5120` | APPROVED |
| `backend/gateway/server.js` | `f77568683e822b950643f955e720d19c06b09d42b14e51fcd7f41a1bb612ad90` | VERIFIED |
| `backend/gateway/__tests__/familyTask7Routes.test.js` | `bb8ad82b17190ca28556de707ffb40ead5a34615441819a725a286b4491844a0` | VERIFIED |
| `backend/services/notification-service/app.js` | `2418ba0dd739b1d4857663d4701dfef0611fb19b6bbc1ab852884635cf425187` | VERIFIED |
| `backend/services/notification-service/server.js` | `d316bfa0b10cc8f6eae2c61fa360de2f1356440867b935dd1f80a7289c810939` | VERIFIED |
| `backend/services/notification-service/models/ReminderSettings.js` | `478e140ae818e5ef2ece601e816226404bc3df9bdd83c868b53590323644bef0` | VERIFIED |
| `backend/services/notification-service/routes/familyNotifications.js` | `312ab64a4a996dc69a8ee924eec05326a76329b0e12b697f390120068e7080ec` | VERIFIED |
| `backend/services/notification-service/services/familyReminderService.js` | `17e5016946a4ba2672908cbddb25c687b2979de960d4f55057b11875e472db91` | VERIFIED |
| `backend/services/notification-service/services/familyNotificationSourceRepository.js` | `ead813e21347790ddf2d7b8aa9d2ca7b4c7b17b61b8a9a37b64f5285452a2d41` | VERIFIED |
| `backend/services/notification-service/__tests__/familyNotifications.test.js` | `b50cf69648aaaab01611fef7a54179d63fdfe3699156724a37c193090fb60557` | VERIFIED |

## Gate Summary

- Task 7 notification detailed design and numbered test cases are approved for implementation.
- Focused notification tests passed with `12` tests.
- Focused gateway tests passed with `2` tests.
- `npm run test:family-regression` passed on the Task 7 gate candidate with `47` suites and `629` tests.
- `FR-NOTIFY-001` and `FR-NOTIFY-002` are marked `COVERED` in the requirement traceability matrix.
- The v1.4 open note that Task 7 was present but not frozen is closed by this v1.5 baseline.

## Open Risks

- Task 7 reminders are derived on read only; push notification, email, SMS, background scheduling and frontend UI remain out of scope for this baseline.
- Reminder sources degrade independently. Source outages return partial reminder results instead of blocking all reminders.
- Root legacy projects retain previously classified school-era failures outside the family regression gate.
