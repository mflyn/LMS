# 家庭成长配置与基础设施修订关闭记录

**Status:** VERIFIED
**Date:** 2026-07-12
**Scope:** Task 1-7 配置与基础设施评审遗漏的选择性迁移
**Branch:** `codex/task1-7-remediation-closure`

## 处理结论

| 编号 | 问题 | 处理 |
| --- | --- | --- |
| C-1 | Gateway 端口来源和默认值不一致 | 新增集中解析器，优先级为 `GATEWAY_PORT > PORT > config.port`；缺失或非法值在启动时失败 |
| C-2 | 敏感端点与普通端点使用同一限流强度 | 新增独立 `sensitiveLimiter`，用于注册、登录、儿童 PIN 登录和 PIN 更新 |
| C-3 | 仓库保留 `.env.backup` / `.env.new` | 删除两个文件，只保留 `.env.example` |
| C-4 | 本地完整栈包含学校版非必要服务 | 新增 `docker-compose.family.yml` 家庭最小栈，完整 Compose 继续承担兼容用途 |
| C-5 | 缺少家庭版快速启动入口 | 新增 `backend/Makefile` 和根目录 family Docker scripts |
| C-6 | `security.js` 与共享 app 安全配置重复 | 删除未被生产代码引用的重复模块 |

## 架构约束

- 完整 `docker-compose.yml` 和 China 版本显式设置 `DATA_SERVICE_URL` 并依赖 `data-service`，继续支持学校兼容接口。
- 家庭 Compose 和家庭 Kubernetes base 不配置 `DATA_SERVICE_URL`，Gateway 不挂载旧 `/api/data`。
- Kubernetes family base 排除 `interaction-service` 和 `data-service`；需要学校能力时必须通过独立 overlay 显式启用。
- notification-service 在家庭 Compose 中设置 `ENABLE_RABBITMQ=false`，避免为未部署的 RabbitMQ 建立重试循环。
- Gateway 统一使用 `GATEWAY_PORT=3000`；服务内部仍可接受 `PORT` 作为兼容回退。

## 对旧方案的修订

旧工作区方案建议替换 `xss-clean` 和 `express-mongo-sanitize`，理由是 Express 5 的只读 `req.query`。当前锁定依赖实际为 Express 4.22.2，该前提不成立，因此本次不替换全局 sanitizer，不扩大安全中间件变更范围。

当前 Gateway 已具备可注入的 `createApp/startServer` 生命周期边界。旧工作区中的整文件 Gateway 实现会回退这套架构，因此只迁移端口解析和可选 legacy data proxy 两项窄改。

## 已完成验证

| 检查 | 结果 |
| --- | --- |
| 配置 focused tests | 5 suites / 27 tests passed |
| `docker-compose.family.yml config --quiet` | passed |
| 完整 Compose + China Compose config | passed |
| `kubectl kustomize deployment/kubernetes` | passed，674 行 |
| family regression | 62 suites / 713 tests passed |
| Task 11 integration + browser | 4 suites / 6 tests；4 browser tests passed |

配置与基础设施修订已经在最新 `main` 基线的隔离分支上完成验证；合并通过 PR 执行，不直接操作原始脏工作区。
