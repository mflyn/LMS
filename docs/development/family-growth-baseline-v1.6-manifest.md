# 家庭成长跟踪最终 MVP 基线清单 v1.6

**baselineId:** FGT-MVP-1.6
**status:** READY_FOR_REVIEW
**supersedesOnApproval:** FGT-MVP-1.5
**scope:** Task 1~11 家庭成长跟踪 MVP
**implementationEvidenceCommit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`
**statusUpdatedAt:** 2026-07-14
**owner:** linmingfeng
**technicalReview:** UNSIGNED
**productApproval:** UNSIGNED
**baselineTag:** NOT_CREATED

本清单是 Task 1~11 完成后的最终 MVP 基线候选。Task 8~11 的功能、测试和
远端 CI 均已通过各自 gate 并合并到 `main`；本清单尚未经过产品负责人签署，
因此状态为 `READY_FOR_REVIEW`，不得提前标记为 `APPROVED` 或创建不可变标签。
在本清单获批前，`FGT-MVP-1.5` 仍是最新已签署基线；v1.6 是覆盖完整 MVP 的
当前评审候选。

本清单不预写自身未来的合并哈希。`implementationEvidenceCommit` 是纳入第 7
阶段文档闭环前、已在 clean worktree 和 `main` 各完整执行统一发布门禁的实现
提交；本清单的合并提交以 Git 历史为准。自动审计不等于独立技术评审签字，也不
等于产品批准。

## 1. MVP 范围关闭

| Task | 交付范围 | 需求/基线状态 | 主要关闭证据 |
| --- | --- | --- | --- |
| Task 1 | 产品范围、总体架构、API 和迁移边界 | 已批准 | [PRD](../product/family-learning-tracker.md)、[总体架构](../architecture/family-learning-tracker-architecture.md)、[API 契约](../api/family-learning-tracker-api.md)、[迁移计划](../superpowers/plans/2026-06-17-family-learning-tracker-transition.md) |
| Task 2 | 后端与测试基线 | 已批准 | [测试策略](./family-growth-test-strategy.md)、[测试基线](./family-tracker-test-baseline.md)、[初始基线清单](./family-growth-baseline-manifest.md) |
| Task 3 | Family、Child、PIN 与家庭权限 | `COVERED` | [需求追踪矩阵](./family-growth-requirement-traceability.md)、[Task 4.5 设计评审](./family-growth-design-review.md) |
| Task 4/4.5 | GrowthTask、家庭时区、身份信封与追溯评审 | `COVERED` / 已批准 | [架构与 ADR](../architecture/family-learning-tracker-architecture.md)、[设计评审](./family-growth-design-review.md)、[FGT-MVP-1](./family-growth-baseline-manifest.md) |
| Task 5 | 学习记录、知识点、星星和奖励 | 已批准 | [Task 5 设计](../superpowers/specs/2026-06-19-family-growth-task5-design.md)、[测试用例](./family-growth-task5-test-cases.md)、[gate](./family-growth-task5-gate.md)、[FGT-MVP-1.3](./family-growth-baseline-v1.3-manifest.md) |
| Task 6 | 私有媒体、错题和周报 | 已批准 | [Task 6 设计](../superpowers/specs/2026-06-20-family-growth-task6-design.md)、[测试用例](./family-growth-task6-test-cases.md)、[gate](./family-growth-task6-gate.md)、[FGT-MVP-1.4](./family-growth-baseline-v1.4-manifest.md) |
| Task 7 | 家庭提醒与提醒设置 | 已批准 | [Task 7 设计](../superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md)、[测试用例](./family-growth-task7-test-cases.md)、[gate](./family-growth-task7-gate.md)、[FGT-MVP-1.5](./family-growth-baseline-v1.5-manifest.md) |
| Task 8 | 家长 Web 应用壳 | `FR-UI-001` 阶段关闭 | [设计](../superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md)、[测试用例](./family-growth-task8-test-cases.md)、[gate](./family-growth-task8-gate.md) |
| Task 9 | 家长 MVP 七个业务页面 | `FR-UI-001` `COVERED` | [详细设计](../superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md)、[测试用例](./family-growth-task9-test-cases.md)、[gate](./family-growth-task9-gate.md) |
| Task 10 | 孩子 PIN 登录与孩子端页面 | `FR-UI-002` `COVERED` | [详细设计](../superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md)、[测试用例](./family-growth-task10-test-cases.md)、[gate](./family-growth-task10-gate.md) |
| Task 11 | 家长/孩子跨角色真实服务 E2E | `FR-FLOW-001` `COVERED` | [详细设计](../superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md)、[测试用例](./family-growth-task11-test-cases.md)、[gate](./family-growth-task11-gate.md) |

需求追踪矩阵中的家庭、孩子、任务、记录、知识点、错题、周报、媒体、奖励、
提醒、家长 UI、孩子 UI 和完整流程需求均为 `COVERED`。v1.6 不新增需求，也不
扩大已经批准的 MVP 功能边界。

当前 35 项需求的逐行代码、聚焦测试和统一门禁证据见
[需求追踪矩阵](./family-growth-requirement-traceability.md)；需求、总体/详细设计、
API、图资产、测试和 Gate 的完整导航见
[设计资产索引](./family-growth-design-asset-index.md)。

## 2. Task 8~11 远端关闭证据

| Task | Gate | Pull request | 必需 CI | Merge commit | 结论 |
| --- | --- | --- | --- | --- | --- |
| Task 8 | [PASSED](./family-growth-task8-gate.md) | [#6](https://github.com/mflyn/LMS/pull/6) | [Family Regression 29074813375](https://github.com/mflyn/LMS/actions/runs/29074813375) `SUCCESS` | `6e5803e8c0e937889aad49f94bac66c4d8b6b995` | 已合并 |
| Task 9 | [PASSED](./family-growth-task9-gate.md) | [#8](https://github.com/mflyn/LMS/pull/8) | [Family Regression 29144249888](https://github.com/mflyn/LMS/actions/runs/29144249888) `SUCCESS` | `1923caa11ed8b4b6328a91c1cb7adb181bc5f9ad` | 已合并 |
| Task 10 | [PASSED](./family-growth-task10-gate.md) | [#11](https://github.com/mflyn/LMS/pull/11) | [Family Regression 29155432245](https://github.com/mflyn/LMS/actions/runs/29155432245) `SUCCESS` | `6f62934b5d2237fa3ce734d5800defe856102ff7` | 已合并 |
| Task 11 | [PASSED / MERGE AUTHORIZED](./family-growth-task11-gate.md) | [#14](https://github.com/mflyn/LMS/pull/14) | [Final Family Regression 29188235632](https://github.com/mflyn/LMS/actions/runs/29188235632) `SUCCESS`; gate acceptance run [29188066334](https://github.com/mflyn/LMS/actions/runs/29188066334) `SUCCESS` | `29991555b305ed4931d36f5b7a210e6bc32a2459` | 已合并并完成主干审计 |

PR 状态、CI 结论和 merge commit 已于 2026-07-13 从 GitHub 与本地
`origin/main` 交叉核实。Task 8~11 不再是仅有设计或本地验证的计划项。

## 3. 当前权威产品与设计资产

| 资产 | 路径 | 当前用途 |
| --- | --- | --- |
| 产品需求 | [family-learning-tracker.md](../product/family-learning-tracker.md) | 家庭成长 MVP 范围、角色、德智体美劳闭环和非目标 |
| 总体架构 | [family-learning-tracker-architecture.md](../architecture/family-learning-tracker-architecture.md) | 服务边界、数据归属、组件图、ER、状态机、权限和部署边界 |
| 跨服务时序 | [sequence-diagrams.md](../architecture/sequence-diagrams.md) | Task 1~11 核心流程、失败/降级点和一致性保证 |
| API 契约 | [family-learning-tracker-api.md](../api/family-learning-tracker-api.md) | 家长、孩子、任务、记录、错题、周报、媒体、提醒和奖励接口 |
| 架构决策 | [decisions/](../architecture/decisions/) | ADR-0001~0007：服务复用、家庭隔离、LocalDate、任务语义、星星幂等、身份信封和周报历史 |
| 需求追踪 | [family-growth-requirement-traceability.md](./family-growth-requirement-traceability.md) | 需求到设计、API、代码、测试和 gate 的主追踪矩阵 |
| 设计资产索引 | [family-growth-design-asset-index.md](./family-growth-design-asset-index.md) | 35 项 Requirement 到 PRD、架构/图、详细设计、API、测试和 gate 的统一导航 |
| 用户指南 | [user-guide/](../user-guide/) | 家庭成长指南入口、快速上手、家长操作和孩子操作说明 |
| 历史文档治理 | [archive/](./archive/) | Task J 旧文档引用扫描、删除、迁移和替代依据 |
| 测试策略 | [family-growth-test-strategy.md](./family-growth-test-strategy.md) | 家庭隔离、状态机、网关、服务集成和 E2E 的质量策略 |
| Task 1~4 设计归档 | [family-growth-task1-4-design-archive.md](./family-growth-task1-4-design-archive.md) | 解释早期任务的权威设计来源、Task 4.5 追溯评审和 Task 5 以后的详细设计分界 |
| Task 4.5 评审 | [family-growth-design-review.md](./family-growth-design-review.md) | Task 1~4 总基线及追溯评审结论 |
| Task 5~11 详细设计 | [specs/](../superpowers/specs/) | 各阶段已批准设计与实施边界 |
| Task 5~11 测试/gate | [development/](./) | 编号测试用例、评审记录和关闭证据 |

本清单的功能、测试和合并证据以 `implementationEvidenceCommit` 为基准。补充计划 Task B
已增加 Task 1~4 归档导航，Task C+D 已收敛 Task 8~11 设计状态并统一 Task 7
提醒设置契约，Task E+F 已补齐业务/服务/前端组件图、ER、状态机和 8 条跨服务
时序，Task G+H 已补齐 35 项需求设计资产追踪和 API 反向设计索引，Task I 已
补齐快速上手、家长和孩子用户指南，Task J 已完成旧文档引用扫描、迁移和清理。
这些文档治理变更不得改变已关闭的 MVP 行为或绕过变更评审。

## 4. 当前统一质量证据

`npm run release:family` 已在 Stage 6 clean feature commit 和合并后的 clean
`main` 提交各执行一次；Stage 7 候选及其合并提交又在文档契约加入同一命令后
各执行一次。本次文档治理候选继续通过同一命令重验；当前结果为：

| Gate | 当前同一次运行结果 |
| --- | --- |
| 文档契约 | 17 份权威文档、35 项需求、链接/占位符/集合一致性检查通过 |
| Backend family regression | 70 suites / 756 tests，通过 |
| Task 11 integration | 4 suites / 6 tests，通过 |
| Frontend CI | 25 suites / 156 tests，通过且无意外 console warning/error |
| Frontend production build | 通过 |
| Task 11 browser | 4 Chromium tests，1 worker、0 retries，通过 |
| Compose | 7 个镜像构建成功；MongoDB 和 7 个应用服务共 8 个服务健康 |
| Public media smoke | 经 gateway 注册家长、建家庭/孩子、上传并绑定 91-byte PNG、签名读取通过 |
| Hygiene/cleanup | Git clean；保存诊断；删除测试容器和网络且不删除持久卷 |

详细命令、两次运行提交和运行时证据见
[v1.6 统一发布 Gate](./family-growth-v1.6-release-gate.md)。Task 8~11 文档中的
较小套件数是各 Task 首次关闭时的历史快照，不再代表当前基线总数。

## 5. 七阶段修复关闭与剩余边界

| Stage | 合并到 `main` | 关闭结论 |
| --- | --- | --- |
| 1 生产运行时 | `1520c9d4` | Node 22 根上下文镜像、生产 composition root、私有媒体路由和 Ubuntu Compose 已关闭 |
| 2 数据不变量 | `2e588780` | Family/Child 与错题历史使用事务；待发星星任务禁止归档；关系修复命令可审计 |
| 3 API 契约 | `c7c062e8` | 家庭、登出、提醒、共享读取边界和孩子档案字段统一 |
| 4 家长功能 | `1df6a3af` | 完整孩子档案/头像和知识能力点工作流关闭 |
| 5 质量门禁 | `025ada92` | ESLint 9、异步导航、React `act()` 和 Router 警告治理关闭 |
| 6 发布门禁 | `30d0e7bb` | clean install、测试、构建、Compose health 和媒体 smoke 统一为单命令 |
| 7 证据基线 | 本清单所在合并提交 | 35 项需求、设计资产、部署指南和当前 Gate 证据闭环 |

以下事项是明确的生产运维或后续维护边界，不是已实现 MVP 的功能缺口：

| 边界 | 当前结论 |
| --- | --- |
| 旧学校版 | 模型和路由保留，测试项目与家庭默认门禁隔离；回滚通过停用家庭路由完成，不删除数据 |
| 依赖维护 | clean install 报告 root 27 项、frontend 60 项既有审计告警；禁止无评审的强制升级，应单独升级并重跑统一门禁 |
| CRA/Browserslist | 数据龄提示仍存在；生产构建已通过，工具链升级独立处理 |
| 浏览器矩阵 | 强制 MVP 门禁为 Chromium 桌面和 360x800；Safari、Firefox、原生移动端不在当前验收范围 |
| 性能和安全扫描 | k6/ZAP 是受控生产发布活动，不替代当前功能、权限、隐私和构建门禁 |
| 生产拓扑 | 仓库 Compose 是开发/验收拓扑；生产仍需托管或多成员 MongoDB、外部 Secret、TLS、监控、备份恢复和运维签署 |
| Kubernetes 发布 | 仓库提供最小工作负载和外部 Secret 边界；集群变更、容量和回滚由目标环境发布流程验收 |

## 6. 审批与变更控制

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Automated technical audit | Codex | EVIDENCE_COMPLETE | 2026-07-14 |
| Independent technical reviewer | UNSIGNED | REQUIRED | — |
| Product owner | UNSIGNED | REQUIRED | — |

批准 v1.6 时必须：

1. 将 `status` 更新为 `APPROVED`，记录产品批准人和时间。
2. 确认 `implementationEvidenceCommit` 及本清单的合并提交仍包含表中全部 gate；若主干已改变，
   重新执行差异审计并更新证据提交。
3. 创建项目约定的不可变基线标签；标签创建前不得填写 `baselineTag`。
4. 后续功能或契约变更建立新基线，不覆盖 v1.6 历史记录。
