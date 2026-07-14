# 家庭成长跟踪文档补充计划

**日期:** 2026-07-13
**范围:** 文档补齐计划本身，不直接修改代码。
**目标:** 补齐 Task1~11 完成后的项目文档缺口，让需求、总体架构、详细设计、API、测试、门禁和用户说明形成可追踪闭环。

---

## 0. 当前计划评审结论

原计划覆盖了部分真实缺口，但不完整：

- 已覆盖：过时文档清理、GrowthTask/MediaReference 状态机、核心时序图、用户指南、ER 图、详细设计索引。
- 缺失：最终 MVP 基线清单、Task1~4 文档归档说明、Task8~11 总设计状态收敛、Task7 `quietHours` 契约一致性、业务组件架构图、前端组件图、设计资产追踪表。
- 风险：原计划把 `git rm` 过时文档列为 P1 默认动作，可能误删仍被 README 或外部链接引用的文件。应先做引用扫描和迁移说明，再决定删除、移动或标记 deprecated。
- 风险：原计划直接嵌入多段完整 Mermaid 和用户指南大纲，容易让计划文档膨胀。执行计划应描述要产出的文档和验收标准，具体图内容放到目标文档里。

本修订版按“先治理基线，再补架构表达，最后补用户文档”的顺序执行。

---

## 1. 目标文档清单

| 文件 | 动作 | 目的 |
| --- | --- | --- |
| `docs/development/family-growth-baseline-v1.6-manifest.md` | 新增 | 冻结 Task8~11 和最终 MVP 验收基线 |
| `docs/development/family-growth-task1-4-design-archive.md` | 新增 | 说明 Task1~4 为什么没有独立 spec，并映射到 PRD/架构/API/ADR/评审 |
| `docs/development/family-growth-design-asset-index.md` | 新增 | 建立需求到设计文档、图、API、测试、gate 的索引 |
| `docs/architecture/family-learning-tracker-architecture.md` | 修改 | 补组件架构图、ER 图、状态机图、核心流程入口 |
| `docs/architecture/sequence-diagrams.md` | 新增 | 补跨服务时序图 |
| `docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md` | 修改 | 状态从 Task8 实施基线收敛为 Task8~11 已实现基线，或声明被最终基线替代 |
| `docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md` | 修改 | 统一提醒设置字段为 `quietHours.start/end` |
| `docs/api/family-learning-tracker-api.md` | 修改 | 增加“相关设计文档”索引 |
| `docs/user-guide/README.md` | 修改 | 从骨架变为用户指南入口 |
| `docs/user-guide/quick-start.md` | 新增 | 5 分钟快速上手 |
| `docs/user-guide/parent-guide.md` | 新增 | 家长操作指南 |
| `docs/user-guide/child-guide.md` | 新增 | 孩子操作指南 |

---

## 2. 执行任务

### Task A：建立最终 MVP 基线

**修改/新增文件**

- 新增 `docs/development/family-growth-baseline-v1.6-manifest.md`
- 修改 `docs/development/README.md`（如果当前索引没有引用最终基线）

**内容要求**

最终基线至少记录：

- `baselineId: FGT-MVP-1.6` 或项目约定的最终编号。
- `status: APPROVED` 或 `READY_FOR_REVIEW`，按实际签署状态填写。
- 覆盖范围：Task1~11 家庭成长 MVP。
- Task8、Task9、Task10、Task11 的 gate 文档、PR/CI/merge commit 证据。
- 当前仍有效的 PRD、架构、API、ADR、需求追踪矩阵、测试策略。
- 已知非阻断风险：旧学校版遗留测试、CRA/Browserslist/audit、生产部署/性能/安全扫描等不在 MVP gate 内的事项。

**验收标准**

- 新文件存在。
- 能明确说明 Task8~11 已被纳入最终 MVP 文档基线。
- 不再只停留在 `FGT-MVP-1.5` / Task7 作为最新基线。

---

### Task B：补 Task1~4 文档归档说明

**新增文件**

- `docs/development/family-growth-task1-4-design-archive.md`

**内容要求**

说明 Task1~4 没有独立 `taskN-design.md` 的原因和替代文档位置：

| Task | 主题 | 权威设计来源 |
| --- | --- | --- |
| Task1 | 产品范围、总体架构、API 契约冻结 | PRD、架构文档、API 文档、ADR、transition plan |
| Task2 | 后端基线和测试基线 | test baseline、test strategy、baseline manifest |
| Task3 | Family/Child/PIN/家庭权限 | PRD、架构 4.1/4.2/6、API Auth and Family、traceability |
| Task4 | GrowthTask/任务状态/家庭时区 | 架构 4.3、API Growth Tasks、ADR-0003/0004/0006/0007 |
| Task4.5 | 追溯设计基线评审 | design-baseline-review spec、design review、baseline manifest |

**验收标准**

- 新开发者能通过该文档理解：Task5~11 有独立详细设计；Task1~4 由总基线和 Task4.5 追溯评审承载。
- 文档链接指向真实存在的文件。

---

### Task C：收敛 Task8~11 总设计状态

**修改文件**

- `docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md`

**内容要求**

- 将 `APPROVED FOR TASK 8 IMPLEMENTATION` 改为当前事实状态，例如 `IMPLEMENTED / TASK 8-11 FINAL BASELINE INPUT`。
- 在开头增加说明：Task8 shell、Task9 parent pages、Task10 child web、Task11 E2E 已分别由后续设计/gate 文档关闭。
- 链接到 Task9/10/11 详细设计和 gate。

**验收标准**

- 文档状态不再误导为“只批准 Task8 实施”。
- Task8~11 的设计链路能从此文档跳转到最终 gate。

---

### Task D：统一 Task7 提醒设置契约

**修改文件**

- `docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md`

**内容要求**

- 将旧字段 `quietHoursStart`、`quietHoursEnd` 统一为嵌套对象：
  - `quietHours.start`
  - `quietHours.end`
- 明确两项必须成对提交，格式为 `HH:mm`。
- 与 `docs/api/family-learning-tracker-api.md` 当前契约保持一致。

**验收标准**

- `rg "quietHoursStart|quietHoursEnd" docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md` 无结果。
- Task7 设计、API、Task9 gate 中的提醒设置字段一致。

---

### Task E：补总体架构图和状态机

**修改文件**

- `docs/architecture/family-learning-tracker-architecture.md`

**需要补充的图/表**

1. 业务组件架构图：Parent Web、Child Web、Gateway、user/homework/progress/analytics/resource/notification、MongoDB、private media storage。
2. 服务组件职责图：每个服务的写模型、读依赖、公开路由和内部接口。
3. 前端组件图：Parent Auth、FamilyContext、ChildAuth、parent routes、child routes、API clients、resource hooks。
4. ER 图：Family、User、GrowthTask、GrowthLog、KnowledgePoint、FamilyMistake、WeeklyReport、ReminderSettings、StarLedgerEntry、Reward、MediaAsset、MediaReference。
5. 状态机图：
   - GrowthTask
   - MediaAsset / MediaReference
   - Star award
   - Reward redemption
   - WeeklyReport current/frozen
   - Child session / stale token

**验收标准**

- 架构文档中至少包含：
  - `flowchart` ≥ 3
  - `erDiagram` ≥ 1
  - `stateDiagram` ≥ 5
- 图中的状态和字段必须与 PRD/API/Task5~11 设计一致。

---

### Task F：补跨服务时序图

**新增文件**

- `docs/architecture/sequence-diagrams.md`

**需要补充的时序图**

1. 家长注册、创建家庭、添加孩子、设置 PIN。
2. 孩子 PIN 登录与后续 gateway 身份信封验证。
3. 创建任务、孩子完成、家长确认、星星发放。
4. GrowthLog / mistake / weekly report 聚合与历史周冻结。
5. 私有媒体上传、业务绑定、授权读取、删除和清理。
6. 提醒派生和部分降级。
7. 奖励创建、兑换、幂等重放。
8. Task11 端到端验收路径。

**验收标准**

- 新文件存在。
- 至少 8 个 `sequenceDiagram`。
- 每张图说明参与组件、关键 API、失败/降级点和数据一致性保证。

---

### Task G：建立设计资产追踪表

**新增文件**

- `docs/development/family-growth-design-asset-index.md`

**内容要求**

按需求 ID 建立索引：

| Requirement | 功能 | PRD | 架构/图 | 详细设计 | API | 测试用例 | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |

至少覆盖：

- 35 个 PRD/traceability 中的需求 ID。
- Task1~11。
- 核心图：组件图、状态机、时序图。

**验收标准**

- 35 个需求 ID 全部出现。
- 每个需求至少能定位到一个设计章节、一个 API 或非 API 说明、一个测试/gate 证据。

---

### Task H：补 API 文档中的相关设计索引

**修改文件**

- `docs/api/family-learning-tracker-api.md`

**内容要求**

在末尾增加“相关设计文档”章节，链接：

- PRD
- 总体架构
- 时序图
- Task1~4 归档说明
- Task5~11 详细设计
- Task5~11 测试用例和 gate
- 最终 MVP baseline

**验收标准**

- API 文档末尾有索引表。
- 所有链接可访问。

---

### Task I：补用户指南

**新增/修改文件**

- 修改 `docs/user-guide/README.md`
- 新增 `docs/user-guide/quick-start.md`
- 新增 `docs/user-guide/parent-guide.md`
- 新增 `docs/user-guide/child-guide.md`

**内容要求**

`quick-start.md` 覆盖：

- 注册家长
- 创建家庭
- 添加孩子并设置 PIN
- 创建任务
- 孩子登录并完成任务
- 家长确认并查看星星/周报

`parent-guide.md` 覆盖：

- 家庭和孩子管理
- 任务、记录、错题、媒体
- 周报、提醒、星星、奖励
- 常见问题和错误处理

`child-guide.md` 覆盖：

- PIN 登录
- 今日任务
- 任务完成反馈
- 错题复习
- 成就/奖励查看
- 退出和会话过期

**验收标准**

- 三份指南都存在。
- 指南不暴露内部 token、服务密钥、数据库字段等实现细节。
- 指南中的操作名称与当前 Web 导航和 API 行为一致。

---

### Task J：处理过时文档

**候选文件**

- `docs/api.md`
- `docs/deployment.md`
- `docs/dependencies.md`
- `docs/设计文档.md`
- `docs/项目依赖说明.md`
- `docs/test-coverage-management.md`

**执行原则**

不要直接删除。先执行引用扫描：

```bash
for f in docs/api.md docs/deployment.md docs/dependencies.md docs/设计文档.md docs/项目依赖说明.md docs/test-coverage-management.md; do
  rg -n "$(basename "$f")|$f" README.md docs backend frontend deployment package.json || true
done
```

然后按结果选择：

- 无引用且内容过时：删除。
- 有历史价值但非当前入口：移动到 `docs/development/archive/` 或标记 `SUPERSEDED`。
- 仍被入口引用：更新引用后再处理。

**验收标准**

- 不存在被 README/API/架构索引引用但文件已删除的断链。
- 根 `docs/*.md` 只保留当前有效入口或明确标记的兼容入口。

**执行结果（2026-07-14）**

- 六个候选文件的引用、内容和替代入口已完成审计。
- 删除四份无有效引用且与当前实现冲突的 API、部署和重复依赖文档。
- 学校版总体设计已归档并标记 `SUPERSEDED`；覆盖率产物说明已迁移到开发文档。
- 详细决策和替代入口见[历史文档归档](./archive/README.md)。

---

## 3. 推荐执行顺序

1. Task A：最终 MVP 基线。
2. Task B：Task1~4 归档说明。
3. Task C + D：状态和契约一致性修订。
4. Task E + F：总体架构图、状态机、时序图。
5. Task G + H：设计资产追踪和 API 索引。
6. Task I：用户指南。
7. Task J：过时文档处理。

---

## 4. 总验收命令

```bash
git diff --check
test -f docs/development/family-growth-baseline-v1.6-manifest.md
test -f docs/development/family-growth-task1-4-design-archive.md
test -f docs/development/family-growth-design-asset-index.md
test -f docs/architecture/sequence-diagrams.md
test -f docs/user-guide/quick-start.md
test -f docs/user-guide/parent-guide.md
test -f docs/user-guide/child-guide.md
rg -n "quietHoursStart|quietHoursEnd" docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md && exit 1 || true
rg -n "APPROVED FOR TASK 8 IMPLEMENTATION" docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md && exit 1 || true
```

---

## 5. 本计划不包含

- 不修改业务代码。
- 不重新跑完整后端/前端测试。
- 不新增功能需求。
- 不把执行计划目录下的所有历史 plan 逐行改写为最终设计文档。
- 不直接删除旧文档，除非完成引用扫描并确认无断链风险。
