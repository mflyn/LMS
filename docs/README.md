# 家庭自主学习项目文档

本目录是家庭自主学习的权威文档入口：长期目标已确认，家庭成长跟踪 FGT-MVP-1.7 是已实现基础，
自主学习和AI增量已有分批实现与验收，不能继续将全部增量概括为待开发；历史38/38也不代表后续增量完成。产品范围、架构、API、实现证据、
测试和部署结论必须指向仓库中的实际代码与可重复验证命令；历史 Task 文档只作为
追溯证据，不能覆盖当前基线。

## 核心导航

2026-11-21现状入口：[功能规格SRS（文档已批准）](./product/family-learning-tracker-current-srs.md)。
本批SRS、指南及待办记录已复审通过并获用户批准，见[批准记录](./development/mvp-current-followups.md#6-文档复审与用户批准2026-11-21)；仅文档收口，不关闭业务、真人／真机或发布门禁。
旧规划中的PLANNED、AI仅A批等按原日期保留；各批现状以SRS所关联的代码、设计和后续批准记录为准。
已实现、运行开关、真人/真机验收和后置项分别列示，
不以最新成功覆盖历史失败或关闭T4/T8/AI-1等门禁。

| 领域 | 权威入口 | 内容 |
| --- | --- | --- |
| 产品 | [家庭成长跟踪 PRD](./product/family-learning-tracker.md) | 用户、德智体美劳范围、38 项需求和非目标 |
| 功能现状 | [功能规格SRS](./product/family-learning-tracker-current-srs.md) | 本地main 9bf042c8已实现功能、分批历史运行状态、待真人/真机及后置范围；不是新产品授权 |
| 总体设计 | [总体架构](./architecture/family-learning-tracker-architecture.md) | 服务、数据所有权、权限、状态机和部署边界 |
| 交互设计 | [时序图](./architecture/sequence-diagrams.md) | 家庭、任务、奖励、媒体和提醒的关键调用顺序 |
| API | [家庭成长 API 契约](./api/family-learning-tracker-api.md) | 请求、响应、错误码、权限和幂等规则 |
| 详细设计 | [设计资产索引](./development/family-growth-design-asset-index.md) | Requirement 与 Task 1-12 设计、代码和测试证据 |
| 需求追踪 | [需求追踪矩阵](./development/family-growth-requirement-traceability.md) | 38 项需求的设计、实现和验证状态 |
| 历史基线 | [FGT-MVP-1.6 基线候选](./development/family-growth-baseline-v1.6-manifest.md) | Task 12 前的实现证据、关闭结论和遗留边界 |
| 共管基线 | [Task 12 第二家长共管 Gate](./development/family-growth-task12-gate.md) | FGT-MVP-1.7 共管实现与历史验收；后续当前候选见功能SRS和增量Gate |
| 测试与发布 | [开发与测试入口](./development/README.md) / [统一发布 Gate](./development/family-growth-v1.6-release-gate.md) / [PDF 与多附件 Gate](./development/family-growth-mistake-pdf-multi-attachments-gate.md) | 本地命令、测试层次和发布判定 |
| 部署 | [部署入口](./deployment/README.md) | Compose、Ubuntu、Kubernetes、Secret 和回滚 |
| 使用 | [用户指南](./user-guide/README.md) | 家长和孩子的操作流程 |
| 自主学习理论与系统设计 | [理论与总体方案](./research/family-self-directed-learning-theory-and-program.md) / [系统设计](./architecture/family-self-directed-learning-system-design.md) | 长期方向、原规划与分龄约束；已实现部分和未实施储备按当前证据分开 |
| 自主学习增量计划 | [MVP 开发计划](./superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md) / [增量 Gate](./development/family-self-directed-learning-mvp-gate.md) | T0–T9分批实施与验收；T4/T8等未关闭，不把工程验收当家庭使用效果通过 |
| AI 学习增量 | [AI-1 最小设计](./superpowers/specs/2026-10-31-family-ai1-minimal-design.md) / [完整平台草案](./architecture/family-ai-learning-platform-design.md) / [最小对接路线 §9](./superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充) | AI1/2/3已有最小工程实现；AI2/3仅限定合成验收，AI-1 OPEN；已核对的历史实例记录均off，真实模型准入另验，不阻塞基础MVP |
| 拟议 AI 机器契约 | [AI 契约目录](./contracts/) | `CurriculumRef`、错因、教学制品、状态机和最终收敛命令的唯一字段真相；仍属草案 |

## 文档结构

```text
docs/
├── product/       # 产品需求和范围
├── architecture/  # 总体架构、ADR 和时序图
├── research/      # 拟议教育理论、家庭运行与试点评估方案
├── contracts/     # 拟议 AI 扩展的机器可读 JSON 契约
├── api/           # 当前 API 契约
├── development/   # 详细设计、计划、测试用例、Gate 和基线证据
├── deployment/    # 当前部署与运维边界
├── ThinkPad_DeepTutor_K12_部署手册/ # 拟议 AI 扩展的低资源部署验证
├── superpowers/   # Task 5-12 已批准的设计与实施计划
└── user-guide/    # 家长和孩子用户指南
```

`docs/development/archive/` 保存已明确废弃或被新基线取代的材料。归档文档不得作为
当前 API、测试数量、发布状态或生产能力的依据。

## 权威关系

1. PRD 定义产品范围与需求编号。
2. 总体架构和 Task 详细设计定义实现约束。
3. API 契约定义前后端可观察行为。
4. 需求追踪矩阵连接需求、设计、代码和测试。
5. v1.6 manifest 记录历史基线；统一发布 Gate 和 Task 12 Gate 记录 v1.7 候选证据。
6. 自主学习是已确认长期主目标，以 PRD 为产品权威；理论解释依据，系统设计定义本轮及后续实现边界。
   正式API及其已批准增量定义可观察契约；系统设计不再复制完整请求体。原PLANNED不覆盖后续实现记录。
   AI最小实现与完整平台草案分别追踪，不能把已有路由、合成验收或CI通过当作真实模型准入或发布总门禁关闭。
7. 需求/设计/开发线程完成修订和开发自测；测试/评审线程负责独立复评及测试执行，开发自审不替代独立复评。

发生冲突时，先停止修改并通过设计评审确定应更新的权威来源，不能只调整某一份
说明来掩盖代码或契约差异。

## 文档验证

修改权威文档后至少执行：

```bash
npm run docs:family:check
git diff --check
```

发布候选还必须执行 `npm run release:family`。文档 Gate 分别报告已批准基线、4 份拟议自主
学习文档和拟议 AI 扩展：基线检查本地链接、标题锚点、38 项需求、实现状态和证据；自主
学习检查 SL-01 至 SL-07、T0 至 T9、planned 状态、版本/幂等/迁移契约；AI 扩展检查 8 份
草案文档、22 份机器契约、代码块/图表结构、审核门禁、DeepTutor 安全与未知结果边界、
outbox 字段以及 K12 代码/数据版本固定。草案通过 Gate 不代表已经实现或获准发布。
