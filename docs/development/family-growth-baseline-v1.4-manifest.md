# 家庭成长跟踪基线清单 v1.4

**baselineId:** FGT-MVP-1.4
**status:** APPROVED
**supersedes:** FGT-MVP-1.3
**absorbs:** FGT-MVP-1.3.1
**codeCandidateCommit:** bcaaea2a
**technicalEvidenceCommit:** f624cead
**statusUpdatedAt:** 2026-07-08
**owner:** linmingfeng
**technicalReviewer:** Codex
**productApprover:** linmingfeng
**productApprovedAt:** 2026-07-08 (Asia/Shanghai)
**baselineTag:** `family-growth-baseline-v1.4`

本清单不记录自身哈希。`codeCandidateCommit` 是 Task 6 最终代码候选；`technicalEvidenceCommit` 包含 Task 6 最终门禁证据。产品负责人已批准并创建不可变 Task 6 基线标签。当前分支中已存在的 Task 7 通知增量不属于本基线验收范围，需在后续 Task 7/Task 8 基线中单独关闭。

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `package.json` | `ca399e96972b656c7b08335800439aeede54b9f5818c18f7ec81a4f9bfd45749` | VERIFIED |
| `docker-compose.yml` | `7676f970b479b39db46270c71518e9dc23ba9749343f2a005ffba4e91d955954` | VERIFIED |
| `docker-compose.china.yml` | `2b22d8d19ab2f235d2f23684105fc6ad1dcdfaca1711e1a0c363166e8b5994e4` | VERIFIED |
| `deployment/kubernetes/create-family-growth-secrets.sh` | `d9a3637211b36e430029986b2bf68ceab0206b7ee9228055ec4122f19c73083a` | VERIFIED |
| `deployment/kubernetes/family-growth-external-secret.yaml` | `208f26b2305c848628b48f0255b1d0b9f0998678cc0a86c973384c03d57b5205` | VERIFIED |
| `deployment/kubernetes/kustomization.yaml` | `f6bd64fe76f1bd818c250e1b2dbf6b24890630be46469373d4fcecc12ba3436c` | VERIFIED |
| `deployment/kubernetes/analytics-service-deployment.yaml` | `6b366b8adf634b3a4447bc8ee85bced285be8c739c6d6ef2a563d26c335ffa02` | VERIFIED |
| `deployment/kubernetes/resource-service-deployment.yaml` | `44e64a1ba9b87545fa68620732650e1f6f73f067e3499284a7a13323de2c8d95` | VERIFIED |
| `docs/product/family-learning-tracker.md` | `4a1405f60617a703e69f136636dce8711ee21b83f4fb66ca550b8bc1cc791c10` | IMPLEMENTED |
| `docs/api/family-learning-tracker-api.md` | `769d428d862c348311ffe56a156653612509a77c2137ee518613ed349ec36948` | APPROVED |
| `docs/development/family-growth-test-strategy.md` | `242dde943b555e34afcb150823663fc849c81f2ac70784d15b74dc6a744ca477` | APPROVED |
| `docs/development/family-growth-requirement-traceability.md` | `f504fac750a3159df721bc860f703a6635fdf20a3d696f456a44b9efff97eeb4` | COVERED |
| `docs/development/family-growth-task6-design-review.md` | `3eaf1ead4380d29b02cc663cdb166d7aa6a1035c750d1ac6edfe2bcfb0a1e5f9` | APPROVED |
| `docs/development/family-growth-task6-test-review.md` | `007ea5c7d63aa362ebf01a87bc0dcfa817e4ac896773e4e8be8656a2683aa313` | APPROVED |
| `docs/development/family-growth-task6-test-cases.md` | `fd2c8edc8b8a467425bef7e0231be490510f20ada14e13a02338690e2303ef07` | VERIFIED |
| `docs/development/family-growth-task6-media-traceability.md` | `7f38ebdc41625d432bc0979183f79d35738e604b7705b2723621a46089ef9607` | COVERED |
| `docs/development/family-growth-task6-implementation-review.md` | `9c73031a1d4810866c47a34539211cd489c5ed19b880b35b8d901f305fe20726` | APPROVED |
| `docs/development/family-growth-task6-gate.md` | `da48a9077d6bd6ddd3c7ded944cbf1579ca0930f5b21bfe8aae5bcb7bc22ed2e` | APPROVED |
| `docs/development/family-growth-baseline-v1.3.1-manifest.md` | `7f44ed8458d78754d3745b1b1feaad85a199dd7e4270b484d2d0f4dee5675b21` | SUPERSEDED |
| `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md` | `673b5bf44cb80398228765d75d2725848dbdd7e3e3c009d1ea912f1c342e3e59` | APPROVED |
| `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md` | `caa9322d26383b17e2eea48e45ba8ec451446559945622a0ecaff7d037f4af13` | APPROVED |
| `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3b-child-avatar-design.md` | `c80481a48477efc818d9fca0131437828c8a44dd50f6b367cc215b2bf7788fa7` | APPROVED |
| `docs/superpowers/specs/2026-06-22-family-growth-task6-phase3c-task-attachments-design.md` | `838a6c380bf1b2ca87995dbd761b2417eb3c6a1b42fe9c66a31b35254ac9119c` | APPROVED |
| `backend/common/services/mediaReferenceClient.js` | `e3156d7a679ab006f6ad09aa990a195569df72315c4303bfefcb4c16027b1a75` | VERIFIED |
| `backend/common/repositories/familyReadRepository.js` | `164b35c5e80b2561ec5dc1a7e00a8a65b1dfb3e0c86c728f3e8dad7198167f5f` | VERIFIED |
| `backend/common/deployment/__tests__/task6Deployment.test.js` | `fdced8bf3d4dfb6ddc8c17b507ee5f9934da8d4877226b40574be840c6d6ee99` | VERIFIED |
| `backend/gateway/server.js` | `f77568683e822b950643f955e720d19c06b09d42b14e51fcd7f41a1bb612ad90` | VERIFIED |
| `backend/gateway/__tests__/familyTask6Routes.test.js` | `5fd2631d2a0ff870b7f8c50091379e6eb94c95c270a4680d0790ba4e5d9ba424` | VERIFIED |
| `backend/services/resource-service/app.js` | `187757073bc85fd2fe89a79a0a5c9aa6b97f6ce562cf773e6a45af8968602ad2` | VERIFIED |
| `backend/services/resource-service/server.js` | `4bc13720ffa29ff5c223d6a8720937a102d0ba860c8020bbe5dd61f77c45214d` | VERIFIED |
| `backend/services/resource-service/routes/media.js` | `cf54854bfb021f3410946a06415537c46d77897c897e9bdeb6c6e930b92e3d4e` | VERIFIED |
| `backend/services/resource-service/routes/internalMediaReferences.js` | `cb474ac5cf39fefeb81b15a4ccb7eb6c474220c89909823fc6ab8b5d03540914` | VERIFIED |
| `backend/services/resource-service/models/MediaAsset.js` | `c646bf5fda0495c5d2e15700ab1dbcb54ee1715b44879293fcdccdf8958c2bd9` | VERIFIED |
| `backend/services/resource-service/models/MediaReference.js` | `2e940925efa1461085fd8ef8b9e587b4f3febf5cc7f14cdafc48dea1041424f8` | VERIFIED |
| `backend/services/resource-service/services/mediaService.js` | `bb81ac5aa197683ba3cef0df0d66a27ca7a6a8fe6d551e3126bd67eab6ce762f` | VERIFIED |
| `backend/services/resource-service/services/mediaReferenceService.js` | `69bfd3ac4e428df49e9c07d07f09a531ea5faf8407c3e5da298e93d5bcae3f55` | VERIFIED |
| `backend/services/resource-service/services/privateMediaStore.js` | `ae745eea50963c321f4fcd67dafff4e0c27b7989bfdae97497eaca393baaa6b0` | VERIFIED |
| `backend/services/user-service/services/childAvatarMediaService.js` | `7128607bb770f238246bf0dfe212c2e61b1786c080764e2ee443e9e16b6e0c9d` | VERIFIED |
| `backend/services/homework-service/services/growthTaskAttachmentMediaService.js` | `a6690653160a36946741065968b23c91120a287a4573fe8fa9d3706c8d5dd702` | VERIFIED |
| `backend/services/progress-service/models/KnowledgePointMasteryEvent.js` | `b199793a56c891f3de88d0b27862a1f27ee1b93a198d2ef52f7c8f73f5135b73` | VERIFIED |
| `backend/services/analytics-service/app.js` | `8b77766e1f8fe5e0cc7144825232dccf09860f2b2b569abceff91a6ff830675d` | VERIFIED |
| `backend/services/analytics-service/server.js` | `5e7bba9511d5e10b7b600a3404286b38e97d87c1ee4c513be470111c3d011b41` | VERIFIED |
| `backend/services/analytics-service/models/FamilyMistake.js` | `f85c87c7596cfe50bcc144fcb95e34298817c6f70681a3b28b5df417779c2daf` | VERIFIED |
| `backend/services/analytics-service/models/FamilyMistakeStateEvent.js` | `ff3c826f948b21c734e043c99b4ec043d79905b254a22984aee4e6bcbe2458ae` | VERIFIED |
| `backend/services/analytics-service/models/WeeklyReport.js` | `93c50dc99d79634cc0299f26dc982a5453a53546d3256f0c1276ddd6c607b520` | VERIFIED |
| `backend/services/analytics-service/routes/familyMistakes.js` | `bb43cdda3bb3a5d6d9a10c7318dde2331fd2e59976168f54ace270722a6b5df1` | VERIFIED |
| `backend/services/analytics-service/routes/weeklyReports.js` | `c465edb4666dbe4a09f4f65e2a359e7e6609ab604dc0695ccd122a6308510d14` | VERIFIED |
| `backend/services/analytics-service/services/familyMistakeMediaService.js` | `1ce0d5cecf0eed73bdef6c6150a33fe90a2a2de3b506483ebb203ab3a1032d85` | VERIFIED |
| `backend/services/analytics-service/services/weeklyReportService.js` | `564797e30f80b124fa5072567fe21fd7bdbb8e9c3ad6d8db5b6ff94f59fe4951` | VERIFIED |

## Gate Summary

- Task 6 design review and test review are approved for baseline candidate `FGT-MVP-1.4`.
- Targeted Task 6 commands passed: resource `7/82`, user `7/124`, homework `4/210`, progress `4/38`, analytics `4/39`, common `2/7`, gateway `1/3`.
- `npm run test:family-regression` passed twice on the same final candidate with `51` suites and `645` tests.
- `npm run test:nocoverage` kept the isolated family phase green with `51` suites and `645` tests, then retained only classified legacy failures.
- `git diff --check` passed, and the static skip/only/process-exit scan found no Task 6 test-control violation.
- `FR-MISTAKE-001`, `FR-REPORT-001`, `FR-MEDIA-001`, `FR-MEDIA-002`, `NFR-PRIVACY-001`, `NFR-DATA-001`, `NFR-SEC-001`, and `NFR-TIME-001` are covered in traceability.

## Open Risks

- Root legacy projects retain classified school-era failures; no new Task 6 family failure is present.
- Repository single-node Mongo replica-set manifests remain demo/staging layouts; production requires managed or multi-member topology.
- The current branch also contains Task 7 notification work. This v1.4 baseline does not approve or freeze Task 7; it only records the approved Task 6 scope and final gate.
