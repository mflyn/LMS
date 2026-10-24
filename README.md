# 家庭自主学习系统

长期主目标是帮助孩子逐步学会自主计划、执行、自检、求助、订正和复盘，家长提供适龄支持。
家庭成长跟踪是已实现基础，继续覆盖德智体美劳；不以学校管理、打卡排名或 AI 自动决策为目标。

当前实现基础为 FGT-MVP-1.7（历史 Task 1–12、38/38 COVERED）。当前自主学习增量 SL-01 至 SL-07
全部 PLANNED：T0 契约及评审门禁已完成，T1 后端及 T2 页面工程已在限定合成范围验收关闭，T3–T9 待执行；真机 DEVICE_PENDING，高级恢复与新回收 REMAINDER_DEFERRED，最新全量仍有 D2B-05 失败，不表示整体增量或自主学习成效已经验证，也不授权真实部署。产品范围、实现证据和发布边界分别以
[产品需求](./docs/product/family-learning-tracker.md)、
[FGT-MVP-1.6 基线候选](./docs/development/family-growth-baseline-v1.6-manifest.md)
和[统一发布 Gate](./docs/development/family-growth-v1.6-release-gate.md)为准。
当前增量以[开发计划](./docs/superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md)和
[增量 Gate](./docs/development/family-self-directed-learning-mvp-gate.md)为准；Task 12 证据见
[第二家长 Gate](./docs/development/family-growth-task12-gate.md)。

## MVP 能力

- 家庭账号、孩子档案和家长/孩子身份隔离。
- 德育、智育、体育、美育、劳动五类成长任务。
- 每日任务执行、成长记录、知识点和错题复盘。
- 家长确认、孩子自评、周报和家庭反馈。
- 星星账户、家庭奖励兑换和提醒设置。
- 任务、记录、错题和周报的私有媒体附件。
- 家长 Web 工作台和孩子 PIN 登录入口。

旧学校版服务、角色枚举和部分代码仍为兼容与回滚保留，但教师、班级、会议、
群聊和学校管理不进入家庭 MVP 导航或发布验收。仓库中的移动端代码也不属于
当前 MVP 门禁。

## 技术与服务

| 层次 | 当前实现 |
| --- | --- |
| Web | React 18、React Router 6、Ant Design 5、Zustand；以 JavaScript 为主，少量 TypeScript |
| API | Node.js 22、Express 4、Mongoose 8、JWT 和网关身份信封 |
| 数据 | MongoDB `rs0` 副本集；业务数据按服务划分写入所有权 |
| 测试 | Jest、Supertest、React Testing Library、Playwright Chromium |
| 本地部署 | Docker Compose 家庭最小栈和 Ubuntu 家庭服务器栈 |
| 可选部署 | Kubernetes 清单与外部 Secret 流程，需目标环境单独审批 |

家庭最小栈包含 gateway、user-service、homework-service、progress-service、
resource-service、analytics-service、notification-service 和 MongoDB。服务职责、
状态机与数据所有权见[总体架构](./docs/architecture/family-learning-tracker-architecture.md)。

## 本地快速开始

需要 Node.js 22、与 lockfile 匹配的 npm、Docker Engine 和 Docker Compose v2。

```bash
npm ci
npm ci --prefix frontend/web

# 让本地 Web 默认通过 8000 端口访问 Gateway
FAMILY_GATEWAY_HOST_PORT=8000 npm run docker:family
npm start --prefix frontend/web
```

Web 开发服务器默认地址为 `http://localhost:3000`，Gateway 为
`http://localhost:8000`。结束本地服务：

```bash
npm run docker:family:down
```

本地 Compose 的默认密钥只允许用于隔离开发和验收。局域网长期运行、Secret、
备份和恢复要求见[部署文档](./docs/deployment/README.md)。

## 验证

常用的聚焦验证命令：

```bash
npm run docs:family:check
npm run test:family-regression
npm run test:ci --prefix frontend/web -- --runInBand
npm run test:task11
```

发布候选必须从干净依赖开始执行完整门禁：

```bash
npm run release:family
```

该门禁覆盖文档契约、lint、后端与前端回归、Task 11 集成测试、生产构建、浏览器
E2E、Compose build/health、私有媒体 smoke 和 Git hygiene。单项测试通过不能替代
完整发布结论。

## 文档

- [项目文档入口](./docs/README.md)
- [产品需求](./docs/product/family-learning-tracker.md)
- [总体架构](./docs/architecture/family-learning-tracker-architecture.md)
- [API 契约](./docs/api/family-learning-tracker-api.md)
- [设计资产与需求追踪](./docs/development/family-growth-design-asset-index.md)
- [开发与测试](./docs/development/README.md)
- [部署与运维边界](./docs/deployment/README.md)
- [用户指南](./docs/user-guide/README.md)

拟议中的 DeepTutor、K12-KGraph 和家长人工审核学习扩展见
[家庭 AI 学习管理平台设计](./docs/architecture/family-ai-learning-platform-design.md)。
该设计当前不是已上线能力，也不改变上述家庭成长 MVP 的发布结论。

## 生产边界

仓库中的 Compose 和 Kubernetes 资产用于开发、验收和受控发布，不构成生产环境
已经上线的证明。生产部署仍需完成外部 Secret、TLS、容量评估、监控告警、备份
恢复、性能与安全扫描以及目标环境回滚演练。

## 许可证

MIT License
