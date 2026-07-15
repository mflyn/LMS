# 家庭成长跟踪项目文档

本目录是家庭成长跟踪 MVP 的权威文档入口。产品范围、架构、API、实现证据、
测试和部署结论必须指向仓库中的实际代码与可重复验证命令；历史 Task 文档只作为
追溯证据，不能覆盖当前基线。

## 核心导航

| 领域 | 权威入口 | 内容 |
| --- | --- | --- |
| 产品 | [家庭成长跟踪 PRD](./product/family-learning-tracker.md) | 用户、德智体美劳范围、35 项需求和非目标 |
| 总体设计 | [总体架构](./architecture/family-learning-tracker-architecture.md) | 服务、数据所有权、权限、状态机和部署边界 |
| 交互设计 | [时序图](./architecture/sequence-diagrams.md) | 家庭、任务、奖励、媒体和提醒的关键调用顺序 |
| API | [家庭成长 API 契约](./api/family-learning-tracker-api.md) | 请求、响应、错误码、权限和幂等规则 |
| 详细设计 | [设计资产索引](./development/family-growth-design-asset-index.md) | Requirement 与 Task 1-11 设计、代码和测试证据 |
| 需求追踪 | [需求追踪矩阵](./development/family-growth-requirement-traceability.md) | 35 项需求的设计、实现和验证状态 |
| 当前基线 | [FGT-MVP-1.6 基线候选](./development/family-growth-baseline-v1.6-manifest.md) | 当前实现证据、关闭结论和遗留边界 |
| 测试与发布 | [开发与测试入口](./development/README.md) / [统一发布 Gate](./development/family-growth-v1.6-release-gate.md) / [PDF 与多附件 Gate](./development/family-growth-mistake-pdf-multi-attachments-gate.md) | 本地命令、测试层次和发布判定 |
| 部署 | [部署入口](./deployment/README.md) | Compose、Ubuntu、Kubernetes、Secret 和回滚 |
| 使用 | [用户指南](./user-guide/README.md) | 家长和孩子的操作流程 |

## 文档结构

```text
docs/
├── product/       # 产品需求和范围
├── architecture/  # 总体架构、ADR 和时序图
├── api/           # 当前 API 契约
├── development/   # 详细设计、计划、测试用例、Gate 和基线证据
├── deployment/    # 当前部署与运维边界
├── superpowers/   # Task 5-11 已批准的设计与实施计划
└── user-guide/    # 家长和孩子用户指南
```

`docs/development/archive/` 保存已明确废弃或被新基线取代的材料。归档文档不得作为
当前 API、测试数量、发布状态或生产能力的依据。

## 权威关系

1. PRD 定义产品范围与需求编号。
2. 总体架构和 Task 详细设计定义实现约束。
3. API 契约定义前后端可观察行为。
4. 需求追踪矩阵连接需求、设计、代码和测试。
5. v1.6 manifest 与统一发布 Gate 记录当前候选基线和可重复证据。

发生冲突时，先停止修改并通过设计评审确定应更新的权威来源，不能只调整某一份
说明来掩盖代码或契约差异。

## 文档验证

修改权威文档后至少执行：

```bash
npm run docs:family:check
git diff --check
```

发布候选还必须执行 `npm run release:family`。文档 Gate 会检查本地链接、标题锚点、
35 项需求集合、基线证据以及三个 README 入口中的真实命令和过时模板内容。
