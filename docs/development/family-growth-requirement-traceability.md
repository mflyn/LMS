# 家庭成长跟踪需求追踪矩阵

**Document status:** FGT-MVP-1.7 IMPLEMENTED / RELEASE GATE
**Implementation conformance:** COVERED (38/38)
**Baseline candidate:** FGT-MVP-1.7
**Implementation evidence commit:** `a5ebae9b`
**Revalidated at:** 2026-07-16

长期主目标已确认为家庭自主学习（2026-10-22）。上方版本、日期和 38/38 仅为已实现 FGT 基础证据；
下方 SL 增量仍 PLANNED，不用历史覆盖率代表增量实现或家庭价值验收。R1–R8 的核实、修订和独立复评
状态见[增量 Gate §13](./family-self-directed-learning-mvp-gate.md#13-r1r8-核实处置方案与开发自审2026-10-22)。

Conformance values are `COVERED`, `DESIGN_APPROVED`, `PARTIAL`, and `GAP`. `plannedTask` and
`gateAtTask` retain the historical delivery phase; conformance describes the current
Task 1~12 scope. Every row below was reconciled against PRD 10.4, the current
design asset index, merged code, focused tests, and the unified release gate.

> [家庭 AI 学习平台设计](../architecture/family-ai-learning-platform-design.md)中的
> DeepTutor、K12-KGraph 和教学闭环是后续拟议范围，尚未分配 Requirement，
> 不包含在本矩阵的 38/38 `COVERED` 结论中。进入实现时必须新增需求与证据行，不能复用
> 当前完成率表示 AI 能力已经交付。

## Current full-gate evidence

- Implementation behavior was established on clean `main` commit
  `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`; the current clean candidate is
  revalidated with `npm run release:family`, and its exact commit is recorded in
  `release-gate-artifacts/release-gate-summary.txt`.
- Current candidate result: 70 backend suites / 756 tests, 4 Task 11 integration suites / 6 tests,
  25 frontend suites / 156 tests, production build, 4 Chromium tests, seven service
  images, eight healthy runtime services, and a private-media gateway smoke flow.
- Detailed evidence and residual boundaries are recorded in
  [the v1.6 release gate](./family-growth-v1.6-release-gate.md). Row-level evidence
  below identifies the focused contract that supplements this common full-gate run.

## PDF and multi-attachment increment evidence

- The increment extends the existing requirements without adding a new PRD ID. Canonical mistake
  arrays, task PDF attachments, parent/child workflows, PDF processing, explicit media security
  profiles, deployment assets and protected real-scanner command are implemented through commit
  `e331c2810ba7fc3077748623d2148585177d791a`.
- The trusted-local release gate passes with 78 backend suites / 867 tests, 27 frontend suites / 174
  tests, 4 Task 11 integration suites / 6 tests, production build, 4 Chromium tests, seven service
  images, eight healthy runtime services and the gateway media smoke flow. The real ClamAV command
  is intentionally not executed on the 8 GiB development host.
- Exact evidence and the `secure-production` approval boundary are recorded in
  [the increment Gate](./family-growth-mistake-pdf-multi-attachments-gate.md).

## Task 12 implementation evidence

- `FR-FAM-004`, `FR-FAM-005`, and `NFR-DATA-003` are implemented by the user service,
  Gateway, live-membership authorization in downstream services, and the parent Web application.
- Replica-set route and real-service tests cover invitation lifecycle, two-parent concurrency,
  governance transactions, compatibility projections, stale-token revocation, and repair behavior.
- React and Chromium tests cover fragment-preserving authentication, one-time token display,
  two stable parent slots, ownership transfer/removal, 360px layout, and browser history cleanup.
- The unified local release command completed with `status=0` at commit `a5ebae9b`, including
  Compose image builds, healthy-service checks, the private-media smoke flow, and clean-tree check.
- Repeatable commands and deployment-only repair preconditions are recorded in the
  [Task 12 Gate](./family-growth-task12-gate.md).

| Requirement | plannedTask | gateAtTask | Product section | Architecture/ADR | API | Code owner | Test evidence | Conformance | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FR-FAM-001` | 3 | 4 | 10.4 | 4.1, ADR-0002/0003 | `POST /api/families` | `Family.js`, `familyController.js` | timezone/default/unique-owner and transaction rollback tests pass | COVERED | closed `FGT-T3-001`, `FGT-T3-007`; Stage 2 atomicity remediation closed |
| `FR-FAM-002` | 3 | 4 | 10.4 | 5, 6, ADR-0002 | family read/update | `familyController.js` | ownership database tests pass | COVERED | none |
| `FR-FAM-003` | 3 | 4 | 10.4 | 3.3, ADR-0006 | auth register/login/logout | `authController.js`, `auth.js` | stable family errors, signed gateway auth, and authenticated idempotent logout contract pass | COVERED | closed `FGT-T3-006`; logout contract remediation closed |
| `FR-FAM-004` | 12 | 12 | 5.1/10.4 | 4.1/6/8.1, ADR-0008, Task 12 design | parent invitation create/read/accept | user-service, gateway, parent Web | invitation/accept/access/auth/projection/API React contracts and real-service Chromium flow pass | COVERED | opaque single-use invitation, equal daily access, safe projections, and fragment return implemented |
| `FR-FAM-005` | 12 | 12 | 5.1/10.4 | 4.1/6/7/8.1, ADR-0008, Task 12 design | invitation revoke, leave, remove, transfer | user-service, gateway, parent Web | governance transaction tests plus transfer/removal React and Chromium flows pass | COVERED | owner-only governance, history retention, and immediate live-membership revocation implemented |
| `FR-CHILD-001` | 3 | 4 | 10.4 | 4.2, 6 | children create/update | `User.js`, `familyController.js` | multiple children, cross-family edit, transaction rollback, full-profile and avatar UI tests pass | COVERED | Stage 2 atomicity and Stage 4 parent workflow remediations closed |
| `FR-CHILD-002` | 3 | 4 | 10.4 | 6.1/6.3 | children list/detail | `familyController.js` | self/sibling and cross-family tests pass | COVERED | none |
| `FR-CHILD-003` | 3 | 4 | 10.4 | 4.2, 6.1 | child PIN set | `User.js`, `familyController.js` | 4-6 digit bounds and reset tests pass | COVERED | closed `FGT-T3-002` |
| `FR-CHILD-004` | 3 | 4 | 10.4 | 3.3, 6.1 | child PIN login | `familyController.js`, `auth.js` | claims/12h/generic error/rate-limit tests pass | COVERED | closed `FGT-T3-004`-`FGT-T3-006`, `FGT-FR-002` |
| `FR-CHILD-005` | 3 | 4 | 10.4 | 4.2 | PIN reset/token | `User.js`, `familyController.js`, `auth.js` | stale-token rejection test passes | COVERED | closed `FGT-T3-003` |
| `FR-TASK-001` | 4 | 4 | 10.4 | 4.3, ADR-0002 | task create | `GrowthTask.js`, `growthTasks.js` | five dimensions and cross-family create pass | COVERED | none |
| `FR-TASK-002` | 4 | 4 | 10.4 | 4.3, ADR-0003 | task create/edit | `GrowthTask.js`, `growthTasks.js` | LocalDate and family-timezone boundary tests pass | COVERED | closed `FGT-T4-001` |
| `FR-TASK-003` | 4 | 4 | 10.4 | 3.2, 4.3 | task list/detail | `growthTasks.js` | status/filter/pagination/cross-family tests pass | COVERED | closed `FGT-T4-001`, `FGT-T4-003`, `FGT-T4-005`, `FGT-T4-006` |
| `FR-TASK-004` | 4 | 4 | 10.4 | GrowthTask state machine | task complete | `growthTasks.js` | own-child and cross-family completion tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-005` | 4 | 4 | 10.4 | GrowthTask state machine | task confirm | `growthTasks.js` | role and cross-family confirmation tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-006` | 4 | 4 | 10.4 | GrowthTask state machine, ADR-0004/0007 | task edit/delete | `GrowthTask.js`, `growthTasks.js` | repeat rejection, soft-cancel/archive, and `confirmed + pending` archive-guard tests pass | COVERED | pending award cannot be stranded; historical report semantics retained |
| `FR-LOG-001` | 5 | 5 | 10.4 | 4.4, Task 5 design 4.1/5 | growth logs | `GrowthLog.js`, `growthLogs.js`, `growthAccess.js` | `TC-T5-LOG-001`-`010` pass | COVERED | closed Task 5 implementation review |
| `FR-POINT-001` | 5 | 5 | 10.4 | 4.5, Task 5 design 4.2/5 | knowledge points | `KnowledgePoint.js`, `knowledgePoints.js`, `growthAccess.js`, `KnowledgePointsPage.js` | `TC-T5-POINT-001`-`008`, `TC-T5-CONTRACT-001`, parent create/filter/update UI tests pass | COVERED | Task 5 backend and Stage 4 parent workflow remediations closed |
| `FR-MISTAKE-001` | 6 | 6 | 10.4 | 4.6, Task 6 design 6/6.1, Task 10 design 3.5, multi-attachment design | mistakes | `FamilyMistake.js`, `FamilyMistakeStateEvent.js`, `familyMistakes.js`, `familyMistakeMediaService.js`, parent/child mistake pages | Historical Task 6/10 cases plus `TC-MPA-API-*`, parent/child collection tests and Task 11 browser flow pass | COVERED | ordered 10-item question/answer image/PDF collections and legacy scalar compatibility implemented |
| `FR-REPORT-001` | 6 | 6 | 10.4 | 4.7, ADR-0001/0007, Task 6 design 7/8 | weekly reports | `WeeklyReport.js`, `weeklyReportService.js`, `weeklyReports.js`, `familyReadRepository.js`, `knowledgePointHistory` | `TC-T6-REPO-001`-`007`, `TC-T6-REPORT-001`-`018` pass; Task 6 gate pass | COVERED | closed Task 6 implementation review and final gate |
| `FR-MEDIA-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/5, PDF security design | media upload/access and business references | `resource-service`, media reference clients, owner services, gateway | Historical media cases plus `TC-MPA-MEDIA-*`, `TC-MPA-SCAN-*`, deployment tests and Task 11 PDF flow pass | COVERED | canonical PDF support and explicit trusted-local/secure-production policies implemented; real scanner release approval remains environment-specific |
| `FR-MEDIA-002` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4.4, multi-attachment design | media delete | `resource-service`, FamilyMistake/Child/GrowthTask media services | Historical removal cases plus collection draft cleanup, reference release and Task 11 removal pass | COVERED | multi-reference removal preserves owner/reference ordering and draft cleanup |
| `FR-REWARD-001` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 6/7 | task confirm/stars | `GrowthTask.js`, `growthTasks.js`, `starAwardClient.js`, `StarLedgerEntry.js`, `internalStars.js` | `TC-T5-STAR-003`-`005`, `TC-T5-SAGA-001`-`008` pass | COVERED | closed Task 5 implementation review; final CAS branches covered |
| `FR-REWARD-002` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 8 | rewards | `Reward.js`, `StarLedgerGuard.js`, `rewards.js`, `starLedgerService.js` | `TC-T5-REWARD-001`-`012` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `FR-NOTIFY-001` | 7 | 7 | 10.4 | 3.1, ADR-0001, Task 7 design | notifications | `notification-service`, `familyReadRepository.js`, `gateway/server.js` | `TC-T7-NOTIFY-001`-`013`, shared cutoff boundary, `TC-T7-GW-001`, and Task 7 gate pass | COVERED | closed Task 7 implementation gate; shared read adapter remediation closed |
| `FR-NOTIFY-002` | 7 | 7 | 9.10/10.4 | 4.8, Task 7 design | notification settings | `ReminderSettings.js`, `familyNotifications.js` | `TC-T7-SETTINGS-001`-`004`, timezone/dedup/settings tests, Task 7 gate pass | COVERED | closed Task 7 implementation gate |
| `FR-UI-001` | 8 | 9 | 10.3/10.4 | 8.1/8.3, Task 8-11, Task 9 and multi-attachment designs | parent Web routes | `frontend/web` family shell and parent workflows | Historical Task 8/9 cases plus parent collection unit tests, full frontend regression and desktop/360px browser checks pass | COVERED | parent task/mistake image/PDF collections implemented |
| `FR-UI-002` | 10 | 10 | 10.3/10.4 | 8.2/8.3, Task 10 and multi-attachment designs | child Web routes | child auth/API/pages and shared media collection | Historical Task 10 cases plus child create/review attachment tests and desktop/360px Chromium checks pass | COVERED | child can manage own mistake image/PDF collections and read task attachments |
| `FR-FLOW-001` | 11 | 11 | 10.3/10.4 | 2/8, Task 11 and multi-attachment designs | full public API through gateway | `backend/tests/task11`, `tests/e2e/task11`, parent/child Web, Compose smoke | 4 integration suites / 6 tests and 4 Chromium tests include PDF upload/download, reorder/removal and sibling/cross-family denial | COVERED | default real-service path is covered in trusted-local; protected real-ClamAV Gate is separate |
| `NFR-SEC-001` | 3 | 4 | 10.4 | 5/6, ADR-0002 | all family APIs | family controllers/routes, gateway, repository adapters | every Task 3/4 cross-family operation plus Task 5/6 internal-route, repository-scope, sibling, gateway, and signed-content checks pass | COVERED | closed `FGT-T4-006`; Task 6 security scope closed by final gate |
| `NFR-SEC-002` | 4 | 4 | 10.4 | 3.3, ADR-0006 | gateway envelope | `gateway/server.js`, `common/middleware/auth.js`, Compose | forged/tampered/expired/replayed/valid/secret tests and `TC-T5-DEPLOY-001` pass | COVERED | closed `FGT-GW-001`-`FGT-GW-004`, `FGT-FR-001`, `FGT-FR-003`, v1.3 remediation |
| `NFR-SEC-003` | 5 | 5 | 10.4 | Task 5 design section 6 | internal star award | `serviceCredential.js`, `internalStars.js`, `starAwardClient.js`, gateway allowlist, external Secret workflow | `TC-T5-STAR-001/002/006`, `TC-T5-GW-002`, `TC-T5-DEPLOY-002` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-DATA-001` | 3 | 4 | 10.4 | 4/5, ADR-0002 | all child data APIs | Family/User/GrowthTask, Task 6 media state, mistake/mastery events, weekly snapshots | family-first IDs/indexes, family-child and mistake-history transactions, media generations, scoped projections, and frozen weekly snapshots verified | COVERED | Stage 2 cross-document atomicity closed; repair command is auditable and tested |
| `NFR-DATA-002` | 5 | 5 | 10.4 | Task 5 design sections 7/8, ADR-0005 | task award and reward redemption | immutable ledger, guard transaction, recoverable confirmation saga, topology startup guard | `TC-T5-STAR-003`-`005`, `TC-T5-REWARD-005`-`012`, `TC-T5-SAGA-001`-`005`, `TC-T5-DEPLOY-003` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-DATA-003` | 12 | 12 | 10.4 | 4.1/5/7, ADR-0008, Task 12 design sections 3-5/9 | all parent membership mutations | Family, User, FamilyParentInvitation, FamilyMembershipEvent | model, concurrency, rollback, projection, immutable-event, repair and repeated real-service tests pass | COVERED | max-two invariant and atomic membership are enforced; target database zero-drift check remains an enablement precondition |
| `NFR-PRIVACY-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/9/10, PDF security design | all media APIs | resource/common/owner services, gateway and deployment profiles | Historical privacy suite plus PDF active-content, canonicalization, scan fail-closed, signed PDF, family isolation and private deployment tests pass | COVERED | trusted-local is explicitly weaker and private-only; secure-production requires successful real-scanner Gate |
| `NFR-TIME-001` | 4 | 4 | 10.4 | 3.2, ADR-0003 | family/task/report dates | `Family.js`, `GrowthTask.js`, routes, `weeklyReportService.js`, `FamilyMistake.js` | IANA timezone, LocalDate boundary, mistake date validation, weekly cutoff, cancellation/completion cutoff, and historical snapshot tests pass | COVERED | closed `FGT-T3-001`, `FGT-T4-001`; Task 6 time scope closed by final gate |
| `NFR-COMPAT-001` | 3 | 4 | 10.4 | 7 | legacy and family routes | legacy plus family route modules and isolated test projects | route-preservation contracts, family release gate, and explicit legacy-test isolation pass | COVERED | school models/routes retained; family rollback remains route-disable without data deletion |

## Planned autonomous-learning increment

自主学习增量不计入 38/38。下表使用独立 `SL-*` 编号和 `PLANNED` 状态，既不进入上方
FGT-MVP-1.7 requirement set，也不改变其实现证据。只有对应 T 任务完成代码、测试和 Gate 后，
才能逐项调整状态；T9 的家庭验证结论与 T0 至 T8 的工程结论继续分开。

| Requirement | Planned tasks | Product | Architecture | API | Planned code owner | Planned verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SL-01` | T1、T2、T7 | PRD 14 | Architecture 12.2/12.3 | API 14.2 | homework/resource、Parent/Child Web | 作品数量/purpose/scope、幂等重放、媒体恢复、版本确认、iPad 路径 | PLANNED |
| `SL-02` | T3、T7 | PRD 14 | Architecture 12.1/12.2 | API 14.3 | homework、Parent/Child Web | pending 求助、家长处理、旧处理与新求助竞争、跨孩子拒绝 | PLANNED |
| `SL-03` | T4、T7 | PRD 14 | Architecture 12.2/12.3 | API 14.2 | homework、Parent/Child Web | 0 至 5 项、版本冲突、代录 actor、分龄页面 | PLANNED |
| `SL-04` | T5、T7 | PRD 14 | Architecture 12.4 | API 14.4 | homework/gateway、Child Web | 首次并发、CAS、LocalDate、同日多孩子、旧路由不回归 | PLANNED |
| `SL-05` | T6、T7 | PRD 14 | Architecture 12.5 | API 14.5 | homework/analytics、Parent Web | 来源同 scope、跨家庭拒绝、purpose 拒绝、部分成功可重试 | PLANNED |
| `SL-06` | T7、T9 | PRD 14 | Architecture 12.1 | API 14.6 | progress/analytics、Parent/Child Web | 孩子反思、家长反馈、历史周统计不改写、四周复盘 | PLANNED |
| `SL-07` | T8、T9 | PRD 14 | Architecture 12.6 | API 14.6/14.7 | deployment and family validation | iPad Safari、Ubuntu 重启、NAS 隔离恢复、回滚、四周试点 | PLANNED |

2026-10-27 T6 工程增量：三种不可变创建来源、权威同 scope 校验、来源回看、人工订正和复习导航已进入
本地合成工程批准关闭。实现及逐项证据见 [Gate §26](./family-self-directed-learning-mvp-gate.md#26-t6-人工错题订正与复习连接2026-10-27)
和 [T6 验证记录](./evidence/t6-engineering-2026-10-27/README.md)。SL-05 仍保留 PLANNED，
T6 总门禁 CLOSED，仅限 ENGINEERING_SYNTHETIC_ONLY，未代替 T7 综合验收或 DEVICE_PENDING；
Docker INCOMPLETE_FAILED、两项非阻断补测、高级恢复及新回收 REMAINDER_DEFERRED 保留。

T6 后续固定 a3aa01cf 的 [独立服务器合成验证](evidence/t6-server-synthetic-2026-10-27/README.md)
已通过，作为 SL-05 的补充工程证据，不将其 PLANNED 改为产品验收完成；M01–M08、D01–D04 与 T7/T8/T9 仍待验收。

T0 只建立上述契约、迁移/兼容规则和增量 Gate，不提供任何 `SL-*` 功能实现证据。当前执行记录见
[自主学习 MVP 增量 Gate](./family-self-directed-learning-mvp-gate.md)。

T1 增量进展：R1/R2 及 R3 第 1–3 步（含材料快照/空更新 P2）已获用户复审关闭；R3 第 4 步实现提交复审，
见 [Gate §18.37](./family-self-directed-learning-mvp-gate.md) 与[验收归并](./family-self-directed-learning-t1-acceptance-reconciliation.md)。
新增 Gateway + homework/resource/progress 正式工厂的合成 HTTP 证据，覆盖升级拒绝、权限、只读、
精确代次、两层丢响应恢复、首次确认/删除审计、发星幂等及启用前后防降级；默认关闭的 Compose 配置另有检查。
这些证据不将 SL-01 标为 COVERED，不替代 R4-G1/G2、T2 前端、T8 真实介质或 T1 关闭批准。

2026-10-24 当前增量状态：上段为历史检查点，T1 后端工程及 R4 已获用户关闭批准；
T2 页面已实现，三项 P2 已获用户批准 CLOSED；限定合成工程汇总验收及总门禁 APPROVED / CLOSED，仍不将 SL-01 整体标为 COVERED（T7/真机等义务尚未全部完成）。
最新批准依据为 [T2 执行记录 §17](./family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)。

| T2 范围 | 实现位置 | 永久验证 | 当前结论 |
| --- | --- | --- | --- |
| 完成、修改、审核、反馈回看 | ChildTaskPage/Today、TasksPage、TaskCompletionEvidence/Review | child/family 组件；T2 正式 HTTP；14 项 T2 浏览器（含恢复、JWT 过期与清空快照反例） | CLOSED（限定合成工程） |
| 原命令及退出恢复 | completionCommandStore、useTaskCompletion、CompletionRecoveryList、childApi/familyApi | 原命令冻结、跨日重登发现/显式恢复、丢响应、只读快照、真实过期 JWT 重登 | CLOSED（限定合成工程） |
| 身份与孩子隔离 | familySession、三项 Context、TasksPage scope | 迟到401/图片、跨标签换孩子、同家长切孩子失败反例 | CLOSED（限定合成工程）；相关 P2 已关闭 |
| 0–10 图及隐私删除 | TaskCompletionMedia、privateMediaRules、privateMediaStore | 490 项前端回归、14 项 HTTP；十图/普通移除/隐私删除及正文/目录 sync/await 反例 | CLOSED（限定合成工程），不替代 T2-G 回收验收 |
| 原材料/错题 PDF、共管 | 原集合控件保留；Task11/12 browser runtime 改为正式 enabled | 既有 Task11 4 项、Task12 1 项浏览器通过 | COMPATIBILITY_VERIFIED（合成） |
| iPad、真实部署与高级恢复 | 原矩阵保留 | 尚无真实设备/部署验收；后置 D2b 失败证据保留 | DEVICE_PENDING / T8_PENDING / REMAINDER_DEFERRED |

2026-10-24 复审后：T2-PAGE-P2-403、T2-PAGE-P2-STORAGE 已获用户明确批准关闭。
后续三项 P2（JWT 过期、可选完成字段快照、实际正文 sync）经独立复审通过及最新用户批准均 CLOSED，详见执行记录 §16；旧两项关闭历史不改写。
永久反例验证403清除私有详情且保留原命令、损坏命令定向退出清理及重登显式恢复、其他身份命令及迟到响应隔离；
原两项页面 P2 的复审曾重新运行40套件488项前端、2套件13项正式HTTP及两项关键浏览器并通过；这是历史轮次，不是最终三项 P2 的当前计数。
[T2 当前工程验收裁决](family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)为 APPROVED / CLOSED（ENGINEERING_SYNTHETIC_ONLY）；最新全量仍 FAILED（3942/3943通过，D2B-05 REMAINDER_DEFERRED），与此前独立后端143/3926通过分别记录，不用旧绿灯覆盖新失败。前端40/490、HTTP2/14、浏览器14项证据及历史失败均保留。
不将 SL-01 或本表后置/真机义务提前改为 COVERED；T8_PENDING / NOT_AUTHORIZED，T3–T9 NOT_STARTED。

2026-10-25 T3 单独授权增量：上段为 T2 时点快照。当前 T3 APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY，T4–T9 NOT_STARTED；批准及独立复评见 Gate §23.8。
SL-02 的 T3 工程实现映射如下；总体仍 PLANNED，不替代 T7 集成、用户验收或真机结果。

| T3 条件 | 实现 | 永久验证 |
| --- | --- | --- |
| 未完成即可请求/更新求助，家长回应、孩子回看 | growthTaskHelpService、TaskHelpPanel、TasksPage/TodayPage/ChildTaskPage | growthTaskHelpService.test.js、TaskHelpPanel/TaskHelpPages、help.integration.test.js、help.spec.js |
| 实时权限、真实 actor、独立版本与原请求重放 | help 服务事务、Gateway、childApi/familyApi | 跨家庭/兄弟姐妹/离家家长/失效身份、双家长及新旧求助竞争、丢响应重放 |
| 完成并发、教学/奖励零副作用、旧记录只读 | 原子字段更新与只读投影 | 完成/取消/归档快照竞争、回滚/提交未知、真实确认后单账本不变 |
| 账号隔离、可发现性与分页 | 复用 familySession、原请求保留、跨日期筛选 | 迟到401/跨标签、未知结果、旧 resolve 不自动重发、取消归档及末页回退 |
| 家长列表拒绝清私有求助、慢读被写入接管 | TasksPage 的当前 scope 401/403 卸载；TaskHelpPanel 读写 loading 所有权 | TaskHelpPages 的拒绝/迟到读写/非鉴权错误对照、TaskHelpPanel 慢读反例、help.spec.js 正式撤权和已提交丢响应重试；两项 P2 已独立复评关闭，旧失败保留；导航测试 P3 及证据来源见 Gate §23.8 |

执行结果、独立评审和失败事实见[Gate §23](family-self-directed-learning-mvp-gate.md#23-t3-独立求助实施与工程验收2026-10-25)。

2026-10-26 T5 单独授权增量：前文为历史状态。T5 当前 IN_PROGRESS / 总门禁 OPEN，
只允许本地合成开发验证，不授权 Git、服务器测试或部署。SL-04 总体仍 PLANNED，
T7 综合验收和真机/家庭价值义务不能由本轮组件或接口测试替代。

| T5 条件 | 实现 | 永久验证 |
| --- | --- | --- |
| 空计划零写、唯一日期作用域、0–20 项、版本 CAS | DailyLearningPlan、dailyLearningPlanService、dailyLearningPlans 路由 | DailyLearningPlan 模型测试、dailyLearningPlan 服务测试、正式 HTTP dailyLearningPlan.integration |
| 实时家庭/孩子权限、日期/午夜、任务状态竞争与失败回滚 | 既有 resolveChildAccess、家庭时区、事务内 Task 栅栏和计划 CAS | 跨家庭/兄弟姐妹/撤权/失效 token、可控首次创建竞争、任务终态竞争、午夜、索引不合格和缺失引用 |
| 实际估时输入者、重排保留、清空/unknown、家长字段不变 | 服务端 estimateRecordedBy/updatedByActor；日计划不修改任务教学字段 | TC-SL-ESTIMATE-001..004 映射见服务/组件/正式 HTTP，比较任务全文和其他集合/账本 |
| 精确 Gateway 路由与严格输入 | dailyLearningPlanInput、Gateway 清洗前精确校验 | 原始 JSON 非有限数值及非法键、旧 children/PIN 路由、匿名拒绝优先 |
| 孩子排序/估时、家长代录、分页与真实详情入口 | DailyLearningPlanPanel、ChildTodayPage、TodayPage、TasksPage | 组件及 dailyLearningPlan.spec；低/高年级、多视口、分页外计划项、scope 绑定导航 |
| 原请求重试、显式采用最新版本、退出和迟到响应隔离 | 复用 familySession 与新日计划 API 包装，不引入 operation UUID | 丢响应原版本冲突/只读核对、普通读失败、跨标签/孩子切换、迟到 PUT 成功/401/403 |

阶段进展与独立评审问题见 [Gate §25](family-self-directed-learning-mvp-gate.md#25-t5-今日计划开发授权与阶段记录2026-10-26)。
本映射不代表用户已验收；DEVICE_PENDING、T8_PENDING / NOT_AUTHORIZED、REMAINDER_DEFERRED 均保留。

2026-10-27 工程验证更新：T5 已具备本地合成工程提交验收条件，Gate §25.2 保持总门禁 OPEN。
家庭后端 149/4290、前端 49/624、正式 HTTP 4/22、完整浏览器 34 passed；独立前端
10/121、后端 6/87 及原索引/限流探针验证修复，计数有重叠不累加。构建中索引、提前拒绝绕过
限流、跨午夜及未知结果提示问题的永久保护见 [验收证据映射](evidence/t5-synthetic-2026-10-26/README.md)。
SL-04 总体仍 PLANNED，不把 T5 工程证据替代 T7 综合验收；历史失败与后置义务不变。

2026-10-27 修订收口：用户批准 QA-T5-NUMERIC-INPUT-001（P2）、QA-T5-DESIGN-CONFLICT-002（P3）
复审通过并关闭。原生未完成数字零写、主动清空、输入者保持、原命令重试及标准冲突契约的
候选和复验绑定见 [关闭评审材料](evidence/t5-numeric-fix-2026-10-27/closure-review.md)。
T5 总门禁仍 OPEN / 待单独批准，SL-04 仍 PLANNED，T7 综合验收义务不变；
T5-NB-001/002 是未完成的非阻断补测，不计入已覆盖，DEVICE_PENDING 和后置范围保留。

2026-10-27 后续用户批准：T5 限定合成工程 APPROVED / CLOSED，取代以上 OPEN 快照。
批准绑定、验证及边界见 [T5 批准记录](evidence/t5-numeric-fix-2026-10-27/approved-closure.md)与 Gate §25.5。
SL-04 总体仍 PLANNED，T7 综合验收、DEVICE_PENDING、T5-NB-001/002 OPEN_NONBLOCKING、
T8/T9 和 REMAINDER_DEFERRED 保留；不以工程关闭声明真机、部署或学习效果通过。
