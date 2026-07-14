# 家庭成长跟踪 v1.6 统一发布 Gate

**Gate status:** PASSED
**Baseline decision:** READY_FOR_REVIEW
**Implementation evidence commit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`
**Revalidated at:** 2026-07-14
**Canonical command:** `npm run release:family`

本文是 FGT-MVP-1.6 的当前统一质量证据。Task 5~11 Gate 保留各功能首次关闭时
的聚焦结果；本文证明七阶段修复后的同一提交可从 clean install 开始，通过文档、
代码、浏览器、镜像、健康检查和公开网关 smoke 的完整链路。Gate 通过不等于产品
批准，基线仍需独立技术评审和产品签署。

## 1. 可重复执行入口

```bash
npm run release:family
```

运行前提：

- Node.js 22 和与 lockfile 匹配的 npm；CI 与容器构建均以 Node 22 为准。
- Docker Engine 和 Docker Compose v2，且当前用户可创建镜像、网络、容器和卷。
- 可安装 Playwright Chromium；Linux CI 可设置
  `RELEASE_GATE_INSTALL_BROWSER_DEPS=1` 安装系统依赖。
- 可用的临时端口。脚本自动选择 gateway/MongoDB host port，避免固定端口冲突。
- 生产凭据不得写入仓库。Compose 默认值只用于隔离的本地验收。

Gate 将诊断写入默认目录 `release-gate-artifacts/`；也可以通过
`RELEASE_GATE_ARTIFACT_DIR` 指定其他目录。每次运行的
`release-gate-summary.txt` 记录退出状态和实际 `git rev-parse HEAD`，因此无需在
本文预写包含本文自身的未来合并哈希。

## 2. Gate 阶段与判定

| 顺序 | 阶段 | 通过条件 |
| --- | --- | --- |
| 1 | Root clean install | `npm ci` 严格按 root lockfile 完成 |
| 2 | Static quality | ESLint 9 对仓库当前范围零错误 |
| 3 | Documentation contract | 17 份权威文档本地链接有效、无未决占位标记，PRD/追踪/设计索引的 35 项 Requirement 集合一致 |
| 4 | Backend family regression | 70 suites / 756 tests 全部通过 |
| 5 | Task 11 integration | 4 suites / 6 tests 通过，真实服务/事务/隐私/跨角色契约成立 |
| 6 | Frontend clean install/test/build | `npm ci`、25 suites / 156 tests 和 production build 全部通过 |
| 7 | Browser E2E | 4 Chromium tests，1 worker、0 retries，通过 |
| 8 | Compose config/build | 配置可解析，7 个 Node.js 服务镜像全部从实际根上下文构建 |
| 9 | Runtime health | MongoDB 和 gateway/user/progress/homework/resource/analytics/notification 共 8 个服务健康；初始化容器成功退出 |
| 10 | Public smoke | 通过 gateway 注册家长、创建家庭和孩子、上传并绑定 91-byte PNG、取得签名 URL 并读取相同图片 |
| 11 | Repository hygiene | Gate 结束前工作树无未忽略的生成文件或改动 |

任一步骤非零退出都使 Gate 失败。脚本通过 `trap` 保存 Compose `ps`、聚合日志和
teardown 日志，再删除本次测试容器和网络；它明确不删除持久卷，避免把发布验证
变成数据清除命令。

## 3. 已核实运行

| 运行 | Commit | 结果 | 用途 |
| --- | --- | --- | --- |
| Stage 6 clean feature worktree | `646a54c3` | PASS | 证明发布脚本本身可在干净候选提交执行 |
| Stage 6 merged `main` | `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd` | PASS | 当前实现证据基准；69/752、4/6、25/156、4 Chromium、8 healthy、91-byte PNG 均来自此运行 |
| Stage 7 candidate and merged `main` | 本报告所在提交及其 merge commit | PASS | 文档契约纳入同一发布命令；70/755；实际提交由对应 artifacts summary 与 Git 历史确定 |
| Current documentation remediation candidate | 本报告当前提交 | PASS | 17 份权威文档、35 项需求、70/756；实际提交由本次 artifacts summary 与 Git 历史确定 |

前两次运行均从 clean worktree 启动。Stage 7 在合并前后使用同一命令再次执行，
从而证明新增文档扫描没有形成只在文档中声明、却未进入发布入口的旁路。

## 4. 七项审查问题的证据闭环

| 审查问题 | 代码/配置关闭 | 当前证据 |
| --- | --- | --- |
| 生产容器与媒体 composition 缺失 | 根上下文 Node 22 Dockerfile；resource/user/homework production app factory；Ubuntu/Family Compose | 镜像构建、8 service health、私有媒体 public smoke |
| 跨文档原子性与待发星星归档 | MongoDB transaction helper；Family/Child 与 mistake history 事务；关系修复命令；`STAR_AWARD_PENDING` guard | 回滚/故障注入/修复 dry-run 与状态冲突测试纳入 70/756 |
| API 契约漂移 | 共享 family contract；认证登出、家庭校验、提醒读取、孩子档案字段统一 | 服务契约和 Task 11 真实网关集成通过 |
| 家长功能缺口 | 孩子完整档案/头像和知识能力点工作流 | 聚焦 UI 测试、25/156、production build、Chromium 通过 |
| 静态与前端测试质量 | ESLint 9 flat config；console guard；异步导航和资源测试治理 | lint 零错误，frontend 无意外 warning/error |
| 发布过程不可复现 | 单一 `release:family` 命令、CI 同入口、诊断和安全 teardown | feature/main clean run 均通过 |
| 证据与基线过期 | 当前追踪矩阵、设计索引、部署指南、v1.6 manifest 和自动文档契约 | 35 项需求逐行 `COVERED`，17 份权威文档扫描通过 |

## 5. 失败处理和诊断

- 保留各阶段独立日志，先查看首个失败步骤，不能用后续局部成功覆盖整体失败。
- Compose 已启动时，无论成功、测试失败还是中断，都采集 `compose-family-ps.txt`
  和 `compose-family.log`，并执行 `down --remove-orphans`。
- teardown 自身失败会把最终状态改为失败，避免残留容器被静默忽略。
- Gate 不执行 `--volumes` 或 `-v`；需要删除验收卷时必须由操作者另行确认范围。
- `release-gate-summary.txt` 是运行索引，详细判定仍以各步骤日志为准。

## 6. 不由本 Gate 证明的事项

本 Gate 证明仓库内 MVP 的功能、契约、构建和本地可部署性，不证明某个生产集群
已经发布。目标环境仍须单独验收外部 Secret、TLS、托管或多成员 MongoDB、容量、
监控告警、备份恢复、灾备、k6/ZAP 策略及 Kubernetes 回滚。Safari、Firefox 和
原生移动客户端不在当前 Chromium MVP 矩阵。依赖审计告警和 CRA/Browserslist
升级属于独立维护工作，修订后必须重新运行本 Gate。

## 7. 审批边界

- 自动 Gate 的 `PASSED` 只表示证据完整。
- [v1.6 基线清单](./family-growth-baseline-v1.6-manifest.md) 必须保持
  `READY_FOR_REVIEW`，直至独立技术评审和产品负责人签署。
- 签署前若 `main` 在 `implementationEvidenceCommit` 之后发生行为、契约、依赖或
  部署变更，应在新提交重新运行 Gate，并更新证据基准。
