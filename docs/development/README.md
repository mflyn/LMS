# 家庭成长跟踪开发与测试

本目录保存家庭成长 MVP 的详细设计、实施计划、测试用例、评审记录和发布证据。
当前实现候选是 FGT-MVP-1.7，包含 38 项需求；Task 12 新增第二家长共管、
成员治理和家长成员关系原子性。

## 当前基线

- [FGT-MVP-1.6 基线候选](./family-growth-baseline-v1.6-manifest.md)
- [统一发布 Gate](./family-growth-v1.6-release-gate.md)
- [38 项需求追踪矩阵](./family-growth-requirement-traceability.md)
- [Task 1-12 设计资产索引](./family-growth-design-asset-index.md)
- [家庭成长测试策略](./family-growth-test-strategy.md)
- [测试质量修订记录](./family-growth-test-quality-remediation.md)
- [配置与基础设施修订记录](./family-growth-config-infra-remediation.md)
- [历史基线和废弃文档说明](./archive/README.md)

## Task 设计与验证

| 范围 | 设计/计划 | 测试与 Gate |
| --- | --- | --- |
| Task 1-4 | [设计归档说明](./family-growth-task1-4-design-archive.md) | [初始基线](./family-growth-baseline-manifest.md) |
| Task 5 | [详细设计](../superpowers/specs/2026-06-19-family-growth-task5-design.md) | [测试用例](./family-growth-task5-test-cases.md) / [Gate](./family-growth-task5-gate.md) |
| Task 6 | [详细设计](../superpowers/specs/2026-06-20-family-growth-task6-design.md) | [测试用例](./family-growth-task6-test-cases.md) / [Gate](./family-growth-task6-gate.md) |
| Task 7 | [详细设计](../superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md) | [测试用例](./family-growth-task7-test-cases.md) / [Gate](./family-growth-task7-gate.md) |
| Task 8 | [详细设计](../superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md) / [实施计划](../superpowers/plans/2026-07-10-family-growth-task8-parent-shell.md) | [测试用例](./family-growth-task8-test-cases.md) / [Gate](./family-growth-task8-gate.md) |
| Task 9 | [详细设计](../superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md) / [实施计划](../superpowers/plans/2026-07-10-family-growth-task9-parent-pages.md) | [测试用例](./family-growth-task9-test-cases.md) / [Gate](./family-growth-task9-gate.md) |
| Task 10 | [详细设计](../superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md) / [实施计划](../superpowers/plans/2026-07-11-family-growth-task10-child-web.md) | [测试用例](./family-growth-task10-test-cases.md) / [Gate](./family-growth-task10-gate.md) |
| Task 11 | [详细设计](../superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md) / [实施计划](../superpowers/plans/2026-07-12-family-growth-task11-e2e.md) | [测试用例](./family-growth-task11-test-cases.md) / [Gate](./family-growth-task11-gate.md) |
| Task 12 | [详细设计](../superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md) / [实施计划](../superpowers/plans/2026-07-16-family-growth-task12-co-parent.md) / [设计评审](./family-growth-task12-design-review.md) | [测试设计与用例](./family-growth-task12-test-cases.md) / [Gate](./family-growth-task12-gate.md) |
| 错题 PDF 与多附件增量 | [详细设计](../superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md) | [测试设计与用例](./family-growth-mistake-pdf-multi-attachments-test-cases.md) / [Gate](./family-growth-mistake-pdf-multi-attachments-gate.md) |

旧 Task Gate 只证明对应历史范围。FGT-MVP-1.7 发布判定使用已纳入 Task 12 的统一
发布 Gate；目标环境启用前还必须完成 Task 12 Gate 规定的数据修复检查。

## 自主学习 MVP 增量计划（T0 已关闭，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5 合成工程已关闭，T6-T9 待执行）

[自主学习 MVP 开发计划](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md)
将最新[系统设计](../architecture/family-self-directed-learning-system-design.md)中的六个工作包
拆成 T0–T9，包含代码落点、依赖、验证、家庭发布和四周试点。SL 编号仅为计划追踪编号，
不属于当前已实现的 38 项需求。DeepTutor、K12、长期项目等继续留在 MVP 验证后的储备范围。

[自主学习 MVP 增量 Gate](./family-self-directed-learning-mvp-gate.md)记录 T0 契约基线、
SL-01 至 SL-07 的 planned 状态、既有测试失败、T1 至 T9 证据以及工程完成与家庭验证的
独立结论。T0 不提供功能实现证据，不能据此开放新增写接口。

[T1 验收清单归并](./family-self-directed-learning-t1-acceptance-reconciliation.md)对应第 1–26 批与
原 35 个历史条目，区分独立实现、正式装配与后续任务边界；四个收尾工作包现已关闭，
不将历史复选框重复计为新开发任务，也不将混合条目的后续责任计为已完成。

[T1 总门禁关闭评审材料](./family-self-directed-learning-t1-acceptance-reconciliation.md#6-t1-总门禁关闭评审材料)
已核对 A01–A35；T1 后端工程总门禁及 R4 汇总项已获用户批准 CLOSED，裁决见 Gate §18.40 和归并表 §6.4。
仅限既定合成验收，不代表前端、真实家庭部署或 Git 发布完成。

[T2 详细设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-design.md)与
[T2 执行、测试及评审记录](./family-self-directed-learning-t2-execution.md)已获用户设计批准，
T2-1 基线修复与门禁 P2、T2-R 公开恢复后端及 owner/pending P2 已获用户验收关闭。
2026-10-24 用户批准 T2-G 未完成高级恢复/新回收后置，不再阻塞 T2-2 至 T2-6 页面开发；保留既有运行安全依赖。
当前批准见[执行记录 §17](family-self-directed-learning-t2-execution.md#17-t2-限定合成范围批准关闭2026-10-24)：三项 P2 CLOSED，T2 工程总门禁 APPROVED / CLOSED，关闭范围 ENGINEERING_SYNTHETIC_ONLY。最新全量仍 FAILED（3942/3943通过，D2B-05 后置），历史失败分别保留。真实设备 DEVICE_PENDING，T8_PENDING / NOT_AUTHORIZED，后置范围 REMAINDER_DEFERRED；不自动启动 T3–T9。
[T2 退出恢复与安全回收补充设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)
原已批准接口、模型、专用凭据、24 小时保留期及每批 50 个参数保留在历史设计；T2-G 已有部分实现，未完成部分后置，不代表真实环境已启用。

## 后续 AI 学习扩展边界

2026-10-26 已补充[DeepTutor/K12 最小路线](../superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md#9-deeptutor-与-k12-最小对接路线2026-10-26-补充)：
AI-0 可提前做单章节能力验证；AI-1～AI-3 和 K12-1 按基础闭环、家庭需求及独立授权启动。
T1～T9 不因此增加 AI 验收；本次只有路线文档，没有已执行的验证或接入。正式使用仍满足 T8，默认 T9 后启动。

[家庭 AI 学习平台设计](../architecture/family-ai-learning-platform-design.md)是后续
DeepTutor、K12-KGraph 和家长人工审核教学闭环的设计草案。
它不属于 Task 1～12 或当前 38 项需求；其中路由、模型和 feature flag 只有在新增
Requirement、详细设计、测试用例、迁移/回滚和独立 Gate 后才能进入实现基线。

## 环境要求

- Node.js 22，与 CI 和家庭服务生产镜像一致。
- 与根目录和 `frontend/web` lockfile 匹配的 npm。
- Docker Engine 与 Docker Compose v2。
- Git；完整发布 Gate 还需要安装 Playwright Chromium 的网络和系统能力。

家庭最小栈通过 Compose 提供 MongoDB 副本集和各 API 服务，本地开发不要求单独
安装 MongoDB、Redis 或消息队列。

## 安装依赖

```bash
npm ci
npm ci --prefix frontend/web
```

需要单独运行浏览器测试时安装 Chromium：

```bash
npx playwright install chromium
```

Linux CI 需要浏览器系统依赖时，按发布文档使用
`RELEASE_GATE_INSTALL_BROWSER_DEPS=1 npm run release:family`。

## 本地开发

启动家庭 API 栈，并把 Gateway 暴露到 Web 默认使用的 8000 端口：

```bash
FAMILY_GATEWAY_HOST_PORT=8000 npm run docker:family
npm start --prefix frontend/web
```

Web 默认运行在 `http://localhost:3000`。查看日志或停止服务：

```bash
npm run docker:family:logs
npm run docker:family:down
```

Compose 内置密钥只用于本地隔离开发。Ubuntu、Kubernetes、外部 Secret、数据备份
和生产边界见[部署入口](../deployment/README.md)。

## 测试命令

| 验证范围 | 命令 |
| --- | --- |
| 文档契约 | `npm run docs:family:check` |
| ESLint | `npm run lint` |
| 家庭后端回归 | `npm run test:family-regression` |
| 前端回归 | `npm run test:ci --prefix frontend/web -- --runInBand` |
| Task 11 集成与浏览器 E2E | `npm run test:task11` |
| Task 12 集成与浏览器 E2E | `npm run test:task12` |
| 旧学校兼容回归 | `npm run test:legacy-regression` |
| 完整发布候选 | `npm run release:family` |

前端默认测试排除 `frontend/web/src/__tests__/legacy/` 中的学校版遗留测试；新增家庭
功能测试必须进入默认 `test:ci` 通道。Task 11 E2E 使用真实内存 MongoDB 副本集、
真实 Gateway/API 和 Chromium，不以静态页面 smoke 代替业务验收。

## 目录职责

| 路径 | 职责 |
| --- | --- |
| `backend/gateway` | 家庭 API 入口、认证和服务代理 |
| `backend/services` | 用户、任务、进度、媒体、分析和提醒服务 |
| `backend/common` | 跨服务契约、模型、中间件和只读仓储 |
| `frontend/web` | 当前家长与孩子 Web 应用 |
| `frontend/mobile` | 旧移动端代码，不属于当前家庭 MVP Gate |
| `tests/e2e/task11` | 家庭业务浏览器验收 |
| `deployment/kubernetes` | 受控 Kubernetes 清单与外部 Secret 流程 |

## 变更流程

1. 从当前 `main` 建立隔离分支或 worktree。
2. 需求变化先更新 PRD、总体设计、详细设计和测试设计并完成评审。
3. 行为修改先增加能失败的聚焦测试，再实现并运行相关回归。
4. 提交发布候选前执行 `npm run release:family` 并保存失败诊断或成功摘要。
5. 通过 Pull Request 合并；不得把历史 Gate、跳过状态或人工口头确认当作发布证据。

当前仓库的 Compose 和 Kubernetes 资产是开发、验收与受控发布能力，不表示生产
环境已经部署。容量、TLS、监控、备份恢复、k6/ZAP 和回滚演练仍需目标环境签署。
