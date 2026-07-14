# Task 1~4 设计归档说明

**Document status:** CURRENT
**Archive scope:** Task 1、Task 2、Task 3、Task 4、Task 4.5
**Applies to baseline:** FGT-MVP-1.6 candidate
**Updated at:** 2026-07-13

## 1. 结论

Task 1~4 没有按后续阶段的命名方式建立独立 `taskN-design.md`，但这不表示这些
任务缺少需求或设计。它们是在独立详细设计模板固定之前完成的基础阶段，设计内容
分别由以下已批准或已验证的总基线资产承载：

- [产品需求文档](../product/family-learning-tracker.md)
- [总体架构](../architecture/family-learning-tracker-architecture.md)
- [API 契约](../api/family-learning-tracker-api.md)
- [ADR-0001~0007](../architecture/decisions/)
- [需求追踪矩阵](./family-growth-requirement-traceability.md)
- [测试策略](./family-growth-test-strategy.md)
- [Task 4.5 设计基线评审记录](./family-growth-design-review.md)
- [初始批准基线清单](./family-growth-baseline-manifest.md)

[transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md)
定义了 Task 1~11 的执行分解；Task 4.5 随后用统一评审规范、追踪矩阵和批准基线
对 Task 1~4 进行了追溯式设计审查。Task 5 开始形成按阶段维护独立详细设计、
编号测试用例和 gate 的稳定方式。

因此，新开发者不应补造与历史不符的 Task 1~4 独立设计文件。需要理解或修改
这些能力时，应使用本文列出的权威来源，并遵守第 2 节的冲突处理规则。

### 1.1 归档映射总览

| Task | 主题 | 权威设计来源 |
| --- | --- | --- |
| Task 1 | 产品范围、总体架构、API 契约冻结 | [PRD](../product/family-learning-tracker.md)、[总体架构](../architecture/family-learning-tracker-architecture.md)、[API](../api/family-learning-tracker-api.md)、[ADR](../architecture/decisions/)、[transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) |
| Task 2 | 后端基线和测试基线 | [test baseline](./family-tracker-test-baseline.md)、[test strategy](./family-growth-test-strategy.md)、[baseline manifest](./family-growth-baseline-manifest.md) |
| Task 3 | Family、Child、PIN、家庭权限 | [PRD](../product/family-learning-tracker.md)、[架构 4.1/4.2/6](../architecture/family-learning-tracker-architecture.md)、[API Auth and Family](../api/family-learning-tracker-api.md)、[traceability](./family-growth-requirement-traceability.md) |
| Task 4 | GrowthTask、任务状态、家庭时区 | [架构 4.3](../architecture/family-learning-tracker-architecture.md)、[API Growth Tasks](../api/family-learning-tracker-api.md)、[ADR-0003](../architecture/decisions/0003-family-local-date.md)、[ADR-0004](../architecture/decisions/0004-single-occurrence-growth-tasks.md)、[ADR-0006](../architecture/decisions/0006-signed-gateway-identity-envelope.md)、[ADR-0007](../architecture/decisions/0007-stable-weekly-report-history.md) |
| Task 4.5 | 追溯设计基线评审 | [design-baseline-review spec](../superpowers/specs/2026-06-18-family-growth-design-baseline-review-design.md)、[design review](./family-growth-design-review.md)、[baseline manifest](./family-growth-baseline-manifest.md) |

## 2. 文档权威性规则

同一主题出现不同表述时，按以下顺序确定当前契约：

1. [PRD](../product/family-learning-tracker.md) 决定产品范围、角色、功能和非目标。
2. [总体架构](../architecture/family-learning-tracker-architecture.md) 与
   [ADR](../architecture/decisions/) 决定服务边界、数据归属、状态语义和技术约束；
   专题 ADR 优先于总体架构中的概述。
3. [API 契约](../api/family-learning-tracker-api.md) 决定公开请求、响应、错误和权限
   边界，但不能自行扩大 PRD 范围。
4. [需求追踪矩阵](./family-growth-requirement-traceability.md)、测试用例和 gate
   证明需求的实现及验收状态，不用于创造新需求。
5. [批准基线清单](./family-growth-baseline-manifest.md) 冻结当时获批的资产和结论。
6. transition plan 仅负责实施顺序和任务拆分；当它与后续批准文档不一致时，
   以后续批准文档为准。

本文是导航和历史归档说明，不替代上述权威文档，也不改变已批准契约。

## 3. Task 1：产品、架构和 API 冻结

**主题：** 产品范围、总体架构、API 契约和迁移边界。

| 设计问题 | 权威来源 | 读取位置 |
| --- | --- | --- |
| 家庭版定位、德智体美劳范围、角色和非目标 | [PRD](../product/family-learning-tracker.md) | 第 1~6、10~13 节 |
| MVP 服务映射、跨服务读取和数据归属 | [总体架构](../architecture/family-learning-tracker-architecture.md) | 第 1~3、5、7、10 节 |
| 公开接口、统一错误、分页、日期和权限约定 | [API 契约](../api/family-learning-tracker-api.md) | 第 1、2、3、11 节及完整接口清单 |
| 复用现有服务和共享 MongoDB | [ADR-0001](../architecture/decisions/0001-reuse-existing-services.md) | 全文 |
| 家庭隔离和本地业务日期 | [ADR-0002](../architecture/decisions/0002-family-data-isolation.md)、[ADR-0003](../architecture/decisions/0003-family-local-date.md) | 全文 |
| 第一阶段执行拆分和兼容迁移 | [transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) | Scope Decision、Target MVP API Surface、Target Data Models、Task 1 |

Task 1 的交付物是跨模块基线，而不是一个可由单一服务详细设计描述的功能单元。
因此使用 PRD、架构、API 和 ADR 的组合比新增一个重复的 `task1-design.md` 更准确。

## 4. Task 2：后端和测试基线

**主题：** 建立可复现的后端现状、测试入口和后续任务准入依据。

| 设计问题 | 权威来源 | 读取位置 |
| --- | --- | --- |
| 根项目和目标服务的测试现状、失败分类、阻塞判断 | [测试基线](./family-tracker-test-baseline.md) | 第 1~5 节；后续准入复测见第 6~7 节 |
| 家庭隔离、确定性数据、安全场景和测试层级 | [测试策略](./family-growth-test-strategy.md) | 第 1~6 节 |
| 初始批准资产、评审角色和 Task 5 准入证据 | [初始基线清单](./family-growth-baseline-manifest.md) | 文档清单和 Approval Evidence |
| Task 2 实施边界 | [transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) | Task 2: Establish Backend Baseline and Test Harness |

Task 2 是工程基线任务，不定义新的产品状态机或公开 API。其权威产物是测试基线、
测试策略和基线清单，因此没有单独业务详细设计。

## 5. Task 3：Family、Child、PIN 和家庭权限

**主题：** 家庭、家长、孩子、PIN 登录/重置和家庭数据权限。

| 设计问题 | 权威来源 | 读取位置 |
| --- | --- | --- |
| 家庭账号、孩子档案和孩子 PIN 的产品行为 | [PRD](../product/family-learning-tracker.md) | 第 3、5.1、9.1~9.3、10.4 节 |
| Family/User 模型、身份信任边界和权限矩阵 | [总体架构](../architecture/family-learning-tracker-architecture.md) | 第 3.3、4.1、4.2、5、6 节 |
| 家长注册/登录、家庭、孩子、PIN 和退出契约 | [API 契约](../api/family-learning-tracker-api.md) | 第 2 节 Auth and Family |
| 家庭隔离、业务日期和网关身份信封 | [ADR-0002](../architecture/decisions/0002-family-data-isolation.md)、[ADR-0003](../architecture/decisions/0003-family-local-date.md)、[ADR-0006](../architecture/decisions/0006-signed-gateway-identity-envelope.md) | 全文 |
| `FR-FAM-*`、`FR-CHILD-*` 和安全/数据需求覆盖 | [需求追踪矩阵](./family-growth-requirement-traceability.md) | 对应需求行 |
| 模型、权限、PIN、稳定错误和网关发现项 | [设计评审](./family-growth-design-review.md) | `FGT-T3-*`、`FGT-GW-*`、`FGT-FR-*` |
| Task 3 实施边界 | [transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) | Task 3: Add Family and Child Domain Model |

Task 3 的模型与接口设计在 Task 4.5 被逐项追溯，发现项全部关闭后才允许进入
Task 5。需求追踪矩阵和评审记录共同承担了独立详细设计通常包含的验收映射。

## 6. Task 4：GrowthTask、状态和家庭时区

**主题：** 五维成长任务、任务状态机、家庭 LocalDate、身份信任和周报历史语义。

| 设计问题 | 权威来源 | 读取位置 |
| --- | --- | --- |
| 五维体系、成长任务和 MVP 验收行为 | [PRD](../product/family-learning-tracker.md) | 第 5.2、5.3、9.4、10.4 节 |
| GrowthTask 模型、状态机、日期和权限 | [总体架构](../architecture/family-learning-tracker-architecture.md) | 第 3.2、3.3、4.3、5、6 节 |
| 创建、查询、完成、确认、编辑和取消/归档契约 | [API 契约](../api/family-learning-tracker-api.md) | 第 1.1、3 节 Growth Tasks |
| 家庭 LocalDate | [ADR-0003](../architecture/decisions/0003-family-local-date.md) | 全文 |
| 单次任务语义 | [ADR-0004](../architecture/decisions/0004-single-occurrence-growth-tasks.md) | 全文 |
| 签名身份信封 | [ADR-0006](../architecture/decisions/0006-signed-gateway-identity-envelope.md) | 全文 |
| 稳定周报历史对任务取消/归档语义的约束 | [ADR-0007](../architecture/decisions/0007-stable-weekly-report-history.md) | 全文 |
| `FR-TASK-*`、`NFR-TIME-001` 和安全/数据需求覆盖 | [需求追踪矩阵](./family-growth-requirement-traceability.md) | 对应需求行 |
| 状态、分页、时区、家庭隔离和网关发现项 | [设计评审](./family-growth-design-review.md) | `FGT-T4-*`、`FGT-GW-*`、`FGT-FR-*` |
| Task 4 实施边界 | [transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) | Task 4: Convert Homework to Growth Tasks |

ADR-0007 在后续 Task 6 周报实现时补充并收紧了 Task 4 的取消/归档语义。它是
当前解释历史任务行为的权威决策，不应以早期计划文字覆盖。

## 7. Task 4.5：追溯设计基线评审

**主题：** 对 Task 1~4 的需求、设计、API、代码、测试和安全边界进行追溯式评审。

| 评审资产 | 作用 |
| --- | --- |
| [设计基线评审规范](../superpowers/specs/2026-06-18-family-growth-design-baseline-review-design.md) | 定义基线文档体系、需求编号、详细设计最低要求、评审状态和 Task 5 准入条件 |
| [设计基线评审记录](./family-growth-design-review.md) | 记录 Task 3/4、gateway 和最终复审发现，及其关闭证据和签署结果 |
| [需求追踪矩阵](./family-growth-requirement-traceability.md) | 将每个 Task 1~4 需求映射到 PRD、架构/ADR、API、代码和测试 |
| [初始批准基线清单](./family-growth-baseline-manifest.md) | 冻结获批资产、哈希、角色、风险和 Task 5 准入结论 |
| [Task 4.5 实施计划](../superpowers/plans/2026-06-18-family-growth-design-baseline-review.md) | 记录评审执行步骤，不覆盖规范和最终评审记录 |
| [transition plan](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) | Task 4.5: Design Baseline Review Gate |

Task 4.5 的 `APPROVED` 结论说明 Task 1~4 已通过统一设计审查。后续发现通过同一
评审记录的 Post-approval PR remediation 继续关闭，而不是另建互相冲突的历史
Task 1~4 设计版本。

## 8. Task 5~11 的详细设计分界

从 Task 5 起，功能阶段使用可独立定位的详细设计。Task 8 使用 Task 8~11 的
前端总设计作为本阶段设计，Task 9~11 再分别补充阶段详细设计。

| Task | 独立详细设计 |
| --- | --- |
| Task 5 | [Task 5 Growth Logs, Knowledge Points and Rewards](../superpowers/specs/2026-06-19-family-growth-task5-design.md) |
| Task 6 | [Task 6 Private Media, Mistakes and Weekly Reports](../superpowers/specs/2026-06-20-family-growth-task6-design.md)；媒体引用、头像和任务附件另有同目录分阶段补充设计 |
| Task 7 | [Task 7 Lightweight Family Notifications](../superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md) |
| Task 8 | [Task 8~11 Frontend Design Baseline](../superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md) |
| Task 9 | [Task 9 Parent MVP Pages Design](../superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md) |
| Task 10 | [Task 10 Child Web Entry Design](../superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md) |
| Task 11 | [Task 11 Family End-to-End Design](../superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md) |

各阶段的编号测试用例和最终 gate 位于 [开发文档目录](./)，最终 MVP 关闭状态见
[FGT-MVP-1.6 基线候选](./family-growth-baseline-v1.6-manifest.md)。

## 9. 新开发者建议阅读顺序

1. 阅读 [PRD](../product/family-learning-tracker.md)，确认 MVP 范围和非目标。
2. 阅读 [总体架构](../architecture/family-learning-tracker-architecture.md) 和相关 ADR，
   确认服务、模型、状态和权限边界。
3. 阅读 [API 契约](../api/family-learning-tracker-api.md)，确认公开行为。
4. 使用本文第 3~7 节定位 Task 1~4 的历史设计和评审证据。
5. 使用第 8 节进入 Task 5~11 的阶段详细设计，再查看对应测试用例和 gate。
6. 使用 [需求追踪矩阵](./family-growth-requirement-traceability.md) 验证需求到实现的
   闭环，并以 [v1.6 基线候选](./family-growth-baseline-v1.6-manifest.md) 判断当前状态。

## 10. 维护规则

- 不为美化文件命名而复制 Task 1~4 的既有设计内容。
- 修订产品行为时同步更新 PRD、架构/ADR、API、追踪矩阵、测试和新基线。
- 历史评审记录只追加纠正说明，不重写当时结论。
- transition plan 保留为执行历史，不作为覆盖后续批准契约的依据。
- 本归档中的路径或章节发生变化时，必须同步更新链接并执行文档链接检查。
