# Family Growth Tracker Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前学校级 LMS 半成品收敛为家庭成长跟踪 MVP，先打通“家长登录 -> 添加孩子 -> 创建德智体美劳成长任务 -> 孩子完成 -> 家长确认 -> 记录错题或成长过程 -> 生成成长周报”的可演示闭环。

**Architecture:** 第一阶段采用“逻辑单体化、模块边界保留”的迁移方式：继续复用现有 `user-service`、`homework-service`、`progress-service`、`resource-service`、`analytics-service`、`notification-service` 和 `gateway`，但接口、模型和前端入口按家庭德智体美劳成长场景收敛。核心抽象从学校作业升级为 `GrowthTask`，每条任务和记录必须归属成长维度 `moral|academic|physical|artistic|labor`。暂缓教师、班级、学校管理员、会议、公告、复杂资源库和复杂分析，不继续扩大微服务数量。

**Tech Stack:** Node.js, Express, Mongoose, MongoDB, Jest, Supertest, React 18, Ant Design, Axios, React Router.

**Path Convention:** 本计划中的所有文件路径均相对于当前 Git worktree 根目录。执行前先运行 `git rev-parse --show-toplevel` 并在该目录工作；禁止将路径替换为某个开发者机器上的绝对路径，以免修改错误 worktree。

---

## Scope Decision

这不是一个单次代码提交能干净完成的改造。执行时拆成 6 个可验收子计划，每个子计划产出能运行、能测试、能演示的软件增量：

1. 需求和信息架构收敛。
2. 后端家庭域模型和权限边界。
3. 成长任务、每日成长记录、领域能力点和智育错题 API。
4. 周报、提醒和激励的最小实现。
5. 家长 Web 端 MVP。
6. 孩子简化入口和端到端测试。

移动端不进入第一轮主线实现；只在最后做一次导航和接口兼容评估，避免同时维护 Web、Parent App、Student App 三条 UI 线。

跨服务聚合采用迁移期共享只读仓储：`backend/common/repositories/familyReadRepository.js` 只提供带 `familyId + childId` 约束的任务、记录、错题和能力点投影查询。各服务仍是自己集合的唯一写入方；禁止跨目录导入其他服务的私有模型。周报在读取失败时返回 `503`，提醒允许部分降级但必须返回 `meta.partial`。

## Current State Observations

- `docs/product/family-learning-tracker.md` 已定义家庭版成长产品边界、核心闭环、MVP 功能和推荐模型。
- `backend/common/models/User.js` 仍是学校版通用用户模型，包含 `teacher`、`student`、`admin`、`class`、`subjects` 等字段。
- `backend/services/homework-service/models/Homework.js` 仍绑定 `class`、`assignedBy`、`assignedTo`，需要改造成 `GrowthTask` 语义，支持课内学习、体育锻炼、艺术练习、劳动实践和品德习惯。
- `backend/services/progress-service/models/Progress.js` 仍是章节完成率模型，需要新增或替换为 `GrowthLog`、`KnowledgePoint`、`Reward` 和周报相关模型。
- `backend/services/data-service/models/MistakeRecord.js` 已有错题雏形，但字段偏题库和学校分析，需要收敛为家庭智育错题记录。
- `frontend/web/src/config/menuConfig.js` 和 `frontend/web/src/App.js` 仍暴露教师、管理员、课程、班级、会议、家校互动等学校版入口。
- `frontend/web/src/pages/dashboards/ParentDashboard.js` 可作为家长首页基础，但当前展示考试、出勤、老师评语，需要改为德智体美劳任务分布、成长投入时长、错题、周报和鼓励反馈。

## Target MVP API Surface

第一阶段只开放这些家庭版接口。执行代码改造时，先写这些接口契约测试，再实现接口。

### Auth and Family

- `POST /api/auth/register`：默认注册家长账号，角色为 `parent`。
- `POST /api/auth/login`：家长账号登录。
- `GET /api/families/me`：获取当前家长所属家庭、孩子列表和默认孩子。
- `POST /api/families`：创建家庭。
- `PATCH /api/families/:familyId`：修改家庭名称。
- `POST /api/children`：家长添加孩子。
- `GET /api/children`：家长查看自己家庭下孩子列表。
- `GET /api/children/:childId`：家长或孩子本人查看孩子档案。
- `PATCH /api/children/:childId`：家长编辑孩子档案。
- `POST /api/children/:childId/pin`：家长设置或重置孩子 PIN。
- `POST /api/auth/child-pin-login`：孩子使用家庭码、孩子 ID 和 PIN 进入简化入口。

### Growth Tasks

- `POST /api/growth-tasks`：家长创建成长任务。
- `GET /api/growth-tasks?childId=&scope=today|week|all&status=&dimension=`：查询今日、本周或全部任务，可按德智体美劳维度筛选。
- `GET /api/growth-tasks/:taskId`：查看任务详情。
- `PATCH /api/growth-tasks/:taskId`：家长编辑任务。
- `PATCH /api/growth-tasks/:taskId/complete`：孩子或家长标记完成，记录实际用时、实际数量、难度、备注、是否需要帮助。
- `PATCH /api/growth-tasks/:taskId/confirm`：家长确认完成并写反馈。
- `DELETE /api/growth-tasks/:taskId`：家长删除未完成任务或归档已完成任务。

### Growth Logs, Knowledge and Mistakes

- `POST /api/growth-logs`：创建每日成长记录。
- `GET /api/growth-logs?childId=&from=&to=&dimension=`：按孩子、日期和成长维度查询成长记录。
- `PATCH /api/growth-logs/:logId`：更新家长备注、孩子自评、专注度、身体状态和心情。
- `POST /api/knowledge-points`：家长创建智育知识点或其他维度能力点。
- `GET /api/knowledge-points?childId=&dimension=&subject=&area=`：查询知识点或能力点。
- `PATCH /api/knowledge-points/:knowledgePointId`：更新掌握程度。
- `POST /api/mistakes`：创建错题记录。
- `GET /api/mistakes?childId=&subject=&reason=&reviewStatus=`：错题列表和待复习筛选。
- `PATCH /api/mistakes/:mistakeId`：更新错题、错因、订正、复习和掌握状态。

### Reports, Rewards and Notifications

- `GET /api/reports/weekly?childId=&weekStart=`：生成或读取固定模板周报。
- `PATCH /api/reports/weekly/:reportId/feedback`：家长补充周报反馈。
- `POST /api/rewards`：家长创建奖励。
- `GET /api/rewards?childId=`：查看奖励和星星状态。
- `PATCH /api/rewards/:rewardId/redeem`：家长确认奖励兑换。
- `GET /api/notifications/family?childId=`：查询今日任务、未完成任务、错题复习、锻炼、习惯和周报提醒。

内部接口不通过 gateway 对外暴露：

- `POST /api/internal/stars/award`：任务首次确认后按 `taskId` 幂等发放星星，仅接受服务凭据。

## Target Data Models

### User

Modify: `backend/common/models/User.js`

Keep `role` values for backward compatibility during migration, but first-stage UI only uses `parent` and `student`. Add family-specific fields without deleting legacy fields in the first pass:

- `familyId: ObjectId`
- `childProfile: { nickname, school, grade, avatar, textbookVersion, interests, weakSubjects, pinHash, tokenVersion }`
- `parentProfile: { familyRole, defaultChildId }`
- `children: ObjectId[]` remains for compatibility, but new access checks must prefer `familyId`.

### Family

Create: `backend/common/models/Family.js`

Fields:

- `familyName: String`
- `timezone: String`，IANA 时区名，默认 `Asia/Shanghai`
- `ownerParentId: ObjectId`
- `memberParentIds: ObjectId[]`
- `childIds: ObjectId[]`
- `createdAt`, `updatedAt`

### GrowthTask

Create: `backend/services/homework-service/models/GrowthTask.js`

Fields:

- `childId`, `familyId`, `createdByParentId`
- `dimension: moral|academic|physical|artistic|labor`
- `area`, `subject`, `title`, `taskType`, `description`
- `dueDate: LocalDate String`, `estimatedMinutes`, `actualMinutes`
- `targetAmount`, `actualAmount`, `unit`
- `priority`
- `status: pending|completed|confirmed|cancelled|archived`
- `difficulty: easy|normal|hard`
- `needsHelp: Boolean`
- `childNote`, `parentFeedback`
- `attachmentMediaIds`
- `completedAt`, `confirmedAt`, `cancelledAt`
- `starAwardState: not_applicable|pending|awarded`

### GrowthLog

Create: `backend/services/progress-service/models/GrowthLog.js`

Fields:

- `childId`, `familyId`, `date: LocalDate String`
- `dimension: moral|academic|physical|artistic|labor`
- `area`, `subject`, `content`, `durationMinutes`
- `amount`, `unit`
- `completedTaskIds`, `completedTaskCount`, `unfinishedTaskCount`
- `focusLevel: good|normal|distracted`
- `difficulty: easy|normal|hard`
- `physicalState: energetic|normal|tired|unwell`
- `mood: happy|calm|resistant|anxious`
- `childReflection`, `parentNote`

### KnowledgePoint

Create: `backend/services/progress-service/models/KnowledgePoint.js`

Fields:

- `childId`, `familyId`, `dimension`, `subject`, `area`, `name`
- `masteryLevel: not_started|learning|basic|skilled|needs_review`
- `practiceCount`, `mistakeCount`, `lastReviewedAt`

### FamilyMistake

Create: `backend/services/analytics-service/models/FamilyMistake.js`

Fields:

- `childId`, `familyId`, `dimension: academic`, `subject`, `knowledgePointId`, `knowledgePointName`
- `questionMediaId`, `childAnswerMediaId`, `correctAnswer`
- `reason: concept|careless|reading|calculation|memory|method|time`
- `corrected`, `reviewed`, `reviewReminderDate`, `mastered`
- `parentNote`, `childExplanation`

### WeeklyReport

Create: `backend/services/analytics-service/models/WeeklyReport.js`

Fields:

- `childId`, `familyId`, `weekStart`, `weekEnd`
- `recordDays`, `totalDurationMinutes`, `taskCompletionRate`
- `dimensionDurations`, `dimensionTaskStats`
- `subjectDurations`, `subjectTaskStats`
- `mistakeCount`, `topMistakeReasons`, `reviewKnowledgePoints`
- `parentNote`, `childReflection`, `nextWeekSuggestion`

### Reward

Create: `backend/services/progress-service/models/Reward.js`

Fields:

- `childId`, `familyId`, `title`, `requiredStars`
- `status: active|redeemed|disabled`
- `createdByParentId`, `redeemedAt`

### StarLedgerEntry

Create: `backend/services/progress-service/models/StarLedgerEntry.js`

Fields:

- `childId`, `familyId`
- `type: earn|spend|adjust`
- `amount`
- `sourceType: task_confirmation|reward_redemption|parent_adjustment`
- `sourceId`, `idempotencyKey`
- `createdBy`, `createdAt`

Create a unique index on `familyId + childId + sourceType + sourceId + type`. Star balance is derived from the immutable ledger; do not keep a separately mutable balance field. Badges are not part of the first-stage MVP.

### ReminderSettings

Create: `backend/services/notification-service/models/ReminderSettings.js`

Fields:

- `familyId` unique
- category enable flags
- `weeklyReportDay: 1..7`, default 7
- `quietHoursStart`, `quietHoursEnd`
- `updatedByParentId`, timestamps

### MediaAsset

Create: `backend/services/resource-service/models/MediaAsset.js`

Fields:

- `familyId`, optional `childId`
- `purpose`, server-generated `storageKey`
- `originalName`, `mimeType`, `sizeBytes`
- `status: active|deleted`
- `createdBy`, `createdAt`, `deletedAt`

Business models store media IDs only. Resource objects are private and are read through short-lived authorized URLs.

## Implementation Tasks

### Task 1: Freeze Product Scope and Architecture Decisions

**Files:**

- Modify: `docs/product/family-learning-tracker.md`
- Create: `docs/architecture/family-learning-tracker-architecture.md`
- Create: `docs/api/family-learning-tracker-api.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Add a first-stage decision summary to the product doc**

  Add a short section after the MVP list stating:

  ```markdown
  ## 13. 第一阶段执行边界

  第一阶段只实现家长 Web 端和孩子简化入口。移动端仅做兼容性评估，不作为首轮验收入口。

  第一阶段继续复用现有服务目录，但接口语义按家庭版重命名和收敛。学校、班级、教师、管理员、会议、公告、复杂资源库、AI 分析和复杂推荐均不进入首轮开发。
  ```

- [ ] **Step 2: Write the architecture document**

  Create `docs/architecture/family-learning-tracker-architecture.md` with:

  - MVP module diagram.
  - Existing service to family capability mapping.
  - Data ownership rules: every family object must carry `familyId`; every child-owned object must carry `childId`.
  - Permission rules: parent can access only own family data; child can access only self data; teacher/admin routes are retained only for backward compatibility and hidden from MVP UI.
  - Deployment rule: first-stage local demo starts only the gateway and required services; no new service is introduced.

- [ ] **Step 3: Write the API contract document**

  Create `docs/api/family-learning-tracker-api.md` using the `Target MVP API Surface` section above as the contract. Include request and response examples for:

  - Create child.
  - Create growth task.
  - Complete growth task.
  - Confirm growth task.
  - Create mistake.
  - Generate weekly report.

- [ ] **Step 4: Link the new docs**

  Update `docs/README.md` so the product, architecture, and API docs are all visible from the docs homepage.

- [ ] **Step 5: Verify documentation formatting**

  Run:

  ```bash
  git diff --check
  ```

  Expected: no trailing whitespace or whitespace error output.

- [ ] **Step 6: Commit documentation baseline**

  ```bash
  git add docs/product/family-learning-tracker.md docs/architecture/family-learning-tracker-architecture.md docs/api/family-learning-tracker-api.md docs/README.md
  git commit -m "docs: define family tracker architecture and api"
  ```

### Task 2: Establish Backend Baseline and Test Harness

**Files:**

- Inspect: `package.json`
- Inspect: `backend/services/user-service/package.json`
- Inspect: `backend/services/homework-service/package.json`
- Inspect: `backend/services/progress-service/package.json`
- Inspect: `backend/services/analytics-service/package.json`
- Create: `docs/development/family-tracker-test-baseline.md`

- [ ] **Step 1: Run the current backend test baseline**

  Run:

  ```bash
  npm run test:nocoverage
  ```

  Expected: collect passing and failing suites. Do not fix unrelated legacy failures in this task; document them.

- [ ] **Step 2: Run targeted service tests**

  Run:

  ```bash
  npm test --prefix backend/services/user-service -- --runInBand
  npm test --prefix backend/services/homework-service -- --runInBand
  npm test --prefix backend/services/progress-service -- --runInBand
  npm test --prefix backend/services/analytics-service -- --runInBand
  ```

  Expected: each command either passes or has documented legacy failures.

- [ ] **Step 3: Create the baseline report**

  Create `docs/development/family-tracker-test-baseline.md` with:

  - Command run.
  - Pass/fail result.
  - Failing test file.
  - Failure category: dependency, path mismatch, model mismatch, mock mismatch, or real behavior regression.
  - Whether it blocks family tracker work.

- [ ] **Step 4: Commit baseline report**

  ```bash
  git add docs/development/family-tracker-test-baseline.md
  git commit -m "docs: record family tracker test baseline"
  ```

### Task 3: Add Family and Child Domain Model

**Files:**

- Modify: `backend/common/models/User.js`
- Create: `backend/common/models/Family.js`
- Modify: `backend/common/models/index.js`
- Create: `backend/services/user-service/controllers/familyController.js`
- Create: `backend/services/user-service/routes/family.js`
- Create: `backend/services/user-service/routes/children.js`
- Modify: `backend/services/user-service/routes/index.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/user-service/__tests__/routes/family.test.js`
- Test: `backend/services/user-service/__tests__/routes/children.test.js`

- [ ] **Step 1: Write route tests for family and child ownership**

  Tests must prove:

  - A parent can create one family.
  - A parent can add multiple children to own family.
  - Parent A cannot read or edit Parent B's child.
  - A child PIN login returns a token scoped to that child.
  - PIN accepts only 4 to 6 digits and is never returned or logged.
  - Five failed attempts for the same IP, family and child within 15 minutes produce `429` with a generic error.
  - Resetting PIN increments `tokenVersion` and invalidates prior child tokens.
  - A child cannot list siblings.

- [ ] **Step 2: Implement `Family` model and user family fields**

  Add `Family.js` and extend `User.js` with `familyId`, `childProfile`, and `parentProfile`. Keep legacy fields so old tests and routes are not broken by deletion.

- [ ] **Step 3: Implement family and child controllers**

  `familyController.js` should contain:

  - `getMyFamily`
  - `createFamily`
  - `updateFamily`
  - `createChild`
  - `listChildren`
  - `getChild`
  - `updateChild`
  - `setChildPin`
  - `childPinLogin`

- [ ] **Step 4: Wire routes and gateway**

  Mount:

  - `user-service`: `/api/families`, `/api/children`.
  - `gateway`: `/api/families`, `/api/children`.
  - auth route: `/api/auth/child-pin-login`.

- [ ] **Step 5: Run targeted tests**

  ```bash
  npm test --prefix backend/services/user-service -- --runInBand family children
  ```

  Expected: new family and children tests pass.

- [ ] **Step 6: Commit family domain**

  ```bash
  git add backend/common/models/User.js backend/common/models/Family.js backend/common/models/index.js backend/services/user-service backend/gateway/server.js
  git commit -m "feat: add family and child domain"
  ```

### Task 4: Convert Homework to Growth Tasks

**Files:**

- Create: `backend/services/homework-service/models/GrowthTask.js`
- Create: `backend/services/homework-service/routes/growthTasks.js`
- Modify: `backend/services/homework-service/server.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/homework-service/__tests__/growthTasks.test.js`

- [ ] **Step 1: Write growth task API tests**

  Tests must cover:

  - Parent creates academic task for own child.
  - Parent creates physical task such as jumping rope with `targetAmount=500` and `unit=count`.
  - Parent creates artistic task such as piano practice with `estimatedMinutes=30`.
  - Parent creates labor task such as room cleanup.
  - Parent creates moral habit task such as bedtime routine.
  - Parent cannot create task for another family child.
  - `scope=today` returns only today's due tasks.
  - `scope=week` returns due tasks in the current week.
  - `today` and `week` use the family IANA timezone, with Monday as the inclusive week start.
  - First-stage creation rejects `repeatRule` with `400 REPEAT_RULE_NOT_SUPPORTED`.
  - `dimension=physical` returns only physical tasks.
  - Child marks own task completed with actual minutes, actual amount and difficulty.
  - Parent confirms a completed task with feedback.
  - Child cannot confirm a task as parent.

- [ ] **Step 2: Implement `GrowthTask` model**

  Use the `GrowthTask` fields from `Target Data Models`. Do not delete `Homework.js` in this task; leave legacy `/api/homework` routes untouched until Web routes have migrated.

- [ ] **Step 3: Implement growth task routes**

  Mount routes under `/api/growth-tasks`. Reuse existing gateway authentication headers. Add local helper functions:

  - `assertParentOwnsChild(parentId, childId)`
  - `assertUserCanAccessChild(user, childId)`
  - `getDateRangeForScope(scope)`

- [ ] **Step 4: Add gateway proxy**

  Proxy `/api/growth-tasks` to `homework-service`.

- [ ] **Step 5: Run tests**

  ```bash
  npm test --prefix backend/services/homework-service -- --runInBand growthTasks
  ```

  Expected: new growth task tests pass.

- [ ] **Step 6: Commit growth tasks**

  ```bash
  git add backend/services/homework-service backend/gateway/server.js
  git commit -m "feat: add family growth tasks"
  ```

### Task 4.5: Design Baseline Review Gate

**Status:** APPROVED

Task 5 is blocked until all entry criteria in
`docs/superpowers/specs/2026-06-18-family-growth-design-baseline-review-design.md`
are satisfied.

- [ ] Product requirements have stable IDs and acceptance criteria.
- [ ] Architecture decisions are recorded and approved.
- [ ] API contract is complete and internally consistent.
- [ ] Test strategy and requirement traceability are complete.
- [ ] Task 3/4 implementation findings are recorded.
- [ ] All BLOCKER and MAJOR findings are closed.
- [ ] Product, architecture, and API baselines are approved.
- [ ] Task 5 entry decision is signed.

### Task 5: Add Growth Logs, Ability Points and Rewards

**Status:** COMPLETE

**Files:**

- Create: `backend/services/progress-service/models/GrowthLog.js`
- Create: `backend/services/progress-service/models/KnowledgePoint.js`
- Create: `backend/services/progress-service/models/Reward.js`
- Create: `backend/services/progress-service/models/StarLedgerEntry.js`
- Create: `backend/services/progress-service/routes/growthLogs.js`
- Create: `backend/services/progress-service/routes/knowledgePoints.js`
- Create: `backend/services/progress-service/routes/rewards.js`
- Create: `backend/services/progress-service/routes/internalStars.js`
- Modify: `backend/services/homework-service/routes/growthTasks.js`
- Test: `backend/services/homework-service/__tests__/growthTasks.test.js`
- Modify: `backend/services/progress-service/routes/index.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/progress-service/__tests__/growthLogs.test.js`
- Test: `backend/services/progress-service/__tests__/knowledgePoints.test.js`
- Test: `backend/services/progress-service/__tests__/rewards.test.js`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.china.yml`
- Modify: `deployment/kubernetes/mongo-deployment.yaml`

- [x] **Step 1: Write tests for growth logs**

  Tests must prove parents and children can create/update allowed fields, dimensions `moral|academic|physical|artistic|labor` are accepted, and cross-family access is denied.

  Creation and update must share the same role field whitelist. A child submitting `parentNote`, ownership or audit fields must receive `403 FIELD_ACCESS_DENIED` rather than silent field removal.

- [x] **Step 2: Write tests for knowledge and ability points**

  Tests must prove a parent can create and update a child's academic knowledge point, physical ability point, artistic practice point, labor skill point and moral habit point, and list by dimension plus subject or area.

- [x] **Step 3: Write tests for stars and rewards**

  Tests must prove a parent can create rewards; first task confirmation creates exactly one 1-star `earn` ledger entry even when retried; balance is derived from the ledger; redemption atomically creates one `spend` entry and updates reward status; insufficient balance returns `409`; and only a parent can confirm redemption. The internal award route must reject ordinary user tokens.

- [x] **Step 4: Implement models and routes**

  Use `/api/growth-logs`, `/api/knowledge-points`, and `/api/rewards` as the public route prefixes. Mount `/api/internal/stars/award` only inside the service network and require a service credential; do not proxy it through gateway.

  Extend task confirmation as a small idempotent saga: atomically set `status=confirmed` and `starAwardState=pending`, call the internal award route with `taskId`, then set `starAwardState=awarded`. If the call fails, return `503 STAR_AWARD_PENDING`; retrying confirmation must resume the pending award instead of creating another ledger entry.

  Run MongoDB as replica set `rs0` in Compose and Kubernetes and add `replicaSet=rs0` to service connection strings. Startup must reject standalone MongoDB when reward redemption is enabled. Compose initialization must be idempotent; Kubernetes must use a stable StatefulSet identity plus an idempotent initialization Job.

- [x] **Step 5: Wire gateway**

  Proxy the three route prefixes to `progress-service`.

- [x] **Step 6: Run targeted tests**

  ```bash
  npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints rewards
  npm test --prefix backend/services/homework-service -- --runInBand growthTasks
  ```

  Expected: new progress-service tests pass.

- [x] **Step 7: Commit progress domain**

  ```bash
  git add backend/services/progress-service backend/services/homework-service/routes/growthTasks.js backend/services/homework-service/__tests__/growthTasks.test.js backend/gateway/server.js
  git commit -m "feat: add growth logs ability points and rewards"
  ```

### Task 6: Add Family Mistakes and Weekly Reports

**Files:**

- Create: `backend/services/analytics-service/models/FamilyMistake.js`
- Create: `backend/services/analytics-service/models/WeeklyReport.js`
- Create: `backend/common/repositories/familyReadRepository.js`
- Test: `backend/common/repositories/__tests__/familyReadRepository.test.js`
- Create: `backend/services/analytics-service/routes/familyMistakes.js`
- Create: `backend/services/analytics-service/routes/weeklyReports.js`
- Modify: `backend/services/analytics-service/server.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/analytics-service/__tests__/familyMistakes.test.js`
- Test: `backend/services/analytics-service/__tests__/weeklyReports.test.js`

- [ ] **Step 1: Write mistake tests**

  Tests must cover creation, list filtering by subject/reason/review status, correction, review reminder, mastered flag, and cross-family denial.

- [ ] **Step 2: Write weekly report tests**

  Tests must create a fixture week containing:

  - 6 recorded growth days.
  - 30 growth tasks with 24 completed.
  - Academic tasks with math mistakes concentrated in fraction calculation.
  - Physical tasks with 4 exercise completions.
  - Artistic tasks with 3 practice completions.
  - Labor tasks with 2 room cleanup completions.
  - Moral habit goal with 4 of 7 bedtime completions.
  - Lower focus on Wednesday and Friday.

  Expected report summary:

  - `recordDays: 6`
  - `taskCompletionRate: 80`
  - `dimensionTaskStats.academic.completed` is greater than 0.
  - `dimensionTaskStats.physical.completed` equals 4.
  - `dimensionTaskStats.artistic.completed` equals 3.
  - `dimensionTaskStats.labor.completed` equals 2.
  - `topMistakeReasons` contains the dominant reason from fixtures.
  - `nextWeekSuggestion` contains deterministic, non-AI recommendations for math review, outdoor exercise and labor tasks.
  - A task cancelled before week end is excluded from the denominator; cancellation after week end does not change the frozen report.
  - A task completed after week end does not enter the historical numerator.
  - A task with actualMinutes and a linked GrowthLog contributes duration once, from GrowthLog only.
  - A zero-task week returns `taskCompletionRate: null`.

- [ ] **Step 3: Implement models and routes**

  Mount:

  - `/api/mistakes`
  - `/api/reports/weekly`

- [ ] **Step 4: Implement deterministic weekly report aggregation**

  Aggregation reads:

  - Growth tasks by `childId`, `weekStart`, `weekEnd`.
  - Growth logs by `childId`, `weekStart`, `weekEnd`.
  - Mistakes by `childId`, `weekStart`, `weekEnd`.
  - Knowledge points with `masteryLevel=needs_review`.
  - Dimension distribution across `moral|academic|physical|artistic|labor`.

  Use `familyReadRepository`; every read method requires both `familyId` and `childId`, applies an explicit timeout and returns projections only. Do not import private models from homework-service or progress-service. If any required projection fails, return `503 AGGREGATION_UNAVAILABLE` rather than treating missing data as zero.

  Apply the formulas in product section 5.7 and architecture section 4.7. Current-week reports may be invalidated; an ended week's first successful computation freezes its statistics. Feedback updates never mutate statistics.

  No AI generation is used in first-stage weekly reports.

- [ ] **Step 5: Run tests**

  ```bash
  npm test --prefix backend/services/analytics-service -- --runInBand familyMistakes weeklyReports
  ```

  Expected: new analytics-service tests pass.

- [ ] **Step 6: Commit mistakes and reports**

  ```bash
  git add backend/common/repositories backend/services/analytics-service backend/gateway/server.js
  git commit -m "feat: add family mistakes and weekly reports"
  ```

### Task 6.5: Add Private Family Media

**Files:**

- Create: `backend/services/resource-service/models/MediaAsset.js`
- Create: `backend/services/resource-service/routes/familyMedia.js`
- Create: `backend/services/resource-service/services/privateMediaStore.js`
- Modify: `backend/services/resource-service/server.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/resource-service/__tests__/familyMedia.test.js`

- [ ] **Step 1: Write media security tests**

  Cover file-signature validation, JPEG/PNG/WebP allowlist, 10 MiB limit, EXIF removal, parent/child purpose rules, cross-family and sibling denial, 300-second access URL expiry, soft deletion, illegal business reference, log redaction and 30-day cleanup eligibility.

- [ ] **Step 2: Implement private media APIs**

  Implement `POST /api/media`, `GET /api/media/:mediaId/access` and `DELETE /api/media/:mediaId` exactly as the API contract. Never persist a public URL in task, mistake, profile or log documents; those models store mediaId references only after resource-service validates scope and purpose.

- [ ] **Step 3: Run and commit**

  ```bash
  npm test --prefix backend/services/resource-service -- --runInBand familyMedia
  git add backend/services/resource-service backend/gateway/server.js
  git commit -m "feat: add private family media"
  ```

### Task 7: Add Lightweight Family Notifications

**Files:**

- Modify: `backend/services/notification-service/models/Notification.js`
- Create: `backend/services/notification-service/models/ReminderSettings.js`
- Create: `backend/services/notification-service/routes/familyNotifications.js`
- Modify: `backend/services/notification-service/server.js`
- Modify: `backend/gateway/server.js`
- Test: `backend/services/notification-service/__tests__/familyNotifications.test.js`

- [ ] **Step 1: Write notification tests**

  Tests must cover:

  - Today's task reminders.
  - Overdue or unfinished task reminders.
  - Mistake review reminders due today.
  - Physical exercise reminders.
  - Moral habit reminders.
  - Labor task reminders.
  - Weekly report reminder on `ReminderSettings.weeklyReportDay`.
  - Settings defaults, parent update, child read-only, invalid ISO weekday and quiet-hour validation.
  - Family-timezone day boundaries, disabled categories, stable ordering and `type + childId + LocalDate + sourceId` deduplication.

- [ ] **Step 2: Implement derived notification route**

  First-stage notifications can be computed on read from task, mistake, habit and report data. Do not introduce background jobs until the demo flow is stable. Expose `GET/PATCH /api/notifications/settings`; default `weeklyReportDay=7`. Compute dates and quiet hours in the family timezone.

  Reuse `familyReadRepository`. Independent reminder categories may degrade separately; when one fails, return the available items with `meta.partial=true` and list the failed category in `meta.unavailableSources`.

- [ ] **Step 3: Wire gateway**

  Proxy `/api/notifications/family` to `notification-service`.

- [ ] **Step 4: Run tests**

  ```bash
  npm test --prefix backend/services/notification-service -- --runInBand familyNotifications
  ```

  Expected: new notification tests pass.

- [ ] **Step 5: Commit notifications**

  ```bash
  git add backend/services/notification-service backend/gateway/server.js
  git commit -m "feat: add family growth notifications"
  ```

### Task 8: Refactor Web App Navigation and API Client

**Files:**

- Modify: `frontend/web/src/config/menuConfig.js`
- Modify: `frontend/web/src/App.js`
- Create: `frontend/web/src/services/familyApi.js`
- Modify: `frontend/web/src/contexts/AuthContext.js`
- Test: `frontend/web/src/__tests__/integration/FamilyNavigation.test.js`

- [ ] **Step 1: Write navigation test**

  Test must verify a parent sees only:

  - 首页
  - 任务
  - 记录
  - 错题
  - 成长
  - 进度
  - 孩子
  - 设置

  It must also verify these labels are absent:

  - 班级管理
  - 教师
  - 家校互动
  - 视频会议
  - 管理端

  Also verify an unauthenticated deep link redirects to parent login, refresh restores a valid parent session, child tokens cannot open parent routes, and logout clears the current role token.

- [ ] **Step 2: Add family API client**

  `familyApi.js` exports functions:

  - `getMyFamily`
  - `createChild`
  - `updateChild`
  - `listGrowthTasks`
  - `createGrowthTask`
  - `completeGrowthTask`
  - `confirmGrowthTask`
  - `listGrowthLogs`
  - `createGrowthLog`
  - `listMistakes`
  - `createMistake`
  - `getWeeklyReport`
  - `listRewards`
  - `uploadMedia`
  - `getMediaAccess`
  - `deleteMedia`
  - `getReminderSettings`
  - `updateReminderSettings`

- [ ] **Step 3: Replace menu config**

  Parent MVP menu must use paths:

  - `/dashboard`
  - `/tasks`
  - `/logs`
  - `/mistakes`
  - `/growth`
  - `/progress`
  - `/children`
  - `/settings`

- [ ] **Step 4: Replace route table**

  Add protected routes for the new family pages. Keep legacy pages importable but unreachable from parent MVP navigation. Parent and child sessions use separate storage keys and route guards; do not render protected content before identity restoration completes.

- [ ] **Step 5: Run Web tests**

  ```bash
  npm test --prefix frontend/web -- --watchAll=false FamilyNavigation
  ```

  Expected: navigation test passes.

- [ ] **Step 6: Commit Web shell**

  ```bash
  git add frontend/web/src/config/menuConfig.js frontend/web/src/App.js frontend/web/src/services/familyApi.js frontend/web/src/contexts/AuthContext.js frontend/web/src/__tests__/integration/FamilyNavigation.test.js
  git commit -m "feat: add family tracker web navigation"
  ```

### Task 9: Build Parent Web MVP Pages

**Files:**

- Modify: `frontend/web/src/pages/dashboards/ParentDashboard.js`
- Create: `frontend/web/src/pages/family/TasksPage.js`
- Create: `frontend/web/src/pages/family/GrowthLogsPage.js`
- Create: `frontend/web/src/pages/family/MistakesPage.js`
- Create: `frontend/web/src/pages/family/GrowthPage.js`
- Create: `frontend/web/src/pages/family/ProgressPage.js`
- Create: `frontend/web/src/pages/family/ChildrenPage.js`
- Create: `frontend/web/src/pages/family/SettingsPage.js`
- Test: `frontend/web/src/__tests__/pages/FamilyDashboard.test.js`
- Test: `frontend/web/src/__tests__/pages/FamilyTasks.test.js`
- Test: `frontend/web/src/__tests__/pages/FamilyMistakes.test.js`
- Test: `frontend/web/src/__tests__/pages/FamilyPageStates.test.js`

- [ ] **Step 1: Write dashboard test**

  Test must verify the dashboard renders:

  - Selected child switcher.
  - Today task count.
  - Week completion rate.
  - Growth minutes.
  - Dimension distribution for moral, academic, physical, artistic and labor tasks.
  - Pending review mistakes.
  - Quick add task.
  - Quick record mistake.

- [ ] **Step 2: Write task page test**

  Test must verify creating, completing and confirming academic, physical, artistic, labor and moral tasks updates the visible task state and dimension filters.

- [ ] **Step 3: Write mistake page test**

  Test must verify recording an academic mistake with subject, knowledge point, reason and review date shows in the pending review list.

- [ ] **Step 4: Implement dashboard**

  Replace school metrics with:

  - 今日任务
  - 本周完成率
  - 本周成长投入时长
  - 德智体美劳分布
  - 待复习错题
  - 需要帮助
  - 本周鼓励语

  All child-scoped pages use one child context. Switching child cancels old requests and clears old-child query data before rendering the new child.

- [ ] **Step 5: Implement pages**

  Use Ant Design tables, forms, tabs and modals. Keep layout dense and task-focused; do not introduce a marketing landing page. Every data surface has explicit loading, empty, retryable-error and partial states; write buttons prevent duplicate submission. Verify 360px responsive layout, keyboard operation, accessible names and non-color-only statuses.

- [ ] **Step 6: Run page tests**

  ```bash
  npm test --prefix frontend/web -- --watchAll=false FamilyDashboard FamilyTasks FamilyMistakes
  ```

  Expected: new family page tests pass.

- [ ] **Step 7: Run build**

  ```bash
  npm run build --prefix frontend/web
  ```

  Expected: production build succeeds.

- [ ] **Step 8: Commit parent Web MVP**

  ```bash
  git add frontend/web/src/pages/dashboards/ParentDashboard.js frontend/web/src/pages/family frontend/web/src/__tests__/pages
  git commit -m "feat: build parent family tracker web mvp"
  ```

### Task 10: Build Child Simplified Web Entry

**Files:**

- Modify: `frontend/web/src/App.js`
- Create: `frontend/web/src/pages/ChildPinLogin.js`
- Create: `frontend/web/src/pages/child/ChildTodayPage.js`
- Create: `frontend/web/src/pages/child/ChildMistakesPage.js`
- Create: `frontend/web/src/pages/child/ChildAchievementsPage.js`
- Create: `frontend/web/src/pages/child/ChildProfilePage.js`
- Test: `frontend/web/src/__tests__/integration/ChildFlow.test.js`

- [ ] **Step 1: Write child flow test**

  Test must verify:

  - Child PIN login succeeds.
  - Child sees only own today growth tasks across dimensions.
  - Child marks one academic task and one physical task complete.
  - Child sets actual minutes, actual amount, difficulty and needs-help flag.
  - Child sees star balance, star ledger and available family rewards.
  - Child cannot open parent routes.
  - Child logout clears only the child token and returns to PIN login.
  - Expired token and rate-limited PIN responses show recoverable states without exposing whether a child exists.

- [ ] **Step 2: Implement child route shell**

  Child navigation contains:

  - 今天
  - 错题
  - 成就
  - 我的

- [ ] **Step 3: Implement child pages**

  Keep actions simple:

  - Complete task.
  - Add actual minutes.
  - Add actual amount and unit when the task uses measurable output, such as jumping rope count or reading pages.
  - Select difficulty.
  - Request help.
  - Mark review mistake as still not understood or already mastered.
  - Add one-sentence self reflection.

- [ ] **Step 4: Run child tests**

  ```bash
  npm test --prefix frontend/web -- --watchAll=false ChildFlow
  ```

  Expected: child flow test passes.

- [ ] **Step 5: Commit child entry**

  ```bash
  git add frontend/web/src/App.js frontend/web/src/pages/ChildPinLogin.js frontend/web/src/pages/child frontend/web/src/__tests__/integration/ChildFlow.test.js
  git commit -m "feat: add child family tracker entry"
  ```

### Task 11: Add End-to-End Demo Flow Test

**Files:**

- Create: `__tests__/integration/family-growth-demo-flow.test.js`
- Create: `docs/development/family-tracker-demo-script.md`

- [ ] **Step 1: Write backend integration test**

  Test the documented demo:

  1. Register parent.
  2. Create family.
  3. Add child named `小明`.
  4. Create 5 today growth tasks: math practice, English reading, jumping rope, piano practice and room cleanup.
  5. Complete 4 tasks, including the physical task with actual count.
  6. Parent confirms completed tasks.
  7. Record 1 math mistake under academic dimension.
  8. Create today's growth log with academic, physical, artistic and labor entries.
  9. Generate weekly growth report with dimension distribution.
  10. Confirming the same task twice produces one star ledger entry, then redeem one family reward without double spending.
  11. Upload a private completion or mistake image, verify sibling/cross-family access is denied, then soft-delete it.
  12. Configure Sunday weekly-report reminders and verify family-timezone deduplication.
  13. Reopen the prior week's report after a late cancellation and late completion and verify statistics are unchanged.

- [ ] **Step 2: Write demo script doc**

  Create `docs/development/family-tracker-demo-script.md` with click-by-click manual demo steps for the same flow.

- [ ] **Step 3: Run integration test**

  ```bash
  npm run test:integration -- --runInBand family-growth-demo-flow
  ```

  Expected: integration test passes.

- [ ] **Step 4: Commit demo flow**

  ```bash
  git add __tests__/integration/family-growth-demo-flow.test.js docs/development/family-tracker-demo-script.md
  git commit -m "test: cover family growth demo flow"
  ```

### Task 12: Mobile Compatibility Assessment

**Files:**

- Inspect: `frontend/mobile/src/navigation/ParentNavigator.js`
- Inspect: `frontend/mobile/src/navigation/StudentNavigator.js`
- Inspect: `frontend/mobile/parent-app/navigation/AppNavigator.js`
- Inspect: `frontend/mobile/student-app/navigation/AppNavigator.js`
- Create: `docs/development/mobile-family-tracker-gap-analysis.md`

- [ ] **Step 1: Compare mobile routes to new Web routes**

  Document which existing mobile screens map to:

  - Dashboard.
  - Tasks.
  - Growth logs.
  - Mistakes.
  - Notifications.
  - Profile.

- [ ] **Step 2: Document first-stage mobile decision**

  State that mobile app code is not refactored in MVP unless Web demo is stable and backend APIs are already passing.

- [ ] **Step 3: Commit mobile assessment**

  ```bash
  git add docs/development/mobile-family-tracker-gap-analysis.md
  git commit -m "docs: assess mobile family tracker gaps"
  ```

## Final Verification

Run these commands before declaring the migration plan implemented:

```bash
git diff --check
npm test --prefix backend/services/user-service -- --runInBand family children
npm test --prefix backend/services/homework-service -- --runInBand growthTasks
npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints rewards
npm test --prefix backend/services/analytics-service -- --runInBand familyMistakes weeklyReports
npm test --prefix backend/services/notification-service -- --runInBand familyNotifications
npm test --prefix frontend/web -- --watchAll=false FamilyNavigation FamilyDashboard FamilyTasks FamilyMistakes ChildFlow
npm run build --prefix frontend/web
npm run test:integration -- --runInBand family-growth-demo-flow
```

Expected final result:

- Parent Web MVP can run the complete 德智体美劳 demo flow.
- Child simplified entry can complete tasks and request help.
- Weekly report shows dimension distribution for moral, academic, physical, artistic and labor growth.
- All family-owned records enforce `familyId` and `childId` access boundaries.
- Teacher, admin, class, meeting, announcement and school analytics are absent from the MVP navigation.
- Legacy school routes are not deleted unless their tests and replacement routes are already covered.

## Recommended Execution Order

1. Complete Task 1 and Task 2 first. This prevents architecture drift and makes existing test risk visible.
2. Complete Task 3 before any child-owned feature. All later permissions depend on `familyId` and child ownership.
3. Complete Task 4, then pass Task 4.5 before starting Task 5. The gate freezes requirements, architecture, API, traceability and Task 3/4 conformance.
4. Complete Task 5 and Task 6 as separate commits after Task 4.5 approval. These are the remaining core domain capabilities.
5. Complete Task 7 after the shared read repository in Task 6; notifications depend on that read boundary.
6. Complete Task 8 before Task 9. Web pages should use the final route and API client shape.
7. Complete Task 11 before mobile assessment. The demo flow is the real MVP acceptance test.

## Out of Scope for First Implementation Pass

- OCR question recognition.
- AI answer generation or AI weekly summaries.
- Teacher invitation and tutor collaboration.
- School, class, grade and administrator management.
- Video meetings, group chat, announcements and read receipts.
- Resource marketplace and public content review.
- Complex RBAC management UI.
- New microservices.
- Production-grade scheduled jobs.
- Repeating task templates, streaks and badges.
