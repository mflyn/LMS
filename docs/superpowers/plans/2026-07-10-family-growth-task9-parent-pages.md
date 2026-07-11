# Family Growth Task 9 Parent MVP Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Task 8 parent-page placeholders with selected-child Task 9 workflows and merge them to `main`.

**Architecture:** `FamilyContext` remains the selected-child authority. A parent-only client and cancellable resource hook yield explicit states; focused pages own filters/forms. Private media uses signed reads and reward redemption uses stable idempotency keys.

**Tech Stack:** React 18, React Router 6, Ant Design 5, Axios 1, Jest, React Testing Library, existing Node/Express family services.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/web/src/services/familyApi.js` | Parent API methods, abort signals, signed media, redeem header. |
| `frontend/web/src/hooks/useChildResource.js` | Selected-child request lifecycle and reset cancellation. |
| `frontend/web/src/components/family/FamilyDataState.js` | Explicit loading/empty/partial/error panels. |
| `frontend/web/src/components/family/PrivateMediaField.js` | Validated private image upload and signed reader. |
| `frontend/web/src/pages/family/*.js` | Today, tasks, logs, mistakes, reports, reminders, rewards. |
| `frontend/web/src/__tests__/family/*.test.js` | API, scope, and page integration tests. |

### Task 1: Parent API Client and Child-Scoped Resource Hook

**Files:**
- Modify: `frontend/web/src/services/familyApi.js`
- Create: `frontend/web/src/hooks/useChildResource.js`
- Create: `frontend/web/src/__tests__/family/familyApi.task9.test.js`
- Create: `frontend/web/src/__tests__/family/useChildResource.test.js`

- [x] **Step 1: Write failing client and reset tests**

```js
await listGrowthTasks({ childId: 'child-a1', scope: 'today', signal });
expect(axios.get).toHaveBeenCalledWith('/api/growth-tasks?childId=child-a1&scope=today', expect.objectContaining({ signal }));
resetChildScope({ previousChildId: 'child-a1', nextChildId: 'child-a2' });
expect(controller.abort).toHaveBeenCalled();
```

- [x] **Step 2: Verify RED**

Run: `cd frontend/web && npm test -- --runInBand familyApi.task9 useChildResource`

Expected: FAIL because Task 9 APIs and hook do not exist.

- [x] **Step 3: Implement client and hook**

```js
export const listGrowthTasks = (params, signal) => parentGet('/api/growth-tasks', params, signal);
export const redeemReward = (id, key) => parentPatch(`/api/rewards/${id}/redeem`, {}, { headers: { 'Idempotency-Key': key } });
```

Add methods for tasks, logs, mistakes, reports, reminders/settings, rewards, upload, and signed access. The hook registers controller abort/clear with `registerChildScopeReset`, ignores abort error, and commits only if child ID/scope version still match.

- [x] **Step 4: Verify GREEN and commit**

Run: `cd frontend/web && npm test -- --runInBand familyApi.task9 useChildResource`

Commit: `git add frontend/web/src/services/familyApi.js frontend/web/src/hooks/useChildResource.js frontend/web/src/__tests__/family/familyApi.task9.test.js frontend/web/src/__tests__/family/useChildResource.test.js && git commit -m "feat: add task9 family data client"`

### Task 2: Shared Page State and Private Media

**Files:**
- Create: `frontend/web/src/components/family/FamilyDataState.js`
- Create: `frontend/web/src/components/family/PrivateMediaField.js`
- Modify: `frontend/web/src/family-shell.css`
- Test: `frontend/web/src/__tests__/family/Task9TodayTasks.test.js`

- [x] **Step 1: Write failing common-control tests**

```js
render(<FamilyDataState state="partial" unavailableSources={['weekly_report']} />);
expect(screen.getByText('weekly_report')).toBeInTheDocument();
await user.upload(screen.getByLabelText('任务附件'), oversizedFile);
expect(screen.getByText('图片不能超过 10 MiB')).toBeInTheDocument();
```

- [x] **Step 2: Verify RED and implement**

Run: `cd frontend/web && npm test -- --runInBand Task9TodayTasks`

Implement text panels and labelled retry. Validate JPEG/PNG/WebP and 10 MiB, upload selected child plus approved purpose, retain media ID only, and resolve signed URL on explicit view. Add mobile styles without page-width overflow.

- [x] **Step 3: Verify GREEN and commit**

Run: `cd frontend/web && npm test -- --runInBand Task9TodayTasks`

Commit: `git add frontend/web/src/components/family frontend/web/src/family-shell.css frontend/web/src/__tests__/family/Task9TodayTasks.test.js && git commit -m "feat: add task9 shared page controls"`

### Task 3: Today Overview and Growth Tasks

**Files:**
- Modify: `frontend/web/src/pages/family/TodayPage.js`
- Create: `frontend/web/src/pages/family/TasksPage.js`
- Modify: `frontend/web/src/App.js`
- Modify: `frontend/web/src/__tests__/family/Task9TodayTasks.test.js`

- [x] **Step 1: Write failing overview/task tests**

```js
expect(await screen.findByText('今日任务')).toBeInTheDocument();
await user.selectOptions(screen.getByLabelText('成长维度'), 'physical');
await user.click(screen.getByRole('button', { name: '创建任务' }));
expect(createGrowthTask).toHaveBeenCalledWith(expect.objectContaining({ childId: 'child-a1', dimension: 'physical' }));
```

- [x] **Step 2: Verify RED and implement**

Run: `cd frontend/web && npm test -- --runInBand Task9TodayTasks`

Load today task/report/mistake/reminder data in parallel and render partial source labels. Implement filters, five-dimension create/edit, completion, feedback confirmation, cancel/archive. Replace records only with returned task; reload on `TASK_STATE_CONFLICT`.

- [x] **Step 3: Verify GREEN and commit**

Run: `cd frontend/web && npm test -- --runInBand Task9TodayTasks`

Commit: `git add frontend/web/src/pages/family/TodayPage.js frontend/web/src/pages/family/TasksPage.js frontend/web/src/App.js frontend/web/src/__tests__/family/Task9TodayTasks.test.js && git commit -m "feat: add family task workflows"`

### Task 4: Growth Logs and Academic Mistakes

**Files:**
- Create: `frontend/web/src/pages/family/GrowthLogsPage.js`
- Create: `frontend/web/src/pages/family/MistakesPage.js`
- Create: `frontend/web/src/__tests__/family/Task9LogsMistakes.test.js`
- Modify: `frontend/web/src/App.js`

- [x] **Step 1: Write failing log/mistake tests**

```js
await user.click(screen.getByRole('button', { name: '保存成长记录' }));
expect(createGrowthLog).toHaveBeenCalledWith(expect.objectContaining({ childId: 'child-a1', dimension: 'labor' }));
await user.click(screen.getByRole('button', { name: '保存错题' }));
expect(createMistake).toHaveBeenCalledWith(expect.objectContaining({ subject: '数学', reason: 'calculation' }));
```

- [x] **Step 2: Verify RED and implement**

Run: `cd frontend/web && npm test -- --runInBand Task9LogsMistakes`

Implement date/dimension log filters and create/edit. Implement subject/review-status mistake filters and create/update. Use media only for contract-backed task/mistake IDs, preserve form values after failure, and do not log feedback.

- [x] **Step 3: Verify GREEN and commit**

Run: `cd frontend/web && npm test -- --runInBand Task9LogsMistakes`

Commit: `git add frontend/web/src/pages/family/GrowthLogsPage.js frontend/web/src/pages/family/MistakesPage.js frontend/web/src/App.js frontend/web/src/__tests__/family/Task9LogsMistakes.test.js && git commit -m "feat: add growth logs and mistakes pages"`

### Task 5: Reports, Reminders, and Rewards

**Files:**
- Create: `frontend/web/src/pages/family/ReportsPage.js`
- Create: `frontend/web/src/pages/family/RemindersPage.js`
- Create: `frontend/web/src/pages/family/RewardsPage.js`
- Create: `frontend/web/src/__tests__/family/Task9ReportsRemindersRewards.test.js`
- Modify: `frontend/web/src/App.js`

- [x] **Step 1: Write failing workflow tests**

```js
await user.click(screen.getByRole('button', { name: '保存家长反馈' }));
expect(updateWeeklyReportFeedback).toHaveBeenCalledWith('report-a1', expect.objectContaining({ parentNote: '继续保持' }));
await user.click(screen.getByRole('button', { name: '确认兑换' }));
expect(redeemReward).toHaveBeenLastCalledWith('reward-a1', expect.any(String));
```

- [x] **Step 2: Verify RED and implement**

Run: `cd frontend/web && npm test -- --runInBand Task9ReportsRemindersRewards`

Use Monday report selector and feedback-only patch. Render reminder partial metadata and nested settings `{ quietHours: { start, end } }`. Render balance/reward/ledger pagination, generate one key per redemption attempt, reuse it on retry, and disable in flight.

- [x] **Step 3: Verify GREEN and commit**

Run: `cd frontend/web && npm test -- --runInBand Task9ReportsRemindersRewards`

Commit: `git add frontend/web/src/pages/family/ReportsPage.js frontend/web/src/pages/family/RemindersPage.js frontend/web/src/pages/family/RewardsPage.js frontend/web/src/App.js frontend/web/src/__tests__/family/Task9ReportsRemindersRewards.test.js && git commit -m "feat: add reports reminders and rewards pages"`

### Task 6: Contract Correction, Gate, and Merge Evidence

**Files:**
- Modify: `docs/api/family-learning-tracker-api.md`
- Create: `docs/development/family-growth-task9-gate.md`
- Modify: `docs/development/README.md`

- [x] **Step 1: Correct reminder documentation**

Replace `quietHoursStart`/`quietHoursEnd` with `{ "quietHours": { "start": "21:00", "end": "07:00" } }`.

- [x] **Step 2: Run backend smoke and final verification**

Run: `npm run test:family-regression -- --runInBand growthTasks.test.js`

Run: `cd frontend/web && npm ci && npm run test:ci`

Run: `cd frontend/web && npm run build`

Run: `npm run test:family-regression`

Run: `git diff --check`

Expected: existing `TC-T5-SAGA-001` proves parent create/complete/confirm/award; all commands exit zero.

- [ ] **Step 3: Browser inspect and commit gate**

At desktop and 360px, create task, switch child, create log/mistake, read report/reminders/rewards, and verify no horizontal overflow. Record evidence, CI, PR, merge SHA. Commit: `git add docs/api/family-learning-tracker-api.md docs/development frontend/web && git commit -m "test: close task9 parent pages gate"`.

## Plan Self-Review

- Tasks 1 to 5 cover resource isolation and all seven Task 9 routes.
- Task 6 covers the contract discrepancy, backend smoke, browser evidence, and final gate.
- No task adds child routes, backend endpoints/data schema, or Task 11 E2E behavior.
