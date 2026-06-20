# 家庭成长跟踪修订基线清单 v1.3.1

**baselineId:** FGT-MVP-1.3.1
**status:** GATE_PASSED_PENDING_PRODUCT_APPROVAL
**supersedes:** FGT-MVP-1.3
**candidateCommit:** 0233bf0e15b3d29f77ae5fece8a9573b46a283b4
**statusUpdatedAt:** 2026-06-20
**owner:** linmingfeng
**technicalReviewer:** Codex
**plannedTag:** `family-growth-baseline-v1.3.1`

本清单不记录自身哈希。`candidateCommit` 包含 Task 5 v1.3 修订代码、评审记录和最终技术门禁证据；下表哈希均从该提交生成。现有 `family-growth-baseline-v1.3` 标签保持不变，产品负责人批准前不得创建 v1.3.1 标签。

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `package.json` | `2bcd6af94513b798ecf04bda98551ffeabbaff331409ae980a534bff6858f09a` | VERIFIED |
| `docker-compose.yml` | `6c9c0f518106ad17d43c54af29b96f5cd8085df44ec59efbe2bd0279b8b1c15a` | VERIFIED |
| `docker-compose.china.yml` | `2b22d8d19ab2f235d2f23684105fc6ad1dcdfaca1711e1a0c363166e8b5994e4` | VERIFIED |
| `deployment/kubernetes/kustomization.yaml` | `0c6b689869c664ddf2d3b8209a3a08a606173b42c37333a6f2c81dfc47a26f25` | VERIFIED |
| `deployment/kubernetes/README.md` | `ddc28069283d114498f87b28a1db4dd1696ac953753b55c82b1f395bdc4b679d` | VERIFIED |
| `deployment/kubernetes/create-family-growth-secrets.sh` | `61eb8e4e41adeb5474c8d701348271b48967f8d47dd416d05d5369d0d96daa8d` | VERIFIED |
| `deployment/kubernetes/gateway-deployment.yaml` | `4474e8a4c584b9be0991dc3cae5cf6a166c89443e93786b6f8b404a7a5380f6b` | VERIFIED |
| `deployment/kubernetes/user-service-deployment.yaml` | `9328ef38b823ca87ee073a41d959a8e9378128148eded693ad254f87bce07557` | VERIFIED |
| `deployment/kubernetes/progress-service-deployment.yaml` | `adf81104168d81d8469005e71d59a262ede5b8e2a305e0f5876cde464a316ab4` | VERIFIED |
| `deployment/kubernetes/homework-service-deployment.yaml` | `e7fc23ad25d0dac1fdea21e8f1678c08d32d3abd572e676a00347edbac8b6cf1` | VERIFIED |
| `deployment/kubernetes/interaction-service-deployment.yaml` | `fdcff13561df820276f6e8462488247894f5c2ce49157c51debd2cf99551915f` | VERIFIED |
| `deployment/kubernetes/resource-service-deployment.yaml` | `3b251a287d28f6114ed1822ae16b6fd89c380109b319bbfd2e5bd1242fcb21a5` | VERIFIED |
| `deployment/kubernetes/data-service-deployment.yaml` | `35bdb4d7a242dac50ad7a66dacd8a8040ebdb9c1b99cd4b2cb1b2377ec00b3bc` | VERIFIED |
| `backend/services/progress-service/server.js` | `4a8b94b179d88733d628dcc1ee3ae641d96e0a113a7b6e22d10d63ad4f08b803` | VERIFIED |
| `backend/services/progress-service/routes/rewards.js` | `6964480cc80324d93f274e4933b5ab9995625cdf748e38edd146411077466d33` | VERIFIED |
| `backend/common/deployment/__tests__/task5Deployment.test.js` | `7d0f6beeb8508a077bdd640d47af07f9de9bf21204ae67785d01287152ab9e08` | VERIFIED |
| `backend/common/contracts/__tests__/apiExamples.test.js` | `f536650f7de7b8dee5cd3c093eb81aed3c55921cf19fd229a02c90abb8228d76` | VERIFIED |
| `backend/services/progress-service/__tests__/startup.test.js` | `d7c489a97102df7927ea8dafb042b8f24140b2689d5389e9e5d604485d9aa78e` | VERIFIED |
| `backend/services/progress-service/__tests__/rewards.test.js` | `98ad4fc2fb284f655fba5efdf08de2e27156b19f326d5d77d323f40b251af280` | VERIFIED |
| `docs/superpowers/specs/2026-06-19-family-growth-task5-design.md` | `3e777c010547304f60e8e99ad6ec804e4a75c6fad9cc568c8aae3b61a312ed82` | APPROVED |
| `docs/api/family-learning-tracker-api.md` | `cd37cc8d1eb9ac29174819c981c8ac7e60510c4b24a062023a96cb7da019c4e8` | APPROVED |
| `docs/development/family-growth-test-strategy.md` | `242dde943b555e34afcb150823663fc849c81f2ac70784d15b74dc6a744ca477` | APPROVED |
| `docs/development/family-growth-task5-test-cases.md` | `1cb63c533cbd487be895f9a73b511f443e8970fa754af43788d44a36146ef8d4` | VERIFIED |
| `docs/development/family-growth-requirement-traceability.md` | `c8a516f660917cfe5e55c0fdb36dd98ab66c6c8a6922981382797779e3ec650f` | COVERED |
| `docs/development/family-growth-task5-v1.3-remediation-review.md` | `c1fbff7a9bc4bf16f4175e891cfb6e165e2f1c44b4c02361673c08a32c1c9345` | APPROVED |
| `docs/development/family-growth-task5-v1.3-remediation-gate.md` | `f1d07a435f1083aae46bb7e36a1762bf904260109c9f4bee9d9ba5b1058a7437` | PASSED |

## Gate Summary

- All eight remediation findings are closed.
- Six targeted commands passed with 33 suites and 283 reported test executions across overlapping scopes.
- Two isolated family runs each passed 28 suites and 237 tests with normal process exit.
- The exact root command preserved 210 classified failed suites and 1096 classified failed tests; its family phase passed 28 suites and 237 tests.
- Compose, credential-free external Secret dry-run, Kubernetes rendering, 52-case catalog, generated-file cleanup, process cleanup, and `git diff --check` passed.

## Open Risks

- Root legacy projects retain classified school-era failures; no new family failure is present.
- Repository single-node Mongo replica-set manifests are non-HA demo/staging layouts; production requires managed or multi-member topology.
- The corrected immutable v1.3.1 tag and final `APPROVED` status require explicit product-owner approval.
