# 家庭成长跟踪开发与测试

本目录保存家庭成长 MVP 的详细设计、实施计划、测试用例、评审记录和发布证据。
当前开发范围以 Task 1-11、35 项需求和 FGT-MVP-1.6 基线候选为准。

## 当前基线

- [FGT-MVP-1.6 基线候选](./family-growth-baseline-v1.6-manifest.md)
- [统一发布 Gate](./family-growth-v1.6-release-gate.md)
- [35 项需求追踪矩阵](./family-growth-requirement-traceability.md)
- [Task 1-11 设计资产索引](./family-growth-design-asset-index.md)
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
| 错题 PDF 与多附件增量 | [详细设计](../superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md) | [测试设计与用例](./family-growth-mistake-pdf-multi-attachments-test-cases.md) / [Gate](./family-growth-mistake-pdf-multi-attachments-gate.md) |

旧 Task Gate 只证明对应历史范围。当前发布判定必须使用 v1.6 统一发布 Gate，不能
用某个服务、页面或旧基线的单项结果替代。

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
